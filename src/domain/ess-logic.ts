import type { DateOnly, LocalTime } from '@/lib/time'
import { simulatedProvenance, userProvenance } from './chill-logic'
import { checkSlot, generateSlots, spanMs } from './booking-core'
import {
  fail,
  makeAudit,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import {
  ACTIVE_RESERVATION_STATES,
  LOAD_STAGES,
  type AuditEvent,
  type Confidence,
  type EssStore,
  type FeeStatus,
  type LaundryLoad,
  type LoadStage,
  type MessFee,
  type Parcel,
  type Reservation,
} from './ess'

/**
 * Pure rules for Campus Essentials (COS-ESSENTIALS-001). No clock, storage or React: callers pass
 * timestamps and ids in. Every change returns the next store plus the in-app notices it earned, so
 * a repository can persist first and announce second. Nothing advances on its own.
 */

export type { Failure, Notice, Ctx } from './service-core'
export type Change<T> = CoreChange<EssStore, T>

const ok = <T>(store: EssStore, value: T, notices: Notice[] = []): Change<T> =>
  coreOk(store, value, notices)
const audit = makeAudit
const notice = (
  recipientProfileId: string,
  entityId: string,
  event: AuditEvent,
  title: string,
  body: string,
  href: string,
  significance: Notice['significance'] = 'standard',
) => makeNotice('ess', recipientProfileId, entityId, event, title, body, href, significance)

/* ───────────────────────────── SS Laundry ───────────────────────────── */

export interface RegisterLoadInput {
  profileId: string
  handedOverDate: DateOnly
  handedOverTime?: LocalTime
  reference?: string
  itemCount?: number
  notes?: string
  collectionPoint?: string
  idempotencyKey: string
}

export const loadPath = (id: string) => `/services/laundry/ss/${id}`

/** A student registration. It is self-reported and says nothing about the provider having received anything. */
export function registerLoad(
  store: EssStore,
  input: RegisterLoadInput,
  c: Ctx,
): Change<{ load: LaundryLoad; created: boolean }> {
  const dup = store.loads.find(
    (l) => l.ownerProfileId === input.profileId && l.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(store, { load: dup, created: false })
  if (input.itemCount !== undefined && (!Number.isInteger(input.itemCount) || input.itemCount < 1))
    return fail('Item count must be a whole number of at least 1.')
  const id = c.newId('load')
  const ev = audit(id, 'student', 'registered', c, 'Registered by the student (self-reported)')
  const load: LaundryLoad = {
    id,
    ownerProfileId: input.profileId,
    handedOverDate: input.handedOverDate,
    ...(input.handedOverTime ? { handedOverTime: input.handedOverTime } : {}),
    ...(input.reference ? { reference: input.reference } : {}),
    ...(input.itemCount ? { itemCount: input.itemCount } : {}),
    ...(input.notes ? { notes: input.notes } : {}),
    ...(input.collectionPoint ? { collectionPoint: input.collectionPoint } : {}),
    stage: 'registered',
    delayFlag: false,
    discrepancyFlag: false,
    underReview: false,
    expectedReturnConfidence: 'unknown',
    studentReportedCollected: false,
    cancelled: false,
    idempotencyKey: input.idempotencyKey,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    version: 1,
    provenance: userProvenance(c.nowIso),
    history: [ev],
  }
  return ok({ ...store, loads: [load, ...store.loads] }, { load, created: true })
}

const replaceLoad = (store: EssStore, next: LaundryLoad): EssStore => ({
  ...store,
  loads: store.loads.map((l) => (l.id === next.id ? next : l)),
})

const bump = (
  l: LaundryLoad,
  ev: AuditEvent,
  patch: Partial<LaundryLoad>,
  c: Ctx,
): LaundryLoad => ({
  ...l,
  ...patch,
  updatedAt: c.nowIso,
  version: l.version + 1,
  history: [...l.history, ev],
})

const findLoad = (store: EssStore, id: string) => store.loads.find((l) => l.id === id)

/** The student may correct self-entered fields only while the load is still just `registered`. */
export function editRegisteredLoad(
  store: EssStore,
  profileId: string,
  loadId: string,
  patch: Partial<Pick<LaundryLoad, 'reference' | 'itemCount' | 'notes' | 'collectionPoint'>>,
  c: Ctx,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l || l.ownerProfileId !== profileId) return fail('That load was not found.')
  if (l.stage !== 'registered' || l.cancelled)
    return fail('Provider-recorded loads can no longer be edited by you.')
  const ev = audit(l.id, 'student', 'edited', c)
  const next = bump(l, ev, patch, c)
  return ok(replaceLoad(store, next), next)
}

/** Documented demo rule: a student can withdraw a registration only before any receipt is recorded. */
export function cancelRegisteredLoad(
  store: EssStore,
  profileId: string,
  loadId: string,
  c: Ctx,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l || l.ownerProfileId !== profileId) return fail('That load was not found.')
  if (l.stage !== 'registered')
    return fail('A load the provider has recorded can no longer be withdrawn here.')
  if (l.cancelled) return ok(store, l)
  const ev = audit(l.id, 'student', 'withdrawn', c, 'Withdrawn before any receipt was recorded')
  const next = bump(l, ev, { cancelled: true }, c)
  return ok(replaceLoad(store, next), next)
}

