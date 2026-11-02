import { Temporal } from 'temporal-polyfill'
import { toPlainDate, type DateOnly, type LocalTime } from './dates'

const LOCALE = 'en-IN'

export function formatDateLong(date: DateOnly): string {
  return toPlainDate(date).toLocaleString(LOCALE, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatDateShort(date: DateOnly): string {
  return toPlainDate(date).toLocaleString(LOCALE, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

export function formatDayMonth(date: DateOnly): string {
  return toPlainDate(date).toLocaleString(LOCALE, { day: 'numeric', month: 'short' })
}

export function formatMonthYear(date: DateOnly): string {
  return toPlainDate(date).toLocaleString(LOCALE, { month: 'long', year: 'numeric' })
}

export function formatWeekday(date: DateOnly, style: 'short' | 'long' = 'short'): string {
  return toPlainDate(date).toLocaleString(LOCALE, { weekday: style })
}

export function dayOfMonth(date: DateOnly): number {
  return toPlainDate(date).day
}

export function formatTime(time: LocalTime): string {
  return Temporal.PlainTime.from(time).toLocaleString(LOCALE, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatTimeRange(start: LocalTime, end: LocalTime): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function formatRangeLabel(from: DateOnly, to: DateOnly): string {
  if (from === to) return formatDateLong(from)
  const a = toPlainDate(from)
  const b = toPlainDate(to)
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${a.toLocaleString(LOCALE, { month: 'long', year: 'numeric' })}`
  }
  return `${formatDayMonth(from)} – ${formatDayMonth(to)} ${b.year}`
}

export function monthName(month: number): string {
  return Temporal.PlainDate.from({ year: 2000, month, day: 1 }).toLocaleString(LOCALE, {
    month: 'long',
  })
}

/** "2 Nov, 10:00 am" for a stored ISO instant, in the campus timezone. */
export function formatInstant(iso: string): string {
  const z = Temporal.Instant.from(iso).toZonedDateTimeISO('Asia/Kolkata')
  return z.toLocaleString(LOCALE, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
