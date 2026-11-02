import {
  ACTIVE_RESERVATION_STATES,
  reservationStateLabel as machineStateLabel,
  type EssStore,
} from '@/domain/ess'
import {
  bookOf,
  GYM_ID,
  isActive,
  LIBRARY_ID,
  offerExpired,
  policyFor,
  slotsOn,
} from '@/domain/sports-logic'
import {
  reservationStateLabel,
  resourceNoun,
  type Activity,
  type Resource,
  type SportsReservation,
  type SportsStore,
  type WaitlistEntry,
} from '@/domain/sports'
import {
  formatDateShort,
  formatInstant,
  formatTime,
  timeToMinutes,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { itemsInRange } from './occurrences'
import { isCancelled, isTimed } from './items'
import { instantMs } from './now'
import type { ActivityEntry } from './home'
import type { ProfileData } from '@/domain/records'

const byUpdated = <T extends { updatedAt: string; id: string }>(a: T, b: T) =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1

export const resourcesFor = (s: SportsStore, activity: Activity) =>
  s.resources.filter((r) => r.activity === activity)

export const ownReservations = (s: SportsStore, profileId: string) =>
  s.reservations.filter((r) => r.ownerProfileId === profileId).sort(byUpdated)

const endMs = (r: Pick<SportsReservation, 'date' | 'end'>) => instantMs(r.date, r.end)
const startMs = (r: Pick<SportsReservation, 'date' | 'start'>) => instantMs(r.date, r.start)

export const upcomingReservations = (s: SportsStore, profileId: string, nowMs: number) =>
  ownReservations(s, profileId)
    .filter((r) => isActive(r) && endMs(r) > nowMs)
    .sort((a, b) => startMs(a) - startMs(b))

export const pastReservations = (s: SportsStore, profileId: string, nowMs: number) =>
  ownReservations(s, profileId).filter(
    (r) => r.state === 'completed' || (isActive(r) && endMs(r) <= nowMs),
  )
export const cancelledReservations = (s: SportsStore, profileId: string) =>
  ownReservations(s, profileId).filter((r) => r.state === 'cancelled' || r.state === 'noShow')

export interface SlotView {
  /** The date the slot starts on (the day after the service date for an after-midnight start). */
  startDate: DateOnly
  endDate: DateOnly
  start: LocalTime
  end: LocalTime
  state: 'free' | 'reserved' | 'past' | 'closed'
  mine: boolean
}

/** Published availability for one resource and day. "free" means unreserved in this local data, nothing more. */
export function slotViews(
  s: SportsStore,
  resource: Resource,
  serviceDate: DateOnly,
  profileId: string,
  nowMs: number,
): SlotView[] {
  return slotsOn(s, resource, serviceDate).map((slot) => {
    const sEnd = instantMs(slot.endDate, slot.end)
    const taken = s.reservations.find(
      (r) =>
        isActive(r) &&
        r.resourceId === resource.id &&
        r.date === slot.startDate &&
        r.start === slot.start,
    )
    return {
      ...slot,
      state:
        sEnd <= nowMs
          ? 'past'
          : resource.status !== 'open'
            ? 'closed'
            : taken
              ? 'reserved'
              : 'free',
      mine: taken?.ownerProfileId === profileId,
    }
  })
}

export type UnitState = 'available' | 'reserved' | 'mine' | 'maintenance' | 'unknown' | 'past'
export interface UnitView {
  resource: Resource
  state: UnitState
}
export interface UnitSummary {
  units: UnitView[]
  /** Physical inventory the demo data lists. Maintenance never changes this number. */
  total: number
  reservable: number
}

/**
 * Per-unit state for one interval of a multi-unit facility (e.g. two snooker tables). "Reservable" counts
 * only units with no recorded booking and an open status; it says nothing about physical use.
 */
export function unitSummary(
  s: SportsStore,
  activity: Activity,
  serviceDate: DateOnly,
  startDate: DateOnly,
  start: LocalTime,
  profileId: string,
  nowMs: number,
): UnitSummary {
  const units = resourcesFor(s, activity)
    .filter((r) => r.bookable !== false)
    .map((resource): UnitView => {
      if (resource.status === 'closed') return { resource, state: 'maintenance' }
      if (resource.status === 'unknown') return { resource, state: 'unknown' }
      const v = slotViews(s, resource, serviceDate, profileId, nowMs).find(
        (x) => x.startDate === startDate && x.start === start,
      )
      if (!v) return { resource, state: 'unknown' }
      if (v.state === 'past') return { resource, state: 'past' }
      if (v.state === 'reserved') return { resource, state: v.mine ? 'mine' : 'reserved' }
      return { resource, state: 'available' }
    })
  return {
    units,
    total: units.length,
    reservable: units.filter((u) => u.state === 'available').length,
  }
}

export const unitStateLabel: Record<UnitState, string> = {
  available: 'Available in demo schedule',
  reserved: 'Reserved',
  mine: 'Reserved by you',
  maintenance: 'Maintenance',
  unknown: 'Unknown',
  past: 'Past',
}

/** Known Calendar commitments that overlap a chosen slot. A warning only: the booking can still be saved. */
export function scheduleWarnings(
  data: ProfileData,
  date: DateOnly,
  start: LocalTime,
  end: LocalTime,
  endDate: DateOnly = date,
): string[] {
  const a = instantMs(date, start)
  const b = instantMs(endDate, end)
  return itemsInRange(data, date, endDate)
    .filter((i) => isTimed(i) && i.blocksTime && !isCancelled(i) && i.recordKind !== 'booking')
    .filter((i) => {
      if (i.time.kind !== 'timed') return false
      return instantMs(i.date, i.time.start) < b && a < instantMs(i.date, i.time.end)
    })
    .map((i) => i.title)
}

export const ownWaitlist = (s: SportsStore, profileId: string) =>
  s.waitlist
    .filter((w) => w.profileId === profileId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))

