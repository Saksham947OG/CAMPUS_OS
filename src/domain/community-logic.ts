import { userProvenance } from './chill-logic'
import {
  CLAIM_ACTIVE,
  type Claim,
  type ClaimStatus,
  type ClubEvent,
  type CommunityActor,
  type CommunityEvent,
  type CommunityStore,
  type Fixture,
  type ItemCategory,
  type JoinRequest,
  type PhotoMeta,
  type PlayerNeed,
  type Report,
  type Team,
  AREAS,
  ITEM_CATEGORIES,
  SPORTS,
} from './community'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import type { DateOnly, LocalTime } from '@/lib/time'

/**
 * Pure rules for Community (COS-COMMUNITY-001). Every rule returns the next store and the in-app
 * notices it earned. Nothing here contacts a person, approves anything officially, or advances by
 * itself when time passes.
 */
type Change<T> = CoreChange<CommunityStore, T>
const ok = <T>(s: CommunityStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)
export const STALE = 'This request changed; refresh details before acting.'

export const reportPath = (id: string) => `/community/lost-found/${id}`
export const claimPath = (id: string) => `/community/lost-found/claims/${id}`
export const clubEventPath = (clubId: string) => `/community/clubs/${clubId}`
export const teamPath = (id: string) => `/community/sports-events/teams/${id}`
export const fixturePath = (id: string) => `/community/sports-events/fixtures/${id}`

const evt = (
  actorType: CommunityActor,
  eventType: string,
  c: Ctx,
  extra: { from?: string; to?: string; reason?: string } = {},
): CommunityEvent => ({
  id: c.newId('cev'),
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
) => makeNotice('community', to, entity, e, title, body, href, sig)

const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, ' ')

/* ───────────────────────────── Lost & Found ───────────────────────────── */

export interface ReportInput {
  kind: 'lost' | 'found'
  title: string
  category: ItemCategory
  description?: string
  colour?: string
  approxDate?: DateOnly
  area?: Report['area']
  photo?: PhotoMeta
  privateDetails?: string
  publish: boolean
}

function checkReport(i: ReportInput): string | null {
  if (!i.title.trim()) return 'Give the report a short title.'
  if (i.title.trim().length > 80) return 'The title can be up to 80 characters.'
  if (!ITEM_CATEGORIES.includes(i.category)) return 'Choose a category.'
  if (i.area && !AREAS.includes(i.area)) return 'Choose a general area from the list.'
  if ((i.description ?? '').length > 300) return 'The description can be up to 300 characters.'
  if ((i.privateDetails ?? '').length > 300)
    return 'The private details can be up to 300 characters.'
  return null
}

/** A similar unresolved report by the same person. Only ever a suggestion: reports are never merged. */
export function findDuplicate(
  s: CommunityStore,
  profileId: string,
  i: Pick<ReportInput, 'kind' | 'title' | 'category'>,
  ignoreId?: string,
): Report | undefined {
  return s.reports.find(
    (r) =>
      r.id !== ignoreId &&
      r.ownerProfileId === profileId &&
      r.kind === i.kind &&
      r.category === i.category &&
      norm(r.title) === norm(i.title) &&
      (r.status === 'draft' || r.status === 'published'),
  )
}

const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== '')) as T

