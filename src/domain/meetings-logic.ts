import { userProvenance } from './chill-logic'
import type { Attendee, Meeting, MeetingStore, Poll, Rsvp, Vote } from './meetings'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import type { DateOnly, LocalTime } from '@/lib/time'
import { instantMs, timeToMinutes } from '@/selectors/now'

/**
 * Pure rules for group meetings and polls. A meeting is one record; every change goes through an
 * explicit command that checks the revision the caller saw, so a stale edit cannot overwrite a newer one.
 */
type Change<T> = CoreChange<MeetingStore, T>
const ok = <T>(s: MeetingStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)
export const STALE = 'This meeting changed since you opened it. Refresh and try again.'
export const meetingPath = (id: string) => `/calendar/meetings/${id}`
export const pollPath = (id: string) => `/calendar/polls/${id}`

const tell = (
  to: string,
  entity: string,
  ev: string,
  title: string,
  body: string,
  href: string,
  sig: Notice['significance'] = 'standard',
) => makeNotice('meetings', to, entity, { id: ev }, title, body, href, sig)

export interface Span {
  date: DateOnly
  start: LocalTime
  end: LocalTime
}
const validSpan = (x: Span) => timeToMinutes(x.end) > timeToMinutes(x.start)

export interface NewMeeting extends Span {
  organizerProfileId: string
  title: string
  purpose?: string
  agenda?: string
  links?: string[]
  attendees: { profileId: string; required: boolean }[]
  roomReservationId?: string
  roomId?: string
  scope?: Meeting['scope']
  opId: string
}

export function createMeeting(
  s: MeetingStore,
  input: NewMeeting,
  c: Ctx,
  nowMs: number,
): Change<{ meeting: Meeting; created: boolean }> {
  const dup = s.meetings.find(
    (m) => m.opId === input.opId && m.organizerProfileId === input.organizerProfileId,
  )
  if (dup) return ok(s, { meeting: dup, created: false })
  if (!input.title.trim()) return fail('Give the meeting a title.')
  if (!validSpan(input)) return fail('The end must be after the start.')
  if (instantMs(input.date, input.end) <= nowMs) return fail('That time has already passed.')
  const ids = Array.from(
    new Set([input.organizerProfileId, ...input.attendees.map((a) => a.profileId)]),
  )
  const attendees: Attendee[] = ids.map((p) =>
    p === input.organizerProfileId
      ? { profileId: p, required: true, rsvp: 'ACCEPTED' as const, respondedAt: c.nowIso }
      : {
          profileId: p,
          required: input.attendees.find((a) => a.profileId === p)?.required ?? true,
          rsvp: 'INVITED' as const,
        },
  )
  const id = c.newId('mtg')
  const m: Meeting = {
    id,
    organizerProfileId: input.organizerProfileId,
    title: input.title.trim(),
    ...(input.purpose?.trim() ? { purpose: input.purpose.trim() } : {}),
    ...(input.agenda?.trim() ? { agenda: input.agenda.trim() } : {}),
    ...(input.links?.length ? { links: input.links.slice(0, 5) } : {}),
    date: input.date,
    start: input.start,
    end: input.end,
    attendees,
    ...(input.roomReservationId
      ? { roomReservationId: input.roomReservationId, roomId: input.roomId }
      : {}),
    ...(input.scope ? { scope: input.scope } : {}),
    status: 'CONFIRMED',
    revision: 1,
    opId: input.opId,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
    history: [
      { id: c.newId('mev'), at: c.nowIso, actor: input.organizerProfileId, type: 'created' },
    ],
  }
  const notes = ids.map((p) =>
    p === input.organizerProfileId
      ? tell(
          p,
          id,
          'rev1',
          'Meeting set (local)',
          `${m.title}: ${m.date} ${m.start}–${m.end}. Invitations are recorded in this on this device only; nobody on another device has been told.`,
          meetingPath(id),
        )
      : tell(
          p,
          id,
          'rev1',
          'Meeting invitation (local)',
          `${m.title}: ${m.date} ${m.start}–${m.end}. Reply from the meeting page.`,
          meetingPath(id),
          'important',
        ),
  )
  return ok({ ...s, meetings: [m, ...s.meetings] }, { meeting: m, created: true }, notes)
}