/** "I collected this": a self-report only. The stage changes only through a simulated handover. */
export function studentReportCollected(
  store: EssStore,
  profileId: string,
  loadId: string,
  c: Ctx,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l || l.ownerProfileId !== profileId) return fail('That load was not found.')
  if (l.stage !== 'readyForCollection' && l.stage !== 'returnedToCampus')
    return fail('You can report collecting a load once it is back on campus.')
  if (l.studentReportedCollected) return ok(store, l)
  const ev = audit(l.id, 'student', 'reportedCollected', c, 'Self-reported collection')
  const next = bump(l, ev, { studentReportedCollected: true }, c)
  return ok(replaceLoad(store, next), next)
}

const STAGE_NOTICE: Partial<Record<LoadStage, [string, string, Notice['significance']]>> = {
  received: ['Demo provider recorded your load', 'Receipt recorded on this device.', 'standard'],
  readyForCollection: [
    'Your laundry is ready (local)',
    'The local provider scenario marked it ready for collection.',
    'important',
  ],
  collected: ['Collection recorded (local)', 'A simulated handover was recorded.', 'standard'],
}

/** One step forward only. The simulator performs it; a provider visit never does. */
export function advanceLoad(
  store: EssStore,
  loadId: string,
  to: LoadStage,
  c: Ctx,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l) return fail('That load was not found.')
  if (l.cancelled) return fail('This registration was withdrawn.')
  const from = LOAD_STAGES.indexOf(l.stage)
  const target = LOAD_STAGES.indexOf(to)
  if (target !== from + 1) {
    return fail(
      l.stage === 'collected'
        ? 'This load is finished and can no longer change.'
        : `A load cannot go from “${l.stage}” to “${to}”. The next step is “${LOAD_STAGES[from + 1]}”.`,
    )
  }
  const ev = audit(l.id, 'demoSimulator', to, c)
  const next = bump(
    l,
    ev,
    {
      stage: to,
      ...(to === 'readyForCollection' || to === 'collected' ? { delayFlag: false } : {}),
    },
    c,
  )
  const n = STAGE_NOTICE[to]
  return ok(
    replaceLoad(store, next),
    next,
    n ? [notice(l.ownerProfileId, l.id, ev, n[0], n[1], loadPath(l.id), n[2])] : [],
  )
}

