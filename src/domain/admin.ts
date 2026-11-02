import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Administration (COS-ADMIN-001): Leave & Out-Time, Facility Complaints, Teaching-Aid reports. One
 * request substrate with typed variants. Leave and tickets keep SEPARATE status sets: a resolved
 * ticket is never an approval. Every decision is a simulated, audited step in the demo and none is
 * an institutional permission, gate pass or maintenance action.
 */

const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })
const text = (max: number) => z.string().trim().max(max)

export const ACTOR_TYPES = ['student', 'demoApprover', 'demoMaintenance', 'demoGate'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

export const actorLabel: Record<ActorType, string> = {
  student: 'You',
  demoApprover: 'Demo Approver (simulated)',
  demoMaintenance: 'Demo Maintenance (simulated)',
  demoGate: 'Demo Gate (simulated)',
}

/** Append-only. Nothing here is ever edited after the fact. */
export const requestEventSchema = z.object({
  id,
  requestId: id,
  actorType: z.enum(ACTOR_TYPES),
  eventType: z.string().min(1).max(60),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  at: iso,
  reason: text(300).optional(),
  revision: z.number().int().min(1).optional(),
})
export type RequestEvent = z.infer<typeof requestEventSchema>

/** Metadata only. The file's contents are never read or stored. */
export const attachmentSchema = z.object({
  id,
  displayName: z.string().min(1).max(120),
  mime: z.string().min(1).max(60),
  sizeBytes: z.number().int().min(0).max(5_000_000),
  demoOnly: z.literal(true),
})
export type Attachment = z.infer<typeof attachmentSchema>

/* ───────────────────────────── Leave ───────────────────────────── */

export const LEAVE_TYPES = ['personal', 'medical', 'event', 'emergency', 'other'] as const
export const leaveTypeLabel: Record<(typeof LEAVE_TYPES)[number], string> = {
  personal: 'Personal',
  medical: 'Medical',
  event: 'Event',
  emergency: 'Emergency',
  other: 'Other',
}

export const LEAVE_STATUSES = [
  'submitted',
  'underReview',
  'changesRequested',
  'resubmitted',
  'approvedInDemo',
  'rejected',
  'withdrawn',
  'gateDepartureLogged',
  'gateReturnLogged',
] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]

/** Exact wording from the spec. "Approved" never appears without its demo caveat. */
export const leaveStatusLabel: Record<LeaveStatus, string> = {
  submitted: 'Submitted to demo',
  underReview: 'Under review (simulated)',
  changesRequested: 'Changes requested (simulated)',
  resubmitted: 'Resubmitted to demo',
  approvedInDemo: 'Approved in demo — NOT A VALID GATE PASS',
  rejected: 'Rejected in demo',
  withdrawn: 'Withdrawn',
  gateDepartureLogged: 'Departure logged in demo',
  gateReturnLogged: 'Return logged in demo',
}

export const LEAVE_OPEN: readonly LeaveStatus[] = [
  'submitted',
  'underReview',
  'changesRequested',
  'resubmitted',
  'approvedInDemo',
  'gateDepartureLogged',
]
export const LEAVE_FINAL: readonly LeaveStatus[] = ['rejected', 'withdrawn', 'gateReturnLogged']

export const classMissedSchema = z.object({
  key: z.string().min(1),
  title: z.string().min(1),
  date: dateOnlySchema,
})

const leaveRevisionSchema = z.object({
  revision: z.number().int().min(1),
  submittedAt: iso,
  leaveType: z.enum(LEAVE_TYPES),
  startDate: dateOnlySchema,
  startTime: localTimeSchema,
  endDate: dateOnlySchema,
  endTime: localTimeSchema,
  reason: text(500),
})
export type LeaveRevision = z.infer<typeof leaveRevisionSchema>

export const leaveRequestSchema = z.object({
  id,
  kind: z.literal('leave'),
  ownerProfileId: id,
  createdAt: iso,
  updatedAt: iso,
  status: z.enum(LEAVE_STATUSES),
  /** Bumped on every transition so a stale view can be detected. */
  statusVersion: z.number().int().min(1),
  /** The current revision of what the student asked for. A new one invalidates any earlier decision. */
  revision: z.number().int().min(1),
  leaveType: z.enum(LEAVE_TYPES),
  startDate: dateOnlySchema,
  startTime: localTimeSchema,
  endDate: dateOnlySchema,
  endTime: localTimeSchema,
  reason: text(500),
  /** A snapshot taken at submission. A later timetable change never rewrites it. */
  classesMissed: z.array(classMissedSchema),
  attachments: z.array(attachmentSchema),
  decision: z
    .object({
      revision: z.number().int().min(1),
      decision: z.enum(['approved', 'rejected']),
      at: iso,
      actorRole: z.literal('demoApprover'),
      reason: text(300).optional(),
    })
    .nullable(),
  gate: z.object({ departedAt: iso.optional(), returnedAt: iso.optional() }),
  revisions: z.array(leaveRevisionSchema).min(1),
  idempotencyKey: z.string().optional(),
  provenance: provenanceSchema,
  history: z.array(requestEventSchema).min(1),
})
export type LeaveRequest = z.infer<typeof leaveRequestSchema>