export function createReport(
  s: CommunityStore,
  profileId: string,
  input: ReportInput & { idempotencyKey: string; confirmDuplicate?: boolean },
  c: Ctx,
): Change<{ report: Report; created: boolean }> {
  const dup = s.reports.find(
    (r) => r.ownerProfileId === profileId && r.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(s, { report: dup, created: false })
  const bad = checkReport(input)
  if (bad) return fail(bad)
  const similar = findDuplicate(s, profileId, input)
  if (similar && !input.confirmDuplicate)
    return fail(
      `You already have a similar open report ("${similar.title}"). Open it, or confirm that this is a different item.`,
    )
  const e = evt('student', input.publish ? 'published' : 'draftSaved', c, {
    to: input.publish ? 'published' : 'draft',
  })
  const report: Report = {
    id: c.newId('rep'),
    ownerProfileId: profileId,
    kind: input.kind,
    title: input.title.trim(),
    category: input.category,
    ...clean({
      description: input.description?.trim(),
      colour: input.colour?.trim(),
      approxDate: input.approxDate,
      area: input.area,
      photo: input.photo,
      privateDetails: input.privateDetails?.trim(),
    }),
    status: input.publish ? 'published' : 'draft',
    idempotencyKey: input.idempotencyKey,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
    history: [e],
  }
  const next = { ...s, reports: [report, ...s.reports] }
  return ok(next, { report, created: true }, input.publish ? matchNotices(next, report) : [])
}

export function updateReport(
  s: CommunityStore,
  profileId: string,
  id: string,
  patch: Omit<ReportInput, 'kind' | 'publish'>,
  c: Ctx,
): Change<Report> {
  const r = s.reports.find((x) => x.id === id && x.ownerProfileId === profileId)
  if (!r) return fail('That report was not found.')
  if (r.status === 'returned' || r.status === 'closed')
    return fail('A finished report cannot be edited.')
  const bad = checkReport({ ...patch, kind: r.kind, publish: false })
  if (bad) return fail(bad)
  const next: Report = {
    ...r,
    title: patch.title.trim(),
    category: patch.category,
    description: patch.description?.trim() || undefined,
    colour: patch.colour?.trim() || undefined,
    approxDate: patch.approxDate,
    area: patch.area,
    photo: patch.photo ?? r.photo,
    privateDetails: patch.privateDetails?.trim() || undefined,
    updatedAt: c.nowIso,
    history: [...r.history, evt('student', 'edited', c)],
  }
  const store = { ...s, reports: s.reports.map((x) => (x.id === r.id ? next : x)) }
  return ok(store, next, next.status === 'published' ? matchNotices(store, next) : [])
}

export function publishReport(
  s: CommunityStore,
  profileId: string,
  id: string,
  c: Ctx,
): Change<Report> {
  const r = s.reports.find((x) => x.id === id && x.ownerProfileId === profileId)
  if (!r) return fail('That report was not found.')
  if (r.status !== 'draft') return fail('Only a draft can be published.')
  const next: Report = {
    ...r,
    status: 'published',
    updatedAt: c.nowIso,
    history: [...r.history, evt('student', 'published', c, { from: 'draft', to: 'published' })],
  }
  const store = { ...s, reports: s.reports.map((x) => (x.id === r.id ? next : x)) }
  return ok(store, next, matchNotices(store, next))
}

export function closeReport(
  s: CommunityStore,
  profileId: string,
  id: string,
  c: Ctx,
): Change<Report> {
  const r = s.reports.find((x) => x.id === id && x.ownerProfileId === profileId)
  if (!r) return fail('That report was not found.')
  if (r.status === 'returned' || r.status === 'closed')
    return fail('This report is already finished.')
  // Closing a found report also ends any claim still waiting on it.
  const claims = s.claims.map((cl) =>
    cl.reportId === r.id && CLAIM_ACTIVE.includes(cl.status)
      ? {
          ...cl,
          status: 'demoRejected' as ClaimStatus,
          statusVersion: cl.statusVersion + 1,
          decisionReason: 'The report was closed.',
          updatedAt: c.nowIso,
          history: [
            ...cl.history,
            evt('student', 'reportClosed', c, { from: cl.status, to: 'demoRejected' }),
          ],
        }
      : cl,
  )
  const next: Report = {
    ...r,
    status: 'closed',
    updatedAt: c.nowIso,
    history: [...r.history, evt('student', 'closed', c, { from: r.status, to: 'closed' })],
  }
  return ok({ ...s, claims, reports: s.reports.map((x) => (x.id === r.id ? next : x)) }, next)
}

export interface MatchCandidate {
  report: Report
  signals: string[]
}

/**
 * A conservative, deterministic suggestion. A broad category must agree, and at least one more
 * signal must be present on BOTH records and agree. A missing field never counts for or against.
 * The result is always labelled "Possible match", never an owner.
 */
export function matchCandidates(s: CommunityStore, r: Report): MatchCandidate[] {
  if (r.status !== 'published') return []
  const out: MatchCandidate[] = []
  for (const o of s.reports) {
    if (o.kind === r.kind || o.status !== 'published' || o.ownerProfileId === r.ownerProfileId)
      continue
    if (o.category !== r.category) continue
    const signals = ['Same broad category']
    if (o.colour && r.colour && norm(o.colour) === norm(r.colour)) signals.push('Same colour')
    if (o.area && r.area && o.area === r.area) signals.push('Same general area')
    if (o.approxDate && r.approxDate) {
      const days = Math.abs(Date.parse(o.approxDate) - Date.parse(r.approxDate)) / 86_400_000
      if (days <= 3) signals.push('Dates within 3 days')
    }
    if (signals.length >= 2) out.push({ report: o, signals })
  }
  return out.sort(
    (a, b) => b.signals.length - a.signals.length || a.report.id.localeCompare(b.report.id),
  )
}

function matchNotices(s: CommunityStore, r: Report): Notice[] {
  const notes: Notice[] = []
  for (const m of matchCandidates(s, r)) {
    const lost = r.kind === 'lost' ? r : m.report
    const found = r.kind === 'found' ? r : m.report
    const entity = `match-${lost.id}-${found.id}`
    const e = { id: 'suggested' }
    notes.push(
      tell(
        lost.ownerProfileId,
        entity,
        e,
        'A possible match for your lost item',
        'A published found report looks similar. This is only a suggestion, not proof it is yours.',
        reportPath(lost.id),
      ),
    )
    notes.push(
      tell(
        found.ownerProfileId,
        entity,
        e,
        'A possible match for the item you found',
        'A published lost report looks similar. This is only a suggestion; nobody has proved ownership.',
        reportPath(found.id),
      ),
    )
  }
  return notes
}

/* claims */

export function submitClaim(
  s: CommunityStore,
  profileId: string,
  input: { reportId: string; answer: string },
  c: Ctx,
): Change<Claim> {
  const r = s.reports.find((x) => x.id === input.reportId)
  if (!r || r.kind !== 'found' || r.status !== 'published')
    return fail('That found item is not open for claims.')
  if (r.ownerProfileId === profileId) return fail('You cannot claim an item you reported.')
  if (!input.answer.trim())
    return fail('Describe something about the item that only its owner would know.')
  if (input.answer.length > 300) return fail('The answer can be up to 300 characters.')
  if (
    s.claims.some(
      (x) =>
        x.reportId === r.id && x.claimantProfileId === profileId && CLAIM_ACTIVE.includes(x.status),
    )
  )
    return fail('You already have an open claim for this item.')
  if (s.claims.some((x) => x.reportId === r.id && x.status === 'demoApproved'))
    return fail('A claim for this item is already approved on this device.')
  const id = c.newId('clm')
  const e = evt('student', 'requested', c, { to: 'requested' })
  const claim: Claim = {
    id,
    reportId: r.id,
    claimantProfileId: profileId,
    privateAnswer: input.answer.trim(),
    status: 'requested',
    statusVersion: 1,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    history: [e],
  }
  return ok({ ...s, claims: [claim, ...s.claims] }, claim, [
    tell(
      profileId,
      id,
      e,
      'Claim recorded',
      'Your answer is private. This is a request, not proof of ownership, and nobody has been contacted.',
      claimPath(id),
    ),
    tell(
      r.ownerProfileId,
      id,
      e,
      'Someone asked to claim the item you reported',
      'A claim is waiting for review. Their answer is not shown here.',
      reportPath(r.id),
    ),
  ])
}

export function withdrawClaim(
  s: CommunityStore,
  profileId: string,
  id: string,
  c: Ctx,
): Change<Claim> {
  const cl = s.claims.find((x) => x.id === id && x.claimantProfileId === profileId)
  if (!cl) return fail('That claim was not found.')
  if (!CLAIM_ACTIVE.includes(cl.status)) return fail('This claim is already finished.')
  const e = evt('student', 'withdrawn', c, { from: cl.status, to: 'withdrawn' })
  const next: Claim = {
    ...cl,
    status: 'withdrawn',
    statusVersion: cl.statusVersion + 1,
    updatedAt: c.nowIso,
    history: [...cl.history, e],
  }
  return ok({ ...s, claims: s.claims.map((x) => (x.id === cl.id ? next : x)) }, next, [
    tell(profileId, cl.id, e, 'Claim withdrawn', 'You withdrew this claim.', claimPath(cl.id)),
  ])
}

/** The labelled demo reviewer. A claim is never approved by passage of time. */
export function reviewClaim(
  s: CommunityStore,
  id: string,
  action: 'startReview' | 'approve' | 'reject',
  c: Ctx,
  opts: { expectedVersion?: number; reason?: string } = {},
): Change<Claim> {
  const cl = s.claims.find((x) => x.id === id)
  if (!cl) return fail('That claim was not found.')
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== cl.statusVersion)
    return fail(STALE)
  const report = s.reports.find((r) => r.id === cl.reportId)
  if (!report) return fail('That report was not found.')
  let to: ClaimStatus
  let title: string
  let body: string
  const reason = opts.reason?.trim()
  if (action === 'startReview') {
    if (cl.status !== 'requested') return fail('Only a new claim can be moved into review.')
    to = 'reviewPending'
    title = 'Claim is under review'
    body = 'A simulated reviewer is looking at your claim. This is not a real security decision.'
  } else if (action === 'approve') {
    if (cl.status !== 'reviewPending')
      return fail('A claim must be under review before it can be approved.')
    if (report.status !== 'published') return fail('This item is no longer open.')
    if (
      s.claims.some(
        (x) => x.reportId === cl.reportId && x.id !== cl.id && x.status === 'demoApproved',
      )
    )
      return fail('Another claim for this item is already approved.')
    to = 'demoApproved'
    title = 'Claim approved'
    body =
      'Approved in the on this device only. It is not a legal or security finding. A separate handover step is still needed.'
  } else {
    if (cl.status !== 'requested' && cl.status !== 'reviewPending')
      return fail('This claim is already finished.')
    if (!reason) return fail('A reason is required when a claim is not approved.')
    to = 'demoRejected'
    title = 'Claim not approved'
    body = `Not approved on this device: ${reason}`
  }
  const e = evt('demoReviewer', action, c, { from: cl.status, to, ...(reason ? { reason } : {}) })
  const notes: Notice[] = [
    tell(
      cl.claimantProfileId,
      cl.id,
      e,
      title,
      body,
      claimPath(cl.id),
      action === 'startReview' ? 'standard' : 'important',
    ),
  ]
  let claims = s.claims.map((x) =>
    x.id === cl.id
      ? {
          ...x,
          status: to,
          statusVersion: x.statusVersion + 1,
          updatedAt: c.nowIso,
          history: [...x.history, e],
          ...(reason ? { decisionReason: reason } : {}),
        }
      : x,
  )
  if (action === 'approve') {
    // Competing claims for the same item end, without saying who won.
    claims = claims.map((x) => {
      if (x.reportId !== cl.reportId || x.id === cl.id || !CLAIM_ACTIVE.includes(x.status)) return x
      const ev = evt('demoReviewer', 'supersededByAnotherClaim', c, {
        from: x.status,
        to: 'demoRejected',
      })
      notes.push(
        tell(
          x.claimantProfileId,
          x.id,
          ev,
          'Claim not approved',
          'Another claim for this item was approved on this device. No details about it are shown.',
          claimPath(x.id),
          'important',
        ),
      )
      return {
        ...x,
        status: 'demoRejected' as ClaimStatus,
        statusVersion: x.statusVersion + 1,
        decisionReason: 'Another claim for this item was approved on this device.',
        updatedAt: c.nowIso,
        history: [...x.history, ev],
      }
    })
  }
  return ok(
    { ...s, claims },
    claims.find((x) => x.id === cl.id)!,
    notes,
  )
}

