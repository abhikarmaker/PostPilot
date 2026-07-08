import { Router } from "express";
import { z } from "zod";
import { prisma } from "@postpilot/db";
import { computeNextRunAt, RecurrenceType } from "@postpilot/shared";
import { requireAuth } from "../middleware/auth";

export const schedulesRouter = Router();
schedulesRouter.use(requireAuth);

const recurrenceTypes = [
  "ONE_TIME",
  "DAILY",
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "CUSTOM",
] as const;

const createScheduleSchema = z.object({
  postId: z.string().uuid(),
  socialAccountIds: z.array(z.string().uuid()).min(1),
  recurrenceType: z.enum(recurrenceTypes),
  interval: z.number().int().positive().default(1),
  cronExpression: z.string().optional(),
  timezone: z.string().default("UTC"),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional(),
});

schedulesRouter.post("/", async (req, res) => {
  const parsed = createScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const post = await prisma.post.findUnique({ where: { id: data.postId } });
  if (!post) return res.status(404).json({ error: "Post not found" });

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: data.socialAccountIds } },
  });
  if (accounts.length !== data.socialAccountIds.length) {
    return res.status(404).json({ error: "One or more social accounts not found" });
  }

  if (data.recurrenceType === "CUSTOM" && !data.cronExpression) {
    return res.status(400).json({ error: "cronExpression is required for CUSTOM recurrence" });
  }

  const schedule = await prisma.schedule.create({
    data: {
      postId: data.postId,
      recurrenceType: data.recurrenceType,
      interval: data.interval,
      cronExpression: data.cronExpression,
      timezone: data.timezone,
      startAt: new Date(data.startAt),
      endAt: data.endAt ? new Date(data.endAt) : undefined,
      nextRunAt: new Date(data.startAt),
      targets: {
        create: data.socialAccountIds.map((socialAccountId) => ({ socialAccountId })),
      },
    },
    include: { targets: { include: { socialAccount: true } } },
  });

  res.status(201).json({ schedule });
});

schedulesRouter.get("/", async (_req, res) => {
  const schedules = await prisma.schedule.findMany({
    include: {
      post: { include: { media: true } },
      targets: { include: { socialAccount: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ schedules });
});

schedulesRouter.get("/:id", async (req, res) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: {
      post: { include: { media: true } },
      targets: { include: { socialAccount: true } },
      history: { orderBy: { attemptedAt: "desc" }, take: 20 },
    },
  });
  if (!schedule) return res.status(404).json({ error: "Schedule not found" });
  res.json({ schedule });
});

const updateScheduleSchema = z.object({
  recurrenceType: z.enum(recurrenceTypes).optional(),
  interval: z.number().int().positive().optional(),
  cronExpression: z.string().optional(),
  timezone: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().nullable().optional(),
  socialAccountIds: z.array(z.string().uuid()).min(1).optional(),
});

schedulesRouter.put("/:id", async (req, res) => {
  const parsed = updateScheduleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const data = parsed.data;

  const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  if (data.socialAccountIds) {
    const accounts = await prisma.socialAccount.findMany({
      where: { id: { in: data.socialAccountIds } },
    });
    if (accounts.length !== data.socialAccountIds.length) {
      return res.status(404).json({ error: "One or more social accounts not found" });
    }
    await prisma.scheduleTarget.deleteMany({ where: { scheduleId: existing.id } });
    await prisma.scheduleTarget.createMany({
      data: data.socialAccountIds.map((socialAccountId) => ({
        scheduleId: existing.id,
        socialAccountId,
      })),
    });
  }

  const nextStartAt = data.startAt ? new Date(data.startAt) : existing.startAt;

  const schedule = await prisma.schedule.update({
    where: { id: existing.id },
    data: {
      recurrenceType: data.recurrenceType,
      interval: data.interval,
      cronExpression: data.cronExpression,
      timezone: data.timezone,
      startAt: data.startAt ? nextStartAt : undefined,
      endAt: data.endAt === null ? null : data.endAt ? new Date(data.endAt) : undefined,
      // Re-anchor the next run if the schedule's timing actually changed.
      nextRunAt: data.startAt ? nextStartAt : undefined,
    },
    include: { targets: { include: { socialAccount: true } } },
  });

  res.json({ schedule });
});

schedulesRouter.patch("/:id/pause", async (req, res) => {
  const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  const schedule = await prisma.schedule.update({
    where: { id: existing.id },
    data: { status: "PAUSED" },
  });
  res.json({ schedule });
});

schedulesRouter.patch("/:id/resume", async (req, res) => {
  const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  let nextRunAt = existing.nextRunAt ?? existing.startAt;
  const now = new Date();
  // Fast-forward past any occurrences missed while paused.
  while (nextRunAt < now) {
    const next = computeNextRunAt(
      {
        recurrenceType: existing.recurrenceType as RecurrenceType,
        interval: existing.interval,
        cronExpression: existing.cronExpression,
        timezone: existing.timezone,
      },
      nextRunAt
    );
    if (!next) break;
    nextRunAt = next;
  }

  const schedule = await prisma.schedule.update({
    where: { id: existing.id },
    data: { status: "ACTIVE", nextRunAt },
  });
  res.json({ schedule });
});

schedulesRouter.delete("/:id", async (req, res) => {
  const existing = await prisma.schedule.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Schedule not found" });

  await prisma.schedule.delete({ where: { id: existing.id } });
  res.status(204).send();
});
