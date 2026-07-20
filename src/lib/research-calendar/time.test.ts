import { describe, expect, it } from "vitest";

import {
  buildScheduleIdempotencyKey,
  buildScheduleIdempotencyKeyForDate,
  getZonedClock,
  isCalendarDayDue,
  listDueScheduleOccurrences,
  runTimeToMinutes,
  zonedScheduleToISOString,
} from "./time";

describe("research calendar time helpers", () => {
  it("calculates the local date, weekday, and minute across a date boundary", () => {
    const instant = new Date("2026-07-16T18:45:00.000Z");

    expect(getZonedClock(instant, "Asia/Kolkata")).toEqual({
      dateKey: "2026-07-17",
      isoWeekday: 5,
      minutes: 15,
    });
    expect(getZonedClock(instant, "UTC")).toEqual({
      dateKey: "2026-07-16",
      isoWeekday: 4,
      minutes: 18 * 60 + 45,
    });
  });

  it("converts a configured run time to minutes", () => {
    expect(runTimeToMinutes("09:30")).toBe(570);
    expect(runTimeToMinutes("00:05")).toBe(5);
  });

  it("marks only enabled matching days due at or after their local run time", () => {
    const day = { weekday: 1, enabled: true, run_time: "09:30" };

    expect(
      isCalendarDayDue(
        day,
        new Date("2026-07-13T04:00:00.000Z"),
        "Asia/Kolkata"
      )
    ).toBe(true);
    expect(
      isCalendarDayDue(
        day,
        new Date("2026-07-13T03:59:00.000Z"),
        "Asia/Kolkata"
      )
    ).toBe(false);
    expect(
      isCalendarDayDue(
        { ...day, weekday: 2 },
        new Date("2026-07-13T04:00:00.000Z"),
        "Asia/Kolkata"
      )
    ).toBe(false);
    expect(
      isCalendarDayDue(
        { ...day, enabled: false },
        new Date("2026-07-13T04:00:00.000Z"),
        "Asia/Kolkata"
      )
    ).toBe(false);
  });

  it("uses the calendar's local date in schedule idempotency keys", () => {
    const instant = new Date("2026-07-16T19:00:00.000Z");

    expect(
      buildScheduleIdempotencyKey("monday-research", instant, "Asia/Kolkata")
    ).toBe("research:monday-research:2026-07-17");
    expect(buildScheduleIdempotencyKey("monday-research", instant, "UTC")).toBe(
      "research:monday-research:2026-07-16"
    );
    expect(
      buildScheduleIdempotencyKeyForDate(
        "monday-research",
        "2026-07-13"
      )
    ).toBe("research:monday-research:2026-07-13");
  });

  it("catches an arbitrary run time at the next daily poll", () => {
    const day = {
      weekday: 1,
      enabled: true,
      run_time: "23:30",
      allow_carry_forward: false,
      carry_forward_limit_days: 0,
    };

    expect(
      listDueScheduleOccurrences(
        day,
        new Date("2026-07-13T03:30:00.000Z"),
        "Asia/Kolkata"
      )
    ).toEqual([]);
    expect(
      listDueScheduleOccurrences(
        day,
        new Date("2026-07-14T03:30:00.000Z"),
        "Asia/Kolkata"
      )
    ).toEqual([
      {
        scheduleDate: "2026-07-13",
        scheduledFor: "2026-07-13T18:00:00.000Z",
        ageDays: 1,
      },
    ]);
  });

  it("uses bounded carry-forward for older missed occurrences", () => {
    const base = {
      weekday: 1,
      enabled: true,
      run_time: "09:00",
      allow_carry_forward: true,
      carry_forward_limit_days: 3,
    };
    const thursday = new Date("2026-07-16T03:30:00.000Z");

    expect(
      listDueScheduleOccurrences(base, thursday, "Asia/Kolkata").map(
        (occurrence) => occurrence.scheduleDate
      )
    ).toEqual(["2026-07-13"]);
    expect(
      listDueScheduleOccurrences(
        { ...base, carry_forward_limit_days: 2 },
        thursday,
        "Asia/Kolkata"
      )
    ).toEqual([]);
  });

  it("resolves local schedules independently of the server timezone", () => {
    expect(
      zonedScheduleToISOString("2026-07-13", "09:00", "Asia/Kolkata")
    ).toBe("2026-07-13T03:30:00.000Z");
    expect(zonedScheduleToISOString("2026-07-13", "09:00", "UTC")).toBe(
      "2026-07-13T09:00:00.000Z"
    );
    expect(
      zonedScheduleToISOString(
        "2026-03-08",
        "02:30",
        "America/New_York"
      )
    ).toBe("2026-03-08T07:30:00.000Z");
  });
});
