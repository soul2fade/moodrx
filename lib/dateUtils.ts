export const DAY_ABBREVS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;
export const MONTH_ABBREVS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;

/** Convert a timestamp to YYYY-MM-DD in local time */
export function toDateString(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Return today's YYYY-MM-DD in local time */
export function todayDateString(): string {
  return toDateString(Date.now());
}

/** Return yesterday's YYYY-MM-DD in local time — DST-safe */
export function yesterdayDateString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d.getTime());
}

/** Format today as "WED, 14 APR" */
export function formatTodayLabel(): string {
  const d = new Date();
  const dayName = DAY_ABBREVS[d.getDay()];
  const dayNum = String(d.getDate()).padStart(2, '0');
  const monthName = MONTH_ABBREVS[d.getMonth()];
  return `${dayName}, ${dayNum} ${monthName}`;
}
