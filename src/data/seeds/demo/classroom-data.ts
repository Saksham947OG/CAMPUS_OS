import type { Provenance } from '@/domain/provenance'
import type { Blocker, ClassroomStore, Room } from '@/domain/classrooms'
import { isoFromMs, type LocalTime } from '@/lib/time'

const demo = (nowIso: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: 'Demonstration schedule (not a real college timetable)',
  updatedAt: nowIso,
})

/**
 * The starting classroom scenario. The four names are the owner's; everything else is illustrative:
 * which hours the schedule "covers", which classes block which room, and which room needs approval.
 * G12's demo schedule only covers the morning, so its afternoon is UNKNOWN rather than free. No
 * capacity, equipment or approval authority is stated, because none has been supplied.
 */
export function initialClassroomStore(nowMs: number): ClassroomStore {
  const nowIso = isoFromMs(nowMs)
  const T = (s: string) => s as LocalTime
  const src = 'Demonstration room record (not the real room)'
  const room = (r: Omit<Room, 'sourceLabel' | 'provenance'>): Room => ({
    ...r,
    sourceLabel: src,
    provenance: demo(nowIso),
  })
  const cls = (
    id: string,
    roomId: string,
    weekday: number,
    start: string,
    end: string,
    label = 'Scheduled class (demo)',
  ): Blocker => ({
    id,
    roomId,
    kind: 'class',
    weekday,
    start: T(start),
    end: T(end),
    label,
    provenance: demo(nowIso),
  })
  return {
    schemaVersion: 1,
    config: { slotMinutes: 60, horizonDays: 14, maxActivePerStudent: 2 },
    rooms: [
      room({
        id: 'CR_CONFERENCE_HALL',
        displayName: 'CR Conference Hall',
        kindLabel: 'Conference / presentation room',
        bookingMode: 'approval',
        knownWindow: { from: T('08:00'), to: T('20:00') },
      }),
      room({
        id: 'CR1',
        displayName: 'CR1',
        kindLabel: 'Classroom',
        bookingMode: 'instant',
        knownWindow: { from: T('08:00'), to: T('20:00') },
      }),
      room({
        id: 'CR3',
        displayName: 'CR3',
        kindLabel: 'Classroom',
        bookingMode: 'instant',
        knownWindow: { from: T('08:00'), to: T('20:00') },
      }),
      room({
        id: 'G12',
        displayName: 'G12',
        kindLabel: 'Classroom',
        bookingMode: 'instant',
        knownWindow: { from: T('08:00'), to: T('13:00') },
      }),
    ],
    blockers: [
      // Recurring classes the demo has mapped to a room (Mon–Fri). Unmapped classes block nothing.
      ...[1, 2, 3, 4, 5].flatMap((d) => [
        cls(`blk-cr1-${d}`, 'CR1', d, '09:00', '11:00'),
        cls(`blk-cr3-${d}`, 'CR3', d, '11:00', '12:00'),
      ]),
      cls('blk-g12-1', 'G12', 1, '08:00', '09:00'),
      cls('blk-hall-3', 'CR_CONFERENCE_HALL', 3, '14:00', '16:00', 'Scheduled event (demo)'),
    ],
    reservations: [],
  }
}