/** A delay overlay. With no date, the return stays "unknown"; a supplied date keeps its stated confidence. */
export function setLoadDelay(
  store: EssStore,
  loadId: string,
  delayed: boolean,
  c: Ctx,
  expected?: { date: DateOnly; confidence: Confidence },
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l) return fail('That load was not found.')
  if (l.stage === 'collected' || l.cancelled) return fail('This load is finished.')
  const ev = audit(
    l.id,
    'demoSimulator',
    delayed ? 'delayed' : 'delayCleared',
    c,
    delayed && !expected ? 'No new date given' : undefined,
  )
  const next = bump(
    l,
    ev,
    {
      delayFlag: delayed,
      ...(delayed && expected
        ? { expectedReturnDate: expected.date, expectedReturnConfidence: expected.confidence }
        : {}),
      ...(delayed && !expected
        ? { expectedReturnDate: undefined, expectedReturnConfidence: 'unknown' as const }
        : {}),
    },
    c,
  )
  const notices = delayed
    ? [
        notice(
          l.ownerProfileId,
          l.id,
          ev,
          'Your laundry is delayed (local)',
          expected
            ? `New date ${expected.confidence === 'confirmed' ? 'confirmed' : 'tentative'}.`
            : 'New date unknown. Awaiting confirmation.',
          loadPath(l.id),
          'important',
        ),
      ]
    : []
  return ok(replaceLoad(store, next), next, notices)
}

/** `returnScheduled` is an expectation, not proof of physical movement, so it never changes the stage. */
export function scheduleLoadReturn(
  store: EssStore,
  loadId: string,
  date: DateOnly,
  confidence: Confidence,
  c: Ctx,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l) return fail('That load was not found.')
  if (l.stage === 'collected' || l.cancelled) return fail('This load is finished.')
  const ev = audit(l.id, 'demoSimulator', 'returnScheduled', c, `${confidence} date`)
  const next = bump(l, ev, { expectedReturnDate: date, expectedReturnConfidence: confidence }, c)
  return ok(replaceLoad(store, next), next, [
    notice(
      l.ownerProfileId,
      l.id,
      ev,
      'Return date updated (local)',
      `Expected ${date} (${confidence}). This is an expectation, not proof the laundry moved.`,
      loadPath(l.id),
    ),
  ])
}

/** Partial return: flag a discrepancy and never close the outstanding part as fully collected. */
export function setLoadDiscrepancy(
  store: EssStore,
  loadId: string,
  flagged: boolean,
  c: Ctx,
  noteText?: string,
): Change<LaundryLoad> {
  const l = findLoad(store, loadId)
  if (!l) return fail('That load was not found.')
  if (l.cancelled) return fail('This registration was withdrawn.')
  const ev = audit(
    l.id,
    'demoSimulator',
    flagged ? 'discrepancyFlagged' : 'discrepancyResolved',
    c,
    noteText,
  )
  const next = bump(
    l,
    ev,
    {
      discrepancyFlag: flagged,
      underReview: flagged,
      discrepancyNote: flagged ? (noteText ?? 'Part of the load has not been returned') : undefined,
    },
    c,
  )
  return ok(
    replaceLoad(store, next),
    next,
    flagged
      ? [
          notice(
            l.ownerProfileId,
            l.id,
            ev,
            'Laundry discrepancy flagged (local)',
            'Part of your load may be outstanding. It is under review.',
            loadPath(l.id),
            'important',
          ),
        ]
      : [],
  )
}

/* ───────────────────────────── Provider visit ───────────────────────────── */

export interface VisitInput {
  status: 'tentative' | 'confirmed' | 'rescheduled' | 'cancelled'
  date?: DateOnly
  windowStart?: LocalTime
  windowEnd?: LocalTime
}

const VISIT_HREF = '/services/laundry/ss'

/** A visit announcement is global and never touches an individual load. */
export function announceVisit(
  store: EssStore,
  input: VisitInput,
  profileIds: readonly string[],
  c: Ctx,
): Change<void> {
  const version = (store.visit?.version ?? 0) + 1
  const visit = {
    status: input.status,
    ...(input.date ? { date: input.date } : {}),
    ...(input.windowStart ? { windowStart: input.windowStart } : {}),
    ...(input.windowEnd ? { windowEnd: input.windowEnd } : {}),
    ...(store.visit?.arrivedAt && input.status !== 'cancelled'
      ? { arrivedAt: store.visit.arrivedAt }
      : {}),
    sourceLabel: 'Demo simulator (not a real provider schedule)',
    asOf: c.nowIso,
    version,
    provenance: simulatedProvenance(c.nowIso),
  }
  const ev = audit('visit', 'demoSimulator', `visit-${input.status}-v${version}`, c)
  return ok(
    { ...store, visit },
    undefined,
    profileIds.map((p) =>
      notice(
        p,
        'visit',
        ev,
        'SS Laundry visit update (local)',
        input.status === 'cancelled'
          ? 'The demo visit was cancelled.'
          : `Visit ${input.status}${input.date ? ` for ${input.date}` : ''}. Individual loads are separate.`,
        VISIT_HREF,
      ),
    ),
  )
}