/** The handover is a separate step from approval. It archives the item from the public list and keeps every record. */
export function markReturned(s: CommunityStore, reportId: string, c: Ctx): Change<Report> {
  const r = s.reports.find((x) => x.id === reportId)
  if (!r) return fail('That report was not found.')
  if (r.status !== 'published') return fail('Only a published report can be returned.')
  const approved = s.claims.find((x) => x.reportId === r.id && x.status === 'demoApproved')
  if (!approved) return fail('No claim is approved for this item yet.')
  const e = evt('demoReviewer', 'returned', c, { from: 'published', to: 'returned' })
  const next: Report = {
    ...r,
    status: 'returned',
    handoverAt: c.nowIso,
    updatedAt: c.nowIso,
    history: [...r.history, e],
  }
  return ok({ ...s, reports: s.reports.map((x) => (x.id === r.id ? next : x)) }, next, [
    tell(
      approved.claimantProfileId,
      r.id,
      e,
      'Handover recorded',
      'The item was marked returned on this device.',
      claimPath(approved.id),
      'important',
    ),
    tell(
      r.ownerProfileId,
      r.id,
      e,
      'Your reported item was marked returned',
      'Marked returned on this device. Your report stays in your history.',
      reportPath(r.id),
    ),
  ])
}

/* ───────────────────────────── Clubs ───────────────────────────── */

