import { Router } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "@postpilot/db";
import { env } from "../env";
import { metaClient } from "../lib/metaClient";

export const metaAuthRouter = Router();

const META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "business_management",
].join(",");

/**
 * Starts the Meta OAuth flow. The browser is redirected here with a valid
 * dashboard session token (since the eventual callback comes from
 * facebook.com and can't carry an Authorization header, a short-lived
 * signed `state` nonce carries CSRF protection across the redirect instead).
 */
metaAuthRouter.get("/connect", (req, res) => {
  const token = String(req.query.token ?? "");
  try {
    jwt.verify(token, env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const state = jwt.sign({ purpose: "meta-oauth" }, env.JWT_SECRET, { expiresIn: "10m" });

  const authorizeUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authorizeUrl.searchParams.set("client_id", env.META_APP_ID);
  authorizeUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", META_OAUTH_SCOPES);
  authorizeUrl.searchParams.set("response_type", "code");

  res.redirect(authorizeUrl.toString());
});

/** Meta redirects here after you approve the app on your own Page/Instagram account. */
metaAuthRouter.get("/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");

  try {
    jwt.verify(state, env.JWT_SECRET);
  } catch {
    return res.status(401).send("Invalid or expired OAuth state");
  }

  try {
    const shortLived = await metaClient.exchangeCodeForToken(code, env.META_REDIRECT_URI);
    const longLived = await metaClient.getLongLivedUserToken(shortLived.access_token);
    const pages = await metaClient.getManagedPages(longLived.access_token);

    // Meta's fb_exchange_token grant normally returns expires_in (~60 days),
    // but sometimes omits it -- fall back to the documented long-lived
    // duration rather than producing an invalid Date.
    const META_LONG_LIVED_TOKEN_SECONDS = 60 * 24 * 60 * 60;
    const tokenExpiresAt = new Date(
      Date.now() + (longLived.expires_in ?? META_LONG_LIVED_TOKEN_SECONDS) * 1000
    );

    for (const page of pages) {
      await prisma.socialAccount.upsert({
        where: { platform_externalId: { platform: "FACEBOOK", externalId: page.id } },
        create: {
          platform: "FACEBOOK",
          externalId: page.id,
          name: page.name,
          accessToken: page.access_token,
          tokenExpiresAt,
        },
        update: {
          name: page.name,
          accessToken: page.access_token,
          tokenExpiresAt,
        },
      });

      if (page.instagram_business_account) {
        await prisma.socialAccount.upsert({
          where: {
            platform_externalId: {
              platform: "INSTAGRAM",
              externalId: page.instagram_business_account.id,
            },
          },
          create: {
            platform: "INSTAGRAM",
            externalId: page.instagram_business_account.id,
            name: `${page.name} (Instagram)`,
            accessToken: page.access_token,
            tokenExpiresAt,
          },
          update: {
            name: `${page.name} (Instagram)`,
            accessToken: page.access_token,
            tokenExpiresAt,
          },
        });
      }
    }

    res.redirect(`${env.WEB_BASE_URL}/connect?success=true`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Meta OAuth callback failed", error);
    res.redirect(`${env.WEB_BASE_URL}/connect?success=false`);
  }
});
