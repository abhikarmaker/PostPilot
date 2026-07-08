export type Platform = "FACEBOOK" | "INSTAGRAM";
export type MediaType = "IMAGE" | "VIDEO" | "REEL";
export type ScheduleStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type PublishStatus = "PENDING" | "SUCCESS" | "FAILED";

export interface CreatePostInput {
  mediaId: string;
  caption: string;
  hashtags: string[];
}

export interface CreateScheduleInput {
  postId: string;
  socialAccountIds: string[];
  recurrenceType:
    | "ONE_TIME"
    | "DAILY"
    | "WEEKLY"
    | "BIWEEKLY"
    | "MONTHLY"
    | "CUSTOM";
  interval?: number;
  cronExpression?: string;
  timezone?: string;
  startAt: string;
  endAt?: string;
}
