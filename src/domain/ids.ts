import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * Stable occurrence identity (DEC-021). One identity shape is used for URLs, reminder keys and
 * recurrence exceptions: `<seriesOrEventId>@<original local date>` with an optional `T<HH:mm>`
 * when a series can have several occurrences per day.
 */
export function occurrenceKey(seriesId: string, originalDate: DateOnly, originalTime?: LocalTime) {
  return originalTime
    ? `${seriesId}@${originalDate}T${originalTime}`
    : `${seriesId}@${originalDate}`
}
