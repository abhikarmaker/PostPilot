import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { env } from "../env";

const s3 = new S3Client({
  region: env.STORAGE_REGION,
  endpoint: env.STORAGE_ENDPOINT || undefined,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
});

/**
 * Generates a presigned PUT URL so the client can upload media directly to
 * object storage. Publishing to Meta requires a publicly reachable URL, so
 * the bucket (or STORAGE_PUBLIC_BASE_URL, e.g. a CDN in front of it) must
 * serve objects publicly.
 */
export async function createUploadUrl(fileExtension: string, contentType: string) {
  const key = `${randomUUID()}${fileExtension}`;

  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 300 }
  );

  const publicUrl = env.STORAGE_PUBLIC_BASE_URL
    ? `${env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : `https://${env.STORAGE_BUCKET}.s3.amazonaws.com/${key}`;

  return { key, uploadUrl, publicUrl };
}
