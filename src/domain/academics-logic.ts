import { userProvenance } from './chill-logic'
import {
  type Group,
  type Invite,
  type Meeting,
  type MeetingActorKind,
  type MeetingStatus,
  type AcademicsStore,
  type EventActor,
  type RequestEvent,
  INVITE_ACTIVE,
  MEETING_OPEN,
  TOPICS,
} from './academics'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import { instantMs } from '@/selectors/now'
import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * Pure rules for Academics (COS-ACADEMICS-001). Faculty, BMS Office and club conversations all use
 * THIS meeting engine with a different actor kind, so there is one state machine. A request is
 * never a confirmed meeting, nothing becomes accepted or completed by time passing, and a student
 * can never answer their own request.
 */
type Change<T> = CoreChange<AcademicsStore, T>
const ok = <T>(s: AcademicsStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)
export const STALE = 'This request changed; refresh details before acting.'

export const meetingPath = (id: string) => `/academics/appointments/${id}`
export const groupPath = (id: string) => `/academics/mentorship/groups/${id}`

const evt = (
  requestId: string,
  actorType: EventActor,
  eventType: string,
  c: Ctx,
  extra: { from?: string; to?: string; reason?: string } = {},
): RequestEvent => ({
  id: c.newId('rev'),
  requestId,
  actorType,
  eventType,
  at: c.nowIso,
  ...(extra.from ? { from: extra.from } : {}),
  ...(extra.to ? { to: extra.to } : {}),
  ...(extra.reason ? { reason: extra.reason } : {}),
})

const tell = (
  to: string,
  entity: string,
  e: { id: string },
  title: string,
  body: string,
  href: string,
  sig: Notice['significance'] = 'standard',
) => makeNotice('academics', to, entity, e, title, body, href, sig)

/* ───────────────────────────── Course Hub: personal state ───────────────────────────── */

export function markRead(
  s: AcademicsStore,
  profileId: string,
  announcementId: string,
): Change<void> {
  if (!s.announcements.some((a) => a.id === announcementId))
    return fail('That announcement was not found.')
  const have = s.read[profileId] ?? []
  if (have.includes(announcementId)) return ok(s, undefined)
  return ok({ ...s, read: { ...s.read, [profileId]: [...have, announcementId] } }, undefined)
}

export function saveNote(
  s: AcademicsStore,
  profileId: string,
  courseId: string,
  textValue: string,
  c: Ctx,
): Change<void> {
  const body = textValue.trim()
  const rest = s.notes.filter((n) => !(n.ownerProfileId === profileId && n.courseId === courseId))
  if (!body) return ok({ ...s, notes: rest }, undefined)
  if (body.length > 1000) return fail('A note can be up to 1000 characters.')
  const existing = s.notes.find((n) => n.ownerProfileId === profileId && n.courseId === courseId)
  return ok(
    {
      ...s,
      notes: [
        ...rest,
        {
          id: existing?.id ?? c.newId('note'),
          ownerProfileId: profileId,
          courseId,
          text: body,
          updatedAt: c.nowIso,
        },
      ],
    },
    undefined,
  )
}

