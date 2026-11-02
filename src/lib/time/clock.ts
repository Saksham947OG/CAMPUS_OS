import { Temporal } from 'temporal-polyfill'
import { CAMPUS_TIMEZONE, fromPlainDate, type DateOnly } from './dates'

/**
 * The only way application code may learn "now". Components and selectors receive a Clock so
 * tests can pin time (incl. IST midnight edges) and a labelled demo-date override could be
 * added later without touching call sites.
 */
export interface Clock {
  now(): Temporal.Instant
}

export const systemClock: Clock = {
  now: () => Temporal.Now.instant(),
}

/** Test/demo helper. Accepts any ISO instant string, e.g. '2026-11-01T04:00:00Z'. */
export function fixedClock(iso: string): Clock {
  const instant = Temporal.Instant.from(iso)
  return { now: () => instant }
}

/** Current wall-clock date in the campus timezone — what "Today" means everywhere. */
export function todayIn(clock: Clock, timeZone: string = CAMPUS_TIMEZONE): DateOnly {
  return fromPlainDate(clock.now().toZonedDateTimeISO(timeZone).toPlainDate())
}

export function nowIn(clock: Clock, timeZone: string = CAMPUS_TIMEZONE): Temporal.ZonedDateTime {
  return clock.now().toZonedDateTimeISO(timeZone)
}
