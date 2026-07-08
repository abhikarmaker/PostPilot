import { Queue } from "bullmq";
import { prisma } from "@postpilot/db";
import { computeNextRunAt, RecurrenceType } from "@postpilot/shared";

/**
 * Finds every ACTIVE schedule whose nextRunAt has arrived, advances its
 * recurrence bookkeeping, and enqueues one publish job per target social
 * account. Advancing nextRunAt *before* dispatching (rather than after
 * publishing) means an overlapping poll tick can't pick the same due
 * schedule up twice.
 */
export async function processDueSchedules(publishQueue: Queue) {
  const now = new Date();

  const dueSchedules = await prisma.schedule.findMany({
    where: { status: "ACTIVE", nextRunAt: { lte: now } },
    include: { targets: { include: { socialAccount: true } } },
  });

  for (const schedule of dueSchedules) {
    const runAt = schedule.nextRunAt ?? now;

    const nextRunAt = computeNextRunAt(
      {
        recurrenceType: schedule.recurrenceType as RecurrenceType,
        interval: schedule.interval,
        cronExpression: schedule.cronExpression,
        timezone: schedule.timezone,
      },
      runAt
    );

    const isFinalRun = !nextRunAt || (schedule.endAt !== null && nextRunAt > schedule.endAt);

    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        nextRunAt: isFinalRun ? null : nextRunAt,
        status: isFinalRun ? "COMPLETED" : "ACTIVE",
      },
    });

    for (const target of schedule.targets) {
      const history = await prisma.publishHistory.create({
        data: {
          scheduleId: schedule.id,
          socialAccountId: target.socialAccountId,
          platform: target.socialAccount.platform,
          status: "PENDING",
          runAt,
        },
      });

      await publishQueue.add(
        "publish",
        { publishHistoryId: history.id },
        { attempts: 3, backoff: { type: "exponential", delay: 30_000 } }
      );
    }
  }

  return dueSchedules.length;
}
