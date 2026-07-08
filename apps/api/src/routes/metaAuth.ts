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
 * JWT (since the eventual callback comes from facebook.com and can't carry
 * an Authorization header, the user id travels in a short-lived signed
 * `state` token instead).
 */
metaAuthRouter.get("/connect", (req, res) => {
  const token = String(req.query.token ?? "");
  let userId: string;
  try {
    userId = (jwt.verify(token, env.JWT_SECRET) as { sub: string }).sub;
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const state = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "10m" });

  const authorizeUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authorizeUrl.searchParams.set("client_id", env.META_APP_ID);
  authorizeUrl.searchParams.set("redirect_uri", env.META_REDIRECT_URI);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", META_OAUTH_SCOPES);
  authorizeUrl.searchParams.set("response_type", "code");

  res.redirect(authorizeUrl.toString());
});

/** Meta redirects here after the user approves the app. */
metaAuthRouter.get("/callback", async (req, res) => {
  const code = String(req.query.code ?? "");
  const state = String(req.query.state ?? "");

  let userId: string;
  try {
    userId = (jwt.verify(state, env.JWT_SECRET) as { sub: string }).sub;
  } catch {
    return res.status(401).send("Invalid or expired OAuth state");
  }

  try {
    const shortLived = await metaClient.exchangeCodeForToken(code, env.META_REDIRECT_URI);
    const longLived = await metaClient.getLongLivedUserToken(shortLived.access_token);
    const pages = await metaClient.getManagedPages(longLived.access_token);

    const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000);

    for (const page of pages) {
      await prisma.socialAccount.upsert({
        where: {
          userId_platform_externalId: {
            userId,
            platform: "FACEBOOK",
            externalId: page.id,
          },
        },
        create: {
          userId,
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
            userId_platform_externalId: {
              userId,
              platform: "INSTAGRAM",
              externalId: page.instagram_business_account.id,
            },
          },
          create: {
            userId,
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
