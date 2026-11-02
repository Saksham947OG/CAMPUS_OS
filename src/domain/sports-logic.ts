import { addDays, isoFromMs, timeToMinutes, type DateOnly, type LocalTime } from '@/lib/time'
import { minutesToTime } from '@/lib/time/calendar'
import { instantMs } from '@/selectors/now'
import { checkSlot, generateOvernightSlots, spanMs, type ActiveBooking } from './booking-core'
import { simulatedProvenance, userProvenance } from './chill-logic'
import type { AuditEvent } from './ess'
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
  ACTIVE_STATES,
  type Activity,
  type Book,
  type Equipment,
  type FaultReport,
  type Loan,
  type Occupancy,
  type Policy,
  type Resource,
  type SportsReservation,
  type SportsStore,
  type WaitlistEntry,
} from './sports'

/**
 * Pure rules for Sports & Fitness (COS-SPORTS-001). Slot checking is the shared booking core
 * (`booking-core.ts`), so courts, tables and the Essentials machines use one interval engine.
 * Nothing here has a clock, storage or React: callers pass timestamps and ids. Nothing advances on
 * its own, and nothing turns "no booking" into "empty" or "slot ended" into "court clear".
 */

type Change<T> = CoreChange<SportsStore, T>
const ok = <T>(store: SportsStore, value: T, notices: Notice[] = []): Change<T> =>
  coreOk(store, value, notices)
const notice = (
  recipient: string,
  entityId: string,
  ev: AuditEvent,
  title: string,
  body: string,
  href: string,
  significance: Notice['significance'] = 'standard',
) => makeNotice('sports', recipient, entityId, ev, title, body, href, significance)

export const bookingPath = (id: string) => `/bookings/my/${id}`
export const WAITLIST_PATH = '/bookings/waitlist'

const findResource = (s: SportsStore, id: string) => s.resources.find((r) => r.id === id)
export const policyFor = (s: SportsStore, r: Resource): Policy => s.config.policies[r.activity]
export const isActive = (r: SportsReservation) => ACTIVE_STATES.includes(r.state)

const activeBookings = (s: SportsStore): ActiveBooking[] =>
  s.reservations
    .filter(isActive)
    .map((r) => ({ ownerId: r.ownerProfileId, resourceId: r.resourceId, span: r }))

const activityOf = (s: SportsStore, resourceId: string): Activity | undefined =>
  findResource(s, resourceId)?.activity

/** Activities in one limit group (the three space services) share a single upcoming-booking limit. */
const limitGroupOf = (s: SportsStore, activity: Activity | undefined): string | undefined =>
  activity ? (s.config.policies[activity].limitGroup ?? activity) : undefined

export interface Slot {
  /** The date this slot STARTS on. For an overnight window it can be the day after the service date. */
  startDate: DateOnly
  start: LocalTime
  /** The date it ENDS on. Different from `startDate` only when the slot crosses midnight. */
  endDate: DateOnly
  end: LocalTime
}

const MINUTES_PER_DAY = 1440
const clockOf = (abs: number) => minutesToTime(abs % MINUTES_PER_DAY)

/**
 * Slots a resource offers for one service date, from its PUBLISHED hours. A window whose close is at
 * or before its open runs into the next day (e.g. 19:45 to 01:45), and each slot carries the real
 * start and end dates. No hours or no booking rules means no slots are invented.
 */
export function slotsOn(s: SportsStore, r: Resource, serviceDate: DateOnly): Slot[] {
  const p = policyFor(s, r)
  if (!p.bookable || r.bookable === false || !r.hours) return []
  const open = timeToMinutes(r.hours.open)
  let close = timeToMinutes(r.hours.close)
  if (close <= open) close += MINUTES_PER_DAY
  return generateOvernightSlots(open, close, p.slotMinutes).map(({ startMin, endMin }) => ({
    startDate: addDays(serviceDate, Math.floor(startMin / MINUTES_PER_DAY)),
    start: clockOf(startMin),
    endDate: addDays(serviceDate, Math.floor(endMin / MINUTES_PER_DAY)),
    end: clockOf(endMin),
  }))
}

/** The slot that starts at a given date and time, whichever service date's grid it belongs to. */
export function findSlot(
  s: SportsStore,
  r: Resource,
  date: DateOnly,
  start: LocalTime,
): Slot | undefined {
  for (const d of [date, addDays(date, -1)]) {
    const hit = slotsOn(s, r, d).find((x) => x.startDate === date && x.start === start)
    if (hit) return hit
  }
  return undefined
}

const op = (
  s: SportsStore,
  action: string,
  entityId: string,
  previous: string,
  next: string,
  c: Ctx,
): SportsStore => ({
  ...s,
  operations: [
    {
      id: c.newId('op'),
      action,
      actorLabel: 'Local demo simulator' as const,
      entityId,
      previous,
      next,
      at: c.nowIso,
    },
    ...s.operations,
  ].slice(0, 100),
})

/* ───────────────────────────── Reserving ───────────────────────────── */

