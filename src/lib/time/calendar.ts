import { Temporal } from 'temporal-polyfill'
import {
  addDays,
  fromPlainDate,
  startOfWeek,
  toPlainDate,
  type DateOnly,
  type LocalTime,
} from './dates'

export function isoWeekday(date: DateOnly): number {
  return toPlainDate(date).dayOfWeek // 1 = Monday … 7 = Sunday
}

export function startOfMonth(date: DateOnly): DateOnly {
  return fromPlainDate(toPlainDate(date).with({ day: 1 }))
}

export function endOfMonth(date: DateOnly): DateOnly {
  const p = toPlainDate(date)
  return fromPlainDate(p.with({ day: p.daysInMonth }))
}

export function addMonths(date: DateOnly, months: number): DateOnly {
  return fromPlainDate(toPlainDate(date).add({ months }))
}

export function daysBetween(from: DateOnly, to: DateOnly): number {
  return toPlainDate(from).until(toPlainDate(to), { largestUnit: 'days' }).days
}

/** Inclusive list of dates. Guarded so a bad range can never hang the UI. */
export function dateRange(from: DateOnly, to: DateOnly, maxDays = 3700): DateOnly[] {
  const out: DateOnly[] = []
  let cursor = from
  while (cursor <= to && out.length < maxDays) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}

export function weekDates(anchor: DateOnly): DateOnly[] {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

/** Month grid: Monday–Sunday weeks, only as many rows (4–6) as the month needs. */
export function monthGrid(anchor: DateOnly): DateOnly[][] {
  const first = startOfMonth(anchor)
  const last = endOfMonth(anchor)
  const gridStart = startOfWeek(first)
  const rows = Math.ceil((daysBetween(gridStart, last) + 1) / 7)
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: 7 }, (_, c) => addDays(gridStart, r * 7 + c)),
  )
}

export function isSameMonth(a: DateOnly, b: DateOnly): boolean {
  return a.slice(0, 7) === b.slice(0, 7)
}

export function yearOf(date: DateOnly): number {
  return toPlainDate(date).year
}

export function monthDayOf(date: DateOnly): { month: number; day: number } {
  const p = toPlainDate(date)
  return { month: p.month, day: p.day }
}

/** A date for a given month/day in `year`, or undefined when it does not exist (e.g. 29 Feb). */
export function dateInYear(year: number, month: number, day: number): DateOnly | undefined {
  try {
    return fromPlainDate(Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' }))
  } catch {
    return undefined
  }
}

export function timeToMinutes(time: LocalTime): number {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(total: number): LocalTime {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(total)))
  const h = String(Math.floor(clamped / 60)).padStart(2, '0')
  const m = String(clamped % 60).padStart(2, '0')
  return `${h}:${m}` as LocalTime
}

/** Half-open [start, end) overlap on minutes-of-day. Adjacent intervals do not overlap. */
export function overlapsMinutes(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end)
}
