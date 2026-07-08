# PostPilot

Recurring social media post scheduler for Facebook Pages and Instagram Professional
accounts, built on the Meta Graph API. Upload a post once, set a recurrence, and
PostPilot republishes it as a brand-new Facebook/Instagram post on schedule.

See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) for the full product spec and
long-term vision.

## Architecture

This is an npm-workspaces monorepo:

```
apps/
  web/     Next.js frontend — connect accounts, compose posts, manage schedules
  api/     Express REST API — auth, social accounts, media, posts, schedules, history
  worker/  BullMQ scheduler — polls due schedules and publishes via the Meta Graph API
packages/
  db/      Prisma schema + client shared by api and worker
  shared/  Recurrence engine, Meta Graph API client, shared types
```

**Scheduler flow**: the worker polls every minute (`POLL_CRON`) for schedules whose
`nextRunAt` has passed, immediately advances each schedule's `nextRunAt` (so a second
poll tick can't double-publish it), then enqueues one `publish` job per target social
account. Each publish job calls the Meta Graph API, retries on failure (BullMQ,
exponential backoff, 3 attempts), and records a `PublishHistory` row with the outcome.

## Prerequisites

- Node.js 20+
- Docker (for local Postgres + Redis), or your own instances
- A [Meta Developer App](https://developers.facebook.com/apps) with Facebook Login
  and the Pages/Instagram Graph API products added, plus a Facebook Page with a
  linked Instagram Professional account for testing

## Setup

```bash
npm install

# Start Postgres + Redis
docker compose up -d

# Configure env vars (fill in DATABASE_URL, JWT_SECRET, META_APP_ID/SECRET, storage creds)
cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env.local

# Create the database schema
npm run db:migrate
```

## Running

```bash
npm run dev:api     # http://localhost:4000
npm run dev:worker  # polls for due schedules and publishes
npm run dev:web     # http://localhost:3000
```

## Meta Graph API notes

- The Graph API publishes **new** posts — it cannot repost an existing post by ID.
  Each scheduled run creates a fresh Facebook/Instagram post from the stored media,
  caption, and hashtags.
- Instagram publishing requires a two-step container flow (create container, poll
  until processed, then publish) — see `packages/shared/src/metaGraphClient.ts`.
- Media must be reachable at a public URL for Meta to fetch it, so object storage
  (S3/R2) must serve uploaded files publicly, or sit behind a public CDN.
- The Graph API itself is free; only ad campaigns incur Meta charges.

## Database tables

`users`, `social_accounts`, `media`, `posts`, `schedules`, `schedule_targets`
(join table for multi-platform schedules), `publish_history`. See
`packages/db/prisma/schema.prisma` for the full schema.
