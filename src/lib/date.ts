export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

export function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  });
}

export interface CalendarCell {
  date: string | null; // YYYY-MM-DD, null for leading/trailing padding
  day: number | null;
}

/** Builds a Sun-start week grid for the given month, padded with blank cells. */
export function buildCalendarWeeks(month: string): CalendarCell[][] {
  const [y, m] = month.split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(y, m - 1, 1));
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const startWeekday = firstOfMonth.getUTCDay(); // 0 = Sunday

  const cells: CalendarCell[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ date: null, day: null });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${month}-${String(d).padStart(2, "0")}`, day: d });
  }
  while (cells.length % 7 !== 0) cells.push({ date: null, day: null });

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function todayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