export function respond(
  s: MeetingStore,
  meetingId: string,
  profileId: string,
  response: Exclude<Rsvp, 'INVITED'>,
  c: Ctx,
): Change<Meeting> {
  const m = s.meetings.find((x) => x.id === meetingId)
  if (!m || !m.attendees.some((a) => a.profileId === profileId))
    return fail('That meeting was not found.')
  if (m.status !== 'CONFIRMED') return fail('This meeting is no longer open for replies.')
  const next: Meeting = {
    ...m,
    attendees: m.attendees.map((a) =>
      a.profileId === profileId
        ? { ...a, rsvp: response, respondedAt: c.nowIso, needsReconfirm: undefined }
        : a,
    ),
    history: [
      ...m.history,
      { id: c.newId('mev'), at: c.nowIso, actor: profileId, type: `rsvp:${response}` },
    ],
  }
  const note = tell(
    m.organizerProfileId,
    m.id,
    `rsvp-${profileId}-${response}-${m.revision}`,
    'A reply to your meeting (local)',
    `${m.title}: a guest replied "${response.toLowerCase()}".`,
    meetingPath(m.id),
  )
  return ok(
    { ...s, meetings: s.meetings.map((x) => (x.id === m.id ? next : x)) },
    next,
    profileId === m.organizerProfileId ? [] : [note],
  )
}

export function reschedule(
  s: MeetingStore,
  meetingId: string,
  actor: string,
  expectedRevision: number,
  to: Span & { roomReservationId?: string; roomId?: string },
  c: Ctx,
  nowMs: number,
): Change<Meeting> {
  const m = s.meetings.find((x) => x.id === meetingId)
  if (!m) return fail('That meeting was not found.')
  if (m.organizerProfileId !== actor) return fail('Only the organizer can move this meeting.')
  if (m.status !== 'CONFIRMED') return fail('Only an open meeting can be moved.')
  if (m.revision !== expectedRevision) return fail(STALE)
  if (!validSpan(to)) return fail('The end must be after the start.')
  if (instantMs(to.date, to.end) <= nowMs) return fail('That time has already passed.')
  const rev = m.revision + 1
  const next: Meeting = {
    ...m,
    ...to,
    // Everyone but the organizer must answer again, because the time they agreed to is gone.
    attendees: m.attendees.map((a) =>
      a.profileId === m.organizerProfileId
        ? a
        : { ...a, rsvp: 'INVITED' as const, needsReconfirm: true, respondedAt: undefined },
    ),
    revision: rev,
    updatedAt: c.nowIso,
    history: [
      ...m.history,
      {
        id: c.newId('mev'),
        at: c.nowIso,
        actor,
        type: 'rescheduled',
        note: `${m.date} ${m.start} → ${to.date} ${to.start}`,
      },
    ],
  }
  const notes = m.attendees.map((a) =>
    tell(
      a.profileId,
      m.id,
      `rev${rev}`,
      'Meeting time changed (local)',
      `${m.title}: now ${to.date} ${to.start}–${to.end} (was ${m.date} ${m.start}).${a.profileId === m.organizerProfileId ? '' : ' Please reply again.'}`,
      meetingPath(m.id),
      'important',
    ),
  )
  return ok({ ...s, meetings: s.meetings.map((x) => (x.id === m.id ? next : x)) }, next, notes)
}

export function cancelMeeting(
  s: MeetingStore,
  meetingId: string,
  actor: string,
  c: Ctx,
): Change<Meeting> {
  const m = s.meetings.find((x) => x.id === meetingId)
  if (!m) return fail('That meeting was not found.')
  if (m.organizerProfileId !== actor) return fail('Only the organizer can cancel this meeting.')
  if (m.status !== 'CONFIRMED') return fail('This meeting is already finished.')
  const next: Meeting = {
    ...m,
    status: 'CANCELLED',
    revision: m.revision + 1,
    updatedAt: c.nowIso,
    history: [...m.history, { id: c.newId('mev'), at: c.nowIso, actor, type: 'cancelled' }],
  }
  const notes = m.attendees.map((a) =>
    tell(
      a.profileId,
      m.id,
      `rev${next.revision}`,
      'Meeting cancelled (local)',
      `${m.title} on ${m.date} was cancelled. The linked room, if any, was released in the recorded schedule only.`,
      meetingPath(m.id),
      'important',
    ),
  )
  return ok({ ...s, meetings: s.meetings.map((x) => (x.id === m.id ? next : x)) }, next, notes)
}

/* ───────────────────────────── Polls ───────────────────────────── */

export interface NewPoll {
  organizerProfileId: string
  title: string
  durationMin: number
  scope: Poll['scope']
  eligible: string[]
  requiredIds: string[]
  candidates: Span[]
}