export function setFollow(
  s: CommunityStore,
  profileId: string,
  clubId: string,
  follow: boolean,
): Change<void> {
  if (!s.clubs.some((c) => c.id === clubId)) return fail('That club was not found.')
  const have = s.follows[profileId] ?? []
  const next = follow ? Array.from(new Set([...have, clubId])) : have.filter((x) => x !== clubId)
  return ok({ ...s, follows: { ...s.follows, [profileId]: next } }, undefined)
}

export const followersOf = (s: CommunityStore, clubId: string) =>
  Object.entries(s.follows)
    .filter(([, ids]) => ids.includes(clubId))
    .map(([p]) => p)

/** Recruitment state shown to a student. "Closing soon" appears only from a real close date. */
export function recruitmentView(
  club: { recruitment: { state: string; closeDate?: string } },
  today: DateOnly,
  thresholdDays: number,
): 'notAnnounced' | 'open' | 'closingSoon' | 'closed' | 'archived' {
  const r = club.recruitment
  if (r.state === 'open') {
    if (r.closeDate && r.closeDate < today) return 'closed'
    if (r.closeDate && (Date.parse(r.closeDate) - Date.parse(today)) / 86_400_000 <= thresholdDays)
      return 'closingSoon'
    return 'open'
  }
  return r.state as 'notAnnounced' | 'closed' | 'archived'
}

