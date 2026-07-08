import { Job } from "bullmq";
import { prisma } from "@postpilot/db";
import { metaClient } from "./metaClient";

function buildCaption(caption: string, hashtags: string[]): string {
  if (hashtags.length === 0) return caption;
  const tags = hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
  return `${caption}\n\n${tags}`;
}

export async function processPublishJob(job: Job<{ publishHistoryId: string }>) {
  const history = await prisma.publishHistory.findUniqueOrThrow({
    where: { id: job.data.publishHistoryId },
    include: {
      socialAccount: true,
      schedule: { include: { post: { include: { media: true } } } },
    },
  });

  const { post } = history.schedule;
  const { media } = post;
  const caption = buildCaption(post.caption, post.hashtags);

  const publishParams = { mediaUrl: media.url, mediaType: media.type, caption };

  const result =
    history.socialAccount.platform === "FACEBOOK"
      ? await metaClient.publishFacebookPost(
          history.socialAccount.externalId,
          history.socialAccount.accessToken,
          publishParams
        )
      : await metaClient.publishInstagramPost(
          history.socialAccount.externalId,
          history.socialAccount.accessToken,
          publishParams
        );

  await prisma.publishHistory.update({
    where: { id: history.id },
    data: { status: "SUCCESS", externalPostId: result.id, errorMessage: null },
  });
}

/** Called from the Worker's "failed" listener once BullMQ has exhausted all retry attempts. */
export async function markPublishJobFailed(publishHistoryId: string, errorMessage: string) {
  await prisma.publishHistory.update({
    where: { id: publishHistoryId },
    data: { status: "FAILED", errorMessage },
  });
}