/** Records that the provider is on campus. It deliberately changes no individual load. */
export function recordVisitArrival(store: EssStore, c: Ctx): Change<void> {
  if (!store.visit || store.visit.status === 'cancelled') return fail('Announce a visit first.')
  return ok({ ...store, visit: { ...store.visit, arrivedAt: c.nowIso, asOf: c.nowIso } }, undefined)
}

/* ───────────────────────────── Machines ───────────────────────────── */

export const slotsForDay = (slotMinutes: number) => generateSlots(8 * 60, 22 * 60, slotMinutes)

const resMs = spanMs

export const isActiveReservation = (r: Reservation) => ACTIVE_RESERVATION_STATES.includes(r.state)

export const reservationPath = () => '/services/laundry/machines'

export interface ReserveInput {
  profileId: string
  machineId: string
  date: DateOnly
  start: LocalTime
  idempotencyKey: string
  today: DateOnly
  nowMs: number
}

export function reserveMachine(
  store: EssStore,
  input: ReserveInput,
  c: Ctx,
): Change<{ reservation: Reservation; created: boolean }> {
  const dup = store.reservations.find(
    (r) => r.ownerProfileId === input.profileId && r.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(store, { reservation: dup, created: false })
  const machine = store.machines.find((m) => m.id === input.machineId)
  if (!machine) return fail('That machine was not found.')
  if (machine.operationalStatus !== 'working')
    return fail(
      machine.operationalStatus === 'outOfService'
        ? 'This machine is out of service, so new bookings are paused.'
        : 'This machine’s working status is unknown, so it cannot be booked.',
    )
  const slot = slotsForDay(store.rules.slotMinutes).find((s) => s.start === input.start)
  if (!slot) return fail('That is not one of the demo time slots.')
  const refusal = checkSlot({
    span: { date: input.date, start: slot.start, end: slot.end },
    nowMs: input.nowMs,
    today: input.today,
    horizonDays: store.rules.horizonDays,
    ownerId: input.profileId,
    resourceId: machine.id,
    active: store.reservations
      .filter(isActiveReservation)
      .map((r) => ({ ownerId: r.ownerProfileId, resourceId: r.machineId, span: r })),
    maxActivePerOwner: store.rules.maxActivePerStudent,
  })
  if (refusal === 'invalid')
    return fail('That time range is not valid: it must end after it starts.')
  if (refusal === 'past') return fail('That slot has already finished.')
  if (refusal === 'beyondHorizon')
    return fail(`Bookings open up to ${store.rules.horizonDays} days ahead on this device.`)
  if (refusal === 'ownerLimit')
    return fail(
      `This demo allows ${store.rules.maxActivePerStudent} upcoming machine booking at a time. Cancel or finish your current one first.`,
    )
  if (refusal === 'conflict') return fail('That slot is already reserved in this reference data.')
  const id = c.newId('res')
  const ev = audit(id, 'student', 'reserved', c)
  const reservation: Reservation = {
    id,
    ownerProfileId: input.profileId,
    machineId: machine.id,
    date: input.date,
    start: slot.start,
    end: slot.end,
    state: 'reserved',
    idempotencyKey: input.idempotencyKey,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    version: 1,
    provenance: userProvenance(c.nowIso),
    history: [ev],
  }
  return ok(
    { ...store, reservations: [reservation, ...store.reservations] },
    { reservation, created: true },
    [
      notice(
        input.profileId,
        id,
        ev,
        'Machine reserved (local)',
        `${machine.label}, ${input.date} ${slot.start}. A local reservation, not a campus booking.`,
        reservationPath(),
      ),
    ],
  )
}

export type ReservationAction =
  'cancel' | 'checkIn' | 'startCycle' | 'finish' | 'noShow' | 'blockedByOutage'

const replaceRes = (store: EssStore, next: Reservation): EssStore => ({
  ...store,
  reservations: store.reservations.map((r) => (r.id === next.id ? next : r)),
})

/** State changes for one reservation. Reservation state is never physical state. */
export function actOnReservation(
  store: EssStore,
  reservationId: string,
  action: ReservationAction,
  actor: 'student' | 'demoSimulator',
  c: Ctx,
  opts: { profileId?: string; nowMs: number },
): Change<Reservation> {
  const r = store.reservations.find((x) => x.id === reservationId)
  if (!r) return fail('That reservation was not found.')
  if (actor === 'student' && r.ownerProfileId !== opts.profileId)
    return fail('That reservation was not found.')
  const studentOnly =
    action === 'cancel' || action === 'checkIn' || action === 'startCycle' || action === 'finish'
  if (studentOnly && actor !== 'student') return fail('Only the student can do that.')
  if (!studentOnly && actor !== 'demoSimulator') return fail('Only the demo simulator can do that.')

  let to: Reservation['state']
  let patch: Partial<Reservation> = {}
  switch (action) {
    case 'cancel':
      if (r.state !== 'reserved')
        return fail('Only a reservation that has not started can be cancelled.')
      to = 'cancelled'
      break
    case 'checkIn':
      if (r.state !== 'reserved')
        return fail('You can check in to a reservation that is still reserved.')
      if (opts.nowMs < resMs(r).start - 15 * 60_000)
        return fail('Check-in opens 15 minutes before the slot.')
      if (opts.nowMs >= resMs(r).end) return fail('That slot has already finished.')
      to = 'checkedIn'
      break
    case 'startCycle':
      if (r.state !== 'checkedIn') return fail('Check in before logging a cycle start.')
      to = 'used'
      patch = { cycleStartAt: c.nowIso, cycleMinutes: store.rules.cycleMinutes }
      break
    case 'finish':
      if (r.state !== 'used' && r.state !== 'checkedIn')
        return fail('Log that you used the machine first.')
      to = 'completed'
      break
    case 'noShow':
      if (r.state !== 'reserved') return fail('Only a still-reserved slot can be marked no-show.')
      if (opts.nowMs < resMs(r).start + store.rules.graceMinutes * 60_000)
        return fail(`The ${store.rules.graceMinutes}-minute demo grace period has not ended.`)
      to = 'noShow'
      break
    case 'blockedByOutage':
      if (r.state !== 'reserved')
        return fail('Only a still-reserved slot can be marked as affected.')
      to = 'blockedByOutage'
      break
  }
  const ev = audit(r.id, actor, to, c)
  const next: Reservation = {
    ...r,
    ...patch,
    state: to,
    updatedAt: c.nowIso,
    version: r.version + 1,
    history: [...r.history, ev],
  }
  const machine = store.machines.find((m) => m.id === r.machineId)
  const notices =
    to === 'cancelled'
      ? [
          notice(
            r.ownerProfileId,
            r.id,
            ev,
            'Machine reservation cancelled (local)',
            `${machine?.label ?? 'Machine'} slot released.`,
            reservationPath(),
          ),
        ]
      : to === 'noShow'
        ? [
            notice(
              r.ownerProfileId,
              r.id,
              ev,
              'Reservation released (local)',
              'The slot was marked no-show. This does not say the machine is empty.',
              reservationPath(),
            ),
          ]
        : to === 'blockedByOutage'
          ? [
              notice(
                r.ownerProfileId,
                r.id,
                ev,
                'Machine outage affects your slot (local)',
                'Your reservation was marked affected. Nothing was cancelled for you.',
                reservationPath(),
                'important',
              ),
            ]
          : []
  return ok(replaceRes(store, next), next, notices)
}

/** The simulator edits one machine's two independent statuses. */
export function setMachineStatus(
  store: EssStore,
  machineId: string,
  patch: Partial<Pick<EssStore['machines'][number], 'operationalStatus' | 'physicalStatus'>>,
  profileIdsAffected: (reservation: Reservation) => string,
  c: Ctx,
): Change<void> {
  const m = store.machines.find((x) => x.id === machineId)
  if (!m) return fail('That machine was not found.')
  const next = {
    ...m,
    ...patch,
    asOf: c.nowIso,
    sourceLabel: 'Demo simulator report',
    provenance: simulatedProvenance(c.nowIso),
  }
  const notices: Notice[] = []
  if (patch.operationalStatus === 'outOfService' && m.operationalStatus !== 'outOfService') {
    const ev = audit(machineId, 'demoSimulator', 'outOfService', c)
    for (const r of store.reservations)
      if (r.machineId === machineId && r.state === 'reserved')
        notices.push(
          notice(
            profileIdsAffected(r),
            r.id,
            ev,
            'Machine out of service (local)',
            `${m.label} is reported out of service. Your reservation was not changed.`,
            reservationPath(),
            'important',
          ),
        )
  }
  return ok(
    { ...store, machines: store.machines.map((x) => (x.id === machineId ? next : x)) },
    undefined,
    notices,
  )
}

/** When a cycle's estimated end passes, say so once. It is an estimate, not a completion check. */
export function dueCycleNotices(store: EssStore, nowMs: number, c: Ctx): Change<number> {
  const due = store.reservations.filter(
    (r) =>
      r.state === 'used' &&
      r.cycleStartAt &&
      r.cycleMinutes &&
      !r.cycleNotifiedAt &&
      Date.parse(r.cycleStartAt) + r.cycleMinutes * 60_000 <= nowMs,
  )
  if (due.length === 0) return ok(store, 0)
  const notices: Notice[] = []
  const reservations = store.reservations.map((r) => {
    if (!due.includes(r)) return r
    const ev = audit(
      r.id,
      'demoSimulator',
      'cycleEstimateReached',
      c,
      'In-app estimate; not verified',
    )
    notices.push(
      notice(
        r.ownerProfileId,
        r.id,
        ev,
        'Estimated finish reached (local)',
        'Your estimated wash time has passed. This is not confirmation the machine finished.',
        reservationPath(),
      ),
    )
    return { ...r, cycleNotifiedAt: c.nowIso, history: [...r.history, ev] }
  })
  return ok({ ...store, reservations }, due.length, notices)
}

/* ───────────────────────────── Mess ───────────────────────────── */

export function setMessOptIn(store: EssStore, profileId: string, on: boolean): Change<void> {
  const has = store.messOptIn.includes(profileId)
  if (on === has) return ok(store, undefined)
  return ok(
    {
      ...store,
      messOptIn: on
        ? [...store.messOptIn, profileId]
        : store.messOptIn.filter((p) => p !== profileId),
    },
    undefined,
  )
}

/** Idempotent: a second check-in returns the open session instead of creating another. */
export function messCheckIn(
  store: EssStore,
  profileId: string,
  c: Ctx,
): Change<{ created: boolean }> {
  if (!store.messOptIn.includes(profileId)) return fail('Turn on self-reporting first.')
  const open = store.messSessions.find((s) => s.profileId === profileId && !s.endedAt)
  if (open) return ok(store, { created: false })
  const session = {
    id: c.newId('ms'),
    profileId,
    startedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
  }
  return ok(
    { ...store, messSessions: [session, ...store.messSessions].slice(0, 300) },
    { created: true },
  )
}

export function messCheckOut(store: EssStore, profileId: string, c: Ctx): Change<void> {
  const open = store.messSessions.find((s) => s.profileId === profileId && !s.endedAt)
  if (!open) return fail('You are not checked in, so there is nothing to check out of.')
  return ok(
    {
      ...store,
      messSessions: store.messSessions.map((s) =>
        s.id === open.id ? { ...s, endedAt: c.nowIso } : s,
      ),
    },
    undefined,
  )
}

export function addMessFeedback(
  store: EssStore,
  input: { profileId: string; mealId: string; rating: number; comment?: string },
  c: Ctx,
): Change<void> {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5)
    return fail('Choose a rating from 1 to 5.')
  const fb = {
    id: c.newId('fb'),
    profileId: input.profileId,
    mealId: input.mealId,
    rating: input.rating,
    ...(input.comment ? { comment: input.comment } : {}),
    at: c.nowIso,
    provenance: userProvenance(c.nowIso),
  }
  return ok({ ...store, messFeedback: [fb, ...store.messFeedback].slice(0, 200) }, undefined)
}

