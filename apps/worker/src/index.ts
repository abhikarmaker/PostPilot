import { env } from "./env";
import { Queue, Worker } from "bullmq";
import { connection, POLL_QUEUE_NAME, PUBLISH_QUEUE_NAME } from "./connection";
import { processDueSchedules } from "./pollProcessor";
import { markPublishJobFailed, processPublishJob } from "./publishProcessor";

const pollQueue = new Queue(POLL_QUEUE_NAME, { connection });
const publishQueue = new Queue(PUBLISH_QUEUE_NAME, { connection });

async function schedulePolling() {
  await pollQueue.add(
    "poll",
    {},
    {
      repeat: { pattern: env.POLL_CRON },
      jobId: "poll-due-schedules",
      removeOnComplete: 100,
      removeOnFail: 100,
    }
  );
}

const pollWorker = new Worker(
  POLL_QUEUE_NAME,
  async () => {
    const count = await processDueSchedules(publishQueue);
    if (count > 0) {
      // eslint-disable-next-line no-console
      console.log(`Dispatched ${count} due schedule(s) for publishing`);
    }
  },
  { connection }
);

const publishWorker = new Worker(
  PUBLISH_QUEUE_NAME,
  async (job) => processPublishJob(job),
  { connection, concurrency: 5 }
);

publishWorker.on("failed", async (job, error) => {
  if (!job) return;
  const attemptsExhausted = job.attemptsMade >= (job.opts.attempts ?? 1);
  if (attemptsExhausted) {
    await markPublishJobFailed(job.data.publishHistoryId, error.message);
    // eslint-disable-next-line no-console
    console.error(`Publish job ${job.id} failed permanently:`, error.message);
  }
});

pollWorker.on("failed", (job, error) => {
  // eslint-disable-next-line no-console
  console.error(`Poll job ${job?.id} failed:`, error.message);
});

schedulePolling()
  .then(() => console.log(`PostPilot worker running (poll cron: "${env.POLL_CRON}")`))
  .catch((error) => {
    console.error("Failed to schedule polling job", error);
    process.exit(1);
  });

async function shutdown() {
  await Promise.all([pollWorker.close(), publishWorker.close(), pollQueue.close(), publishQueue.close()]);
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