export interface ReserveInput {
  profileId: string
  resourceId: string
  date: DateOnly
  start: LocalTime
  idempotencyKey: string
  partnerNote?: string
  participants?: number
  today: DateOnly
  nowMs: number
}

/** The checks every new reservation, including an accepted waitlist offer, must pass. */
function validateNew(
  s: SportsStore,
  i: Omit<ReserveInput, 'idempotencyKey'>,
):
  | { ok: true; resource: Resource; end: LocalTime; endDate: DateOnly }
  | { ok: false; reason: string } {
  const resource = findResource(s, i.resourceId)
  if (!resource) return fail('That resource was not found.')
  const policy = policyFor(s, resource)
  if (!policy.bookable || resource.bookable === false)
    return fail('Booking is not configured for this resource.')
  if (resource.status === 'closed')
    return fail('This resource is closed, so new bookings are paused.')
  if (resource.status === 'unknown')
    return fail('This resource’s status is unknown, so it cannot be booked.')
  if (!resource.hours) return fail('Opening hours were not provided, so no slots are offered.')
  const slot = findSlot(s, resource, i.date, i.start)
  if (!slot) return fail('That is not one of the demo time slots.')
  if (i.participants !== undefined) {
    if (!Number.isInteger(i.participants) || i.participants < 1)
      return fail('Enter a whole number of participants of at least 1.')
    if (policy.participantMax !== undefined && i.participants > policy.participantMax)
      return fail(`This demo allows up to ${policy.participantMax} participants.`)
  }
  const refusal = checkSlot({
    span: { date: i.date, start: slot.start, end: slot.end, endDate: slot.endDate },
    nowMs: i.nowMs,
    today: i.today,
    horizonDays: policy.horizonDays,
    ownerId: i.profileId,
    resourceId: resource.id,
    active: activeBookings(s),
    maxActivePerOwner: policy.maxActive,
    bufferMinutes: policy.bufferMinutes,
    countsTowardLimit: (b) =>
      limitGroupOf(s, activityOf(s, b.resourceId)) === limitGroupOf(s, resource.activity),
  })
  if (refusal === 'invalid')
    return fail('That time range is not valid: it must end after it starts.')
  if (refusal === 'past') return fail('That slot has already finished.')
  if (refusal === 'beyondHorizon')
    return fail(`Bookings open up to ${policy.horizonDays} days ahead in this demo.`)
  if (refusal === 'ownerLimit')
    return fail(
      `This demo allows ${policy.maxActive} upcoming ${policy.maxActive === 1 ? 'booking' : 'bookings'} ${policy.limitGroup ? 'across the space services' : 'for this activity'} at a time. Cancel one first.`,
    )
  if (refusal === 'conflict') return fail('That slot is already reserved in this demo data.')
  return { ok: true, resource, end: slot.end, endDate: slot.endDate }
}

function newReservation(
  i: ReserveInput,
  resource: Resource,
  end: LocalTime,
  endDate: DateOnly,
  c: Ctx,
  extra: { action?: string; note?: string } = {},
): { reservation: SportsReservation; ev: AuditEvent } {
  const id = c.newId('bk')
  const ev = makeAudit(id, 'student', extra.action ?? 'confirmedDemo', c, extra.note)
  return {
    ev,
    reservation: {
      id,
      ownerProfileId: i.profileId,
      resourceId: resource.id,
      date: i.date,
      start: i.start,
      end,
      ...(endDate !== i.date ? { endDate } : {}),
      state: 'confirmedDemo',
      disrupted: false,
      ...(i.partnerNote?.trim() ? { partnerNote: i.partnerNote.trim() } : {}),
      ...(i.participants ? { participants: i.participants } : {}),
      idempotencyKey: i.idempotencyKey,
      createdAt: c.nowIso,
      updatedAt: c.nowIso,
      version: 1,
      provenance: userProvenance(c.nowIso),
      history: [ev],
    },
  }
}

export function reserveSlot(
  s: SportsStore,
  i: ReserveInput,
  c: Ctx,
): Change<{ reservation: SportsReservation; created: boolean }> {
  const dup = s.reservations.find(
    (r) => r.ownerProfileId === i.profileId && r.idempotencyKey === i.idempotencyKey,
  )
  if (dup) return ok(s, { reservation: dup, created: false })
  const v = validateNew(s, i)
  if (!v.ok) return v
  const { reservation, ev } = newReservation(i, v.resource, v.end, v.endDate, c)
  return ok(
    { ...s, reservations: [reservation, ...s.reservations] },
    { reservation, created: true },
    [
      notice(
        i.profileId,
        reservation.id,
        ev,
        'Reservation saved in CampusOS demo',
        `${v.resource.label}, ${i.date} ${i.start}. A demo reservation, not a campus booking.`,
        bookingPath(reservation.id),
      ),
    ],
  )
}

const replaceRes = (s: SportsStore, next: SportsReservation): SportsStore => ({
  ...s,
  reservations: s.reservations.map((r) => (r.id === next.id ? next : r)),
})