export function setBusyReport(
  store: EssStore,
  state: 'quiet' | 'moderate' | 'busy' | 'unknown',
  c: Ctx,
): Change<void> {
  return ok(
    {
      ...store,
      messBusy: {
        state,
        asOf: c.nowIso,
        sourceLabel: 'Demo simulator report (not a live count)',
        provenance: simulatedProvenance(c.nowIso),
      },
    },
    undefined,
  )
}

export function supplyFee(
  store: EssStore,
  input: Pick<
    MessFee,
    'amountMinor' | 'dueDate' | 'instructions' | 'lateFee' | 'authorizedFormUrl'
  >,
  c: Ctx,
): Change<void> {
  if (
    input.amountMinor !== undefined &&
    (!Number.isInteger(input.amountMinor) || input.amountMinor < 0)
  )
    return fail('The amount must be a whole number of paise.')
  if (input.authorizedFormUrl !== undefined && !/^https:\/\/[^\s]+$/.test(input.authorizedFormUrl))
    return fail('A payment form link must be a full https:// address.')
  const fee: MessFee = {
    ...input,
    currency: 'INR',
    sourceLabel: 'Entered on this device simulator (not a campus record)',
    asOf: c.nowIso,
    provenance: simulatedProvenance(c.nowIso),
  }
  return ok({ ...store, fee, feeStatus: {} }, undefined)
}

