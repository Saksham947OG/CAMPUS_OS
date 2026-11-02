import { Temporal } from 'temporal-polyfill'

/** Default campus timezone (COS-HOME-001 §2.1, COS-CAL-001 C-D15). */
export const CAMPUS_TIMEZONE = 'Asia/Kolkata'

declare const dateOnlyBrand: unique symbol
declare const localTimeBrand: unique symbol

/**
 * A calendar date with no time attached, `YYYY-MM-DD`. Date-only deadlines stay date-only:
 * there is deliberately no helper that turns a DateOnly into an instant without an explicit
 * LocalTime (never fabricate 23:59 — CLAUDE.md invariant).
 */
export type DateOnly = string & { readonly [dateOnlyBrand]: true }

/** A wall-clock time in the campus timezone, `HH:mm`. */
export type LocalTime = string & { readonly [localTimeBrand]: true }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isDateOnly(value: string): value is DateOnly {
  if (!DATE_RE.test(value)) return false
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' })
    return true
  } catch {
    return false
  }
}

export function parseDateOnly(value: string): DateOnly {
  if (!isDateOnly(value)) throw new RangeError(`Invalid date-only value: "${value}"`)
  return value
}

export function isLocalTime(value: string): value is LocalTime {
  return TIME_RE.test(value)
}

export function parseLocalTime(value: string): LocalTime {
  if (!isLocalTime(value)) throw new RangeError(`Invalid local time: "${value}"`)
  return value
}

export function toPlainDate(date: DateOnly): Temporal.PlainDate {
  return Temporal.PlainDate.from(date)
}

export function fromPlainDate(date: Temporal.PlainDate): DateOnly {
  return date.toString() as DateOnly
}

export function addDays(date: DateOnly, days: number): DateOnly {
  return fromPlainDate(toPlainDate(date).add({ days }))
}

/** Weeks run Monday–Sunday (COS-HOME-001 §2.1, COS-CAL-001 §3.1). */
export function startOfWeek(date: DateOnly): DateOnly {
  const plain = toPlainDate(date)
  return fromPlainDate(plain.subtract({ days: plain.dayOfWeek - 1 }))
}

export function compareDateOnly(a: DateOnly, b: DateOnly): number {
  return Temporal.PlainDate.compare(toPlainDate(a), toPlainDate(b))
}

/** Combine an explicit date and explicit time into a zoned instant. Both are required. */
export function toZonedDateTime(
  date: DateOnly,
  time: LocalTime,
  timeZone: string = CAMPUS_TIMEZONE,
): Temporal.ZonedDateTime {
  return toPlainDate(date).toZonedDateTime({ timeZone, plainTime: Temporal.PlainTime.from(time) })
}

/** ISO instant string (with offset) for an epoch-millisecond value. */
export function isoFromMs(ms: number): string {
  return Temporal.Instant.fromEpochMilliseconds(ms).toString()
}