const bump = (
  r: SportsReservation,
  ev: AuditEvent,
  patch: Partial<SportsReservation>,
  c: Ctx,
): SportsReservation => ({
  ...r,
  ...patch,
  updatedAt: c.nowIso,
  version: r.version + 1,
  history: [...r.history, ev],
})

const labelOf = (s: SportsStore, r: SportsReservation) =>
  findResource(s, r.resourceId)?.label ?? 'Resource'

/* ───────────────────────────── Student actions ───────────────────────────── */

export type StudentAction = 'cancel' | 'checkIn' | 'finish'

export function studentAct(
  s: SportsStore,
  profileId: string,
  id: string,
  action: StudentAction,
  c: Ctx,
  nowMs: number,
): Change<SportsReservation> {
  const r = s.reservations.find((x) => x.id === id)
  if (!r || r.ownerProfileId !== profileId) return fail('That booking was not found.')
  const { start, end } = spanMs(r)
  if (action === 'cancel') {
    if (r.state !== 'confirmedDemo')
      return fail('Only a confirmed booking that has not started can be cancelled.')
    const ev = makeAudit(
      r.id,
      'student',
      'cancelled',
      c,
      'Released. This does not say the resource is empty.',
    )
    const next = bump(r, ev, { state: 'cancelled' }, c)
    return ok(replaceRes(s, next), next, [
      notice(
        profileId,
        r.id,
        ev,
        'Your demo booking was cancelled',
        `${labelOf(s, r)} ${r.date} ${r.start}.`,
        bookingPath(r.id),
      ),
    ])
  }
  if (action === 'checkIn') {
    if (r.state !== 'confirmedDemo') return fail('You can check in to a confirmed booking.')
    if (nowMs < start - 15 * 60_000) return fail('Check-in opens 15 minutes before the slot.')
    if (nowMs >= end) return fail('That slot has already finished.')
    const ev = makeAudit(r.id, 'student', 'checkedIn', c, 'Self-reported; not verified')
    const next = bump(r, ev, { state: 'checkedIn' }, c)
    return ok(replaceRes(s, next), next, [
      notice(
        profileId,
        r.id,
        ev,
        'Self-reported check-in recorded',
        'This is your own report, not an access or security check.',
        bookingPath(r.id),
        'optional',
      ),
    ])
  }
  // An expired check-in can still be closed by the student's own word; the app never does it for them.
  if (r.state !== 'checkedIn' && r.state !== 'checkInExpired')
    return fail('Check in before marking the booking finished.')
  const ev = makeAudit(r.id, 'student', 'completed', c, 'Self-reported')
  const next = bump(r, ev, { state: 'completed' }, c)
  return ok(replaceRes(s, next), next)
}

/* ───────────────────────────── Simulator: no-show, closure, disruption ───────────────────────────── */

/** Releases the booking CLAIM after the grace period. It says nothing about who is physically there. */
export function processNoShow(
  s: SportsStore,
  id: string,
  c: Ctx,
  nowMs: number,
): Change<SportsReservation> {
  const r = s.reservations.find((x) => x.id === id)
  if (!r) return fail('That booking was not found.')
  const resource = findResource(s, r.resourceId)
  if (r.state !== 'confirmedDemo')
    return fail('Only a confirmed, not-yet-checked-in booking can be released as a no-show.')
  const grace = resource ? policyFor(s, resource).graceMinutes : 10
  if (nowMs < spanMs(r).start + grace * 60_000)
    return fail(`The ${grace}-minute demo grace period has not ended.`)
  const ev = makeAudit(
    r.id,
    'demoSimulator',
    'noShow',
    c,
    'Claim released; physical use is unknown',
  )
  const next = bump(r, ev, { state: 'noShow' }, c)
  return ok(op(replaceRes(s, next), 'noShow', r.id, r.state, 'noShow', c), next, [
    notice(
      r.ownerProfileId,
      r.id,
      ev,
      'Demo booking released after no-show',
      'The booking was released. This does not mean the resource is physically empty.',
      bookingPath(r.id),
    ),
  ])
}

/** Closing blocks new bookings and visibly flags existing ones. It never cancels them silently. */
export function closeResource(
  s: SportsStore,
  resourceId: string,
  noteText: string,
  c: Ctx,
  nowMs: number,
): Change<number> {
  const res = findResource(s, resourceId)
  if (!res) return fail('That resource was not found.')
  const text = noteText.trim() || 'Closed in the demo simulator'
  const notices: Notice[] = []
  let flagged = 0
  const reservations = s.reservations.map((r) => {
    if (r.resourceId !== resourceId || !isActive(r) || spanMs(r).end <= nowMs || r.disrupted)
      return r
    const ev = makeAudit(r.id, 'demoSimulator', 'disrupted', c, text)
    flagged++
    notices.push(
      notice(
        r.ownerProfileId,
        r.id,
        ev,
        'Your demo reservation may be affected',
        `${res.label} is closed: ${text}. Nothing was cancelled for you; open the booking for next steps.`,
        bookingPath(r.id),
        'important',
      ),
    )
    return bump(r, ev, { disrupted: true, disruptionNote: text }, c)
  })
  const resources = s.resources.map((x) =>
    x.id === resourceId
      ? {
          ...x,
          status: 'closed' as const,
          closureNote: text,
          asOf: c.nowIso,
          sourceLabel: 'Demo simulator report',
          provenance: simulatedProvenance(c.nowIso),
        }
      : x,
  )
  return ok(
    op({ ...s, resources, reservations }, 'closeResource', resourceId, res.status, 'closed', c),
    flagged,
    notices,
  )
}

