import { parseExpression } from "cron-parser";

export type RecurrenceType =
  | "ONE_TIME"
  | "DAILY"
  | "WEEKLY"
  | "BIWEEKLY"
  | "MONTHLY"
  | "CUSTOM";

export interface RecurrenceConfig {
  recurrenceType: RecurrenceType;
  interval: number;
  cronExpression?: string | null;
  timezone: string;
}

/**
 * Computes the next run time strictly after `after`, or null if the
 * schedule has no further occurrences (ONE_TIME already fired).
 */
export function computeNextRunAt(
  config: RecurrenceConfig,
  after: Date
): Date | null {
  switch (config.recurrenceType) {
    case "ONE_TIME":
      return null;
    case "DAILY":
      return addDays(after, config.interval || 1);
    case "WEEKLY":
      return addDays(after, 7 * (config.interval || 1));
    case "BIWEEKLY":
      return addDays(after, 14);
    case "MONTHLY":
      return addMonths(after, config.interval || 1);
    case "CUSTOM": {
      if (!config.cronExpression) {
        throw new Error("CUSTOM recurrence requires a cronExpression");
      }
      const interval = parseExpression(config.cronExpression, {
        currentDate: after,
        tz: config.timezone,
      });
      return interval.next().toDate();
    }
    default:
      throw new Error(`Unknown recurrence type: ${config.recurrenceType}`);
  }
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setUTCMonth(result.getUTCMonth() + months);
  return result;
}
