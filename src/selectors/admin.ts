import {
  assetLabel,
  categoryLabel,
  leaveStatusLabel,
  leaveTypeLabel,
  ticketStatusLabel,
  LEAVE_OPEN,
  TICKET_OPEN,
  type AdminStore,
  type LeaveRequest,
  type Ticket,
} from '@/domain/admin'
import type { ProfileData } from '@/domain/records'
import { addDays, formatDateShort, formatInstant, type DateOnly } from '@/lib/time'
import type { ActivityEntry } from './home'
import { isCancelled, isTimed } from './items'
import { itemsInRange } from './occurrences'

/** One row in My Requests. The canonical record is always the leave request or the ticket itself. */
export interface MyRequest {
  id: string
  kind: 'leave' | 'complaint' | 'teachingAid'
  kindLabel: string
  title: string
  status: string
  statusLabel: string
  category: string
  open: boolean
  createdAt: string
  updatedAt: string
  href: string
  summary: string
}

export const ownLeaves = (s: AdminStore, profileId: string) =>
  s.leaves.filter((l) => l.ownerProfileId === profileId)
export const ownTickets = (s: AdminStore, profileId: string) =>
  s.tickets.filter((t) => t.ownerProfileId === profileId)

export const leaveHref = (id: string) => `/administration/leave/${id}`
export const ticketHref = (t: Pick<Ticket, 'id' | 'kind'>) =>
  t.kind === 'teachingAid'
    ? `/administration/teaching-aids/${t.id}`
    : `/administration/complaints/${t.id}`

/** Where a deep link to /administration/requests/:id should land, for the signed-in profile only. */
export function canonicalHref(s: AdminStore, profileId: string, id: string): string | null {
  const l = ownLeaves(s, profileId).find((x) => x.id === id)
  if (l) return leaveHref(l.id)
  const t = ownTickets(s, profileId).find((x) => x.id === id)
  return t ? ticketHref(t) : null
}

const leaveRow = (l: LeaveRequest): MyRequest => ({
  id: l.id,
  kind: 'leave',
  kindLabel: 'Leave and out-time',
  title: `${leaveTypeLabel[l.leaveType]} request, ${formatDateShort(l.startDate)}`,
  status: l.status,
  statusLabel: leaveStatusLabel[l.status],
  category: leaveTypeLabel[l.leaveType],
  open: LEAVE_OPEN.includes(l.status),
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
  href: leaveHref(l.id),
  // The reason can be private (medical, personal), so list views never print it.
  summary: 'Private reason',
})

const ticketRow = (t: Ticket): MyRequest => ({
  id: t.id,
  kind: t.kind,
  kindLabel: t.kind === 'teachingAid' ? 'Teaching-aid report' : 'Facility complaint',
  title:
    t.kind === 'teachingAid' && t.teaching
      ? `${assetLabel[t.teaching.assetType]}, ${t.teaching.classroomReference}`
      : `${categoryLabel[t.category]}${t.location ? `, ${t.location}` : ''}`,
  status: t.status,
  statusLabel: ticketStatusLabel[t.status],
  category:
    t.kind === 'teachingAid' && t.teaching
      ? assetLabel[t.teaching.assetType]
      : categoryLabel[t.category],
  open: TICKET_OPEN.includes(t.status),
  createdAt: t.createdAt,
  updatedAt: t.updatedAt,
  href: ticketHref(t),
  summary: t.description.length > 80 ? `${t.description.slice(0, 80)}…` : t.description,
})

/** Newest-updated first, then id, so the order is stable. */
export function myRequests(s: AdminStore, profileId: string): MyRequest[] {
  return [
    ...ownLeaves(s, profileId).map(leaveRow),
    ...ownTickets(s, profileId).map(ticketRow),
  ].sort((a, b) =>
    a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : a.id < b.id ? -1 : 1,
  )
}

export interface RequestFilter {
  kind?: MyRequest['kind'] | ''
  status?: string
  state?: 'open' | 'closed' | ''
  query?: string
  from?: string
  to?: string
}

