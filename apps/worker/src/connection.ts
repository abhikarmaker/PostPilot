import type { ConnectionOptions } from "bullmq";
import { env } from "./env";

const parsed = new URL(env.REDIS_URL);

export const connection: ConnectionOptions = {
  host: parsed.hostname,
  port: Number(parsed.port || 6379),
  password: parsed.password || undefined,
  username: parsed.username || undefined,
  maxRetriesPerRequest: null,
};

export const POLL_QUEUE_NAME = "postpilot:poll-due-schedules";
export const PUBLISH_QUEUE_NAME = "postpilot:publish-post";
