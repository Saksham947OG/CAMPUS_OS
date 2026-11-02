import { simulatedProvenance } from './chill-logic'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import type { Exam, Measure, Scenario, SeatAllocation, SharedStore } from './shared'
import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * Pure rules for COS-SHARED-001. A seating change is a simulated, versioned step that keeps every
 * earlier version and tells only the affected profile, without printing the seat in the message.
 * Scenarios are what-ifs: saving one never turns it into an observation.
 */
type Change<T> = CoreChange<SharedStore, T>
const ok = <T>(s: SharedStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)

export const examPath = (id: string) => `/academics/exams/${id}`
const ev = (id: string) => ({ id })

export interface SeatInput {
  hall?: string
  room?: string
  row?: string
  column?: string
  seat?: string
}
const clean = (i: SeatInput): SeatInput =>
  Object.fromEntries(
    Object.entries(i)
      .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
      .map(([k, v]) => [k, (v as string).trim()]),
  )

/** Simulated seating change. It never rewrites the exam's own date or time. */
export function changeSeat(
  s: SharedStore,
  examId: string,
  ownerProfileId: string,
  input: SeatInput,
  c: Ctx,
): Change<SeatAllocation> {
  const exam = s.exams.find((e) => e.id === examId)
  if (!exam) return fail('That exam was not found.')
  const fields = clean(input)
  if (Object.keys(fields).length === 0)
    return fail('Enter at least a hall, room, row, column or seat.')
  const existing = s.seats.filter((x) => x.examId === examId && x.ownerProfileId === ownerProfileId)
  const base = existing[0]
  const version = (base?.version ?? 0) + 1
  const next: SeatAllocation = {
    id: base?.id ?? c.newId('seat'),
    examId,
    ownerProfileId,
    ...fields,
    version,
    updatedAt: c.nowIso,
    needsVerification: false,
    sourceLabel: 'Fictional demo seat (not an official allotment)',
    provenance: simulatedProvenance(c.nowIso),
    history: [...(base?.history ?? []), { version, at: c.nowIso, ...fields }],
  }
  const seats = [
    ...s.seats.filter((x) => !(x.examId === examId && x.ownerProfileId === ownerProfileId)),
    next,
  ]
  const note = makeNotice(
    'shared',
    ownerProfileId,
    `${examId}`,
    ev(`seat-${next.id}-v${version}`),
    base ? 'Your exam seating changed (demo)' : 'Your exam seating was added (demo)',
    `${exam.name}: open the exam to see your seating. Details are not shown here.`,
    examPath(examId),
    'critical',
  )
  return ok({ ...s, seats }, next, [note])
}

/** Two allocations for one profile, exam and version are a contradiction. Both are flagged and neither is chosen. */
export function injectSeatConflict(
  s: SharedStore,
  examId: string,
  ownerProfileId: string,
  c: Ctx,
): Change<void> {
  const mine = s.seats.find((x) => x.examId === examId && x.ownerProfileId === ownerProfileId)
  if (!mine) return fail('That profile has no seating for this exam to contradict.')
  const rival: SeatAllocation = {
    ...mine,
    id: c.newId('seat'),
    hall: 'Demo Hall 9',
    row: '9',
    column: '9',
    needsVerification: true,
    history: [{ version: mine.version, at: c.nowIso, hall: 'Demo Hall 9', row: '9', column: '9' }],
  }
  return ok(
    {
      ...s,
      seats: [
        ...s.seats.map((x) => (x.id === mine.id ? { ...x, needsVerification: true } : x)),
        rival,
      ],
    },
    undefined,
  )
}

/** The simulator picks which allocation stands. The rest are dropped from the live list. */
export function resolveSeatConflict(s: SharedStore, seatId: string): Change<void> {
  const keep = s.seats.find((x) => x.id === seatId)
  if (!keep) return fail('That allocation was not found.')
  const seats = s.seats
    .filter(
      (x) =>
        !(x.examId === keep.examId && x.ownerProfileId === keep.ownerProfileId && x.id !== keep.id),
    )
    .map((x) => (x.id === keep.id ? { ...x, needsVerification: false } : x))
  return ok({ ...s, seats }, undefined)
}

/** Reschedules an exam (a simulated, versioned change). Every profile gets one critical, source-labelled notice. */
export function rescheduleExam(
  s: SharedStore,
  examId: string,
  patch: { date: DateOnly; startTime?: LocalTime },
  profileIds: readonly string[],
): Change<Exam> {
  const e = s.exams.find((x) => x.id === examId)
  if (!e) return fail('That exam was not found.')
  const next: Exam = {
    ...e,
    date: patch.date,
    ...(patch.startTime ? { startTime: patch.startTime } : { startTime: undefined }),
    status: 'changed',
    version: e.version + 1,
  }
  return ok(
    { ...s, exams: s.exams.map((x) => (x.id === e.id ? next : x)) },
    next,
    profileIds.map((p) =>
      makeNotice(
        'shared',
        p,
        e.id,
        ev(`exam-${e.id}-v${next.version}`),
        'Exam details changed (demo)',
        `${e.name} now has a different date. Open the exam for the details. This is a simulated change.`,
        examPath(e.id),
        'critical',
      ),
    ),
  )
}

/* ───────────────────────────── Time Tax scenarios ───────────────────────────── */

export interface ScenarioInput {
  serviceId: string
  measure: Measure
  baselineMinutes: number
  scenarioMinutes: number
  eligibleStudents: number
  visitsPerWeek: number
  adoptionPercent: number
  weeks: number
}

export function saveScenario(
  s: SharedStore,
  profileId: string,
  i: ScenarioInput,
  c: Ctx,
): Change<Scenario> {
  const nums = [
    i.baselineMinutes,
    i.scenarioMinutes,
    i.eligibleStudents,
    i.visitsPerWeek,
    i.adoptionPercent,
    i.weeks,
  ]
  if (nums.some((n) => !Number.isFinite(n) || n < 0))
    return fail('Every assumption must be a number that is zero or more.')
  if (i.adoptionPercent > 100) return fail('Adoption cannot be more than 100%.')
  if (!Number.isInteger(i.weeks) || i.weeks < 1)
    return fail('Use a whole number of weeks, at least 1.')
  const existing = s.scenarios.find(
    (x) => x.ownerProfileId === profileId && x.serviceId === i.serviceId,
  )
  const next: Scenario = {
    id: existing?.id ?? c.newId('scn'),
    ownerProfileId: profileId,
    ...i,
    eligibleStudents: Math.round(i.eligibleStudents),
    updatedAt: c.nowIso,
  }
  return ok({ ...s, scenarios: [...s.scenarios.filter((x) => x.id !== next.id), next] }, next)
}

/** Removes the profile's own what-if for a service. Sourced observations are a different record and are never touched. */
export function resetScenario(s: SharedStore, profileId: string, serviceId: string): Change<void> {
  return ok(
    {
      ...s,
      scenarios: s.scenarios.filter(
        (x) => !(x.ownerProfileId === profileId && x.serviceId === serviceId),
      ),
    },
    undefined,
  )
}
