import { MetaGraphClient } from "@postpilot/shared";
import { env } from "./env";

export const metaClient = new MetaGraphClient({
  appId: env.META_APP_ID,
  appSecret: env.META_APP_SECRET,
});
