import type { Provenance } from '@/domain/provenance'
import type { Exam, SeatAllocation, SharedStore } from '@/domain/shared'
import { addDays, fixedClock, isoFromMs, type DateOnly, type LocalTime } from '@/lib/time'
import { makeNow } from '@/selectors/now'

const demo = (nowIso: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: 'Illustrative sample exam record (not a real exam)',
  updatedAt: nowIso,
})

/**
 * The starting Shared scenario: three fictional exams (one with a start time, two date-only) and
 * fictional seats. Demo profile B has a seat for every exam, profile A only for the first, and
 * the third exam has none for anyone, so "seating not provided" is visible. No real room, row or
 * roll number appears.
 */
export function initialSharedStore(nowMs: number): SharedStore {
  const nowIso = isoFromMs(nowMs)
  const today: DateOnly = makeNow(fixedClock(nowIso)).today
  const exam = (
    id: string,
    courseId: string,
    name: string,
    offset: number,
    startTime?: string,
  ): Exam => ({
    id,
    courseId,
    name,
    date: addDays(today, offset),
    ...(startTime ? { startTime: startTime as LocalTime } : {}),
    status: 'scheduled',
    version: 1,
    sourceLabel: 'Illustrative sample exam record (not a real exam)',
    provenance: demo(nowIso),
  })
  const seat = (
    id: string,
    examId: string,
    owner: string,
    hall: string,
    row: string,
    column: string,
  ): SeatAllocation => ({
    id,
    examId,
    ownerProfileId: owner,
    hall,
    row,
    column,
    version: 1,
    updatedAt: nowIso,
    needsVerification: false,
    sourceLabel: 'Fictional demo seat (not an official allotment)',
    provenance: demo(nowIso),
    history: [{ version: 1, at: nowIso, hall, row, column }],
  })
  return {
    schemaVersion: 1,
    exams: [
      exam('exam-1', 'course-a', 'Sample Course A: mid-term (demo)', 10),
      exam('exam-2', 'course-b', 'Sample Course B: quiz (demo)', 12, '10:00'),
      exam('exam-3', 'course-c', 'Sample Course C: mid-term (demo)', 14),
    ],
    seats: [
      seat('seat-a-1', 'exam-1', 'demo-student-a', 'Demo Hall 1', '3', '5'),
      seat('seat-b-1', 'exam-1', 'demo-student-b', 'Demo Hall 2', '1', '2'),
      seat('seat-b-2', 'exam-2', 'demo-student-b', 'Demo Hall 2', '4', '6'),
    ],
    scenarios: [],
  }
}
