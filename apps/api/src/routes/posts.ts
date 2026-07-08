import { Router } from "express";
import { z } from "zod";
import { prisma } from "@postpilot/db";
import { AuthedRequest, requireAuth } from "../middleware/auth";

export const postsRouter = Router();
postsRouter.use(requireAuth);

const postSchema = z.object({
  mediaId: z.string().uuid(),
  caption: z.string().max(2200),
  hashtags: z.array(z.string()).default([]),
});

postsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const media = await prisma.media.findFirst({
    where: { id: parsed.data.mediaId, userId: req.userId },
  });
  if (!media) return res.status(404).json({ error: "Media not found" });

  const post = await prisma.post.create({
    data: { ...parsed.data, userId: req.userId! },
    include: { media: true },
  });
  res.status(201).json({ post });
});

postsRouter.get("/", async (req: AuthedRequest, res) => {
  const posts = await prisma.post.findMany({
    where: { userId: req.userId },
    include: { media: true, schedules: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ posts });
});

postsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const post = await prisma.post.findFirst({
    where: { id: req.params.id, userId: req.userId },
    include: { media: true, schedules: { include: { targets: true } } },
  });
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json({ post });
});

postsRouter.put("/:id", async (req: AuthedRequest, res) => {
  const parsed = postSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.post.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Post not found" });

  const post = await prisma.post.update({
    where: { id: existing.id },
    data: parsed.data,
    include: { media: true },
  });
  res.json({ post });
});

postsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const existing = await prisma.post.findFirst({
    where: { id: req.params.id, userId: req.userId },
  });
  if (!existing) return res.status(404).json({ error: "Post not found" });

  await prisma.post.delete({ where: { id: existing.id } });
  res.status(204).send();
});
