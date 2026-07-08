import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  WEB_BASE_URL: z.string().default("http://localhost:3000"),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  ADMIN_PASSWORD: z.string().min(1, "ADMIN_PASSWORD is required"),
  META_APP_ID: z.string().default(""),
  META_APP_SECRET: z.string().default(""),
  META_REDIRECT_URI: z.string().default("http://localhost:4000/auth/meta/callback"),
  STORAGE_ENDPOINT: z.string().default(""),
  STORAGE_REGION: z.string().default("auto"),
  STORAGE_BUCKET: z.string().default("postpilot-media"),
  STORAGE_ACCESS_KEY_ID: z.string().default(""),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(""),
  STORAGE_PUBLIC_BASE_URL: z.string().default(""),
});

export const env = envSchema.parse(process.env);