/** True only for an https link. Anything else is shown as "Resource not provided", never opened. */
export const isSafeUrl = (u: string | undefined): u is string => {
  if (!u) return false
  try {
    const url = new URL(u)
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

/* ───────────────────────────── Meetings (faculty, office, club) ───────────────────────────── */

export interface MeetingInput {
  actorKind: MeetingActorKind
  actorId: string
  actorLabel?: string
  slotId?: string
  /** Used when no published window is chosen and proposals are allowed. */
  date?: DateOnly
  start?: LocalTime
  end?: LocalTime
  topic: Meeting['topic']
  note?: string
  groupId?: string
}

export function submitMeeting(
  s: AcademicsStore,
  input: MeetingInput & {
    profileId: string
    idempotencyKey: string
    nowMs: number
    knownClubs?: readonly string[]
  },
  c: Ctx,
): Change<{ meeting: Meeting; created: boolean }> {
  const dup = s.meetings.find(
    (m) => m.ownerProfileId === input.profileId && m.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(s, { meeting: dup, created: false })
  if (!TOPICS.includes(input.topic)) return fail('Choose a topic.')
  if ((input.note ?? '').length > 300) return fail('The note can be up to 300 characters.')
  const exists =
    input.actorKind === 'faculty'
      ? s.faculty.some((f) => f.id === input.actorId)
      : input.actorKind === 'office'
        ? s.office.id === input.actorId
        : input.knownClubs
          ? input.knownClubs.includes(input.actorId)
          : input.actorId.length > 0
  if (!exists) return fail('That person or office was not found.')
  let date = input.date
  let start = input.start
  let end = input.end
  if (input.slotId) {
    const slot = s.availability.find(
      (a) =>
        a.id === input.slotId && a.actorKind === input.actorKind && a.actorId === input.actorId,
    )
    if (!slot) return fail('That time window was not found.')
    date = slot.date
    start = slot.start
    end = slot.end
  } else if (!s.config.allowProposals) {
    return fail('No published window was chosen, and proposing a time is switched off.')
  }
  if (!date || !start || !end) return fail('Choose a date and a start and end time.')
  if (!(instantMs(date, end) > instantMs(date, start)))
    return fail('The end must be after the start.')
  if (instantMs(date, end) <= input.nowMs) return fail('That time has already passed.')
  const open = s.meetings.find(
    (m) =>
      m.ownerProfileId === input.profileId &&
      m.actorKind === input.actorKind &&
      m.actorId === input.actorId &&
      m.date === date &&
      m.start === start &&
      MEETING_OPEN.includes(m.status),
  )
  if (open) return fail('You already have an open request for that time.')
  const id = c.newId('mtg')
  const e = evt(id, 'student', 'requested', c, { to: 'requested' })
  const meeting: Meeting = {
    id,
    ownerProfileId: input.profileId,
    actorKind: input.actorKind,
    actorId: input.actorId,
    ...(input.actorLabel ? { actorLabel: input.actorLabel.slice(0, 60) } : {}),
    ...(input.slotId ? { slotId: input.slotId } : {}),
    date,
    start,
    end,
    topic: input.topic,
    ...(input.note?.trim() ? { note: input.note.trim() } : {}),
    ...(input.groupId ? { groupId: input.groupId } : {}),
    status: 'requested',
    statusVersion: 1,
    idempotencyKey: input.idempotencyKey,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
    history: [e],
  }
  return ok({ ...s, meetings: [meeting, ...s.meetings] }, { meeting, created: true }, [
    tell(
      input.profileId,
      id,
      e,
      'Demo meeting request recorded',
      'It is stored in this on this device only. Nobody has been told, and a request is not an appointment.',
      meetingPath(id),
    ),
  ])
}

export type MeetingAction =
  | 'withdraw'
  | 'acceptAlternative'
  | 'declineAlternative'
  | 'requestCancellation'
  | 'accept'
  | 'reject'
  | 'propose'
  | 'confirmAlternative'
  | 'cancel'
  | 'complete'

const STUDENT: MeetingAction[] = [
  'withdraw',
  'acceptAlternative',
  'declineAlternative',
  'requestCancellation',
]
export const actorRoleFor = (k: MeetingActorKind): 'demoFaculty' | 'demoOffice' | 'demoClub' =>
  k === 'faculty' ? 'demoFaculty' : k === 'office' ? 'demoOffice' : 'demoClub'

/** Counts accepted requests on one published window, so an exclusive window is not accepted twice in this local data. */
function acceptedOn(s: AcademicsStore, m: Meeting) {
  return s.meetings.filter(
    (x) => x.id !== m.id && x.slotId && x.slotId === m.slotId && x.status === 'acceptedDemo',
  ).length
}

export function meetingAct(
  s: AcademicsStore,
  id: string,
  action: MeetingAction,
  actor: 'student' | 'demoFaculty' | 'demoOffice' | 'demoClub',
  c: Ctx,
  opts: {
    profileId?: string
    expectedVersion?: number
    reason?: string
    alternative?: { date: DateOnly; start: LocalTime; end: LocalTime }
  } = {},
): Change<Meeting> {
  const m = s.meetings.find((x) => x.id === id)
  if (!m) return fail('That meeting request was not found.')
  const isStudentStep = STUDENT.includes(action)
  if (isStudentStep ? actor !== 'student' : actor !== actorRoleFor(m.actorKind))
    return fail('That step belongs to a different demo role, not to you.')
  if (actor === 'student' && m.ownerProfileId !== opts.profileId)
    return fail('That meeting request was not found.')
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== m.statusVersion)
    return fail(STALE)
  const reason = opts.reason?.trim()
  let to: MeetingStatus
  const patch: Partial<Meeting> = {}
  let title = ''
  let body = ''
  switch (action) {
    case 'withdraw':
      if (
        !(['requested', 'alternativeProposed', 'alternativeAccepted'] as MeetingStatus[]).includes(
          m.status,
        )
      )
        return fail(
          'Only a request that has not been accepted can be withdrawn. Ask to cancel an accepted one instead.',
        )
      to = 'withdrawn'
      title = 'Local request withdrawn'
      body = 'You withdrew this request. It stays in your history.'
      break
    case 'acceptAlternative':
      if (m.status !== 'alternativeProposed' || !m.alternative)
        return fail('There is no alternative time to accept.')
      to = 'alternativeAccepted'
      Object.assign(patch, m.alternative, { alternative: undefined })
      title = 'Alternative accepted (awaiting demo confirmation)'
      body =
        'You accepted the proposed time. It becomes a demo appointment only when the simulator confirms it.'
      break
    case 'declineAlternative':
      if (m.status !== 'alternativeProposed')
        return fail('There is no alternative time to decline.')
      to = 'withdrawn'
      title = 'Local request withdrawn'
      body = 'You declined the alternative and the request ended.'
      break
    case 'requestCancellation':
      if (m.status !== 'acceptedDemo')
        return fail('Only a request accepted on this device can be asked to cancel.')
      to = 'cancellationRequested'
      title = 'Cancellation requested'
      body = 'Recorded on this device. It is cancelled only when the simulator confirms it.'
      break
    case 'accept':
      if (m.status !== 'requested') return fail('Only a new request can be accepted.')
      if (m.slotId) {
        const cap = s.availability.find((a) => a.id === m.slotId)?.capacity ?? 1
        if (acceptedOn(s, m) >= cap)
          return fail('That window is already accepted for someone else in this reference data.')
      }
      to = 'acceptedDemo'
      title = 'Demo appointment accepted'
      body = 'Accepted in the on this device only. It is not an official appointment.'
      break
    case 'reject':
      if (m.status !== 'requested') return fail('Only a new request can be declined.')
      if (!reason) return fail('A reason is required when declining.')
      to = 'rejectedDemo'
      title = 'Local request declined'
      body = `Declined on this device: ${reason}`
      break
    case 'propose':
      if (m.status !== 'requested')
        return fail('An alternative can be proposed only for a new request.')
      if (
        !opts.alternative ||
        !(
          instantMs(opts.alternative.date, opts.alternative.end) >
          instantMs(opts.alternative.date, opts.alternative.start)
        )
      )
        return fail('Give a valid alternative date and time.')
      to = 'alternativeProposed'
      patch.alternative = opts.alternative
      title = 'Alternative time proposed (simulated)'
      body = `An alternative was proposed for ${opts.alternative.date} ${opts.alternative.start}. Your original time is unchanged until you accept it.`
      break
    case 'confirmAlternative':
      if (m.status !== 'alternativeAccepted')
        return fail('The student has not accepted an alternative.')
      to = 'acceptedDemo'
      title = 'Demo appointment accepted'
      body =
        'The alternative time is accepted in the on this device only. It is not an official appointment.'
      break
    case 'cancel':
      if (m.status !== 'acceptedDemo' && m.status !== 'cancellationRequested')
        return fail('Only an accepted request can be cancelled.')
      to = 'cancelledDemo'
      title = 'Demo appointment cancelled'
      body = 'Cancelled on this device. The history is kept.'
      break
    case 'complete':
      if (m.status !== 'acceptedDemo')
        return fail('Only an accepted request can be marked completed.')
      to = 'completedDemo'
      title = 'Demo appointment marked completed'
      body = 'Marked completed by the simulator. Time passing never does this.'
      break
  }
  const e = evt(m.id, actor, action, c, { from: m.status, to, ...(reason ? { reason } : {}) })
  const next: Meeting = {
    ...m,
    ...patch,
    status: to,
    statusVersion: m.statusVersion + 1,
    updatedAt: c.nowIso,
    history: [...m.history, e],
  }
  return ok({ ...s, meetings: s.meetings.map((x) => (x.id === m.id ? next : x)) }, next, [
    tell(
      m.ownerProfileId,
      m.id,
      e,
      title,
      body,
      meetingPath(m.id),
      action === 'accept' || action === 'reject' ? 'important' : 'standard',
    ),
  ])
}

/* ───────────────────────────── Project groups and mentorship ───────────────────────────── */

export function createGroup(
  s: AcademicsStore,
  profileId: string,
  input: { title: string; description?: string; courseId?: string; memberAliases?: string[] },
  c: Ctx,
): Change<Group> {
  if (!input.title.trim()) return fail('Give the group a title.')
  const g: Group = {
    id: c.newId('grp'),
    ownerProfileId: profileId,
    ...(input.courseId ? { courseId: input.courseId } : {}),
    title: input.title.trim().slice(0, 80),
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 300) } : {}),
    memberAliases: (input.memberAliases ?? [])
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, 8),
    milestones: [],
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
  }
  return ok({ ...s, groups: [g, ...s.groups] }, g)
}

