import { Router } from "express";
import multer from "multer";
import AdmZip from "adm-zip";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@postpilot/db";
import { addWallClockDays, nextWeekdayAt } from "@postpilot/shared";
import { requireAuth } from "../middleware/auth";
import { uploadBuffer } from "../lib/storage";

export const campaignsRouter = Router();
campaignsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 },
});

const CAMPAIGN_TIMEZONE = "America/Vancouver";
const TUESDAY = 2;
const FRIDAY = 5;

const hashtagsField = z
  .union([z.array(z.string()), z.string()])
  .default([])
  .transform((value) =>
    Array.isArray(value)
      ? value
      : value
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean)
  );

const campaignEntrySchema = z.object({
  week: z.number().int().positive(),
  image: z.string().min(1),
  topic: z.string().min(1),
  fb_caption: z.string(),
  fb_hashtags: hashtagsField,
  ig_caption: z.string(),
  ig_hashtags: hashtagsField,
});

const campaignManifestSchema = z.array(campaignEntrySchema).min(1);

function guessContentType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "mp4") return "video/mp4";
  return "application/octet-stream";
}

function reelFilenameFor(imageFilename: string): string {
  return `${imageFilename.replace(/\.[^./]+$/, "")}-reel-audio.mp4`;
}

interface ImportedWeek {
  week: number;
  topic: string;
  imagePostId: string;
  reelPostId: string;
}

interface FailedWeek {
  week: number;
  mediaType: "image" | "reel";
  reason: string;
}

/**
 * Bulk-imports a recurring campaign from a zip (images/, reels/,
 * postpilot-content.json at the root). One image post + one Reel post per
 * week, each with platform-specific captions, scheduled every 8 weeks
 * forever (images Tuesdays, Reels Fridays, both 9am America/Vancouver).
 */
