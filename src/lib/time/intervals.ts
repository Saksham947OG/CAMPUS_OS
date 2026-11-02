import { Temporal } from 'temporal-polyfill'

/** Half-open interval [start, end) over real instants (COS-CAL-001 §11). */
export interface Interval {
  readonly start: Temporal.Instant
  readonly end: Temporal.Instant
}

export function makeInterval(start: Temporal.Instant, end: Temporal.Instant): Interval {
  if (Temporal.Instant.compare(end, start) <= 0) {
    throw new RangeError('Interval end must be strictly after start')
  }
  return { start, end }
}

/**
 * Definite overlap: max(start1, start2) < min(end1, end2).
 * Adjacent intervals (one ends exactly when the other starts) do NOT overlap.
 */
export function overlaps(a: Interval, b: Interval): boolean {
  const latestStart = Temporal.Instant.compare(a.start, b.start) >= 0 ? a.start : b.start
  const earliestEnd = Temporal.Instant.compare(a.end, b.end) <= 0 ? a.end : b.end
  return Temporal.Instant.compare(latestStart, earliestEnd) < 0
}
