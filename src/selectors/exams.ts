import { formatTime } from '@/lib/time'
import type { Exam, SeatAllocation, SharedStore } from '@/domain/shared'
import type { ProfileData } from '@/domain/records'

/** Courses this profile actually has, read off its own schedule and deadlines. Nothing is guessed. */
export function profileCourseIds(data: ProfileData): Set<string> {
  const ids = new Set<string>()
  for (const s of data.series) if (s.courseId) ids.add(s.courseId)
  for (const e of data.events) if (e.courseId) ids.add(e.courseId)
  for (const d of data.deadlines) if (d.courseId) ids.add(d.courseId)
  return ids
}

export const examsFor = (s: SharedStore, courseIds: Set<string>) =>
  s.exams
    .filter((e) => courseIds.has(e.courseId))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

/** This profile's own allocation(s) for an exam. More than one means they contradict each other. */
export const seatsFor = (s: SharedStore, profileId: string, examId: string): SeatAllocation[] =>
  s.seats.filter((x) => x.examId === examId && x.ownerProfileId === profileId)

export type SeatView =
  | { kind: 'none' }
  | { kind: 'conflict'; seats: SeatAllocation[] }
  | { kind: 'seat'; seat: SeatAllocation }

export function seatView(s: SharedStore, profileId: string, examId: string): SeatView {
  const mine = seatsFor(s, profileId, examId)
  if (mine.length === 0) return { kind: 'none' }
  if (mine.length > 1 || mine.some((x) => x.needsVerification))
    return { kind: 'conflict', seats: mine }
  return { kind: 'seat', seat: mine[0]! }
}

export const seatText = (x: Pick<SeatAllocation, 'hall' | 'room' | 'row' | 'column' | 'seat'>) =>
  [
    x.hall,
    x.room,
    x.row ? `row ${x.row}` : '',
    x.column ? `column ${x.column}` : '',
    x.seat ? `seat ${x.seat}` : '',
  ]
    .filter(Boolean)
    .join(', ')

export const examTimeText = (e: Exam) =>
  e.startTime ? `starts ${formatTime(e.startTime)}` : 'start time not provided'