const ownGroup = (s: AcademicsStore, profileId: string, id: string) =>
  s.groups.find((g) => g.id === id && g.ownerProfileId === profileId)

export function addMilestone(
  s: AcademicsStore,
  profileId: string,
  groupId: string,
  input: { title: string; dueDate?: DateOnly },
  c: Ctx,
): Change<void> {
  const g = ownGroup(s, profileId, groupId)
  if (!g) return fail('That group was not found.')
  if (!input.title.trim()) return fail('Give the milestone a title.')
  const next: Group = {
    ...g,
    updatedAt: c.nowIso,
    milestones: [
      ...g.milestones,
      {
        id: c.newId('ms'),
        title: input.title.trim().slice(0, 80),
        ...(input.dueDate ? { dueDate: input.dueDate } : {}),
        status: 'notStarted' as const,
      },
    ],
  }
  return ok({ ...s, groups: s.groups.map((x) => (x.id === g.id ? next : x)) }, undefined)
}

/** A milestone is a personal plan. Marking one done never touches an official course deadline. */
export function setMilestoneStatus(
  s: AcademicsStore,
  profileId: string,
  groupId: string,
  milestoneId: string,
  status: 'notStarted' | 'inProgress' | 'done',
  c: Ctx,
): Change<void> {
  const g = ownGroup(s, profileId, groupId)
  if (!g || !g.milestones.some((m) => m.id === milestoneId))
    return fail('That milestone was not found.')
  const next: Group = {
    ...g,
    updatedAt: c.nowIso,
    milestones: g.milestones.map((m) => (m.id === milestoneId ? { ...m, status } : m)),
  }
  return ok({ ...s, groups: s.groups.map((x) => (x.id === g.id ? next : x)) }, undefined)
}

