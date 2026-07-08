# PostPilot

A personal tool to upload one of your own Reels/posts once and have it
automatically republish to your Facebook Page and Instagram account on a
recurring schedule (daily/weekly/monthly/custom). Built for a single owner —
not a multi-tenant product, no public sign-up.

See [`docs/PROJECT_BRIEF.md`](docs/PROJECT_BRIEF.md) for the original product
spec this was scaffolded from.

## Architecture

npm-workspaces monorepo:

```
apps/
  web/     Next.js dashboard — connect your accounts, compose posts, manage schedules
  api/     Express REST API — single-password login, Meta OAuth, media, posts, schedules
  worker/  BullMQ scheduler — polls due schedules and publishes via the Meta Graph API
packages/
  db/      Prisma schema + client shared by api and worker
  shared/  Recurrence engine, Meta Graph API client, shared types
```

There's one login (a password you set yourself, no user accounts/registration)
and every connected account, post, and schedule belongs to that one owner —
you.

**Scheduler flow**: the worker polls every minute (`POLL_CRON`) for schedules
whose `nextRunAt` has passed, advances each schedule's `nextRunAt` immediately
(so a second poll tick can't double-publish it), then enqueues one `publish`
job per target account. Each job calls the Meta Graph API, retries on failure
(3 attempts, exponential backoff), and logs the outcome to publish history.

## Setting up your Meta App (no App Review needed)

Meta's App Review + Business Verification process (weeks-long, built for
apps publishing on behalf of *other people's* Pages) does not apply here,
because you're only ever publishing to your own Page/Instagram account:

1. Create an app at [developers.facebook.com/apps](https://developers.facebook.com/apps)
   (type: "Business").
2. Add the **Facebook Login** and **Instagram Graph API** products.
3. Leave the app in **Development Mode**.
4. Under **App Roles → Roles**, add yourself (the Facebook account that
   manages your Page) as an **Admin** or **Developer**. Any account with a
   role on the app can authorize it without App Review, as long as the app
   stays in Development Mode.
5. Make sure your Instagram account is a **Professional (Business/Creator)**
   account linked to your Facebook Page.
6. Note your App ID and App Secret, and set the OAuth redirect URI to
   `https://<your-domain-or-ip>/auth/meta/callback` (or
   `http://localhost:4000/auth/meta/callback` while testing locally) under
   Facebook Login → Settings → Valid OAuth Redirect URIs.

If you ever want to publish to a Page you don't personally administer, that's
when Advanced Access and App Review come into play — not needed for this.

## Deploying on an always-on server (recommended)

Since the scheduler needs to keep running to fire posts on time, deploy this
to a small VPS (or a home server) with Docker rather than running it only
when your laptop happens to be open.

```bash
git clone <this repo> postpilot && cd postpilot
cp .env.example .env
# Edit .env: set ADMIN_PASSWORD, JWT_SECRET, META_APP_ID/SECRET, storage
# creds, and WEB_BASE_URL/NEXT_PUBLIC_API_BASE_URL to your server's
# public address (e.g. http://your-server-ip:3000 / :4000, or a domain).

docker compose up -d --build
```

This brings up Postgres, Redis, the API, the worker, and the web dashboard.
The API and worker automatically apply database migrations on startup, so
there's nothing else to run. Open `http://<your-server>:3000`, log in with
`ADMIN_PASSWORD`, and connect your Facebook Page under **Connected Accounts**.

Media you upload must end up at a **publicly reachable URL** — Meta fetches
it from there — so `STORAGE_*` should point at a real S3 bucket or
Cloudflare R2 bucket (with public read access), not local disk.

## Local development (without Docker)

```bash
npm install
docker compose up -d postgres redis   # just the two dependencies

cp packages/db/.env.example packages/db/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env.local

npm run db:migrate   # applies packages/db/prisma/migrations

npm run dev:api      # http://localhost:4000
npm run dev:worker
npm run dev:web       # http://localhost:3000
```

## Meta Graph API notes

- The Graph API publishes **new** posts — it cannot repost an existing post
  by ID. Each scheduled run creates a fresh Facebook/Instagram post from the
  stored media, caption, and hashtags.
- Instagram publishing uses a two-step container flow (create container, poll
  until processed, then publish) — see `packages/shared/src/metaGraphClient.ts`.
- The long-lived Page access token Meta issues lasts ~60 days as long as it's
  used periodically; if publishing ever starts failing with an auth error,
  just reconnect the account from the dashboard to refresh it.
- The Graph API itself is free; only ad campaigns incur Meta charges.

## Database tables

`social_accounts`, `media`, `posts`, `schedules`, `schedule_targets` (join
table for schedules targeting multiple accounts), `publish_history`. See
`packages/db/prisma/schema.prisma` for the full schema.