export const clearFee = (store: EssStore): Change<void> =>
  ok({ ...store, fee: null, feeStatus: {} }, undefined)

/** Clicking a form link never calls this; only the student's own explicit report does. */
export function reportFeeSubmitted(store: EssStore, profileId: string, on: boolean): Change<void> {
  if (!store.fee) return fail('No fee details are available to report against.')
  const status: FeeStatus = on ? 'studentReportedSubmitted' : 'notSubmitted'
  return ok({ ...store, feeStatus: { ...store.feeStatus, [profileId]: status } }, undefined)
}

/* ───────────────────────────── Parcels ───────────────────────────── */

export const parcelPath = (id: string) => `/services/parcels/${id}`

export interface LogParcelInput {
  recipientProfileId: string
  courier?: string
  referenceSuffix?: string
  collectionPoint?: string
  /** Simulated arrival time. The simulator may backdate it to demonstrate an overdue parcel. */
  loggedAt?: string
}

export function logParcel(store: EssStore, input: LogParcelInput, c: Ctx): Change<Parcel> {
  if (input.referenceSuffix && input.referenceSuffix.length > 8)
    return fail(
      'Keep only a short reference suffix (up to 8 characters), never a full tracking number.',
    )
  const id = c.newId('parcel')
  const at = input.loggedAt ?? c.nowIso
  const ev: AuditEvent = {
    ...audit(id, 'demoSimulator', 'logged', c, 'Logged by the demo operator'),
    at,
  }
  const parcel: Parcel = {
    id,
    recipientProfileId: input.recipientProfileId,
    ...(input.courier ? { courier: input.courier } : {}),
    ...(input.referenceSuffix ? { referenceSuffix: input.referenceSuffix } : {}),
    ...(input.collectionPoint ? { collectionPoint: input.collectionPoint } : {}),
    loggedAt: at,
    state: 'logged',
    version: 1,
    updatedAt: c.nowIso,
    provenance: simulatedProvenance(
      c.nowIso,
      'Logged by the local demo operator (stands in for a gate/office log)',
    ),
    history: [ev],
  }
  return ok({ ...store, parcels: [parcel, ...store.parcels] }, parcel, [
    notice(
      input.recipientProfileId,
      id,
      ev,
      'Parcel logged (local)',
      input.collectionPoint
        ? `Collect from: ${input.collectionPoint}.`
        : 'Collection point unknown. Ask the collection desk.',
      parcelPath(id),
    ),
  ])
}

