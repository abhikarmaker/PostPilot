-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO', 'REEL');

-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('ONE_TIME', 'DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "social_accounts" (
    "id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3),
    "metaUserId" TEXT,
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "durationSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" TEXT NOT NULL,
    "mediaId" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "hashtags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "cronExpression" TEXT,
    "daysOfWeek" INTEGER[],
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "status" "ScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_targets" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,

    CONSTRAINT "schedule_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_history" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "socialAccountId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "status" "PublishStatus" NOT NULL DEFAULT 'PENDING',
    "externalPostId" TEXT,
    "errorMessage" TEXT,
    "runAt" TIMESTAMP(3) NOT NULL,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "social_accounts_platform_externalId_key" ON "social_accounts"("platform", "externalId");

-- CreateIndex
CREATE INDEX "schedules_status_nextRunAt_idx" ON "schedules"("status", "nextRunAt");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_targets_scheduleId_socialAccountId_key" ON "schedule_targets"("scheduleId", "socialAccountId");

-- CreateIndex
CREATE INDEX "publish_history_scheduleId_idx" ON "publish_history"("scheduleId");

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_targets" ADD CONSTRAINT "schedule_targets_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_targets" ADD CONSTRAINT "schedule_targets_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_history" ADD CONSTRAINT "publish_history_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_history" ADD CONSTRAINT "publish_history_socialAccountId_fkey" FOREIGN KEY ("socialAccountId") REFERENCES "social_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

