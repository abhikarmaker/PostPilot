-- Split the single shared caption/hashtags into per-platform fields, since
-- Facebook and Instagram captions need to differ for the same post.
ALTER TABLE "posts"
  ADD COLUMN "label" TEXT,
  ADD COLUMN "fbCaption" TEXT,
  ADD COLUMN "fbHashtags" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "igCaption" TEXT,
  ADD COLUMN "igHashtags" TEXT[] NOT NULL DEFAULT '{}';

-- Backfill existing rows from the old shared fields before they're dropped.
UPDATE "posts" SET "fbCaption" = "caption", "igCaption" = "caption";
UPDATE "posts" SET "fbHashtags" = "hashtags", "igHashtags" = "hashtags";

ALTER TABLE "posts"
  ALTER COLUMN "fbCaption" SET NOT NULL,
  ALTER COLUMN "igCaption" SET NOT NULL;

ALTER TABLE "posts"
  DROP COLUMN "caption",
  DROP COLUMN "hashtags";