export function reopenResource(s: SportsStore, resourceId: string, c: Ctx): Change<void> {
  const res = findResource(s, resourceId)
  if (!res) return fail('That resource was not found.')
  const resources = s.resources.map((x) =>
    x.id === resourceId
      ? {
          ...x,
          status: 'open' as const,
          closureNote: undefined,
          asOf: c.nowIso,
          sourceLabel: 'Demo simulator report',
          provenance: simulatedProvenance(c.nowIso),
        }
      : x,
  )
  return ok(op({ ...s, resources }, 'reopenResource', resourceId, res.status, 'open', c), undefined)
}

/** Clear the flag, or cancel the booking because of the closure. Either way it is an explicit, logged step. */
export function resolveDisruption(
  s: SportsStore,
  id: string,
  how: 'resolve' | 'cancel',
  c: Ctx,
): Change<SportsReservation> {
  const r = s.reservations.find((x) => x.id === id)
  if (!r) return fail('That booking was not found.')
  if (!r.disrupted) return fail('This booking is not marked as disrupted.')
  if (how === 'resolve') {
    const ev = makeAudit(r.id, 'demoSimulator', 'disruptionResolved', c)
    const next = bump(r, ev, { disrupted: false, disruptionNote: undefined }, c)
    return ok(
      op(replaceRes(s, next), 'resolveDisruption', r.id, 'disrupted', 'resolved', c),
      next,
      [
        notice(
          r.ownerProfileId,
          r.id,
          ev,
          'Demo disruption resolved',
          'Your booking stands as before.',
          bookingPath(r.id),
        ),
      ],
    )
  }
  const ev = makeAudit(r.id, 'demoSimulator', 'cancelledForClosure', c, r.disruptionNote)
  const next = bump(r, ev, { state: 'cancelled', disrupted: false }, c)
  return ok(op(replaceRes(s, next), 'cancelForClosure', r.id, r.state, 'cancelled', c), next, [
    notice(
      r.ownerProfileId,
      r.id,
      ev,
      'Your demo booking was cancelled',
      'It was cancelled because the resource is closed. No payment was involved.',
      bookingPath(r.id),
      'important',
    ),
  ])
}

/* ───────────────────────────── Waitlist ───────────────────────────── */

const sameSlot = (w: WaitlistEntry, resourceId: string, date: DateOnly, start: LocalTime) =>
  w.resourceId === resourceId && w.date === date && w.start === start

export function joinWaitlist(
  s: SportsStore,
  input: {
    profileId: string
    resourceId: string
    date: DateOnly
    start: LocalTime
    nowMs: number
    today: DateOnly
  },
  c: Ctx,
): Change<{ entry: WaitlistEntry; created: boolean }> {
  const resource = findResource(s, input.resourceId)
  if (!resource) return fail('That resource was not found.')
  const policy = policyFor(s, resource)
  if (!policy.bookable || resource.bookable === false || !policy.allowWaitlist)
    return fail('A waitlist is not configured for this resource.')
  const slot = findSlot(s, resource, input.date, input.start)
  if (!slot) return fail('That is not one of the demo time slots.')
  const open = s.waitlist.find(
    (w) =>
      w.profileId === input.profileId &&
      sameSlot(w, input.resourceId, input.date, input.start) &&
      (w.state === 'waiting' || w.state === 'offered'),
  )
  if (open) return ok(s, { entry: open, created: false })
  if (
    spanMs({ date: input.date, start: slot.start, end: slot.end, endDate: slot.endDate }).end <=
    input.nowMs
  )
    return fail('That slot has already finished.')
  const taken = s.reservations.find(
    (r) =>
      isActive(r) &&
      r.resourceId === input.resourceId &&
      r.date === input.date &&
      r.start === input.start,
  )
  if (!taken) return fail('That slot is free, so book it instead of joining a waitlist.')
  if (taken.ownerProfileId === input.profileId) return fail('You already hold this slot.')
  const id = c.newId('wl')
  const ev = makeAudit(id, 'student', 'waiting', c)
  const entry: WaitlistEntry = {
    id,
    resourceId: input.resourceId,
    date: input.date,
    start: input.start,
    end: slot.end,
    profileId: input.profileId,
    sequence: s.nextSequence,
    state: 'waiting',
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
  }
  return ok(
    { ...s, waitlist: [...s.waitlist, entry], nextSequence: s.nextSequence + 1 },
    { entry, created: true },
    [
      notice(
        input.profileId,
        id,
        ev,
        'Added to recorded demo waitlist',
        'This is not a reservation. You only get a slot if an offer is made and you accept it.',
        WAITLIST_PATH,
        'optional',
      ),
    ],
  )
}