/** Reschedule or cancel a club event. The same id and link are kept, and followers get one message per version. */
export function changeClubEvent(
  s: CommunityStore,
  eventId: string,
  change:
    | { cancel: true; reason?: string }
    | {
        cancel?: false
        date: DateOnly
        start?: LocalTime
        end?: LocalTime
        venue?: string
        reason?: string
      },
  c: Ctx,
): Change<ClubEvent> {
  const ev = s.clubEvents.find((x) => x.id === eventId)
  if (!ev) return fail('That event was not found.')
  if (ev.status === 'cancelled') return fail('This event is already cancelled.')
  const club = s.clubs.find((x) => x.id === ev.clubId)
  const version = ev.version + 1
  const e = evt('demoOrganizer', change.cancel ? 'cancelled' : 'rescheduled', c, {
    from: ev.status,
    to: change.cancel ? 'cancelled' : 'rescheduled',
    ...(change.reason ? { reason: change.reason } : {}),
  })
  const next: ClubEvent = change.cancel
    ? { ...ev, status: 'cancelled', version, history: [...ev.history, e] }
    : {
        ...ev,
        date: change.date,
        start: change.start,
        end: change.end,
        venue: change.venue ?? ev.venue,
        status: 'rescheduled',
        version,
        history: [...ev.history, e],
      }
  const notes = followersOf(s, ev.clubId).map((p) =>
    tell(
      p,
      ev.id,
      { id: `v${version}` },
      change.cancel
        ? 'A club event you follow was cancelled (local)'
        : 'A club event you follow changed (local)',
      `${club?.name ?? 'A club'}: ${ev.title}. This is a simulated change; no organizer sent it.`,
      clubEventPath(ev.clubId),
      'important',
    ),
  )
  return ok({ ...s, clubEvents: s.clubEvents.map((x) => (x.id === ev.id ? next : x)) }, next, notes)
}

/* ───────────────────────────── Teams ───────────────────────────── */

/** Who is acting. A student acts as themselves; the labelled simulator acts for a fictional captain only. */
export type TeamActor =
  { kind: 'student'; profileId: string } | { kind: 'demoCaptain' } | { kind: 'demoCommittee' }

const canCaptain = (t: Team, a: TeamActor) =>
  a.kind === 'student'
    ? t.captainProfileId === a.profileId
    : a.kind === 'demoCaptain' && !t.captainProfileId
const actorType = (a: TeamActor): CommunityActor => (a.kind === 'student' ? 'student' : a.kind)

export const activeRequest = (s: CommunityStore, teamId: string, profileId: string) =>
  s.joinRequests.find(
    (r) => r.teamId === teamId && r.profileId === profileId && r.status === 'requested',
  )
export const spotsLeft = (t: Team) => t.maxRoster - t.members.length

