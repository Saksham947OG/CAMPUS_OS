import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Campus Essentials (COS-ESSENTIALS-001): SS Laundry, self-service machines, Mess extras and Parcels.
 * One canonical store, owner-filtered views, append-only histories. Every record carries provenance;
 * "unknown" is a value, never zero or on-time. Nothing here is a live or verified source.
 */

const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })
const note = z.string().trim().max(300)

export const auditEventSchema = z.object({
  id,
  entityId: id,
  actorKind: z.enum(['student', 'demoSimulator', 'import']),
  action: z.string().min(1).max(60),
  at: iso,
  dataMode: z.enum(['userCreated', 'simulated', 'demoSeed', 'provided']),
  note: note.optional(),
})
export type AuditEvent = z.infer<typeof auditEventSchema>

/* ───────────────────────────── SS Laundry ───────────────────────────── */

export const LOAD_STAGES = [
  'registered',
  'received',
  'processing',
  'returnedToCampus',
  'readyForCollection',
  'collected',
] as const
export const loadStageSchema = z.enum(LOAD_STAGES)
export type LoadStage = z.infer<typeof loadStageSchema>

export const loadStageLabel: Record<LoadStage, string> = {
  registered: 'Registered by you (not yet confirmed received)',
  received: 'Receipt recorded (demo provider)',
  processing: 'Processing (demo provider)',
  returnedToCampus: 'Returned to campus (demo provider)',
  readyForCollection: 'Ready for collection (demo provider)',
  collected: 'Collection recorded (demo provider)',
}

export const loadStageChip: Record<LoadStage, string> = {
  registered: 'Student reported',
  received: 'Received',
  processing: 'Processing',
  returnedToCampus: 'Back on campus',
  readyForCollection: 'Ready for collection',
  collected: 'Collected',
}

export const confidenceSchema = z.enum(['tentative', 'confirmed', 'unknown'])
export type Confidence = z.infer<typeof confidenceSchema>

export const laundryLoadSchema = z.object({
  id,
  ownerProfileId: id,
  /** Optional receipt/bag reference. Never a secret. */
  reference: z.string().trim().max(40).optional(),
  handedOverDate: dateOnlySchema,
  handedOverTime: localTimeSchema.optional(),
  itemCount: z.number().int().min(1).max(200).optional(),
  notes: note.optional(),
  collectionPoint: z.string().trim().max(80).optional(),
  stage: loadStageSchema,
  /** Overlays coexist with a stage. */
  delayFlag: z.boolean(),
  discrepancyFlag: z.boolean(),
  discrepancyNote: note.optional(),
  underReview: z.boolean(),
  expectedReturnDate: dateOnlySchema.optional(),
  expectedReturnConfidence: confidenceSchema,
  /** The student says they collected it. Self-reported until a simulated handover. */
  studentReportedCollected: z.boolean(),
  cancelled: z.boolean(),
  idempotencyKey: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  version: z.number().int().min(1),
  provenance: provenanceSchema,
  history: z.array(auditEventSchema).min(1),
})
export type LaundryLoad = z.infer<typeof laundryLoadSchema>

export const providerVisitSchema = z.object({
  status: z.enum(['tentative', 'confirmed', 'rescheduled', 'cancelled']),
  date: dateOnlySchema.optional(),
  windowStart: localTimeSchema.optional(),
  windowEnd: localTimeSchema.optional(),
  /** A recorded arrival. It never changes any individual load. */
  arrivedAt: iso.optional(),
  sourceLabel: z.string().min(1).max(80),
  asOf: iso,
  version: z.number().int().min(1),
  provenance: provenanceSchema,
})
export type ProviderVisit = z.infer<typeof providerVisitSchema>

/* ───────────────────────────── Machines ───────────────────────────── */

export const machineSchema = z.object({
  id,
  label: z.string().min(1).max(60),
  location: z.string().max(80).optional(),
  operationalStatus: z.enum(['working', 'outOfService', 'unknown']),
  /** Independent of reservations: no booking does not mean available. */
  physicalStatus: z.enum(['available', 'occupied', 'unknown']),
  sourceLabel: z.string().min(1).max(80),
  asOf: iso,
  provenance: provenanceSchema,
})
export type Machine = z.infer<typeof machineSchema>

export const RESERVATION_STATES = [
  'reserved',
  'checkedIn',
  'used',
  'completed',
  'cancelled',
  'noShow',
  'blockedByOutage',
] as const
export const reservationStateSchema = z.enum(RESERVATION_STATES)
export type ReservationState = z.infer<typeof reservationStateSchema>

export const reservationStateLabel: Record<ReservationState, string> = {
  reserved: 'Reserved',
  checkedIn: 'Checked in (self-reported)',
  used: 'Cycle started (self-reported)',
  completed: 'Finished (self-reported)',
  cancelled: 'Cancelled',
  noShow: 'Marked no-show (demo)',
  blockedByOutage: 'Affected by an outage (demo)',
}

export const reservationSchema = z.object({
  id,
  ownerProfileId: id,
  machineId: id,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  state: reservationStateSchema,
  cycleStartAt: iso.optional(),
  cycleMinutes: z.number().int().min(1).max(240).optional(),
  /** Set once the in-app "estimated finish reached" message has been shown. */
  cycleNotifiedAt: iso.optional(),
  idempotencyKey: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  version: z.number().int().min(1),
  provenance: provenanceSchema,
  history: z.array(auditEventSchema).min(1),
})
export type Reservation = z.infer<typeof reservationSchema>