/* ───────────────────────────── Tickets ───────────────────────────── */

export const CATEGORIES = [
  'plumbing',
  'electricity',
  'wifi',
  'cleaning',
  'washroom',
  'other',
] as const
export const categoryLabel: Record<(typeof CATEGORIES)[number], string> = {
  plumbing: 'Plumbing',
  electricity: 'Electricity',
  wifi: 'Wi-Fi',
  cleaning: 'Room cleaning',
  washroom: 'Washroom',
  other: 'Other',
}
export const ASSET_TYPES = ['projector', 'microphone', 'ac', 'smartboard', 'other'] as const
export const assetLabel: Record<(typeof ASSET_TYPES)[number], string> = {
  projector: 'Projector',
  microphone: 'Microphone',
  ac: 'Air conditioning',
  smartboard: 'Smartboard',
  other: 'Other equipment',
}

export const TICKET_STATUSES = [
  'submitted',
  'assigned',
  'inProgress',
  'awaitingParts',
  'resolvedInDemo',
  'reopened',
  'closedInDemo',
  'cancelledByReporter',
] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export const ticketStatusLabel: Record<TicketStatus, string> = {
  submitted: 'Submitted',
  assigned: 'Assigned (simulated)',
  inProgress: 'In progress (simulated)',
  awaitingParts: 'Awaiting parts (simulated)',
  resolvedInDemo: 'Marked resolved (simulated)',
  reopened: 'Reopened',
  closedInDemo: 'Closed (demo)',
  cancelledByReporter: 'Cancelled',
}
export const TICKET_OPEN: readonly TicketStatus[] = [
  'submitted',
  'assigned',
  'inProgress',
  'awaitingParts',
  'resolvedInDemo',
  'reopened',
]

export const ticketSchema = z.object({
  id,
  kind: z.enum(['complaint', 'teachingAid']),
  ownerProfileId: id,
  createdAt: iso,
  updatedAt: iso,
  status: z.enum(TICKET_STATUSES),
  statusVersion: z.number().int().min(1),
  category: z.enum(CATEGORIES),
  description: text(500),
  /** Self-reported unless chosen from the student's own timetable. */
  location: text(80).optional(),
  locationSource: z.enum(['selfReported', 'timetable']).optional(),
  /** What the student said, kept apart from anything the simulator assigns. */
  reportedSeverity: z.enum(['normal', 'urgent']),
  attachments: z.array(attachmentSchema),
  demoPriority: z.enum(['normal', 'high']).optional(),
  /** A demo label only. No real team or person is ever invented. */
  teamLabel: z.string().max(60).optional(),
  /** Optional and labelled "Demo target": never an SLA. */
  demoTargetHours: z.number().int().min(1).max(720).optional(),
  teaching: z
    .object({
      classroomReference: text(80).min(1),
      classroomSource: z.enum(['selfReported', 'timetable']),
      assetType: z.enum(ASSET_TYPES),
      deviceIdentifier: text(40).optional(),
      /** A reporter assertion, not observed minutes lost. */
      classImpact: z.enum(['none', 'delayed', 'disrupted']).optional(),
    })
    .optional(),
  resolutionCount: z.number().int().min(0),
  idempotencyKey: z.string().optional(),
  provenance: provenanceSchema,
  history: z.array(requestEventSchema).min(1),
})
export type Ticket = z.infer<typeof ticketSchema>

export const adminConfigSchema = z.object({
  /** Gate actions exist only when this demo policy is on. */
  gateEnabled: z.boolean(),
  /** Default demo policy: a reporter may cancel only until work starts. */
  cancelUntilWorkStarts: z.boolean(),
  /** Demo team labels offered to the simulator. They are not real teams. */
  teams: z.array(z.string().min(1).max(60)).min(1).max(10),
})
export type AdminConfig = z.infer<typeof adminConfigSchema>

export const adminStoreSchema = z.object({
  schemaVersion: z.literal(1),
  config: adminConfigSchema,
  leaves: z.array(leaveRequestSchema),
  tickets: z.array(ticketSchema),
})
export type AdminStore = z.infer<typeof adminStoreSchema>

export const defaultAdminConfig = (): AdminConfig => ({
  gateEnabled: true,
  cancelUntilWorkStarts: true,
  teams: [
    'Demo facilities team A',
    'Demo facilities team B',
    'Demo IT and classroom equipment team',
  ],
})