export function createTeam(
  s: CommunityStore,
  profileId: string,
  input: {
    sport: Team['sport']
    name: string
    maxRoster?: number
    description?: string
    recruiting?: boolean
  },
  c: Ctx,
): Change<Team> {
  if (!SPORTS.includes(input.sport)) return fail('Choose a sport.')
  const name = input.name.trim()
  if (!name) return fail('Give the team a name.')
  if (name.length > 40) return fail('The team name can be up to 40 characters.')
  const max = input.maxRoster ?? s.config.defaultMaxRoster
  if (!Number.isInteger(max) || max < 2 || max > 30)
    return fail('The roster size must be a whole number from 2 to 30.')
  const t: Team = {
    id: c.newId('team'),
    sport: input.sport,
    name,
    captainProfileId: profileId,
    captainLabel: 'You (captain)',
    maxRoster: max,
    ...(input.description?.trim() ? { description: input.description.trim().slice(0, 200) } : {}),
    status: input.recruiting === false ? 'rosterClosed' : 'recruiting',
    members: [profileId],
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    provenance: userProvenance(c.nowIso),
    history: [evt('student', 'created', c)],
  }
  return ok({ ...s, teams: [t, ...s.teams] }, t)
}

const setTeam = (s: CommunityStore, t: Team): CommunityStore => ({
  ...s,
  teams: s.teams.map((x) => (x.id === t.id ? t : x)),
})

export function requestJoin(
  s: CommunityStore,
  profileId: string,
  teamId: string,
  c: Ctx,
): Change<JoinRequest> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (t.status !== 'recruiting') return fail('This team is not recruiting.')
  if (t.members.includes(profileId)) return fail('You are already on this team.')
  if (activeRequest(s, teamId, profileId))
    return fail('You already have a request waiting for this team.')
  if (spotsLeft(t) <= 0) return fail('This team is full.')
  const r: JoinRequest = {
    id: c.newId('jr'),
    teamId,
    profileId,
    status: 'requested',
    createdAt: c.nowIso,
  }
  const e = { id: r.id }
  const notes = [
    tell(
      profileId,
      r.id,
      e,
      'Join request recorded (local)',
      `Your request to join ${t.name} is recorded on this device. The captain has not been messaged.`,
      teamPath(t.id),
    ),
  ]
  if (t.captainProfileId)
    notes.push(
      tell(
        t.captainProfileId,
        r.id,
        e,
        'Someone asked to join your team',
        `A request to join ${t.name} is waiting for your decision.`,
        teamPath(t.id),
      ),
    )
  return ok({ ...s, joinRequests: [r, ...s.joinRequests] }, r, notes)
}

export function withdrawJoin(
  s: CommunityStore,
  profileId: string,
  requestId: string,
): Change<void> {
  const r = s.joinRequests.find((x) => x.id === requestId && x.profileId === profileId)
  if (!r) return fail('That request was not found.')
  if (r.status !== 'requested') return fail('Only a waiting request can be withdrawn.')
  return ok(
    {
      ...s,
      joinRequests: s.joinRequests.map((x) =>
        x.id === r.id ? { ...x, status: 'withdrawn' as const } : x,
      ),
    },
    undefined,
  )
}

export function leaveTeam(
  s: CommunityStore,
  profileId: string,
  teamId: string,
  c: Ctx,
): Change<void> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t || !t.members.includes(profileId)) return fail('You are not on this team.')
  if (t.captainProfileId === profileId)
    return fail('A captain cannot leave. Cancel the team instead.')
  return ok(
    setTeam(s, {
      ...t,
      members: t.members.filter((m) => m !== profileId),
      updatedAt: c.nowIso,
      history: [...t.history, evt('student', 'left', c)],
    }),
    undefined,
  )
}

