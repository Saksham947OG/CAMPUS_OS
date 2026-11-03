import { userProvenance } from './chill-logic'
import {
  type ActorType,
  type AdminStore,
  type Attachment,
  type LeaveRequest,
  type LeaveStatus,
  type RequestEvent,
  type Ticket,
  type TicketStatus,
  LEAVE_OPEN,
  LEAVE_TYPES,
  CATEGORIES,
  ASSET_TYPES,
  TICKET_OPEN,
} from './admin'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import type { DateOnly, LocalTime } from '@/lib/time'
import { instantMs } from '@/selectors/now'

/**
 * Pure rules for Administration (COS-ADMIN-001). Leave and tickets keep separate state machines on
 * a shared request substrate. No clock, storage or React: callers pass timestamps and ids. Nothing
 * here advances by itself, a student can never perform a privileged step, and a "decision" is only
 * ever a simulated record on this device: never a permission, a gate pass or a repair.
 */

type Change<T> = CoreChange<AdminStore, T>
const ok = <T>(store: AdminStore, value: T, notices: Notice[] = []): Change<T> =>
  coreOk(store, value, notices)

export const requestPath = (id: string) => `/administration/requests/${id}`
export const STALE = 'This request changed; refresh details before acting.'

const event = (
  requestId: string,
  actorType: ActorType,
  eventType: string,
  c: Ctx,
  extra: { from?: string; to?: string; reason?: string; revision?: number } = {},
): RequestEvent => ({
  id: c.newId('rev'),
  requestId,
  actorType,
  eventType,
  at: c.nowIso,
  ...(extra.from ? { from: extra.from } : {}),
  ...(extra.to ? { to: extra.to } : {}),
  ...(extra.reason ? { reason: extra.reason } : {}),
  ...(extra.revision ? { revision: extra.revision } : {}),
})

const tell = (
  recipient: string,
  requestId: string,
  ev: RequestEvent,
  title: string,
  body: string,
  significance: Notice['significance'] = 'standard',
) =>
  makeNotice('admin', recipient, requestId, ev, title, body, requestPath(requestId), significance)

/* ───────────────────────────── Attachments ───────────────────────────── */

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp']
export const MAX_ATTACHMENT_BYTES = 2_000_000

/** Metadata only: the contents are never read. Returns a reason when the file is not acceptable. */
export function checkAttachment(
  file: { name: string; type: string; size: number },
  kind: 'image' | 'any',
): string | null {
  if (!file.name.trim()) return 'The file needs a name.'
  if (file.size > MAX_ATTACHMENT_BYTES)
    return 'That file is larger than 2 MB. Choose a smaller one.'
  if (kind === 'image' && !IMAGE_TYPES.includes(file.type))
    return 'Only PNG, JPEG or WebP images can be described here. Choose another file.'
  return null
}

export const describeAttachment = (
  file: { name: string; type: string; size: number },
  c: Ctx,
): Attachment => ({
  id: c.newId('att'),
  displayName: file.name.trim().slice(0, 120),
  mime: file.type || 'application/octet-stream',
  sizeBytes: file.size,
  demoOnly: true,
})

/* ───────────────────────────── Leave ───────────────────────────── */

export interface LeaveInput {
  leaveType: LeaveRequest['leaveType']
  startDate: DateOnly
  startTime: LocalTime
  /** Defaults to the start date. An overnight request names its end date explicitly. */
  endDate?: DateOnly
  endTime: LocalTime
  reason: string
  classesMissed?: LeaveRequest['classesMissed']
  attachments?: Attachment[]
}

/** Validates the interval and reason. A bad request is refused whole; nothing is half-saved. */
export function checkLeaveInput(i: LeaveInput): string | null {
  if (!LEAVE_TYPES.includes(i.leaveType)) return 'Choose a request type.'
  if (!i.reason.trim()) return 'Enter a reason. Keep it short and avoid private medical detail.'
  if (i.reason.trim().length > 500) return 'The reason must be 500 characters or fewer.'
  const start = instantMs(i.startDate, i.startTime)
  const end = instantMs(i.endDate ?? i.startDate, i.endTime)
  if (!(end > start))
    return 'The return must be after the departure. Overnight requests need the return date.'
  return null
}

const snapshot = (
  l: Pick<
    LeaveRequest,
    'revision' | 'leaveType' | 'startDate' | 'startTime' | 'endDate' | 'endTime' | 'reason'
  >,
  at: string,
) => ({
  revision: l.revision,
  submittedAt: at,
  leaveType: l.leaveType,
  startDate: l.startDate,
  startTime: l.startTime,
  endDate: l.endDate,
  endTime: l.endTime,
  reason: l.reason,
})

