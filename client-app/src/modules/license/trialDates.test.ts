import { describe, expect, it } from "vitest";
import { calendarDaysBetween, daysLeft } from "./trialDates";

describe("trial calendar day calculations", () => {
  it("shows exactly 180 days at the first install instant", () => {
    expect(daysLeft("2027-02-11", new Date("2026-08-15T04:16:00.000Z"))).toBe(180);
    expect(calendarDaysBetween("2026-08-15", "2027-02-11")).toBe(180);
  });

  it("decreases by one on the following calendar day", () => {
    expect(daysLeft("2027-02-11", new Date("2026-08-16T00:01:00.000Z"))).toBe(179);
  });

  it("shows zero on and after the expiry date", () => {
    expect(daysLeft("2027-02-11", new Date("2027-02-11T00:00:00.000Z"))).toBe(0);
    expect(daysLeft("2027-02-11", new Date("2027-02-12T00:00:00.000Z"))).toBe(0);
  });
});