/** Accepts or rejects a join request. Capacity is re-checked here, at the moment of the decision. */
export function decideJoin(
  s: CommunityStore,
  teamId: string,
  requestId: string,
  decision: 'accept' | 'reject',
  actor: TeamActor,
  c: Ctx,
): Change<JoinRequest> {
  const t = s.teams.find((x) => x.id === teamId)
  const r = s.joinRequests.find((x) => x.id === requestId && x.teamId === teamId)
  if (!t || !r) return fail('That request was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can decide join requests.')
  if (r.status !== 'requested') return fail('This request is already decided.')
  if (decision === 'accept') {
    if (t.members.includes(r.profileId)) return fail('That person is already on the roster.')
    if (spotsLeft(t) <= 0) return fail('This team is full, so nobody else can be accepted.')
  }
  const next: JoinRequest = {
    ...r,
    status: decision === 'accept' ? 'accepted' : 'rejected',
    decidedAt: c.nowIso,
  }
  const team: Team =
    decision === 'accept'
      ? {
          ...t,
          members: [...t.members, r.profileId],
          updatedAt: c.nowIso,
          history: [...t.history, evt(actorType(actor), 'accepted', c)],
        }
      : t
  const store = setTeam(
    { ...s, joinRequests: s.joinRequests.map((x) => (x.id === r.id ? next : x)) },
    team,
  )
  return ok(store, next, [
    tell(
      r.profileId,
      r.id,
      { id: next.status },
      decision === 'accept'
        ? 'Join request accepted by the captain (local)'
        : 'Join request not accepted (local)',
      decision === 'accept'
        ? `You are on ${t.name}'s roster. That is not committee approval for any event.`
        : `The captain did not accept your request for ${t.name}.`,
      teamPath(t.id),
      'important',
    ),
  ])
}

export function setRecruiting(
  s: CommunityStore,
  teamId: string,
  open: boolean,
  actor: TeamActor,
  c: Ctx,
): Change<Team> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can change this.')
  if (t.status !== 'recruiting' && t.status !== 'rosterClosed')
    return fail('The roster can no longer be reopened or closed at this stage.')
  const next: Team = {
    ...t,
    status: open ? 'recruiting' : 'rosterClosed',
    updatedAt: c.nowIso,
    history: [...t.history, evt(actorType(actor), open ? 'reopened' : 'rosterClosed', c)],
  }
  return ok(setTeam(s, next), next)
}

export function submitTeam(
  s: CommunityStore,
  teamId: string,
  actor: TeamActor,
  c: Ctx,
): Change<Team> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can submit the team.')
  if (t.status !== 'rosterClosed')
    return fail('Close the roster first, then submit the team for approval.')
  const next: Team = {
    ...t,
    status: 'submitted',
    updatedAt: c.nowIso,
    history: [...t.history, evt(actorType(actor), 'submitted', c)],
  }
  return ok(setTeam(s, next), next)
}

/** The simulated sports committee. Roster acceptance and event approval are different things. */
export function decideTeamApproval(
  s: CommunityStore,
  teamId: string,
  decision: 'approvedDemo' | 'declinedDemo',
  c: Ctx,
): Change<Team> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (t.status !== 'submitted') return fail('Only a submitted team can be approved or declined.')
  const e = evt('demoCommittee', decision, c, { from: 'submitted', to: decision })
  const next: Team = { ...t, status: decision, updatedAt: c.nowIso, history: [...t.history, e] }
  const notes = t.members.map((p) =>
    tell(
      p,
      t.id,
      { id: decision },
      decision === 'approvedDemo' ? 'Team approved on this device' : 'Team declined on this device',
      `${t.name}: a simulated committee decided. No real committee has reviewed anything.`,
      teamPath(t.id),
      'important',
    ),
  )
  return ok(setTeam(s, next), next, notes)
}

export function cancelTeam(
  s: CommunityStore,
  teamId: string,
  actor: TeamActor,
  c: Ctx,
): Change<Team> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can cancel the team.')
  if (t.status === 'withdrawn') return fail('This team is already cancelled.')
  const e = evt(actorType(actor), 'cancelled', c, { from: t.status, to: 'withdrawn' })
  const next: Team = { ...t, status: 'withdrawn', updatedAt: c.nowIso, history: [...t.history, e] }
  const joinRequests = s.joinRequests.map((r) =>
    r.teamId === t.id && r.status === 'requested'
      ? { ...r, status: 'withdrawn' as const, decidedAt: c.nowIso }
      : r,
  )
  const needs = s.needs.map((n) => (n.teamId === t.id ? { ...n, closed: true } : n))
  const notes = t.members
    .filter((p) => p !== t.captainProfileId)
    .map((p) =>
      tell(
        p,
        t.id,
        { id: 'cancelled' },
        'A team you joined was cancelled (local)',
        `${t.name} was cancelled by its captain. Its history is kept.`,
        teamPath(t.id),
        'important',
      ),
    )
  return ok({ ...setTeam(s, next), joinRequests, needs }, next, notes)
}

