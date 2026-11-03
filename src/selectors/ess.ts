import {
  ACTIVE_RESERVATION_STATES,
  feeStatusLabel,
  loadStageChip,
  parcelStateLabel,
  type EssStore,
  type FeeStatus,
  type LaundryLoad,
  type Machine,
  type Parcel,
  type ProviderVisit,
  type Reservation,
} from '@/domain/ess'
import {
  isParcelOverdue,
  parcelAgeHours,
  parcelPath,
  slotsForDay,
  loadPath,
} from '@/domain/ess-logic'
import {
  formatDateShort,
  formatInstant,
  formatTime,
  isoFromMs,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { formatPaise } from '@/lib/money'
import type { ActivityEntry } from './home'
import { instantMs } from './now'

/* ───────────────────────────── SS Laundry ───────────────────────────── */

export const ownLoads = (s: EssStore, profileId: string) =>
  s.loads.filter((l) => l.ownerProfileId === profileId)

export const isLoadFinished = (l: LaundryLoad) => l.cancelled || l.stage === 'collected'

const byUpdated = <T extends { updatedAt: string; id: string }>(a: T, b: T) =>
  a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1

export const activeLoads = (loads: readonly LaundryLoad[]) =>
  loads.filter((l) => !isLoadFinished(l)).sort(byUpdated)
export const finishedLoads = (loads: readonly LaundryLoad[]) =>
  loads.filter(isLoadFinished).sort(byUpdated)

/** What the return date means. Missing is "awaiting confirmation", never a guessed date. */
export function expectedReturnText(l: LaundryLoad): string {
  if (!l.expectedReturnDate || l.expectedReturnConfidence === 'unknown')
    return l.delayFlag
      ? 'New date unknown. Awaiting confirmation.'
      : 'Unknown. Awaiting confirmation.'
  return `${formatDateShort(l.expectedReturnDate)} (${l.expectedReturnConfidence === 'confirmed' ? 'confirmed' : 'tentative'})`
}

export function visitText(v: ProviderVisit | null): { headline: string; detail: string[] } {
  if (!v)
    return {
      headline: 'No visit has been reported',
      detail: ['No schedule has been supplied, so none is shown or guessed.'],
    }
  const window =
    v.date &&
    `${formatDateShort(v.date)}${v.windowStart && v.windowEnd ? `, ${formatTime(v.windowStart)}–${formatTime(v.windowEnd)}` : ''}`
  const head = {
    tentative: 'Visit announced (tentative)',
    confirmed: 'Visit confirmed',
    rescheduled: 'Visit rescheduled',
    cancelled: 'Visit cancelled',
  }[v.status]
  return {
    headline: head,
    detail: [
      ...(window && v.status !== 'cancelled' ? [window] : []),
      ...(v.arrivedAt
        ? [
            `Provider reported on campus at ${formatInstant(v.arrivedAt)}. This does not mean any individual load was returned.`,
          ]
        : []),
      `${v.sourceLabel} · as of ${formatInstant(v.asOf)}`,
    ],
  }
}

/* ───────────────────────────── Machines ───────────────────────────── */

export const operationalText: Record<Machine['operationalStatus'], string> = {
  working: 'Reported working',
  outOfService: 'Reported out of service',
  unknown: 'Working status unknown',
}
export const physicalText: Record<Machine['physicalStatus'], string> = {
  available: 'Reported free (report)',
  occupied: 'Reported in use (report)',
  unknown: 'Physical status unknown',
}

export const ownReservations = (s: EssStore, profileId: string) =>
  s.reservations.filter((r) => r.ownerProfileId === profileId).sort(byUpdated)

export const reservationEndMs = (r: Pick<Reservation, 'date' | 'end'>) => instantMs(r.date, r.end)
export const reservationStartMs = (r: Pick<Reservation, 'date' | 'start'>) =>
  instantMs(r.date, r.start)

export const upcomingReservations = (s: EssStore, profileId: string, nowMs: number) =>
  ownReservations(s, profileId)
    .filter((r) => ACTIVE_RESERVATION_STATES.includes(r.state) && reservationEndMs(r) > nowMs)
    .sort((a, b) => reservationStartMs(a) - reservationStartMs(b))

export const pastReservations = (s: EssStore, profileId: string, nowMs: number) =>
  ownReservations(s, profileId).filter(
    (r) => !ACTIVE_RESERVATION_STATES.includes(r.state) || reservationEndMs(r) <= nowMs,
  )

export interface SlotView {
  start: LocalTime
  end: LocalTime
  state: 'free' | 'reserved' | 'past'
  mine: boolean
}

/** Slot availability for one machine and day. "free" means unreserved in this local data, nothing more. */
export function slotViews(
  s: EssStore,
  machineId: string,
  date: DateOnly,
  profileId: string,
  nowMs: number,
): SlotView[] {
  return slotsForDay(s.rules.slotMinutes).map((slot) => {
    const startMs = instantMs(date, slot.start)
    const endMs = instantMs(date, slot.end)
    const taken = s.reservations.find(
      (r) =>
        r.machineId === machineId &&
        r.date === date &&
        ACTIVE_RESERVATION_STATES.includes(r.state) &&
        instantMs(r.date, r.start) < endMs &&
        startMs < instantMs(r.date, r.end),
    )
    return {
      ...slot,
      state: endMs <= nowMs ? 'past' : taken ? 'reserved' : 'free',
      mine: taken?.ownerProfileId === profileId,
    }
  })
}

/** An outage never silently changes a reservation; it only raises a warning on it. */
export function reservationWarning(s: EssStore, r: Reservation): string | null {
  const m = s.machines.find((x) => x.id === r.machineId)
  if (m?.operationalStatus === 'outOfService' && r.state === 'reserved')
    return `${m.label} is reported out of service. Your reservation has not been changed or cancelled.`
  if (r.state === 'blockedByOutage')
    return 'Marked as affected by an outage. Check the machine before you go.'
  return null
}

export function cycleEstimate(r: Reservation, nowMs: number) {
  if (!r.cycleStartAt || !r.cycleMinutes) return null
  const endMs = Date.parse(r.cycleStartAt) + r.cycleMinutes * 60_000
  return { endMs, endIso: isoFromMs(endMs), reached: endMs <= nowMs, minutes: r.cycleMinutes }
}

/** True only while the grace period has run out on a still-reserved slot. */
export const graceExpired = (s: EssStore, r: Reservation, nowMs: number) =>
  r.state === 'reserved' && nowMs >= reservationStartMs(r) + s.rules.graceMinutes * 60_000

/* ───────────────────────────── Mess ───────────────────────────── */

export const openMessSession = (s: EssStore, profileId: string) =>
  s.messSessions.find((x) => x.profileId === profileId && !x.endedAt)

export function messOccupancy(s: EssStore, nowMs: number) {
  const open = s.messSessions.filter((x) => !x.endedAt)
  const staleMs = s.rules.messSessionStaleMinutes * 60_000
  const stale = open.filter((x) => nowMs - Date.parse(x.startedAt) > staleMs)
  const fresh = open.length - stale.length
  return {
    selfReportedNow: fresh,
    staleForReview: stale.length,
    participants: s.messOptIn.length,
    text:
      s.messOptIn.length === 0
        ? 'No one has joined self-reporting, so there is no sample to show.'
        : `${fresh} ${fresh === 1 ? 'person has' : 'people have'} self-reported being in the mess (a self-reported sample of ${s.messOptIn.length} ${s.messOptIn.length === 1 ? 'profile' : 'profiles'}).`,
    caveat:
      'Self-reported sample from personas only. Not actual occupied seats, not a live count, and capacity is unknown, so no percentage or free-seat number is shown.',
  }
}

export interface FeeView {
  supplied: boolean
  amountText: string | null
  dueText: string | null
  lateFee: string | null
  instructions: string | null
  formUrl: string | null
  status: FeeStatus
  statusLabel: string
  sourceText: string | null
}

export function feeView(s: EssStore, profileId: string): FeeView {
  const f = s.fee
  const status: FeeStatus = f ? (s.feeStatus[profileId] ?? 'notSubmitted') : 'unknown'
  return {
    supplied: !!f,
    amountText: f?.amountMinor !== undefined ? formatPaise(f.amountMinor) : null,
    dueText: f?.dueDate ? formatDateShort(f.dueDate) : null,
    lateFee: f?.lateFee ?? null,
    instructions: f?.instructions ?? null,
    formUrl: f?.authorizedFormUrl ?? null,
    status,
    statusLabel: feeStatusLabel[status],
    sourceText: f ? `${f.sourceLabel} · as of ${formatInstant(f.asOf)}` : null,
  }
}

export const ownFeedback = (s: EssStore, profileId: string) =>
  s.messFeedback.filter((x) => x.profileId === profileId)

/* ───────────────────────────── Parcels ───────────────────────────── */

export const ownParcels = (s: EssStore, profileId: string) =>
  s.parcels.filter((p) => p.recipientProfileId === profileId).sort(byUpdated)

export const pendingParcels = (ps: readonly Parcel[]) => ps.filter((p) => p.state !== 'collected')
export const collectedParcels = (ps: readonly Parcel[]) => ps.filter((p) => p.state === 'collected')

export function parcelView(p: Parcel, s: EssStore, nowMs: number) {
  const overdue = isParcelOverdue(p, s.rules, nowMs)
  return {
    overdue,
    label: overdue ? 'Uncollected for a while' : parcelStateLabel[p.state],
    where: p.collectionPoint ?? 'Collection point unknown. Ask the collection desk.',
    ageDays: Math.floor(parcelAgeHours(p, nowMs) / 24),
  }
}

/* ───────────────────────────── Home My Activity ───────────────────────────── */

/**
 * Active loads, parcels waiting and a running wash estimate, read from the same canonical records as
 * the service pages. Machine reservations already reach Home through the shared booking projection.
 */
export function essActivity(s: EssStore, profileId: string, nowMs: number): ActivityEntry[] {
  const out: ActivityEntry[] = []
  for (const l of activeLoads(ownLoads(s, profileId)))
    out.push({
      id: l.id,
      type: 'Laundry load',
      label: l.reference ? `SS Laundry load ${l.reference}` : 'SS Laundry load',
      status: `${loadStageChip[l.stage]}${l.delayFlag ? ' · delayed' : ''}${l.discrepancyFlag ? ' · discrepancy' : ''}`,
      when: `Return: ${expectedReturnText(l)}`,
      mode: l.provenance.dataMode,
      href: loadPath(l.id),
      active: true,
      simulated: l.stage !== 'registered',
    })
  for (const p of pendingParcels(ownParcels(s, profileId))) {
    const v = parcelView(p, s, nowMs)
    out.push({
      id: p.id,
      type: 'Parcel',
      label: p.courier ? `Parcel from ${p.courier}` : 'Parcel',
      status: v.label,
      when: `Logged ${formatInstant(p.loggedAt)}`,
      mode: p.provenance.dataMode,
      href: parcelPath(p.id),
      active: true,
      simulated: true,
    })
  }
  for (const r of ownReservations(s, profileId)) {
    const c = r.state === 'used' ? cycleEstimate(r, nowMs) : null
    if (!c) continue
    out.push({
      id: `${r.id}-cycle`,
      type: 'Machine cycle',
      label: 'Wash cycle (your estimate)',
      status: c.reached ? 'Estimated finish reached (not verified)' : 'In progress (estimate)',
      when: `Estimated end ${formatInstant(c.endIso)}`,
      mode: r.provenance.dataMode,
      href: '/services/laundry/machines',
      active: true,
    })
  }
  for (const l of finishedLoads(ownLoads(s, profileId)).slice(0, 3))
    out.push({
      id: l.id,
      type: 'Laundry load',
      label: l.reference ? `SS Laundry load ${l.reference}` : 'SS Laundry load',
      status: l.cancelled ? 'Withdrawn' : 'Collection recorded (local)',
      when: `Updated ${formatInstant(l.updatedAt)}`,
      mode: l.provenance.dataMode,
      href: loadPath(l.id),
      active: false,
    })
  for (const p of collectedParcels(ownParcels(s, profileId)).slice(0, 3))
    out.push({
      id: p.id,
      type: 'Parcel',
      label: p.courier ? `Parcel from ${p.courier}` : 'Parcel',
      status: parcelStateLabel.collected,
      when: p.collectedAt ? `Collected ${formatInstant(p.collectedAt)}` : '',
      mode: p.provenance.dataMode,
      href: parcelPath(p.id),
      active: false,
      simulated: true,
    })
  return out
}