export function leaveWaitlist(
  s: SportsStore,
  profileId: string,
  entryId: string,
  c: Ctx,
): Change<void> {
  const w = s.waitlist.find((x) => x.id === entryId)
  if (!w || w.profileId !== profileId) return fail('That waitlist entry was not found.')
  if (w.state !== 'waiting' && w.state !== 'offered') return fail('This entry is already finished.')
  return ok(
    {
      ...s,
      waitlist: s.waitlist.map((x) =>
        x.id === entryId ? { ...x, state: 'declined' as const, updatedAt: c.nowIso } : x,
      ),
    },
    undefined,
  )
}

/** Position among RECORDED demo entries for that slot, never a campus-wide rank. */
export function waitlistPosition(
  s: SportsStore,
  w: WaitlistEntry,
): { position: number; of: number } | null {
  if (w.state !== 'waiting') return null
  const queue = s.waitlist
    .filter((x) => x.state === 'waiting' && sameSlot(x, w.resourceId, w.date, w.start))
    .sort((a, b) => a.sequence - b.sequence)
  const i = queue.findIndex((x) => x.id === w.id)
  return i < 0 ? null : { position: i + 1, of: queue.length }
}

export const offerExpired = (w: WaitlistEntry, nowMs: number) =>
  w.state === 'offered' && !!w.offerExpiresAt && Date.parse(w.offerExpiresAt) <= nowMs

/** Offer a freed slot to the earliest recorded waiting entry. Nothing is granted until they accept. */
export function issueOffer(
  s: SportsStore,
  resourceId: string,
  date: DateOnly,
  start: LocalTime,
  c: Ctx,
  nowMs: number,
): Change<WaitlistEntry> {
  const resource = findResource(s, resourceId)
  if (!resource) return fail('That resource was not found.')
  const taken = s.reservations.find(
    (r) => isActive(r) && r.resourceId === resourceId && r.date === date && r.start === start,
  )
  if (taken) return fail('That slot is still reserved, so there is nothing to offer yet.')
  const live = s.waitlist.find(
    (w) => sameSlot(w, resourceId, date, start) && w.state === 'offered' && !offerExpired(w, nowMs),
  )
  if (live) return fail('An offer for this slot is already open.')
  const next = s.waitlist
    .filter((w) => sameSlot(w, resourceId, date, start) && w.state === 'waiting')
    .sort((a, b) => a.sequence - b.sequence)[0]
  if (!next) return fail('No one is waiting for that slot.')
  const offerExpiresAt = isoPlus(c.nowIso, s.config.offerLifetimeMinutes)
  const ev = makeAudit(next.id, 'demoSimulator', 'offered', c, `Expires ${offerExpiresAt}`)
  const entry: WaitlistEntry = {
    ...next,
    state: 'offered',
    offeredAt: c.nowIso,
    offerExpiresAt,
    updatedAt: c.nowIso,
  }
  return ok(
    op(
      { ...s, waitlist: s.waitlist.map((w) => (w.id === next.id ? entry : w)) },
      'issueOffer',
      next.id,
      'waiting',
      'offered',
      c,
    ),
    entry,
    [
      notice(
        next.profileId,
        next.id,
        ev,
        'A demo slot offer is available',
        `${resource.label}, ${date} ${start}. Accept within ${s.config.offerLifetimeMinutes} minutes. It is not yours until you accept.`,
        WAITLIST_PATH,
        'important',
      ),
    ],
  )
}

function isoPlus(iso: string, minutes: number): string {
  return isoFromMs(Date.parse(iso) + minutes * 60_000)
}

/** Marks a lapsed offer expired. This is an explicit, visible step, not a background worker. */
export function expireOffer(
  s: SportsStore,
  entryId: string,
  c: Ctx,
  nowMs: number,
): Change<WaitlistEntry> {
  const w = s.waitlist.find((x) => x.id === entryId)
  if (!w) return fail('That waitlist entry was not found.')
  if (!offerExpired(w, nowMs)) return fail('That offer has not lapsed yet.')
  const next: WaitlistEntry = { ...w, state: 'expired', updatedAt: c.nowIso }
  return ok(
    op(
      { ...s, waitlist: s.waitlist.map((x) => (x.id === w.id ? next : x)) },
      'expireOffer',
      w.id,
      'offered',
      'expired',
      c,
    ),
    next,
  )
}