export function postNeed(
  s: CommunityStore,
  teamId: string,
  input: { description: string; positions?: string; expiresOn: DateOnly; fixtureId?: string },
  actor: TeamActor,
  today: DateOnly,
  c: Ctx,
): Change<PlayerNeed> {
  const t = s.teams.find((x) => x.id === teamId)
  if (!t) return fail('That team was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can post a need.')
  if (t.status !== 'recruiting') return fail('Only a recruiting team can look for players.')
  if (!input.description.trim()) return fail('Say what you need.')
  if (!input.expiresOn || input.expiresOn < today)
    return fail('Choose a closing date that is today or later.')
  if (input.fixtureId && !s.fixtures.some((f) => f.id === input.fixtureId))
    return fail('That fixture was not found.')
  const n: PlayerNeed = {
    id: c.newId('need'),
    teamId,
    ...(input.fixtureId ? { fixtureId: input.fixtureId } : {}),
    description: input.description.trim().slice(0, 200),
    ...(input.positions?.trim() ? { positions: input.positions.trim().slice(0, 60) } : {}),
    expiresOn: input.expiresOn,
    closed: false,
    createdAt: c.nowIso,
  }
  return ok({ ...s, needs: [n, ...s.needs] }, n)
}

export function closeNeed(s: CommunityStore, needId: string, actor: TeamActor): Change<void> {
  const n = s.needs.find((x) => x.id === needId)
  const t = n && s.teams.find((x) => x.id === n.teamId)
  if (!n || !t) return fail('That post was not found.')
  if (!canCaptain(t, actor)) return fail('Only the team captain can close this post.')
  return ok(
    { ...s, needs: s.needs.map((x) => (x.id === n.id ? { ...x, closed: true } : x)) },
    undefined,
  )
}

/** Closed by hand, or because the configured date has passed. Nothing else closes it. */
export const needOpen = (n: PlayerNeed, today: DateOnly) => !n.closed && n.expiresOn >= today

/* ───────────────────────────── Fixtures ───────────────────────────── */

export const fixtureAudience = (s: CommunityStore, f: Fixture) =>
  Array.from(new Set(s.teams.filter((t) => f.teamIds.includes(t.id)).flatMap((t) => t.members)))

export function changeFixture(
  s: CommunityStore,
  fixtureId: string,
  change:
    | {
        kind: 'reschedule'
        date: DateOnly
        start?: LocalTime
        end?: LocalTime
        venue?: string
        reason?: string
      }
    | { kind: 'cancel'; reason?: string }
    | { kind: 'complete'; result?: string },
  c: Ctx,
  opts: { expectedVersion?: number } = {},
): Change<Fixture> {
  const f = s.fixtures.find((x) => x.id === fixtureId)
  if (!f) return fail('That fixture was not found.')
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== f.version) return fail(STALE)
  if (f.status === 'cancelled' || f.status === 'completedDemo')
    return fail('This fixture is finished.')
  const version = f.version + 1
  const snap = {
    version: f.version,
    at: c.nowIso,
    date: f.date,
    start: f.start,
    end: f.end,
    venue: f.venue,
  }
  let next: Fixture
  let title: string
  if (change.kind === 'reschedule') {
    if (change.start && change.end && !(change.end > change.start))
      return fail('The end must be after the start.')
    next = {
      ...f,
      date: change.date,
      start: change.start,
      end: change.end,
      venue: change.venue ?? f.venue,
      status: 'rescheduled',
      version,
      revisions: [...f.revisions, { ...snap, ...(change.reason ? { reason: change.reason } : {}) }],
    }
    title = 'A fixture you are in changed (local)'
  } else if (change.kind === 'cancel') {
    next = {
      ...f,
      status: 'cancelled',
      version,
      revisions: [...f.revisions, { ...snap, ...(change.reason ? { reason: change.reason } : {}) }],
    }
    title = 'A fixture you are in was cancelled (local)'
  } else {
    next = {
      ...f,
      status: 'completedDemo',
      version,
      ...(change.result?.trim() ? { result: change.result.trim().slice(0, 80) } : {}),
      revisions: [...f.revisions, snap],
    }
    title = ''
  }
  const notes = title
    ? fixtureAudience(s, f).map((p) =>
        tell(
          p,
          f.id,
          { id: `v${version}` },
          title,
          `${f.title}. This is a simulated change; no organizer sent it.`,
          fixturePath(f.id),
          'important',
        ),
      )
    : []
  return ok({ ...s, fixtures: s.fixtures.map((x) => (x.id === f.id ? next : x)) }, next, notes)
}
