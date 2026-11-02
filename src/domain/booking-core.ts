import { instantMs } from '@/selectors/now'
import type { DateOnly, LocalTime } from '@/lib/time'
import { minutesToTime } from '@/lib/time/calendar'

/**
 * The one reservation-interval engine (COS-SPORTS-001 §3, COS-ESSENTIALS-001 §4). Washing machines,
 * badminton courts, tables and the rest all decide "is this slot allowed?" here, so the rules
 * (past slot, booking horizon, per-owner limit, overlap with capacity, turnover buffer) exist once.
 * Callers keep their own states, notices and policy values. This is a rule check inside one local
 * data source: it is not a cross-client lock and says nothing about physical vacancy.
 */

export interface BookingSpan {
  date: DateOnly
  start: LocalTime
  end: LocalTime
  /** The date the interval ends on. Set only when it crosses midnight; otherwise the same as `date`. */
  endDate?: DateOnly
}

export interface ActiveBooking {
  ownerId: string
  resourceId: string
  span: BookingSpan
}

export const spanMs = (s: BookingSpan) => ({
  start: instantMs(s.date, s.start),
  end: instantMs(s.endDate ?? s.date, s.end),
})

/** Half-open intervals overlap when max(start) < min(end). A turnover buffer widens one side. */
export function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
  bufferMs = 0,
): boolean {
  return a.start < b.end + bufferMs && b.start < a.end + bufferMs
}

/** Fixed-length slots from `fromMinutes` to `toMinutes` (minutes after local midnight). */
export function generateSlots(
  fromMinutes: number,
  toMinutes: number,
  slotMinutes: number,
): { start: LocalTime; end: LocalTime }[] {
  const out: { start: LocalTime; end: LocalTime }[] = []
  if (slotMinutes <= 0) return out
  for (let m = fromMinutes; m + slotMinutes <= toMinutes; m += slotMinutes)
    out.push({ start: minutesToTime(m), end: minutesToTime(m + slotMinutes) })
  return out
}

/**
 * Slots that may run past midnight. `fromMinutes`/`toMinutes` are minutes after the start day's
 * midnight, and `toMinutes` may exceed 1440 for an overnight window (e.g. 19:45 → 01:45 next day).
 * `dayOffset` is 0 for a start on the service date and 1 for a start after midnight.
 */
export function generateOvernightSlots(
  fromMinutes: number,
  toMinutes: number,
  slotMinutes: number,
): { startMin: number; endMin: number }[] {
  const out: { startMin: number; endMin: number }[] = []
  if (slotMinutes <= 0) return out
  for (let m = fromMinutes; m + slotMinutes <= toMinutes; m += slotMinutes)
    out.push({ startMin: m, endMin: m + slotMinutes })
  return out
}

export type SlotRefusal = 'invalid' | 'past' | 'beyondHorizon' | 'ownerLimit' | 'conflict'

export interface SlotCheckInput {
  span: BookingSpan
  nowMs: number
  today: DateOnly
  horizonDays: number
  ownerId: string
  resourceId: string
  /** Every active booking in the same data source. */
  active: readonly ActiveBooking[]
  /** How many upcoming active bookings one owner may hold in this group. */
  maxActivePerOwner: number
  /** Concurrent bookings a resource can hold. Exclusive resources use 1. */
  capacity?: number
  bufferMinutes?: number
  /** Restricts which active bookings count toward the owner limit (e.g. same activity). Default: all. */
  countsTowardLimit?: (b: ActiveBooking) => boolean
}

/** Returns why a slot cannot be booked, or null when it can. */
export function checkSlot(i: SlotCheckInput): SlotRefusal | null {
  const span = spanMs(i.span)
  // An end at or before the start (for example a missing next-day end date) is never guessed into shape.
  if (!(span.end > span.start)) return 'invalid'
  if (span.end <= i.nowMs) return 'past'
  const horizonEnd = instantMs(i.today, '23:59' as LocalTime) + i.horizonDays * 86_400_000
  if (span.start > horizonEnd) return 'beyondHorizon'
  const count = i.countsTowardLimit ?? (() => true)
  const mine = i.active.filter(
    (b) => b.ownerId === i.ownerId && count(b) && spanMs(b.span).end > i.nowMs,
  )
  if (mine.length >= i.maxActivePerOwner) return 'ownerLimit'
  const buffer = (i.bufferMinutes ?? 0) * 60_000
  const concurrent = i.active.filter(
    (b) => b.resourceId === i.resourceId && overlaps(span, spanMs(b.span), buffer),
  )
  if (concurrent.length >= (i.capacity ?? 1)) return 'conflict'
  return null
}