/** Accepting re-runs every reservation check before one booking is created. Declining frees the offer. */
export function respondToOffer(
  s: SportsStore,
  profileId: string,
  entryId: string,
  accept: boolean,
  c: Ctx,
  ctx: { today: DateOnly; nowMs: number },
): Change<{ reservation?: SportsReservation }> {
  const w = s.waitlist.find((x) => x.id === entryId)
  if (!w || w.profileId !== profileId) return fail('That waitlist entry was not found.')
  if (w.state !== 'offered') return fail('There is no open offer on this entry.')
  if (!accept) {
    return ok(
      {
        ...s,
        waitlist: s.waitlist.map((x) =>
          x.id === w.id ? { ...x, state: 'declined' as const, updatedAt: c.nowIso } : x,
        ),
      },
      {},
    )
  }
  if (offerExpired(w, ctx.nowMs))
    return fail(
      'This offer has expired. It stays on the list until the simulator marks it expired.',
    )
  const input: ReserveInput = {
    profileId,
    resourceId: w.resourceId,
    date: w.date,
    start: w.start,
    idempotencyKey: `offer-${w.id}`,
    ...ctx,
  }
  const v = validateNew(s, input)
  if (!v.ok) return v
  const { reservation, ev } = newReservation(input, v.resource, v.end, v.endDate, c, {
    action: 'confirmedFromOffer',
    note: 'Accepted a waitlist offer',
  })
  return ok(
    {
      ...s,
      reservations: [reservation, ...s.reservations],
      waitlist: s.waitlist.map((x) =>
        x.id === w.id
          ? {
              ...x,
              state: 'accepted' as const,
              resultingReservationId: reservation.id,
              updatedAt: c.nowIso,
            }
          : x,
      ),
    },
    { reservation },
    [
      notice(
        profileId,
        reservation.id,
        ev,
        'Reservation saved in CampusOS demo',
        `${v.resource.label}, ${w.date} ${w.start}, from your accepted offer.`,
        bookingPath(reservation.id),
      ),
    ],
  )
}

/* ───────────────────────────── Gym ───────────────────────────── */

export const GYM_ID = 'DEMO-GYM'
export const LIBRARY_ID = 'DEMO-LIBRARY'
const forFacility = (facilityId: string) => (g: { facilityId?: string }) =>
  (g.facilityId ?? GYM_ID) === facilityId

/** One open self-report per profile per facility. A second click returns the open one. */
export function gymCheckIn(
  s: SportsStore,
  profileId: string,
  c: Ctx,
  facilityId: string = GYM_ID,
): Change<{ created: boolean }> {
  const mine = forFacility(facilityId)
  const open = s.gymSessions.find((g) => g.profileId === profileId && !g.endedAt && mine(g))
  if (open) return ok(s, { created: false })
  const session = {
    id: c.newId('gs'),
    profileId,
    ...(facilityId !== GYM_ID ? { facilityId } : {}),
    startedAt: c.nowIso,
    expiresAt: isoFromMs(Date.parse(c.nowIso) + s.config.checkInMaxMinutes * 60_000),
    provenance: userProvenance(c.nowIso),
  }
  return ok({ ...s, gymSessions: [session, ...s.gymSessions].slice(0, 300) }, { created: true })
}

export function gymCheckOut(
  s: SportsStore,
  profileId: string,
  c: Ctx,
  facilityId: string = GYM_ID,
): Change<void> {
  const mine = forFacility(facilityId)
  const open = s.gymSessions.find((g) => g.profileId === profileId && !g.endedAt && mine(g))
  if (!open) return fail('You are not checked in, so there is nothing to check out of.')
  return ok(
    {
      ...s,
      gymSessions: s.gymSessions.map((g) =>
        g.id === open.id ? { ...g, endedAt: c.nowIso, closeReason: 'MANUAL' as const } : g,
      ),
    },
    undefined,
  )
}

/** An explicit correction: removes your open self-report instead of pretending you left. */
export function gymCorrectCheckIn(
  s: SportsStore,
  profileId: string,
  facilityId: string = GYM_ID,
): Change<void> {
  const mine = forFacility(facilityId)
  const open = s.gymSessions.find((g) => g.profileId === profileId && !g.endedAt && mine(g))
  if (!open) return fail('You have no open check-in to correct.')
  return ok({ ...s, gymSessions: s.gymSessions.filter((g) => g.id !== open.id) }, undefined)
}

export function setOccupancy(
  s: SportsStore,
  input: { count: number | null; level?: Occupancy['level'] },
  c: Ctx,
  facilityId: string = GYM_ID,
): Change<void> {
  if (input.count !== null && (!Number.isInteger(input.count) || input.count < 0))
    return fail('Enter a whole number, or leave it unknown.')
  const occupancy: Occupancy = {
    count: input.count,
    ...(input.level ? { level: input.level } : {}),
    completeness: input.count === null ? 'unknown' : 'partial',
    asOf: c.nowIso,
    sourceLabel: 'Demo simulator snapshot (not a live count)',
    provenance: simulatedProvenance(c.nowIso),
  }
  const field = facilityId === LIBRARY_ID ? 'libraryOccupancy' : 'occupancy'
  const before = s[field]
  return ok(
    op(
      { ...s, [field]: occupancy },
      'setOccupancy',
      facilityId,
      before ? String(before.count) : 'none',
      String(input.count),
      c,
    ),
    undefined,
  )
}