const replaceParcel = (store: EssStore, next: Parcel): EssStore => ({
  ...store,
  parcels: store.parcels.map((p) => (p.id === next.id ? next : p)),
})

export function recordParcelCollected(store: EssStore, parcelId: string, c: Ctx): Change<Parcel> {
  const p = store.parcels.find((x) => x.id === parcelId)
  if (!p) return fail('That parcel was not found.')
  if (p.state === 'collected') return fail('This parcel is already recorded as collected.')
  const ev = audit(p.id, 'demoSimulator', 'collected', c, 'Handover recorded by the demo operator')
  const next: Parcel = {
    ...p,
    state: 'collected',
    collectedAt: c.nowIso,
    updatedAt: c.nowIso,
    version: p.version + 1,
    history: [...p.history, ev],
  }
  return ok(replaceParcel(store, next), next, [
    notice(
      p.recipientProfileId,
      p.id,
      ev,
      'Parcel collection recorded (local)',
      'A simulated handover was recorded.',
      parcelPath(p.id),
    ),
  ])
}

export function markParcelException(
  store: EssStore,
  parcelId: string,
  text: string,
  c: Ctx,
): Change<Parcel> {
  const p = store.parcels.find((x) => x.id === parcelId)
  if (!p) return fail('That parcel was not found.')
  if (p.state === 'collected') return fail('A collected parcel can no longer change.')
  const ev = audit(p.id, 'demoSimulator', 'exception', c, text)
  const next: Parcel = {
    ...p,
    state: 'exception',
    exceptionNote: text,
    updatedAt: c.nowIso,
    version: p.version + 1,
    history: [...p.history, ev],
  }
  return ok(replaceParcel(store, next), next, [
    notice(
      p.recipientProfileId,
      p.id,
      ev,
      'Parcel needs attention (local)',
      text,
      parcelPath(p.id),
      'important',
    ),
  ])
}