export function deleteGroup(s: AcademicsStore, profileId: string, groupId: string): Change<void> {
  if (!ownGroup(s, profileId, groupId)) return fail('That group was not found.')
  return ok(
    {
      ...s,
      groups: s.groups.filter((g) => g.id !== groupId),
      invites: s.invites.filter((i) => i.groupId !== groupId),
    },
    undefined,
  )
}

/** One active invitation per group at a time. This is a prototype policy, not a campus rule. */
export function sendInvite(
  s: AcademicsStore,
  profileId: string,
  input: { groupId: string; facultyId: string; note: string },
  c: Ctx,
): Change<Invite> {
  const g = ownGroup(s, profileId, input.groupId)
  if (!g) return fail('That group was not found.')
  if (!s.faculty.some((f) => f.id === input.facultyId))
    return fail('That faculty profile was not found.')
  if (!input.note.trim()) return fail('Say what you would like help with.')
  if (s.invites.some((i) => i.groupId === g.id && INVITE_ACTIVE.includes(i.status)))
    return fail('This group already has an active mentorship invitation. Withdraw it first.')
  const id = c.newId('inv')
  const e = evt(id, 'student', 'sent', c, { to: 'sent' })
  const invite: Invite = {
    id,
    groupId: g.id,
    ownerProfileId: profileId,
    facultyId: input.facultyId,
    note: input.note.trim().slice(0, 300),
    status: 'sent',
    statusVersion: 1,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    history: [e],
  }
  return ok({ ...s, invites: [invite, ...s.invites] }, invite, [
    tell(
      profileId,
      id,
      e,
      'Demo mentorship invitation recorded',
      'Stored in this on this device only. Nothing was delivered to any professor.',
      groupPath(g.id),
    ),
  ])
}