/** An equipment fault never closes anything else: closure is a separate simulator action. */
export function setEquipmentStatus(
  s: SportsStore,
  equipmentId: string,
  status: Equipment['status'],
  c: Ctx,
): Change<void> {
  const e = s.equipment.find((x) => x.id === equipmentId)
  if (!e) return fail('That equipment was not found.')
  const equipment = s.equipment.map((x) =>
    x.id === equipmentId
      ? {
          ...x,
          status,
          asOf: c.nowIso,
          sourceLabel: 'Demo simulator report',
          provenance: simulatedProvenance(c.nowIso),
        }
      : x,
  )
  return ok(
    op({ ...s, equipment }, 'setEquipmentStatus', equipmentId, e.status, status, c),
    undefined,
  )
}

export function reportFault(
  s: SportsStore,
  profileId: string,
  equipmentId: string,
  text: string,
  c: Ctx,
  evidence: FaultReport['evidence'] = [],
): Change<void> {
  if (!s.equipment.some((x) => x.id === equipmentId)) return fail('That equipment was not found.')
  if (!text.trim()) return fail('Describe the problem so it can be noted.')
  const report = {
    id: c.newId('fr'),
    equipmentId,
    profileId,
    note: text.trim().slice(0, 300),
    at: c.nowIso,
    ...(evidence?.length ? { evidence } : {}),
  }
  return ok({ ...s, faultReports: [report, ...s.faultReports].slice(0, 100) }, undefined)
}

/** Adds an equipment item the simulator was TOLD about. Without this, equipment stays "not supplied". */
export function addEquipment(
  s: SportsStore,
  facilityId: string,
  label: string,
  c: Ctx,
): Change<void> {
  if (!findResource(s, facilityId)) return fail('That facility was not found.')
  const name = label.trim()
  if (!name) return fail('Enter the equipment name.')
  const item: Equipment = {
    id: c.newId('eq'),
    facilityId,
    label: name.slice(0, 60),
    status: 'unknown',
    sourceLabel: 'Entered in the demo simulator (not an inventory)',
    asOf: c.nowIso,
    provenance: simulatedProvenance(c.nowIso),
  }
  return ok(
    op(
      { ...s, equipment: [...s.equipment, item] },
      'addEquipment',
      facilityId,
      'none',
      item.label,
      c,
    ),
    undefined,
  )
}

/* ───────────────────────────── Library loans (demo records) ───────────────────────────── */

export const LOANS_PATH = '/bookings/library/loans'

/** A demo loan entered in the simulator. A due date is date-only: it never gains an invented hour. */
export function addDemoLoan(
  s: SportsStore,
  input: { profileId: string; bookId: string; dueDate: DateOnly; issuedOn?: DateOnly },
  c: Ctx,
): Change<Loan> {
  if (!s.catalogue.some((b) => b.id === input.bookId)) return fail('That demo book was not found.')
  if (input.issuedOn && input.issuedOn > input.dueDate)
    return fail('The issue date must not be after the due date.')
  const loan: Loan = {
    id: c.newId('loan'),
    profileId: input.profileId,
    bookId: input.bookId,
    ...(input.issuedOn ? { issuedOn: input.issuedOn } : {}),
    dueDate: input.dueDate,
    updatedAt: c.nowIso,
    provenance: simulatedProvenance(
      c.nowIso,
      'Entered in the demo simulator (not library circulation data)',
    ),
  }
  return ok(
    op({ ...s, loans: [loan, ...s.loans] }, 'addDemoLoan', loan.id, 'none', input.dueDate, c),
    loan,
  )
}

/** A changed due date updates the SAME loan and re-arms its reminder: no second loan appears. */
export function updateLoanDue(
  s: SportsStore,
  loanId: string,
  dueDate: DateOnly,
  c: Ctx,
): Change<Loan> {
  const l = s.loans.find((x) => x.id === loanId)
  if (!l) return fail('That loan was not found.')
  if (l.returnedOn) return fail('This loan is already recorded as returned.')
  const next: Loan = { ...l, dueDate, reminderNotifiedAt: undefined, updatedAt: c.nowIso }
  return ok(
    op(
      { ...s, loans: s.loans.map((x) => (x.id === l.id ? next : x)) },
      'updateLoanDue',
      l.id,
      l.dueDate,
      dueDate,
      c,
    ),
    next,
  )
}

/** Only the simulator can record a return. A student cannot certify one, and no fine is ever computed. */
export function recordLoanReturn(
  s: SportsStore,
  loanId: string,
  today: DateOnly,
  c: Ctx,
): Change<Loan> {
  const l = s.loans.find((x) => x.id === loanId)
  if (!l) return fail('That loan was not found.')
  if (l.returnedOn) return fail('This loan is already recorded as returned.')
  const next: Loan = { ...l, returnedOn: today, updatedAt: c.nowIso }
  return ok(
    op(
      { ...s, loans: s.loans.map((x) => (x.id === l.id ? next : x)) },
      'recordLoanReturn',
      l.id,
      'on loan',
      'returned',
      c,
    ),
    next,
  )
}

