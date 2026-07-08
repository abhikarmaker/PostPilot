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

## Deploying for $0/month

Everything below is free-tier-forever, not a trial: an Oracle Cloud "Always
Free" VM for compute, Postgres/Redis/Caddy running as containers on that same
VM (no separate paid database), Cloudflare R2's free tier for media storage,
DuckDNS for free subdomains, and Caddy for free automatic HTTPS. The only
ongoing cost is the Meta Graph API itself, which is free.

### 1. Create the free VM

1. Sign up at [cloud.oracle.com](https://www.oracle.com/cloud/free/) (a card
   is required for identity verification but you won't be charged if you
   stay within the Always Free limits).
2. Create a Compute Instance using an **Ampere A1 (ARM) "Always Free"**
   shape — the free tier gives you up to 4 OCPUs / 24GB RAM, far more than
   this stack needs. Use the default Ubuntu image.
3. Assign it a **reserved (static) public IP** so it doesn't change on
   reboot (Networking → Reserved Public IPs — free, still within Always
   Free).
4. Open ports **80** and **443** to the internet: add ingress rules for both
   in the instance's **Security List / Network Security Group**, and also
   confirm the VM's own firewall allows them (Oracle's Ubuntu images ship
   with `iptables` rules that block everything but SSH by default — run
   `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` and the same for
   `443`, then persist with `sudo netfilter-persistent save` if available).
5. SSH in and install Docker:
   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER   # log out and back in after this
   sudo apt-get install -y docker-compose-plugin
   ```

### 2. Point two free DuckDNS subdomains at it

1. Sign in at [duckdns.org](https://www.duckdns.org) (free account, no card).
2. Register two subdomains, e.g. `yourname-app` and `yourname-api`, both
   pointed at your VM's reserved public IP.
3. These become `WEB_DOMAIN` and `API_DOMAIN` in your `.env` — Caddy will
   request free Let's Encrypt certificates for them automatically the first
   time it starts, as long as DNS is already pointing at the VM and ports
   80/443 are reachable.

### 3. Create a free Cloudflare R2 bucket

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com) and open
   **R2** (free tier: 10GB storage, no egress fees — plenty for personal
   Reels/photos).
2. Create a bucket (e.g. `postpilot-media`) and enable public access for it
   under the bucket's Settings → **Public access** (gives you a
   `pub-xxxxxxxx.r2.dev` URL — that's `STORAGE_PUBLIC_BASE_URL`).
3. Under **R2 → Manage API Tokens**, create a token with read/write access
   to the bucket — that gives you `STORAGE_ACCESS_KEY_ID` and
   `STORAGE_SECRET_ACCESS_KEY`.
4. Your account ID (visible on the R2 overview page) forms
   `STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com`.

### 4. Configure your Meta app and deploy

Follow "Setting up your Meta App" above, using
`https://<API_DOMAIN>/auth/meta/callback` as the OAuth redirect URI. Then:

```bash
git clone <this repo> postpilot && cd postpilot
cp .env.example .env
# Fill in: WEB_DOMAIN, API_DOMAIN, ADMIN_PASSWORD, JWT_SECRET,
# META_APP_ID/SECRET, and the STORAGE_* values from step 3.

docker compose up -d --build
```

This brings up Postgres, Redis, the API, the worker, the web dashboard, and
Caddy (which is the only container exposed to the internet, on 80/443).
Migrations apply automatically on startup. Visit `https://<WEB_DOMAIN>`, log
in with `ADMIN_PASSWORD`, and connect your Facebook Page under **Connected
Accounts**.

The first request to each domain may take a few seconds while Caddy
provisions its certificate — check `docker compose logs caddy` if a page
doesn't load right away.

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