export function createPoll(s: MeetingStore, input: NewPoll, c: Ctx): Change<Poll> {
  if (!input.title.trim()) return fail('Give the poll a title.')
  const eligible = Array.from(new Set([input.organizerProfileId, ...input.eligible]))
  if (eligible.length < 2) return fail('A poll needs at least one other eligible person.')
  if (input.candidates.length === 0 || input.candidates.length > 8)
    return fail('Choose between 1 and 8 candidate times.')
  if (input.candidates.some((x) => !validSpan(x)))
    return fail('Every candidate needs an end after its start.')
  const seen = new Set<string>()
  for (const x of input.candidates) {
    const k = `${x.date}|${x.start}`
    if (seen.has(k)) return fail('Two candidate times are the same.')
    seen.add(k)
  }
  const p: Poll = {
    id: c.newId('poll'),
    organizerProfileId: input.organizerProfileId,
    title: input.title.trim(),
    durationMin: input.durationMin,
    scope: input.scope,
    eligible,
    requiredIds: input.requiredIds.filter((x) => eligible.includes(x)),
    candidates: input.candidates.map((x) => ({ id: `${x.date}T${x.start}`, ...x })),
    ballots: {},
    status: 'OPEN',
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
  }
  const notes = eligible
    .filter((e) => e !== input.organizerProfileId)
    .map((e) =>
      tell(
        e,
        p.id,
        'open',
        'A time poll is open (local)',
        `${p.title}: vote on a time. Voting never overrides a clash with your timetable.`,
        pollPath(p.id),
        'important',
      ),
    )
  return ok({ ...s, polls: [p, ...s.polls] }, p, notes)
}

export function castVote(
  s: MeetingStore,
  pollId: string,
  profileId: string,
  votes: Record<string, Vote>,
  c: Ctx,
): Change<Poll> {
  const p = s.polls.find((x) => x.id === pollId)
  if (!p) return fail('That poll was not found.')
  if (!p.eligible.includes(profileId))
    return fail('You are not on this poll’s list, so you cannot vote.')
  if (p.status !== 'OPEN') return fail('This poll is closed.')
  const known = new Set(p.candidates.map((x) => x.id))
  if (Object.keys(votes).some((k) => !known.has(k)))
    return fail('That time is not part of this poll.')
  const next: Poll = {
    ...p,
    ballots: { ...p.ballots, [profileId]: { votes, at: c.nowIso } },
    updatedAt: c.nowIso,
  }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === p.id ? next : x)) }, next)
}

export function closePoll(s: MeetingStore, pollId: string, actor: string, c: Ctx): Change<Poll> {
  const p = s.polls.find((x) => x.id === pollId)
  if (!p) return fail('That poll was not found.')
  if (p.organizerProfileId !== actor) return fail('Only the organizer can close this poll.')
  if (p.status !== 'OPEN') return fail('This poll is already closed.')
  const next: Poll = { ...p, status: 'CLOSED', updatedAt: c.nowIso }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === p.id ? next : x)) }, next)
}

export interface Tally {
  candidateId: string
  yes: number
  ifNeeded: number
  no: number
  /** Eligible people who have not voted. They are not "No". */
  noReply: number
  feasible: boolean
}

/**
 * Feasible times first, then most Yes, then most If needed, then earliest. Ties are explained, and
 * nothing is chosen for the organizer: they finalize.
 */
export function tally(
  p: Poll,
  feasible: ReadonlySet<string>,
): { rows: Tally[]; ranked: Tally[]; tieNote?: string } {
  const rows = p.candidates.map((c) => {
    const votes = p.eligible.map((e) => p.ballots[e]?.votes[c.id])
    return {
      candidateId: c.id,
      yes: votes.filter((v) => v === 'YES').length,
      ifNeeded: votes.filter((v) => v === 'IF_NEEDED').length,
      no: votes.filter((v) => v === 'NO').length,
      noReply: p.eligible.filter((e) => !p.ballots[e]).length,
      feasible: feasible.has(c.id),
    }
  })
  const ranked = rows
    .filter((r) => r.feasible)
    .sort(
      (a, b) =>
        b.yes - a.yes || b.ifNeeded - a.ifNeeded || a.candidateId.localeCompare(b.candidateId),
    )
  const top = ranked[0]
  const tied = top
    ? ranked.filter((r) => r.yes === top.yes && r.ifNeeded === top.ifNeeded).length > 1
    : false
  return {
    rows,
    ranked,
    ...(tied
      ? { tieNote: 'Tied on votes, so the earliest time is listed first. The organizer decides.' }
      : {}),
  }
}

export function finalizePoll(
  s: MeetingStore,
  pollId: string,
  meetingId: string,
  actor: string,
  c: Ctx,
): Change<Poll> {
  const p = s.polls.find((x) => x.id === pollId)
  if (!p) return fail('That poll was not found.')
  if (p.organizerProfileId !== actor) return fail('Only the organizer can finalize this poll.')
  if (p.status === 'FINALIZED') return fail('This poll already produced a meeting.')
  const next: Poll = { ...p, status: 'FINALIZED', finalMeetingId: meetingId, updatedAt: c.nowIso }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === p.id ? next : x)) }, next)
}