const findLeave = (s: AdminStore, id: string) => s.leaves.find((l) => l.id === id)
const putLeave = (s: AdminStore, next: LeaveRequest): AdminStore => ({
  ...s,
  leaves: s.leaves.map((l) => (l.id === next.id ? next : l)),
})

export function submitLeave(
  s: AdminStore,
  input: LeaveInput & { profileId: string; idempotencyKey: string },
  c: Ctx,
): Change<{ leave: LeaveRequest; created: boolean }> {
  const dup = s.leaves.find(
    (l) => l.ownerProfileId === input.profileId && l.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(s, { leave: dup, created: false })
  const bad = checkLeaveInput(input)
  if (bad) return fail(bad)
  const id = c.newId('leave')
  const endDate = input.endDate ?? input.startDate
  const ev = event(id, 'student', 'submitted', c, { to: 'submitted', revision: 1 })
  const base = {
    revision: 1,
    leaveType: input.leaveType,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate,
    endTime: input.endTime,
    reason: input.reason.trim(),
  }
  const leave: LeaveRequest = {
    id,
    kind: 'leave',
    ownerProfileId: input.profileId,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    status: 'submitted',
    statusVersion: 1,
    ...base,
    classesMissed: input.classesMissed ?? [],
    attachments: input.attachments ?? [],
    decision: null,
    gate: {},
    revisions: [snapshot(base, c.nowIso)],
    idempotencyKey: input.idempotencyKey,
    provenance: userProvenance(c.nowIso),
    history: [ev],
  }
  return ok({ ...s, leaves: [leave, ...s.leaves] }, { leave, created: true }, [
    tell(
      input.profileId,
      id,
      ev,
      'Local request saved',
      'Your leave request is stored on this device. It has not been sent to anyone and is not a campus permission.',
    ),
  ])
}

/** Student edits after "changes requested", or after an approval: a NEW revision, never an overwrite. */
export function reviseLeave(
  s: AdminStore,
  profileId: string,
  id: string,
  input: LeaveInput,
  c: Ctx,
): Change<LeaveRequest> {
  const l = findLeave(s, id)
  if (!l || l.ownerProfileId !== profileId) return fail('That request was not found.')
  const afterApproval = l.status === 'approvedInDemo'
  if (l.status !== 'changesRequested' && !afterApproval)
    return fail(
      'You can edit a request only after changes were requested, or before departure once it is approved on this device (which sends it for review again).',
    )
  const bad = checkLeaveInput(input)
  if (bad) return fail(bad)
  const revision = l.revision + 1
  const endDate = input.endDate ?? input.startDate
  const next: LeaveRequest = {
    ...l,
    leaveType: input.leaveType,
    startDate: input.startDate,
    startTime: input.startTime,
    endDate,
    endTime: input.endTime,
    reason: input.reason.trim(),
    classesMissed: input.classesMissed ?? l.classesMissed,
    attachments: input.attachments ?? l.attachments,
    revision,
    status: 'resubmitted',
    statusVersion: l.statusVersion + 1,
    decision: null, // an earlier decision never carries over to a different revision
    updatedAt: c.nowIso,
    revisions: [
      ...l.revisions,
      snapshot({ ...input, endDate, revision, reason: input.reason.trim() }, c.nowIso),
    ],
    history: [
      ...l.history,
      event(l.id, 'student', afterApproval ? 'revisedAfterApproval' : 'resubmitted', c, {
        from: l.status,
        to: 'resubmitted',
        revision,
      }),
    ],
  }
  const ev = next.history[next.history.length - 1]!
  return ok(putLeave(s, next), next, [
    tell(
      profileId,
      id,
      ev,
      'Local request saved',
      afterApproval
        ? 'Your change needs a new review. The earlier approval no longer applies.'
        : 'Your updated request is stored on this device.',
    ),
  ])
}

export function withdrawLeave(
  s: AdminStore,
  profileId: string,
  id: string,
  c: Ctx,
): Change<LeaveRequest> {
  const l = findLeave(s, id)
  if (!l || l.ownerProfileId !== profileId) return fail('That request was not found.')
  if (
    !(['submitted', 'underReview', 'changesRequested', 'resubmitted'] as LeaveStatus[]).includes(
      l.status,
    )
  )
    return fail('Only a request that has not been decided on this device can be withdrawn.')
  const ev = event(l.id, 'student', 'withdrawn', c, {
    from: l.status,
    to: 'withdrawn',
    revision: l.revision,
  })
  const next: LeaveRequest = {
    ...l,
    status: 'withdrawn',
    statusVersion: l.statusVersion + 1,
    decision: null,
    updatedAt: c.nowIso,
    history: [...l.history, ev],
  }
  return ok(putLeave(s, next), next, [
    tell(
      profileId,
      id,
      ev,
      'Local request withdrawn',
      'You withdrew this request. It stays in your history.',
    ),
  ])
}

export type LeaveAction =
  'startReview' | 'requestChanges' | 'approve' | 'reject' | 'logDeparture' | 'logReturn'

const LEAVE_ACTOR: Record<LeaveAction, ActorType> = {
  startReview: 'demoApprover',
  requestChanges: 'demoApprover',
  approve: 'demoApprover',
  reject: 'demoApprover',
  logDeparture: 'demoGate',
  logReturn: 'demoGate',
}

/** A privileged step. It names the role performing it and the revision and version it was looking at. */
export function leaveAct(
  s: AdminStore,
  id: string,
  action: LeaveAction,
  actor: ActorType,
  c: Ctx,
  opts: { expectedRevision?: number; expectedVersion?: number; reason?: string } = {},
): Change<LeaveRequest> {
  if (actor !== LEAVE_ACTOR[action])
    return fail('That step belongs to a different role, not to you.')
  const l = findLeave(s, id)
  if (!l) return fail('That request was not found.')
  if (
    (opts.expectedRevision !== undefined && opts.expectedRevision !== l.revision) ||
    (opts.expectedVersion !== undefined && opts.expectedVersion !== l.statusVersion)
  )
    return fail(STALE)
  const reason = opts.reason?.trim()
  let to: LeaveStatus
  let decision = l.decision
  let gate = l.gate
  let title = ''
  let body = ''
  switch (action) {
    case 'startReview':
      if (l.status !== 'submitted' && l.status !== 'resubmitted')
        return fail('Only a submitted request can start review.')
      to = 'underReview'
      title = 'Review started'
      body = 'A simulated approver started reviewing your request.'
      break
    case 'requestChanges':
      if (l.status !== 'underReview')
        return fail('Changes can be requested only while a request is under review.')
      if (!reason) return fail('A reason is required when requesting changes.')
      to = 'changesRequested'
      title = 'Changes requested'
      body = reason
      break
    case 'approve':
      if (l.status !== 'underReview')
        return fail('Only a request under review can be approved on this device.')
      to = 'approvedInDemo'
      decision = {
        revision: l.revision,
        decision: 'approved',
        at: c.nowIso,
        actorRole: 'demoApprover',
        ...(reason ? { reason } : {}),
      }
      title = 'Decision recorded locally'
      body = 'Approved locally. This is not an official permission and not a valid gate pass.'
      break
    case 'reject':
      if (l.status !== 'underReview')
        return fail('Only a request under review can be rejected on this device.')
      if (!reason) return fail('A reason is required when rejecting a request.')
      to = 'rejected'
      decision = {
        revision: l.revision,
        decision: 'rejected',
        at: c.nowIso,
        actorRole: 'demoApprover',
        reason,
      }
      title = 'Decision recorded locally'
      body = `Rejected locally: ${reason}. This is not an official decision.`
      break
    case 'logDeparture':
      if (!s.config.gateEnabled)
        return fail('Gate actions are switched off in the planning policy.')
      if (l.status !== 'approvedInDemo' || !l.decision || l.decision.revision !== l.revision)
        return fail(
          'A departure can be logged only for a request approved on this device for its current revision.',
        )
      to = 'gateDepartureLogged'
      gate = { ...l.gate, departedAt: c.nowIso }
      title = 'Simulated gate status updated'
      body = 'Departure logged on this device. This is not a real guard event.'
      break
    case 'logReturn':
      if (!s.config.gateEnabled)
        return fail('Gate actions are switched off in the planning policy.')
      if (l.status !== 'gateDepartureLogged' || !l.gate.departedAt)
        return fail('A return can be logged only after a departure was logged on this device.')
      to = 'gateReturnLogged'
      gate = { ...l.gate, returnedAt: c.nowIso }
      title = 'Simulated gate status updated'
      body = 'Return logged on this device. This is not a real guard event.'
      break
  }
  const ev = event(l.id, actor, action, c, {
    from: l.status,
    to,
    revision: l.revision,
    ...(reason ? { reason } : {}),
  })
  const next: LeaveRequest = {
    ...l,
    status: to,
    statusVersion: l.statusVersion + 1,
    decision,
    gate,
    updatedAt: c.nowIso,
    history: [...l.history, ev],
  }
  return ok(putLeave(s, next), next, [
    tell(
      l.ownerProfileId,
      l.id,
      ev,
      title,
      body,
      action === 'approve' || action === 'reject' || action === 'requestChanges'
        ? 'critical'
        : 'standard',
    ),
  ])
}

/* ───────────────────────────── Tickets ───────────────────────────── */

export interface TicketInput {
  kind: Ticket['kind']
  category: Ticket['category']
  description: string
  location?: string
  locationSource?: Ticket['locationSource']
  reportedSeverity: Ticket['reportedSeverity']
  attachments?: Attachment[]
  evidence?: Ticket['evidence']
  teaching?: Ticket['teaching']
}

export function checkTicketInput(i: TicketInput): string | null {
  if (!CATEGORIES.includes(i.category)) return 'Choose a category.'
  if (!i.description.trim()) return 'Describe the problem.'
  if (i.description.trim().length > 500) return 'The description must be 500 characters or fewer.'
  if (i.kind === 'teachingAid') {
    if (!i.teaching?.classroomReference.trim()) return 'Enter the classroom for this report.'
    if (!i.teaching.assetType || !ASSET_TYPES.includes(i.teaching.assetType))
      return 'Choose the type of equipment.'
  }
  return null
}

const findTicket = (s: AdminStore, id: string) => s.tickets.find((t) => t.id === id)
const putTicket = (s: AdminStore, next: Ticket): AdminStore => ({
  ...s,
  tickets: s.tickets.map((t) => (t.id === next.id ? next : t)),
})

/** One ticket engine for both complaints and teaching-aid reports. A teaching report is the same lifecycle with extra fields. */
export function submitTicket(
  s: AdminStore,
  input: TicketInput & { profileId: string; idempotencyKey: string },
  c: Ctx,
): Change<{ ticket: Ticket; created: boolean }> {
  const dup = s.tickets.find(
    (t) => t.ownerProfileId === input.profileId && t.idempotencyKey === input.idempotencyKey,
  )
  if (dup) return ok(s, { ticket: dup, created: false })
  const bad = checkTicketInput(input)
  if (bad) return fail(bad)
  const id = c.newId('ticket')
  const ev = event(id, 'student', 'submitted', c, { to: 'submitted' })
  const ticket: Ticket = {
    id,
    kind: input.kind,
    ownerProfileId: input.profileId,
    createdAt: c.nowIso,
    updatedAt: c.nowIso,
    status: 'submitted',
    statusVersion: 1,
    category: input.category,
    description: input.description.trim(),
    ...(input.location?.trim()
      ? { location: input.location.trim(), locationSource: input.locationSource ?? 'selfReported' }
      : {}),
    reportedSeverity: input.reportedSeverity,
    attachments: input.attachments ?? [],
    ...(input.evidence?.length ? { evidence: input.evidence } : {}),
    ...(input.teaching ? { teaching: input.teaching } : {}),
    resolutionCount: 0,
    idempotencyKey: input.idempotencyKey,
    provenance: userProvenance(c.nowIso),
    history: [ev],
  }
  return ok({ ...s, tickets: [ticket, ...s.tickets] }, { ticket, created: true }, [
    tell(
      input.profileId,
      id,
      ev,
      'Ticket recorded in CampusOS',
      'It is stored in this on this device only. Nobody at the campus has received it, and no response time is promised.',
    ),
  ])
}

export type TicketAction =
  | 'cancel'
  | 'reopen'
  | 'acknowledge'
  | 'assign'
  | 'start'
  | 'awaitParts'
  | 'resume'
  | 'resolve'
  | 'close'

const TICKET_ACTOR: Record<TicketAction, ActorType[]> = {
  cancel: ['student'],
  reopen: ['student'],
  acknowledge: ['student'],
  assign: ['demoMaintenance'],
  start: ['demoMaintenance'],
  awaitParts: ['demoMaintenance'],
  resume: ['demoMaintenance'],
  resolve: ['demoMaintenance'],
  close: ['demoMaintenance'],
}

export function ticketAct(
  s: AdminStore,
  id: string,
  action: TicketAction,
  actor: ActorType,
  c: Ctx,
  opts: {
    profileId?: string
    expectedVersion?: number
    reason?: string
    team?: string
    demoPriority?: 'normal' | 'high'
    demoTargetHours?: number
  } = {},
): Change<Ticket> {
  if (!TICKET_ACTOR[action].includes(actor))
    return fail('That step belongs to a different role, not to you.')
  const t = findTicket(s, id)
  if (!t) return fail('That ticket was not found.')
  if (actor === 'student' && t.ownerProfileId !== opts.profileId)
    return fail('That ticket was not found.')
  if (opts.expectedVersion !== undefined && opts.expectedVersion !== t.statusVersion)
    return fail(STALE)
  const reason = opts.reason?.trim()
  let to: TicketStatus
  let title = ''
  let body = ''
  const patch: Partial<Ticket> = {}
  switch (action) {
    case 'cancel': {
      const beforeWork: TicketStatus[] = ['submitted', 'assigned']
      if (
        !(s.config.cancelUntilWorkStarts ? beforeWork : TICKET_OPEN).includes(t.status) ||
        t.status === 'resolvedInDemo' ||
        t.status === 'reopened'
      )
        return fail(
          'This ticket can no longer be cancelled because work has started or it is already finished.',
        )
      to = 'cancelledByReporter'
      title = 'Ticket cancelled'
      body = 'You cancelled this app ticket. It stays in your history.'
      break
    }
    case 'reopen':
      if (t.status !== 'resolvedInDemo')
        return fail('Only a ticket marked resolved on this device can be reopened.')
      if (!reason) return fail('Say what is still wrong so the history makes sense.')
      to = 'reopened'
      title = 'Issue reopened'
      body = `Reopened on the same ticket: ${reason}`
      break
    case 'acknowledge':
      if (t.status !== 'resolvedInDemo')
        return fail(
          'There is nothing to acknowledge until the ticket is marked resolved on this device.',
        )
      to = 'closedInDemo'
      title = 'Ticket closed (local)'
      body = 'You confirmed the issue is sorted. Closed in the on this device only.'
      break
    case 'assign':
      if (t.status !== 'submitted' && t.status !== 'reopened')
        return fail('Only a submitted or reopened ticket can be assigned.')
      to = 'assigned'
      patch.teamLabel = opts.team?.trim() || 'Team not assigned'
      if (opts.demoPriority) patch.demoPriority = opts.demoPriority
      if (opts.demoTargetHours) patch.demoTargetHours = opts.demoTargetHours
      title = 'Assignment simulated'
      body = `Assignment: ${patch.teamLabel}. This is not a real team or a promise of a visit.`
      break
    case 'start':
      if (t.status !== 'assigned' && t.status !== 'reopened')
        return fail('Work can start only on an assigned or reopened ticket.')
      to = 'inProgress'
      title = 'Progress simulated'
      body = 'Work was marked started on this device.'
      break
    case 'awaitParts':
      if (t.status !== 'assigned' && t.status !== 'inProgress')
        return fail('Parts can be awaited only once a ticket is assigned or in progress.')
      to = 'awaitingParts'
      title = 'Ticket awaiting parts'
      body = 'Simulated: the ticket is waiting for parts.'
      break
    case 'resume':
      if (t.status !== 'awaitingParts') return fail('Only a ticket awaiting parts can resume.')
      to = 'inProgress'
      title = 'Progress simulated'
      body = 'Work resumed on this device.'
      break
    case 'resolve':
      if (t.status !== 'inProgress')
        return fail('Only a ticket that is in progress can be marked resolved.')
      to = 'resolvedInDemo'
      patch.resolutionCount = t.resolutionCount + 1
      title = 'Issue marked resolved locally'
      body = 'Marked resolved on this device. Please confirm it is sorted, or reopen it.'
      break
    case 'close':
      if (t.status !== 'resolvedInDemo') return fail('Only a ticket marked resolved can be closed.')
      to = 'closedInDemo'
      title = 'Ticket closed (local)'
      body = 'Closed on this device by the simulator.'
      break
  }
  const ev = event(t.id, actor, action, c, { from: t.status, to, ...(reason ? { reason } : {}) })
  const next: Ticket = {
    ...t,
    ...patch,
    status: to,
    statusVersion: t.statusVersion + 1,
    updatedAt: c.nowIso,
    history: [...t.history, ev],
  }
  return ok(putTicket(s, next), next, [
    tell(
      t.ownerProfileId,
      t.id,
      ev,
      title,
      t.teaching ? `${t.teaching.classroomReference}: ${body}` : body,
    ),
  ])
}

export const isOpenLeave = (l: LeaveRequest) => LEAVE_OPEN.includes(l.status)
export const isOpenTicket = (t: Ticket) => TICKET_OPEN.includes(t.status)
