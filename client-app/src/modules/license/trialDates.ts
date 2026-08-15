const MS_PER_DAY = 86_400_000;

function utcDateOnly(value: string): number {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function calendarDaysBetween(startDate: string, endDate: string): number {
  return Math.max(0, Math.floor((utcDateOnly(endDate) - utcDateOnly(startDate)) / MS_PER_DAY));
}

/**
 * Trial payloads contain date-only values. Calculate remaining calendar days
 * from today's UTC date so the first day of a 180-day trial is shown as 180,
 * not 181 because of the expiry date's end-of-day time.
 */
export function daysLeft(expiryDate: string, now = new Date()): number {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.floor((utcDateOnly(expiryDate) - today) / MS_PER_DAY));
}