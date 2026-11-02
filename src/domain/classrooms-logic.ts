import { userProvenance } from './chill-logic'
import {
  HOLDING,
  PURPOSES,
  type Blocker,
  type ClassroomStore,
  type Reservation,
  type RoomEvent,
  type SlotStatus,
} from './classrooms'
import { checkSlot, overlaps, spanMs, generateSlots, type ActiveBooking } from './booking-core'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import { addDays, type DateOnly, type LocalTime } from '@/lib/time'
import { isoWeekday } from '@/lib/time/calendar'
import { instantMs, timeToMinutes } from '@/selectors/now'

/**
 * Pure rules for classroom reservations. Intervals are half-open, so back-to-back bookings never
 * collide. Availability means "no conflict in the schedule we know about", never "the room is empty".
 */
type Change<T> = CoreChange<ClassroomStore, T>
const ok = <T>(s: ClassroomStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)

/** The ribbon shows these demo hours. It does not claim the building opens or closes then. */
export const DISPLAY_WINDOW = { from: 8 * 60, to: 20 * 60 }
export const bookingPath = (id: string) => `/bookings/classrooms/bookings/${id}`

/** 0 = Sunday … 6 = Saturday, from the shared calendar helper (ISO weekday is 1 = Monday … 7 = Sunday). */
const weekdayOf = (d: DateOnly) => isoWeekday(d) % 7
const evt = (
  actor: RoomEvent['actor'],
  type: string,
  c: Ctx,
  x: Partial<RoomEvent> = {},
): RoomEvent => ({
  id: c.newId('rev'),
  actor,
  type,
  at: c.nowIso,
  ...x,
})
const tell = (
  to: string,
  entity: string,
  e: { id: string },
  title: string,
  body: string,
  sig: Notice['significance'] = 'standard',
) => makeNotice('classrooms', to, entity, e, title, body, bookingPath(entity), sig)

export interface Span {
  date: DateOnly
  start: LocalTime
  end: LocalTime
}

/** Blockers that apply on one date: single-date ones and weekly classes. */
export function blockersOn(s: ClassroomStore, roomId: string, date: DateOnly): Blocker[] {
  const wd = weekdayOf(date)
  return s.blockers.filter(
    (b) => b.roomId === roomId && (b.date === date || (b.weekday === wd && !b.date)),
  )
}

const asActive = (
  s: ClassroomStore,
  roomId: string,
  date: DateOnly,
  ignoreId?: string,
): ActiveBooking[] => [
  ...blockersOn(s, roomId, date).map((b) => ({
    ownerId: '__schedule__',
    resourceId: roomId,
    span: { date, start: b.start, end: b.end },
  })),
  ...s.reservations
    .filter((r) => r.id !== ignoreId && r.roomId === roomId && HOLDING.includes(r.state))
    .map((r) => ({
      ownerId: r.ownerProfileId,
      resourceId: r.roomId,
      span: { date: r.date, start: r.start, end: r.end },
    })),
]

/** Everything a student holds or has requested counts toward their limit, under a key that can never collide. */
const ownerLoad = (s: ClassroomStore, profileId: string, ignoreId?: string): ActiveBooking[] =>
  s.reservations
    .filter(
      (r) =>
        r.id !== ignoreId &&
        r.ownerProfileId === profileId &&
        (r.state === 'pendingApproval' || HOLDING.includes(r.state)),
    )
    .map((r) => ({
      ownerId: profileId,
      resourceId: `__own__${r.id}`,
      span: { date: r.date, start: r.start, end: r.end },
    }))

const within = (w: { from: LocalTime; to: LocalTime } | null, span: Span) =>
  !!w &&
  timeToMinutes(span.start) >= timeToMinutes(w.from) &&
  timeToMinutes(span.end) <= timeToMinutes(w.to)

export function slotStatus(
  s: ClassroomStore,
  roomId: string,
  span: Span,
  profileId: string,
): SlotStatus {
  const room = s.rooms.find((r) => r.id === roomId)
  if (!room || !within(room.knownWindow, span)) return { kind: 'unknown' }
  const probe = spanMs(span)
  const block = blockersOn(s, roomId, span.date).find((b) =>
    overlaps(probe, spanMs({ date: span.date, start: b.start, end: b.end })),
  )
  if (block) return { kind: 'blocked', label: block.label, until: block.end }
  const held = s.reservations.find(
    (r) =>
      r.roomId === roomId &&
      HOLDING.includes(r.state) &&
      overlaps(probe, spanMs({ date: r.date, start: r.start, end: r.end })),
  )
  // Another student's booking is only ever a busy interval: no name, reason or note.
  if (held) return { kind: 'booked', until: held.end, mine: held.ownerProfileId === profileId }
  const pending = s.reservations.find(
    (r) =>
      r.roomId === roomId &&
      r.ownerProfileId === profileId &&
      r.state === 'pendingApproval' &&
      overlaps(probe, spanMs({ date: r.date, start: r.start, end: r.end })),
  )
  if (pending) return { kind: 'pending', mine: true }
  return { kind: 'available' }
}