/** A student may flag a problem. That adds a history entry; it never records a handover. */
export function studentReportParcelIssue(
  store: EssStore,
  profileId: string,
  parcelId: string,
  text: string,
  c: Ctx,
): Change<Parcel> {
  const p = store.parcels.find((x) => x.id === parcelId)
  if (!p || p.recipientProfileId !== profileId) return fail('That parcel was not found.')
  if (!text.trim()) return fail('Describe the problem so the desk can look into it.')
  const ev = audit(p.id, 'student', 'issueReported', c, text.trim().slice(0, 300))
  const next: Parcel = {
    ...p,
    updatedAt: c.nowIso,
    version: p.version + 1,
    history: [...p.history, ev],
  }
  return ok(replaceParcel(store, next), next)
}

export const parcelAgeHours = (p: Parcel, nowMs: number) =>
  (nowMs - Date.parse(p.loggedAt)) / 3_600_000

/** Derived, never stored as a status: old enough to deserve a reminder. Not a fine or a policy. */
export const isParcelOverdue = (p: Parcel, rules: EssStore['rules'], nowMs: number) =>
  p.state === 'logged' && parcelAgeHours(p, nowMs) >= rules.parcelReminderHours

/** Shows each overdue reminder once, the next time the app checks. No background delivery. */
export function dueParcelNotices(store: EssStore, nowMs: number, c: Ctx): Change<number> {
  const due = store.parcels.filter(
    (p) => isParcelOverdue(p, store.rules, nowMs) && !p.overdueNotifiedAt,
  )
  if (due.length === 0) return ok(store, 0)
  const notices: Notice[] = []
  const parcels = store.parcels.map((p) => {
    if (!due.includes(p)) return p
    const ev = audit(
      p.id,
      'demoSimulator',
      'uncollectedReminder',
      c,
      'Derived reminder; the parcel status is unchanged',
    )
    notices.push(
      notice(
        p.recipientProfileId,
        p.id,
        ev,
        'Parcel still uncollected (local)',
        `Logged ${Math.floor(parcelAgeHours(p, nowMs) / 24)} days ago. A demo reminder, not a campus rule.`,
        parcelPath(p.id),
        'important',
      ),
    )
    return { ...p, overdueNotifiedAt: c.nowIso, history: [...p.history, ev] }
  })
  return ok({ ...store, parcels }, due.length, notices)
}