campaignsRouter.post("/import", upload.single("zip"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Missing zip file (field name: zip)" });

  let zip: AdmZip;
  try {
    zip = new AdmZip(req.file.buffer);
  } catch {
    return res.status(400).json({ error: "Could not read the uploaded file as a zip" });
  }

  const entriesByName = new Map(zip.getEntries().map((entry) => [entry.entryName.replace(/^\/+/, ""), entry]));

  // Tolerate the zip having a single wrapping top-level folder (common when
  // zipping via Finder/`zip -r folder/`) by resolving images/reels relative
  // to wherever postpilot-content.json actually landed, not assuming root.
  const manifestKey =
    [...entriesByName.keys()].find((name) => name === "postpilot-content.json") ??
    [...entriesByName.keys()].find((name) => name.endsWith("/postpilot-content.json"));
  if (!manifestKey) {
    return res.status(400).json({ error: "postpilot-content.json not found in zip" });
  }
  const manifestEntry = entriesByName.get(manifestKey)!;
  const rootPrefix = manifestKey.includes("/") ? manifestKey.slice(0, manifestKey.lastIndexOf("/") + 1) : "";

  let manifest: z.infer<typeof campaignManifestSchema>;
  try {
    const parsed = JSON.parse(manifestEntry.getData().toString("utf-8"));
    manifest = campaignManifestSchema.parse(parsed);
  } catch (error) {
    return res.status(400).json({
      error: "postpilot-content.json is invalid",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  const socialAccounts = await prisma.socialAccount.findMany();
  if (socialAccounts.length === 0) {
    return res.status(400).json({
      error: "No connected accounts. Connect a Facebook Page/Instagram account before importing a campaign.",
    });
  }

  const minWeek = Math.min(...manifest.map((entry) => entry.week));
  const imageBase = nextWeekdayAt(CAMPAIGN_TIMEZONE, TUESDAY, 9, 0);
  const reelBase = nextWeekdayAt(CAMPAIGN_TIMEZONE, FRIDAY, 9, 0);

  const imported: ImportedWeek[] = [];
  const failed: FailedWeek[] = [];

  for (const entry of manifest.sort((a, b) => a.week - b.week)) {
    const weekOffsetDays = (entry.week - minWeek) * 7;

    const imageEntry = entriesByName.get(`${rootPrefix}images/${entry.image}`);
    const reelFilename = reelFilenameFor(entry.image);
    const reelEntry = entriesByName.get(`${rootPrefix}reels/${reelFilename}`);

    if (!imageEntry) {
      failed.push({ week: entry.week, mediaType: "image", reason: `images/${entry.image} not found in zip` });
    } else {
      try {
        const { key, publicUrl } = await uploadBuffer(
          `campaign/${randomUUID()}-${entry.image}`,
          imageEntry.getData(),
          guessContentType(entry.image)
        );

        const imagePost = await prisma.$transaction(async (tx) => {
          const media = await tx.media.create({
            data: {
              type: "IMAGE",
              url: publicUrl,
              storageKey: key,
              mimeType: guessContentType(entry.image),
              width: 1080,
              height: 1080,
            },
          });
          const post = await tx.post.create({
            data: {
              mediaId: media.id,
              label: `Week ${entry.week}: ${entry.topic} (image)`,
              fbCaption: entry.fb_caption,
              fbHashtags: entry.fb_hashtags,
              igCaption: entry.ig_caption,
              igHashtags: entry.ig_hashtags,
            },
          });
          await tx.schedule.create({
            data: {
              postId: post.id,
              recurrenceType: "WEEKLY",
              interval: 8,
              timezone: CAMPAIGN_TIMEZONE,
              startAt: addWallClockDays(imageBase, CAMPAIGN_TIMEZONE, weekOffsetDays),
              nextRunAt: addWallClockDays(imageBase, CAMPAIGN_TIMEZONE, weekOffsetDays),
              targets: { create: socialAccounts.map((a) => ({ socialAccountId: a.id })) },
            },
          });
          return post;
        });

        imported.push({ week: entry.week, topic: entry.topic, imagePostId: imagePost.id, reelPostId: "" });
      } catch (error) {
        failed.push({
          week: entry.week,
          mediaType: "image",
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (!reelEntry) {
      failed.push({ week: entry.week, mediaType: "reel", reason: `reels/${reelFilename} not found in zip` });
      continue;
    }

    try {
      const { key, publicUrl } = await uploadBuffer(
        `campaign/${randomUUID()}-${reelFilename}`,
        reelEntry.getData(),
        guessContentType(reelFilename)
      );

      const reelPost = await prisma.$transaction(async (tx) => {
        const media = await tx.media.create({
          data: {
            type: "REEL",
            url: publicUrl,
            storageKey: key,
            mimeType: guessContentType(reelFilename),
            width: 1080,
            height: 1920,
            durationSeconds: 9,
          },
        });
        const post = await tx.post.create({
          data: {
            mediaId: media.id,
            label: `Week ${entry.week}: ${entry.topic} (reel)`,
            fbCaption: entry.fb_caption,
            fbHashtags: entry.fb_hashtags,
            igCaption: entry.ig_caption,
            igHashtags: entry.ig_hashtags,
          },
        });
        await tx.schedule.create({
          data: {
            postId: post.id,
            recurrenceType: "WEEKLY",
            interval: 8,
            timezone: CAMPAIGN_TIMEZONE,
            startAt: addWallClockDays(reelBase, CAMPAIGN_TIMEZONE, weekOffsetDays),
            nextRunAt: addWallClockDays(reelBase, CAMPAIGN_TIMEZONE, weekOffsetDays),
            targets: { create: socialAccounts.map((a) => ({ socialAccountId: a.id })) },
          },
        });
        return post;
      });

      const existing = imported.find((w) => w.week === entry.week);
      if (existing) {
        existing.reelPostId = reelPost.id;
      } else {
        imported.push({ week: entry.week, topic: entry.topic, imagePostId: "", reelPostId: reelPost.id });
      }
    } catch (error) {
      failed.push({
        week: entry.week,
        mediaType: "reel",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  res.status(imported.length > 0 ? 201 : 400).json({
    targetedAccounts: socialAccounts.map((a) => ({ platform: a.platform, name: a.name })),
    imported,
    failed,
  });
});
