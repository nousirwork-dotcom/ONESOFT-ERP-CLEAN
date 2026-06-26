/**
 * dateUtils.ts — دوال تنسيق التاريخ الموحدة (ISO 8601: YYYY-MM-DD)
 */

export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d as string);
  if (isNaN(dt.getTime())) return "—";
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d as string);
  if (isNaN(dt.getTime())) return "—";
  return `${fmtDate(dt)} ${String(dt.getHours()).padStart(2, "0")}:${String(dt.getMinutes()).padStart(2, "0")}`;
}