export const ACTIVE_RESERVATION_STATES: readonly ReservationState[] = [
  'reserved',
  'checkedIn',
  'used',
]

/** Demo defaults, editable in the simulator. They are NOT campus rules. */
export const demoRulesSchema = z.object({
  maxActivePerStudent: z.number().int().min(1).max(5),
  graceMinutes: z.number().int().min(0).max(120),
  horizonDays: z.number().int().min(1).max(30),
  slotMinutes: z.number().int().min(15).max(240),
  cycleMinutes: z.number().int().min(10).max(240),
  parcelReminderHours: z.number().int().min(1).max(720),
  messSessionStaleMinutes: z.number().int().min(10).max(600),
})
export type DemoRules = z.infer<typeof demoRulesSchema>
export const defaultDemoRules = (): DemoRules => ({
  maxActivePerStudent: 1,
  graceMinutes: 10,
  horizonDays: 7,
  slotMinutes: 60,
  cycleMinutes: 45,
  parcelReminderHours: 72,
  messSessionStaleMinutes: 90,
})

/* ───────────────────────────── Mess ───────────────────────────── */

export const messSessionSchema = z.object({
  id,
  profileId: id,
  startedAt: iso,
  endedAt: iso.optional(),
  provenance: provenanceSchema,
})
export type MessSession = z.infer<typeof messSessionSchema>

export const messFeedbackSchema = z.object({
  id,
  profileId: id,
  mealId: id,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(300).optional(),
  at: iso,
  provenance: provenanceSchema,
})
export type MessFeedback = z.infer<typeof messFeedbackSchema>

export const messFeeSchema = z.object({
  /** In paise. Left undefined when not supplied: never invented. */
  amountMinor: z.number().int().min(0).optional(),
  currency: z.literal('INR'),
  dueDate: dateOnlySchema.optional(),
  instructions: z.string().trim().max(300).optional(),
  lateFee: z.string().trim().max(120).optional(),
  /** An existing authorised form, only if someone supplied it. https only. */
  authorizedFormUrl: z.url({ protocol: /^https$/ }).optional(),
  sourceLabel: z.string().min(1).max(80),
  asOf: iso,
  provenance: provenanceSchema,
})
export type MessFee = z.infer<typeof messFeeSchema>

export const FEE_STATUSES = [
  'notSubmitted',
  'studentReportedSubmitted',
  'verificationPending',
  'verifiedPaid',
  'unknown',
] as const
export const feeStatusSchema = z.enum(FEE_STATUSES)
export type FeeStatus = z.infer<typeof feeStatusSchema>

export const feeStatusLabel: Record<FeeStatus, string> = {
  notSubmitted: 'Not submitted',
  studentReportedSubmitted: 'You reported submitting it (not a receipt)',
  verificationPending: 'Verification pending',
  verifiedPaid: 'Verified paid',
  unknown: 'Unknown',
}

export const busyReportSchema = z.object({
  state: z.enum(['quiet', 'moderate', 'busy', 'unknown']),
  asOf: iso,
  sourceLabel: z.string().min(1).max(80),
  provenance: provenanceSchema,
})
export type BusyReport = z.infer<typeof busyReportSchema>

/* ───────────────────────────── Parcels ───────────────────────────── */

export const PARCEL_STATES = ['logged', 'collected', 'exception'] as const
export const parcelStateSchema = z.enum(PARCEL_STATES)
export type ParcelState = z.infer<typeof parcelStateSchema>

export const parcelStateLabel: Record<ParcelState, string> = {
  logged: 'Awaiting collection',
  collected: 'Collection recorded',
  exception: 'Needs attention',
}

export const parcelSchema = z.object({
  id,
  recipientProfileId: id,
  courier: z.string().trim().max(40).optional(),
  /** A short suffix only. Never a full tracking number. */
  referenceSuffix: z.string().trim().max(8).optional(),
  collectionPoint: z.string().trim().max(80).optional(),
  loggedAt: iso,
  state: parcelStateSchema,
  collectedAt: iso.optional(),
  exceptionNote: note.optional(),
  /** Set once the in-app "uncollected" reminder has been shown. */
  overdueNotifiedAt: iso.optional(),
  version: z.number().int().min(1),
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(auditEventSchema).min(1),
})
export type Parcel = z.infer<typeof parcelSchema>

/* ───────────────────────────── The store ───────────────────────────── */

export const essStoreSchema = z.object({
  schemaVersion: z.literal(1),
  rules: demoRulesSchema,
  visit: providerVisitSchema.nullable(),
  loads: z.array(laundryLoadSchema),
  machines: z.array(machineSchema),
  reservations: z.array(reservationSchema),
  messOptIn: z.array(z.string()),
  messSessions: z.array(messSessionSchema),
  messBusy: busyReportSchema.nullable(),
  messFeedback: z.array(messFeedbackSchema),
  fee: messFeeSchema.nullable(),
  feeStatus: z.record(z.string(), feeStatusSchema),
  parcels: z.array(parcelSchema),
  nextSequence: z.number().int().min(1),
})
export type EssStore = z.infer<typeof essStoreSchema>