/** The ribbon for one room and day: one status per demo slot. */
export function ribbon(s: ClassroomStore, roomId: string, date: DateOnly, profileId: string) {
  return generateSlots(DISPLAY_WINDOW.from, DISPLAY_WINDOW.to, s.config.slotMinutes).map((sl) => ({
    ...sl,
    status: slotStatus(s, roomId, { date, ...sl }, profileId),
  }))
}

const REFUSAL: Record<string, string> = {
  invalid: 'The end must be after the start.',
  past: 'That time has already passed.',
  beyondHorizon: 'That is further ahead than the demo allows.',
  ownerLimit:
    'You already hold the most reservations or requests the demo allows. Cancel one first.',
  conflict: 'That time overlaps something already recorded for this room.',
}

export interface ReservationInput extends Span {
  roomId: string
  purpose: Reservation['purpose']
  groupName?: string
  attendees?: number
  notes?: string
  /** For a slot the schedule does not cover: send it as a request for verification. */
  asVerificationRequest?: boolean
  meetingId?: string
}

export function submitReservation(
  s: ClassroomStore,
  profileId: string,
  input: ReservationInput & { idempotencyKey: string },
  c: Ctx,
  nowMs: number,
  today: DateOnly,
): Change<{ reservation: Reservation; created: boolean }> {
  const dup = s.reservations.find(
    (r) => r.ownerProfileId === profileId && r.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(s, { reservation: dup, created: false })
  const room = s.rooms.find((r) => r.id === input.roomId)
  if (!room) return fail('That room was not found.')
  if (!PURPOSES.includes(input.purpose)) return fail('Choose a purpose.')
  if ((input.notes ?? '').length > 300) return fail('Notes can be up to 300 characters.')
  const status = slotStatus(s, input.roomId, input, profileId)
  const refusal = checkSlot({
    span: input,
    nowMs,
    today,
    horizonDays: s.config.horizonDays,
    ownerId: profileId,
    resourceId: input.roomId,
    active: [...asActive(s, input.roomId, input.date), ...ownerLoad(s, profileId)],
    maxActivePerOwner: s.config.maxActivePerStudent,
    countsTowardLimit: (b) => b.resourceId.startsWith('__own__'),
  })
  if (refusal) return fail(REFUSAL[refusal]!)
  if (status.kind === 'blocked' || status.kind === 'booked')
    return fail('That time overlaps something already recorded for this room.')
  if (status.kind === 'pending')
    return fail('You already have a request for this room at that time.')
  let state: Reservation['state']
  let needsVerification = false
  if (status.kind === 'unknown') {
    if (!input.asVerificationRequest)
      return fail(
        'The demo schedule does not cover that time, so it cannot be confirmed. Send it as a request for verification instead.',
      )
    state = 'pendingApproval'
    needsVerification = true
  } else {
    state = room.bookingMode === 'instant' ? 'confirmedDemo' : 'pendingApproval'
  }
  const id = c.newId('crb')
  const e = evt('student', state === 'confirmedDemo' ? 'confirmed' : 'requested', c, { to: state })
  const reservation: Reservation = {
    id,
    ownerProfileId: profileId,
    roomId: input.roomId,
    date: input.date,
    start: input.start,
    end: input.end,
    purpose: input.purpose,
    ...(input.groupName?.trim() ? { groupName: input.groupName.trim() } : {}),
    ...(input.attendees ? { attendees: input.attendees } : {}),
    ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
    state,
    ...(needsVerification ? { needsVerification } : {}),
    ...(input.meetingId ? { meetingId: input.meetingId } : {}),
    idempotencyKey: input.idempotencyKey,
    version: 1,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
    history: [e],
  }
  const where = room.displayName
  return ok(
    { ...s, reservations: [reservation, ...s.reservations] },
    { reservation, created: true },
    [
      tell(
        profileId,
        id,
        e,
        state === 'confirmedDemo'
          ? 'Classroom reserved (local)'
          : 'Classroom request recorded (local)',
        state === 'confirmedDemo'
          ? `${where} is reserved in this on this device only. It is not a campus booking and does not show whether the room is physically empty.`
          : `${where}: requested, not reserved. Nobody has been told; a simulated reviewer must decide.`,
      ),
    ],
  )
}

const own = (s: ClassroomStore, profileId: string, id: string) =>
  s.reservations.find((r) => r.id === id && r.ownerProfileId === profileId)
const put = (s: ClassroomStore, r: Reservation): ClassroomStore => ({
  ...s,
  reservations: s.reservations.map((x) => (x.id === r.id ? r : x)),
})

export function decide(
  s: ClassroomStore,
  id: string,
  decision: 'approve' | 'reject',
  c: Ctx,
  nowMs: number,
  reason?: string,
): Change<Reservation> {
  const r = s.reservations.find((x) => x.id === id)
  if (!r) return fail('That request was not found.')
  if (r.state !== 'pendingApproval') return fail('Only a waiting request can be decided.')
  const room = s.rooms.find((x) => x.id === r.roomId)!
  if (decision === 'reject') {
    if (!reason?.trim()) return fail('A reason is required when a request is not approved.')
    const e = evt('demoReviewer', 'rejected', c, {
      from: r.state,
      to: 'rejected',
      reason: reason.trim(),
    })
    const next: Reservation = {
      ...r,
      state: 'rejected',
      decisionReason: reason.trim(),
      version: r.version + 1,
      updatedAt: c.nowIso,
      history: [...r.history, e],
    }
    return ok(put(s, next), next, [
      tell(
        r.ownerProfileId,
        r.id,
        e,
        'Classroom request not approved (local)',
        `${room.displayName}: ${reason.trim()}`,
        'important',
      ),
    ])
  }
  if (instantMs(r.date, r.end) <= nowMs) return fail('That time has already passed.')
  const clash = checkSlot({
    span: r,
    nowMs,
    today: r.date,
    horizonDays: 3650,
    ownerId: r.ownerProfileId,
    resourceId: r.roomId,
    active: asActive(s, r.roomId, r.date, r.id),
    maxActivePerOwner: 99,
  })
  if (clash === 'conflict')
    return fail('Another booking or class now holds that time, so it cannot be approved.')
  const e = evt('demoReviewer', 'approved', c, { from: r.state, to: 'confirmedDemo' })
  const next: Reservation = {
    ...r,
    state: 'confirmedDemo',
    needsVerification: undefined,
    version: r.version + 1,
    updatedAt: c.nowIso,
    history: [...r.history, e],
  }
  return ok(put(s, next), next, [
    tell(
      r.ownerProfileId,
      r.id,
      e,
      'Classroom request approved (local)',
      `${room.displayName} is reserved on this device.`,
      'important',
    ),
  ])
}

export function cancel(
  s: ClassroomStore,
  profileId: string,
  id: string,
  c: Ctx,
  nowMs: number,
): Change<Reservation> {
  const r = own(s, profileId, id)
  if (!r) return fail('That reservation was not found.')
  if (!(['pendingApproval', 'confirmedDemo', 'disrupted'] as const).includes(r.state as never))
    return fail('This reservation is already finished.')
  if (instantMs(r.date, r.end) <= nowMs) return fail('That time has already ended.')
  const room = s.rooms.find((x) => x.id === r.roomId)
  const e = evt('student', 'cancelled', c, { from: r.state, to: 'cancelled' })
  const next: Reservation = {
    ...r,
    state: 'cancelled',
    version: r.version + 1,
    updatedAt: c.nowIso,
    history: [...r.history, e],
  }
  return ok(put(s, next), next, [
    tell(
      profileId,
      r.id,
      e,
      'Classroom reservation cancelled (local)',
      `${room?.displayName}: the recorded slot is free again. This does not mean anyone checked the room.`,
    ),
  ])
}

/** One write: the new time is checked first, so a failure leaves the old reservation exactly as it was. */
export function reschedule(
  s: ClassroomStore,
  profileId: string,
  id: string,
  to: Span & { roomId: string },
  c: Ctx,
  nowMs: number,
  today: DateOnly,
): Change<Reservation> {
  const r = own(s, profileId, id)
  if (!r) return fail('That reservation was not found.')
  if (!(['pendingApproval', 'confirmedDemo'] as const).includes(r.state as never))
    return fail('Only an open reservation can be moved.')
  const room = s.rooms.find((x) => x.id === to.roomId)
  if (!room) return fail('That room was not found.')
  const probe: ClassroomStore = { ...s, reservations: s.reservations.filter((x) => x.id !== r.id) }
  const status = slotStatus(probe, to.roomId, to, profileId)
  const refusal = checkSlot({
    span: to,
    nowMs,
    today,
    horizonDays: s.config.horizonDays,
    ownerId: profileId,
    resourceId: to.roomId,
    active: [...asActive(probe, to.roomId, to.date), ...ownerLoad(s, profileId, r.id)],
    maxActivePerOwner: s.config.maxActivePerStudent,
    countsTowardLimit: (b) => b.resourceId.startsWith('__own__'),
  })
  if (refusal) return fail(REFUSAL[refusal]!)
  if (status.kind !== 'available')
    return fail(
      status.kind === 'unknown'
        ? 'The demo schedule does not cover that time.'
        : 'That time is already taken or blocked.',
    )
  const state: Reservation['state'] =
    room.bookingMode === 'instant' ? 'confirmedDemo' : 'pendingApproval'
  const e = evt('student', 'rescheduled', c, {
    from: `${r.roomId} ${r.date} ${r.start}`,
    to: `${to.roomId} ${to.date} ${to.start}`,
  })
  const next: Reservation = {
    ...r,
    ...to,
    state,
    version: r.version + 1,
    updatedAt: c.nowIso,
    history: [...r.history, e],
  }
  return ok(put(s, next), next, [
    tell(
      profileId,
      r.id,
      e,
      'Classroom reservation moved (local)',
      `${room.displayName} on ${to.date}, ${to.start}–${to.end}. The old slot is free again.`,
    ),
  ])
}

/* Simulator: schedule changes that make the demo realistic. */

export function closeRoom(
  s: ClassroomStore,
  roomId: string,
  span: Span,
  label: string,
  c: Ctx,
): Change<{ disrupted: number }> {
  if (!s.rooms.some((r) => r.id === roomId)) return fail('That room was not found.')
  if (!(timeToMinutes(span.end) > timeToMinutes(span.start)))
    return fail('The end must be after the start.')
  const blocker: Blocker = {
    id: c.newId('blk'),
    roomId,
    kind: 'maintenance',
    date: span.date,
    start: span.start,
    end: span.end,
    label: label.trim() || 'Closed (demo maintenance)',
    provenance: {
      dataMode: 'simulated',
      verification: 'notApplicable',
      authority: 'demoIllustration',
      sourceLabel: 'Simulated closure',
      updatedAt: c.nowIso,
    },
  }
  const probe = spanMs(span)
  const notes: Notice[] = []
  const reservations = s.reservations.map((r) => {
    if (r.roomId !== roomId || !HOLDING.includes(r.state) || r.state === 'disrupted') return r
    if (!overlaps(probe, spanMs({ date: r.date, start: r.start, end: r.end }))) return r
    const e = evt('demoOps', 'disrupted', c, { from: r.state, to: 'disrupted' })
    notes.push(
      tell(
        r.ownerProfileId,
        r.id,
        e,
        'Your classroom may be unavailable (local)',
        `${s.rooms.find((x) => x.id === roomId)?.displayName} has a simulated closure at your time. Check the booking.`,
        'important',
      ),
    )
    return {
      ...r,
      state: 'disrupted' as const,
      version: r.version + 1,
      updatedAt: c.nowIso,
      history: [...r.history, e],
    }
  })
  return ok(
    { ...s, blockers: [...s.blockers, blocker], reservations },
    { disrupted: notes.length },
    notes,
  )
}

/** Another student's booking, recorded as a bare busy interval. Used to show a conflict at confirmation time. */
export function injectOtherBooking(
  s: ClassroomStore,
  roomId: string,
  span: Span,
  c: Ctx,
): Change<void> {
  if (!s.rooms.some((r) => r.id === roomId)) return fail('That room was not found.')
  if (!(timeToMinutes(span.end) > timeToMinutes(span.start)))
    return fail('The end must be after the start.')
  const b: Blocker = {
    id: c.newId('blk'),
    roomId,
    kind: 'otherBooking',
    date: span.date,
    start: span.start,
    end: span.end,
    label: 'Booked',
    provenance: {
      dataMode: 'simulated',
      verification: 'notApplicable',
      authority: 'demoIllustration',
      sourceLabel: 'Simulated booking by another student',
      updatedAt: c.nowIso,
    },
  }
  return ok({ ...s, blockers: [...s.blockers, b] }, undefined)
}

export const nextDays = (today: DateOnly, n: number) =>
  Array.from({ length: n }, (_, i) => addDays(today, i))
