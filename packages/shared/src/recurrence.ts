import { parseExpression } from "cron-parser";
import { DateTime } from "luxon";

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
      return addWallClockDays(after, config.timezone, config.interval || 1);
    case "WEEKLY":
      return addWallClockDays(after, config.timezone, 7 * (config.interval || 1));
    case "BIWEEKLY":
      // Always every 2 weeks by definition -- unlike WEEKLY, interval isn't consulted here.
      return addWallClockDays(after, config.timezone, 14);
    case "MONTHLY":
      return addWallClockMonths(after, config.timezone, config.interval || 1);
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

// Adding a fixed number of real days in local wall-clock time (rather than
// raw UTC) means a schedule anchored to e.g. 9am America/Vancouver keeps
// firing at 9am local across DST transitions, instead of drifting an hour.
// Exported since callers seeding multiple weeks' worth of startAt values
// (e.g. campaign import) need the same DST-safe day arithmetic.
export function addWallClockDays(date: Date, timezone: string, days: number): Date {
  return DateTime.fromJSDate(date, { zone: timezone }).plus({ days }).toJSDate();
}

/**
 * Finds the next occurrence of `weekday` (luxon convention: Monday=1 ...
 * Sunday=7) at `hour:minute` local time in `timezone`, strictly after `from`
 * -- e.g. "next Tuesday 9am America/Vancouver". If today is the target
 * weekday and the time hasn't passed yet, returns today.
 */
export function nextWeekdayAt(
  timezone: string,
  weekday: number,
  hour: number,
  minute: number,
  from: Date = new Date()
): Date {
  const nowLocal = DateTime.fromJSDate(from, { zone: timezone });
  const daysUntil = (weekday - nowLocal.weekday + 7) % 7;
  let candidate = nowLocal.plus({ days: daysUntil }).set({ hour, minute, second: 0, millisecond: 0 });
  if (candidate <= nowLocal) {
    candidate = candidate.plus({ weeks: 1 });
  }
  return candidate.toJSDate();
}

// Luxon's month arithmetic overflows past short months (Jan 31 + 1 month
// lands in March, not Feb 28) rather than clamping -- clamp explicitly to
// the target month's last day, matching how most scheduling UIs behave.
function addWallClockMonths(date: Date, timezone: string, months: number): Date {
  const start = DateTime.fromJSDate(date, { zone: timezone });
  const targetMonthStart = start.plus({ months }).startOf("month");
  const clampedDay = Math.min(start.day, targetMonthStart.daysInMonth ?? start.day);
  return targetMonthStart.set({ day: clampedDay, hour: start.hour, minute: start.minute, second: start.second, millisecond: start.millisecond }).toJSDate();
}