export function waitlistLabel(w: WaitlistEntry, nowMs: number): string {
  if (w.state === 'offered')
    return offerExpired(w, nowMs)
      ? 'Offer lapsed (awaiting simulator)'
      : 'Offer open: not yours until you accept'
  return {
    waiting: 'Waiting (not a reservation)',
    accepted: 'Accepted',
    declined: 'Declined or left',
    expired: 'Offer expired',
    offered: '',
  }[w.state]
}

export function facilityView(s: SportsStore, profileId: string, nowMs: number, facilityId: string) {
  const facility = s.resources.find((r) => r.id === facilityId)
  const sessions = s.gymSessions.filter((g) => (g.facilityId ?? GYM_ID) === facilityId)
  const open = sessions.filter((g) => !g.endedAt)
  const staleMs = s.config.gymSessionStaleMinutes * 60_000
  const stale = open.filter((g) => nowMs - Date.parse(g.startedAt) > staleMs)
  const o = facilityId === LIBRARY_ID ? s.libraryOccupancy : s.occupancy
  const occStale = !!o && nowMs - Date.parse(o.asOf) > s.config.occupancyStaleMinutes * 60_000
  return {
    facility,
    /** Backwards-compatible alias used by the gym page. */
    gym: facility,
    hours: facility?.hours
      ? `${formatTime(facility.hours.open)}–${formatTime(facility.hours.close)}`
      : null,
    selfReportedNow: open.length - stale.length,
    staleForReview: stale.length,
    mySession: open.find((g) => g.profileId === profileId),
    /** The latest check-in of yours that ran out. The digital check-in stopped; presence is unconfirmed. */
    myExpired: open.some((g) => g.profileId === profileId)
      ? undefined
      : sessions
          .filter((g) => g.profileId === profileId && g.closeReason === 'AUTO_EXPIRED')
          .sort((a, b) => (a.endedAt! < b.endedAt! ? 1 : -1))[0],
    snapshot: !o
      ? 'Unknown. No occupancy snapshot has been recorded.'
      : o.count === null
        ? `Unknown · ${o.sourceLabel} · as of ${formatInstant(o.asOf)}`
        : `Reported active check-ins: ${o.count}${o.level ? ` · ${o.level}` : ''} · ${o.sourceLabel} · as of ${formatInstant(o.asOf)}${occStale ? ' · stale' : ''}`,
    snapshotStale: occStale,
  }
}

export const gymView = (s: SportsStore, profileId: string, nowMs: number) =>
  facilityView(s, profileId, nowMs, GYM_ID)

export const equipmentFor = (s: SportsStore, facilityId: string) =>
  s.equipment.filter((e) => (e.facilityId ?? GYM_ID) === facilityId)

export const ownLoans = (s: SportsStore, profileId: string) =>
  s.loans
    .filter((l) => l.profileId === profileId)
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : a.id < b.id ? -1 : 1))
    .map((l) => ({ loan: l, book: bookOf(s, l.bookId) }))

export const bookStatusLabel: Record<'availableSnapshot' | 'onLoanSnapshot' | 'unknown', string> = {
  availableSnapshot: 'Available in a demo snapshot (not guaranteed on the shelf)',
  onLoanSnapshot: 'On loan in a demo snapshot',
  unknown: 'Status unknown',
}

export function searchCatalogue(s: SportsStore, query: string) {
  const q = query.trim().toLowerCase()
  return s.catalogue.filter((b) => !q || `${b.title} ${b.author ?? ''}`.toLowerCase().includes(q))
}

