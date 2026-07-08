import { Router } from "express";
import { z } from "zod";
import { prisma } from "@postpilot/db";
import { requireAuth } from "../middleware/auth";
import { createUploadUrl } from "../lib/storage";

export const mediaRouter = Router();
mediaRouter.use(requireAuth);

const uploadUrlSchema = z.object({
  fileExtension: z.string().regex(/^\.[a-zA-Z0-9]+$/, "e.g. \".jpg\" or \".mp4\""),
  contentType: z.string(),
});

/** Step 1: client asks for a presigned URL to upload the raw file to storage. */
mediaRouter.post("/upload-url", async (req, res) => {
  const parsed = uploadUrlSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { key, uploadUrl, publicUrl } = await createUploadUrl(
    parsed.data.fileExtension,
    parsed.data.contentType
  );

  res.json({ key, uploadUrl, publicUrl });
});

const createMediaSchema = z.object({
  type: z.enum(["IMAGE", "VIDEO", "REEL"]),
  url: z.string().url(),
  storageKey: z.string(),
  mimeType: z.string().optional(),
  sizeBytes: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSeconds: z.number().optional(),
});

/** Step 2: client confirms the upload finished, creating the Media record. */
mediaRouter.post("/", async (req, res) => {
  const parsed = createMediaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const media = await prisma.media.create({ data: parsed.data });
  res.status(201).json({ media });
});

mediaRouter.get("/", async (_req, res) => {
  const media = await prisma.media.findMany({ orderBy: { createdAt: "desc" } });
  res.json({ media });
});