export function withdrawInvite(
  s: AcademicsStore,
  profileId: string,
  inviteId: string,
  c: Ctx,
): Change<Invite> {
  const i = s.invites.find((x) => x.id === inviteId && x.ownerProfileId === profileId)
  if (!i) return fail('That invitation was not found.')
  if (!INVITE_ACTIVE.includes(i.status)) return fail('This invitation is already finished.')
  const e = evt(i.id, 'student', 'withdrawn', c, { from: i.status, to: 'withdrawn' })
  const next: Invite = {
    ...i,
    status: 'withdrawn',
    statusVersion: i.statusVersion + 1,
    updatedAt: c.nowIso,
    history: [...i.history, e],
  }
  return ok({ ...s, invites: s.invites.map((x) => (x.id === i.id ? next : x)) }, next, [
    tell(
      profileId,
      i.id,
      e,
      'Demo mentorship status updated',
      'You withdrew the invitation.',
      groupPath(i.groupId),
    ),
  ])
}

/** The simulated mentor's answer. Feedback is always "Sample feedback — simulated" and never attributed to a real professor. */
export function respondInvite(
  s: AcademicsStore,
  inviteId: string,
  response: 'accepted' | 'declined' | 'feedbackRequested',
  c: Ctx,
  opts: { expectedVersion?: number } = {},
): Change<Invite> {
  const i = s.invites.find((x) => x.id === inviteId)
  if (!i) return fail('That invitation was not found.')
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== i.statusVersion)
    return fail(STALE)
  if (i.status !== 'sent') return fail('Only a newly sent invitation can be answered.')
  const e = evt(i.id, 'demoMentor', response, c, { from: i.status, to: response })
  const next: Invite = {
    ...i,
    status: response,
    statusVersion: i.statusVersion + 1,
    updatedAt: c.nowIso,
    ...(response === 'feedbackRequested'
      ? { feedback: 'Please add your milestone dates and a short summary of the problem.' }
      : {}),
    history: [...i.history, e],
  }
  return ok({ ...s, invites: s.invites.map((x) => (x.id === i.id ? next : x)) }, next, [
    tell(
      i.ownerProfileId,
      i.id,
      e,
      'Demo mentorship status updated',
      'A simulated mentor responded. This does not mean any real professor has agreed.',
      groupPath(i.groupId),
      'important',
    ),
  ])
}
