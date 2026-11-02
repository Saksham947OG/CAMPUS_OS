import type { Layer } from '@/domain/categories'
import type { LifecycleStatus, Provenance, Verification } from '@/domain/provenance'
import type { EventCategory, TaskState } from '@/domain/records'
import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * How an item sits on a day. Only `timed` occupies the hourly grid and can conflict. A deadline
 * with no `dueTime` is date-only and is never given an invented clock time.
 */
export type ItemTime =
  | { kind: 'timed'; start: LocalTime; end: LocalTime }
  | { kind: 'allDay' }
  | { kind: 'unknownTime' }
  | { kind: 'deadline'; dueTime?: LocalTime }

export type RecordKind = 'event' | 'series' | 'deadline' | 'task' | 'focus' | 'birthday' | 'booking'

/**
 * The single projection unit that Calendar views, Home widgets, conflicts and reminders all use.
 * `recordId` points at the canonical record; the item itself is never stored or edited.
 */
export interface CalendarItem {
  /** Stable occurrence identity: `<recordId>@<original date>` (DEC-021). */
  key: string
  recordId: string
  recordKind: RecordKind
  title: string
  category: EventCategory
  layer: Layer
  date: DateOnly
  time: ItemTime
  status: LifecycleStatus
  verification: Verification
  provenance: Provenance
  blocksTime: boolean
  /** Student-owned and editable from the Calendar (see COS-CAL-001 §7.3). */
  editable: boolean
  location?: string
  instructor?: string
  courseId?: string
  description?: string
  seriesId?: string
  taskState?: TaskState
  taskId?: string
  /** Present when this occurrence was moved: the original slot, so history is never invented. */
  changedFrom?: { date: DateOnly; start?: LocalTime; end?: LocalTime }
  changeReason?: string
  changeUpdatedAt?: string
  /** Owner-module route for records the Calendar must not edit (e.g. bookings). */
  manageRoute?: string
}

export const isTimed = (
  item: CalendarItem,
): item is CalendarItem & { time: { kind: 'timed'; start: LocalTime; end: LocalTime } } =>
  item.time.kind === 'timed'

export const isCancelled = (item: CalendarItem) => item.status === 'cancelled'

export function compareItems(a: CalendarItem, b: CalendarItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const aTimed = a.time.kind === 'timed'
  const bTimed = b.time.kind === 'timed'
  if (aTimed !== bTimed) return aTimed ? 1 : -1 // lane items first, then timed
  if (a.time.kind === 'timed' && b.time.kind === 'timed' && a.time.start !== b.time.start) {
    return a.time.start < b.time.start ? -1 : 1
  }
  if (a.title !== b.title) return a.title < b.title ? -1 : 1
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0
}