/** Filters change what is shown, never what exists. */
export function filterRequests(rows: readonly MyRequest[], f: RequestFilter): MyRequest[] {
  const q = (f.query ?? '').trim().toLowerCase()
  return rows.filter(
    (r) =>
      (!f.kind || r.kind === f.kind) &&
      (!f.status || r.status === f.status) &&
      (!f.state || (f.state === 'open') === r.open) &&
      (!q || `${r.title} ${r.category} ${r.statusLabel}`.toLowerCase().includes(q)) &&
      (!f.from || r.updatedAt.slice(0, 10) >= f.from) &&
      (!f.to || r.updatedAt.slice(0, 10) <= f.to),
  )
}

const norm = (v: string | undefined) => (v ?? '').trim().toLowerCase()

/** Open tickets of the SAME student with the same category and place. A hint only: nothing is merged. */
export function similarOpenTickets(
  s: AdminStore,
  profileId: string,
  category: string,
  location: string,
): Ticket[] {
  if (!norm(location)) return []
  return ownTickets(s, profileId).filter(
    (t) =>
      TICKET_OPEN.includes(t.status) &&
      t.category === category &&
      norm(t.location) === norm(location),
  )
}

/** Earlier reports about the same classroom and equipment, among this student's own tickets only. */
export function earlierTeachingReports(s: AdminStore, profileId: string, ticket: Ticket): number {
  if (!ticket.teaching) return 0
  return ownTickets(s, profileId).filter(
    (t) =>
      t.id !== ticket.id &&
      t.teaching &&
      norm(t.teaching.classroomReference) === norm(ticket.teaching!.classroomReference) &&
      t.teaching.assetType === ticket.teaching!.assetType,
  ).length
}

/** Time between recorded demo events. Demo timing from simulator clicks, never institutional performance. */
export function demoDurationMinutes(t: Ticket, from: string, to: string): number | null {
  const a = t.history.find((h) => h.eventType === from)
  const b = [...t.history].reverse().find((h) => h.eventType === to)
  if (!a || !b) return null
  return Math.max(0, Math.round((Date.parse(b.at) - Date.parse(a.at)) / 60_000))
}

/** Classes from the student's own Calendar that fall inside a requested interval. Never invented. */
export function classesBetween(data: ProfileData, from: DateOnly, to: DateOnly) {
  return itemsInRange(data, from, to)
    .filter((i) => i.category === 'class' && isTimed(i) && !isCancelled(i))
    .map((i) => ({ key: i.key, title: i.title, date: i.date }))
}

/** Locations of the student's own timetable classes in the next two weeks, for the classroom picker. */
export function timetableRooms(data: ProfileData, today: DateOnly): string[] {
  const rooms = itemsInRange(data, today, addDays(today, 14))
    .filter((i) => i.category === 'class' && i.location)
    .map((i) => i.location as string)
  return [...new Set(rooms)].sort()
}

/** Open requests (and the latest closed ones) for Home My Activity. Every leave entry keeps its demo caveat. */
export function adminActivity(s: AdminStore, profileId: string): ActivityEntry[] {
  const rows = myRequests(s, profileId)
  const entry = (r: MyRequest, active: boolean): ActivityEntry => ({
    id: r.id,
    type:
      r.kind === 'leave'
        ? 'Leave request'
        : r.kind === 'teachingAid'
          ? 'Teaching-aid report'
          : 'Complaint',
    label: r.title,
    status: r.statusLabel,
    when: `Updated ${formatInstant(r.updatedAt)}`,
    mode: 'userCreated',
    href: `/administration/requests/${r.id}`,
    active,
    simulated: r.status !== 'submitted' && r.status !== 'resubmitted',
  })
  return [
    ...rows.filter((r) => r.open).map((r) => entry(r, true)),
    ...rows
      .filter((r) => !r.open)
      .slice(0, 3)
      .map((r) => entry(r, false)),
  ]
}
