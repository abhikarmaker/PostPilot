import "dotenv/config";

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  REDIS_URL: required("REDIS_URL", "redis://localhost:6379"),
  POLL_CRON: required("POLL_CRON", "* * * * *"),
  META_APP_ID: process.env.META_APP_ID ?? "",
  META_APP_SECRET: process.env.META_APP_SECRET ?? "",
};
