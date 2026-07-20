import type { ResearchCalendarDay } from "./types";

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export interface ZonedClock {
  dateKey: string;
  isoWeekday: number;
  minutes: number;
}

export interface ResearchScheduleOccurrence {
  /** Calendar-local YYYY-MM-DD. This is the durable idempotency boundary. */
  scheduleDate: string;
  scheduledFor: string;
  ageDays: number;
}

const MAX_CARRY_FORWARD_DAYS = 30;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function getZonedClock(
  date: Date,
  timeZone: string
): ZonedClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const isoWeekday = WEEKDAY_TO_ISO[map.weekday];
  if (!isoWeekday) throw new Error(`Unsupported weekday: ${map.weekday}`);

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    isoWeekday,
    minutes: Number(map.hour) * 60 + Number(map.minute),
  };
}

export function runTimeToMinutes(runTime: string): number {
  const [hours, minutes] = runTime.split(":").map(Number);
  return hours * 60 + minutes;
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function isoWeekdayForDateKey(dateKey: string): number {
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function getZonedDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
  };
}

/** Convert a local wall-clock schedule to an instant without assuming a UTC offset. */
export function zonedScheduleToISOString(
  dateKey: string,
  runTime: string,
  timeZone: string
): string {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`Invalid schedule date: ${dateKey}`);
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = runTime.split(":").map(Number);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let candidate = new Date(desiredAsUtc);
  const attemptedCandidates: Date[] = [];

  // Offsets can change at DST boundaries. Re-evaluating converges for ordinary
  // and repeated wall-clock times without depending on the server timezone.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    attemptedCandidates.push(candidate);
    const observed = getZonedDateTimeParts(candidate, timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute
    );
    const correction = desiredAsUtc - observedAsUtc;
    if (correction === 0) return candidate.toISOString();
    candidate = new Date(candidate.getTime() + correction);
  }

  // A nonexistent DST wall-clock time is advanced to the first representable
  // instant after the gap. It remains bounded to its configured local date.
  attemptedCandidates.push(candidate);
  const afterGap = attemptedCandidates
    .map((attempted) => ({
      attempted,
      observed: getZonedDateTimeParts(attempted, timeZone),
    }))
    .filter(({ observed }) =>
      observed.year === year &&
      observed.month === month &&
      observed.day === day &&
      Date.UTC(year, month - 1, day, observed.hour, observed.minute) >=
        desiredAsUtc
    )
    .sort((left, right) => {
      const leftMinutes = left.observed.hour * 60 + left.observed.minute;
      const rightMinutes = right.observed.hour * 60 + right.observed.minute;
      return leftMinutes - rightMinutes;
    })[0];
  if (afterGap) return afterGap.attempted.toISOString();
  throw new Error(`Could not resolve ${dateKey} ${runTime} in ${timeZone}.`);
}

/**
 * Return unfiltered schedule occurrences that a daily poll may recover.
 *
 * One previous local day is always considered scheduler catch-up. This is
 * separate from editorial carry-forward and guarantees that a once-daily poll
 * which ran before an arbitrary configured run_time can dispatch it next day.
 * Older occurrences require the explicit carry-forward setting and are capped.
 */
export function listDueScheduleOccurrences(
  day: Pick<
    ResearchCalendarDay,
    | "weekday"
    | "enabled"
    | "run_time"
    | "allow_carry_forward"
    | "carry_forward_limit_days"
  >,
  date: Date,
  timeZone: string
): ResearchScheduleOccurrence[] {
  if (!day.enabled) return [];
  const clock = getZonedClock(date, timeZone);
  const configuredLookback = day.allow_carry_forward
    ? Math.min(
        Math.max(day.carry_forward_limit_days, 0),
        MAX_CARRY_FORWARD_DAYS
      )
    : 0;
  const lookbackDays = Math.max(1, configuredLookback);
  const occurrences: ResearchScheduleOccurrence[] = [];

  for (let ageDays = 0; ageDays <= lookbackDays; ageDays += 1) {
    const scheduleDate = shiftDateKey(clock.dateKey, -ageDays);
    if (isoWeekdayForDateKey(scheduleDate) !== day.weekday) continue;
    if (ageDays === 0 && clock.minutes < runTimeToMinutes(day.run_time)) {
      continue;
    }

    const scheduledFor = zonedScheduleToISOString(
      scheduleDate,
      day.run_time,
      timeZone
    );
    if (new Date(scheduledFor).getTime() > date.getTime()) continue;
    occurrences.push({ scheduleDate, scheduledFor, ageDays });
  }

  return occurrences.sort((left, right) =>
    left.scheduledFor.localeCompare(right.scheduledFor)
  );
}

export function isCalendarDayDue(
  day: Pick<ResearchCalendarDay, "weekday" | "enabled" | "run_time">,
  date: Date,
  timeZone: string
): boolean {
  if (!day.enabled) return false;
  const clock = getZonedClock(date, timeZone);
  return (
    clock.isoWeekday === day.weekday &&
    clock.minutes >= runTimeToMinutes(day.run_time)
  );
}

export function buildScheduleIdempotencyKey(
  calendarDayId: string,
  date: Date,
  timeZone: string
): string {
  return buildScheduleIdempotencyKeyForDate(
    calendarDayId,
    getZonedClock(date, timeZone).dateKey
  );
}

export function buildScheduleIdempotencyKeyForDate(
  calendarDayId: string,
  scheduleDate: string
): string {
  if (!DATE_KEY_PATTERN.test(scheduleDate)) {
    throw new Error(`Invalid schedule date: ${scheduleDate}`);
  }
  return `research:${calendarDayId}:${scheduleDate}`;
}