/** The student's own note, kept apart from the (simulated) circulation data. */
export function setLoanNote(
  s: SportsStore,
  profileId: string,
  loanId: string,
  note: string,
  c: Ctx,
): Change<Loan> {
  const l = s.loans.find((x) => x.id === loanId)
  if (!l || l.profileId !== profileId) return fail('That loan was not found.')
  const next: Loan = {
    ...l,
    studentNote: note.trim().slice(0, 200) || undefined,
    updatedAt: c.nowIso,
  }
  return ok({ ...s, loans: s.loans.map((x) => (x.id === l.id ? next : x)) }, next)
}

/**
 * One in-app reminder per loan, from 09:00 on the day BEFORE a date-only due date, while the loan is
 * not recorded as returned. It shows when the app next looks; nothing is claimed for a closed app.
 */
export function dueLoanNotices(s: SportsStore, nowMs: number, c: Ctx): Change<number> {
  const due = s.loans.filter(
    (l) =>
      !l.returnedOn &&
      !l.reminderNotifiedAt &&
      instantMs(addDays(l.dueDate, -1), '09:00' as LocalTime) <= nowMs,
  )
  if (due.length === 0) return ok(s, 0)
  const notices: Notice[] = []
  const loans = s.loans.map((l) => {
    if (!due.includes(l)) return l
    const ev = makeAudit(l.id, 'demoSimulator', 'dueReminder', c, 'Derived in-app reminder')
    const book = s.catalogue.find((b) => b.id === l.bookId)
    notices.push(
      notice(
        l.profileId,
        l.id,
        ev,
        'Library book due soon (demo)',
        `${book?.title ?? 'A demo book'} is due ${l.dueDate}. A date-only due date, so no time is implied. This is a demo record, not library data.`,
        LOANS_PATH,
      ),
    )
    return { ...l, reminderNotifiedAt: c.nowIso }
  })
  return ok({ ...s, loans }, due.length, notices)
}

export const bookOf = (s: SportsStore, id: string): Book | undefined =>
  s.catalogue.find((b) => b.id === id)

/**
 * A check-in is a lease with an end. Any open self-report past its end is closed as AUTO_EXPIRED at its
 * expiry time. That means the digital check-in stopped counting; it does NOT mean the person left, so
 * physical use stays unconfirmed. It is derived from timestamps, so running it twice, or after a reload,
 * gives the same result and never revives a closed session. Returns the same object when nothing expired.
 */
export function reconcileLeases(s: SportsStore, nowMs: number): SportsStore {
  const maxMs = s.config.checkInMaxMinutes * 60_000
  let changed = false
  const gymSessions = s.gymSessions.map((g) => {
    if (g.endedAt) return g
    const end = g.expiresAt ? Date.parse(g.expiresAt) : Date.parse(g.startedAt) + maxMs
    if (end > nowMs) return g
    changed = true
    return {
      ...g,
      expiresAt: g.expiresAt ?? isoFromMs(end),
      endedAt: isoFromMs(end),
      closeReason: 'AUTO_EXPIRED' as const,
    }
  })
  // A booked session's lease ends with the booking. A check-in nobody closed is expired, never "finished":
  // the record says physical use is unconfirmed. Derived from the slot end, so a reload changes nothing.
  const reservations = s.reservations.map((r) => {
    if (r.state !== 'checkedIn' && r.state !== 'inUse') return r
    const { end } = spanMs(r)
    if (end > nowMs) return r
    changed = true
    const at = isoFromMs(end)
    return {
      ...r,
      state: 'checkInExpired' as const,
      updatedAt: at,
      version: r.version + 1,
      history: [
        ...r.history,
        {
          id: `${r.id}-lease-expired`,
          entityId: r.id,
          actorKind: 'system' as const,
          action: 'checkInExpired',
          at,
          dataMode: 'simulated' as const,
          note: 'The booking ended. Check-in expired; physical use unconfirmed.',
        },
      ],
    }
  })
  return changed ? { ...s, gymSessions, reservations } : s
}

/** "Still here": renews an open check-in for another full lease, never after it expired. */
export function gymRenew(
  s: SportsStore,
  profileId: string,
  c: Ctx,
  nowMs: number,
  facilityId: string = GYM_ID,
): Change<void> {
  const mine = forFacility(facilityId)
  const open = s.gymSessions.find((g) => g.profileId === profileId && !g.endedAt && mine(g))
  if (!open) return fail('That check-in has already expired. Check in again if you are still here.')
  const end = open.expiresAt
    ? Date.parse(open.expiresAt)
    : Date.parse(open.startedAt) + s.config.checkInMaxMinutes * 60_000
  if (end <= nowMs)
    return fail('That check-in has already expired. Check in again if you are still here.')
  const next = isoFromMs(nowMs + s.config.checkInMaxMinutes * 60_000)
  return ok(
    {
      ...s,
      gymSessions: s.gymSessions.map((g) =>
        g.id === open.id ? { ...g, expiresAt: next, lastConfirmedAt: c.nowIso } : g,
      ),
    },
    undefined,
  )
}