/** One list across the booking-like records this student holds, so My Bookings shows machines too. */
export interface BookingSummary {
  id: string
  kind: 'sports' | 'machine'
  title: string
  date: DateOnly
  start: LocalTime
  end: LocalTime
  stateLabel: string
  active: boolean
  cancelled: boolean
  disrupted: boolean
  href: string
  /** The facility's activity, so a finished or cancelled booking can link to "Book again". */
  activity?: Activity
}

export function bookingSummaries(
  sports: SportsStore,
  ess: EssStore | null,
  profileId: string,
  nowMs: number,
): BookingSummary[] {
  const a: BookingSummary[] = ownReservations(sports, profileId).map((r) => ({
    id: r.id,
    kind: 'sports',
    title: sports.resources.find((x) => x.id === r.resourceId)?.label ?? 'Resource',
    date: r.date,
    start: r.start,
    end: r.end,
    stateLabel: reservationStateLabel[r.state],
    active: isActive(r) && endMs(r) > nowMs,
    cancelled: r.state === 'cancelled' || r.state === 'noShow',
    disrupted: r.disrupted,
    href: `/bookings/my/${r.id}`,
    activity: sports.resources.find((x) => x.id === r.resourceId)?.activity,
  }))
  const b: BookingSummary[] = (ess?.reservations ?? [])
    .filter((r) => r.ownerProfileId === profileId)
    .map((r) => ({
      id: r.id,
      kind: 'machine' as const,
      title: ess?.machines.find((m) => m.id === r.machineId)?.label ?? 'Machine',
      date: r.date,
      start: r.start,
      end: r.end,
      stateLabel: machineStateLabel[r.state],
      active: ACTIVE_RESERVATION_STATES.includes(r.state) && instantMs(r.date, r.end) > nowMs,
      cancelled: r.state === 'cancelled' || r.state === 'noShow',
      disrupted: r.state === 'blockedByOutage',
      href: '/services/laundry/machines',
    }))
  return [...a, ...b].sort((x, y) => instantMs(x.date, x.start) - instantMs(y.date, y.start))
}

/** Open offers surface in Home My Activity as alerts. Bookings themselves arrive through the shared booking projection. */
export function sportsActivity(s: SportsStore, profileId: string, nowMs: number): ActivityEntry[] {
  return ownWaitlist(s, profileId)
    .filter((w) => w.state === 'offered' && !offerExpired(w, nowMs))
    .map((w) => ({
      id: w.id,
      type: 'Waitlist offer' as const,
      label: `${s.resources.find((r) => r.id === w.resourceId)?.label ?? 'Slot'} offer`,
      status: 'Offer open: not yours until you accept',
      when: `${w.date} ${w.start}`,
      mode: 'simulated' as const,
      href: '/bookings/waitlist',
      active: true,
      simulated: true,
    }))
}

export { policyFor, timeToMinutes }

/** Published hours as text. A close at or before the open runs into the next day, and says so. */
export function hoursText(h: Resource['hours']): string {
  if (!h) return 'Not provided'
  const overnight = timeToMinutes(h.close) <= timeToMinutes(h.open)
  return `${formatTime(h.open)}–${formatTime(h.close)}${overnight ? ' (next day)' : ''} (demo)`
}

/** Both dates are always shown when a slot crosses midnight, e.g. "Sat, 14 Nov 11:45 pm → Sun, 15 Nov 12:15 am". */
export function spanText(s: {
  startDate: DateOnly
  start: LocalTime
  endDate: DateOnly
  end: LocalTime
}) {
  return s.endDate === s.startDate
    ? `${formatDateShort(s.startDate)}, ${formatTime(s.start)}–${formatTime(s.end)}`
    : `${formatDateShort(s.startDate)} ${formatTime(s.start)} → ${formatDateShort(s.endDate)} ${formatTime(s.end)}`
}

const UNIT_COUNTED: readonly Activity[] = [
  'badminton',
  'tableTennis',
  'pool',
  'snooker',
  'basketball',
]

/**
 * Capacity in the right unit for the facility, or an explicit "Capacity not provided". Courts and tables are
 * counted from the demo fixtures (editable data, not a measurement). People or seats are never invented, and a
 * physical count is kept apart from per-booking group limits, reservations and self-reported check-ins.
 */
export function capacityText(s: SportsStore, r: Resource): string {
  if (!UNIT_COUNTED.includes(r.activity)) return 'Capacity not provided'
  const n = s.resources.filter((x) => x.activity === r.activity).length
  const noun = resourceNoun[r.activity]
  return `${n} ${noun}${n === 1 ? '' : 's'} listed in the demo fixtures (editable sample data)`
}
