import type { Interval } from '@/domain/availability'
import type { Meeting } from '@/domain/meetings'
import type { ProfileData } from '@/domain/records'
import type { ClassroomStore } from '@/domain/classrooms'
import type { DateOnly } from '@/lib/time'
import { isCancelled, isTimed } from './items'
import { itemsInRange } from './occurrences'
import { instantMs } from './now'

/**
 * Known busy time for one person: timed, time-blocking, uncancelled items, as bare instants. No title
 * leaves this function, so a private appointment contributes to planning without being shown.
 * Coverage is "unknown" when no timetable is recorded, so such a person is never assumed free.
 */
export function busyOf(
  data: ProfileData,
  from: DateOnly,
  to: DateOnly,
  ignoreRecordId?: string,
): { busy: Interval[]; coverage: 'known' | 'unknown' } {
  const busy = itemsInRange(data, from, to)
    .filter(isTimed)
    .filter((i) => i.blocksTime && !isCancelled(i) && i.recordId !== ignoreRecordId)
    .map((i) => ({ start: instantMs(i.date, i.time.start), end: instantMs(i.date, i.time.end) }))
  // A recorded timetable is what makes someone plannable: recurring classes, or a supplied schedule made of
  // dated timed events (the source-backed personas). A few personal events do not.
  const recorded =
    data.series.length > 0 ||
    data.events.some((e) => e.provenance.dataMode === 'provided' && e.timing.kind === 'timed')
  return { busy, coverage: recorded ? 'known' : 'unknown' }
}

/** What the room of a meeting really is, read from the one owner of the room record. */
export type RoomState = 'none' | 'confirmed' | 'pending' | 'notConfirmed'
export function roomStateOf(
  m: Pick<Meeting, 'roomReservationId'>,
  s: ClassroomStore | null,
): RoomState {
  if (!m.roomReservationId) return 'none'
  const r = s?.reservations.find((x) => x.id === m.roomReservationId)
  if (!r) return 'notConfirmed'
  return r.state === 'confirmedDemo'
    ? 'confirmed'
    : r.state === 'pendingApproval'
      ? 'pending'
      : 'notConfirmed'
}
