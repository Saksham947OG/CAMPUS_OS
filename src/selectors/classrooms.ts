import type { ClassroomStore } from '@/domain/classrooms'
import { slotStatus } from '@/domain/classrooms-logic'
import { minutesToTime, type DateOnly } from '@/lib/time'

/**
 * How many rooms have a timetabled class or a held booking right now, out of every room on record. It reads
 * only the recorded schedule: a room outside its recorded window counts as not in use, and a booked room
 * can still be empty in real life.
 */
export function roomsInUse(
  s: ClassroomStore,
  date: DateOnly,
  minutes: number,
): { inUse: number; total: number } {
  const start = Math.min(minutes, 24 * 60 - 2)
  const span = { date, start: minutesToTime(start), end: minutesToTime(start + 1) }
  const inUse = s.rooms.filter((r) => {
    const k = slotStatus(s, r.id, span, '').kind
    return k === 'blocked' || k === 'booked'
  }).length
  return { inUse, total: s.rooms.length }
}
