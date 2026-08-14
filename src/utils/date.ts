// All helpers here operate on LOCAL calendar dates via the 3-arg Date constructor and
// getFullYear/getMonth/getDate — never toISOString()/UTC. Mixing in a UTC round-trip while
// stepping dates with setDate() silently drifts by a day across DST transitions.

export function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function todayISO(): string {
  return dateToISO(new Date())
}

export function addDays(iso: string, days: number): string {
  const d = isoToDate(iso)
  d.setDate(d.getDate() + days)
  return dateToISO(d)
}

export function formatDMY(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export function formatShort(iso: string): string {
  const d = isoToDate(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Monday-anchored ISO week key, e.g. "2026-W33" — used to bucket workouts per week.
export function isoWeekKey(iso: string): string {
  const d = isoToDate(iso)
  const day = (d.getDay() + 6) % 7 // 0 = Monday
  const monday = new Date(d)
  monday.setDate(d.getDate() - day)
  const jan1 = new Date(monday.getFullYear(), 0, 1)
  const weekNum = Math.ceil(((+monday - +jan1) / 86400000 + jan1.getDay() + 1) / 7)
  return `${monday.getFullYear()}-W${pad(weekNum)}`
}

export function startOfWeek(iso: string): string {
  const d = isoToDate(iso)
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return dateToISO(d)
}

// Points in a chronologically-sorted series where the calendar year advances, keyed by each
// point's chart label — used to draw "new year" reference lines on x-axes.
export function yearBoundaries<T extends { date: string; label: string }>(
  data: T[],
): { label: string; year: string }[] {
  const marks: { label: string; year: string }[] = []
  let lastYear: string | null = null
  for (const d of data) {
    const year = d.date.slice(0, 4)
    if (lastYear !== null && year !== lastYear) marks.push({ label: d.label, year })
    lastYear = year
  }
  return marks
}
