import { z } from 'zod'
import { auditEventSchema } from './ess'
import { evidenceMetaSchema } from './evidence'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Sports & Fitness (COS-SPORTS-001): Gym, Badminton and Other Sports on one resource-booking engine.
 * Every number here is a configurable DEMO default in `demoSportsConfig`, never an institutional rule.
 * Reservation is not physical use, check-in is a self-report, and an unknown count is never zero.
 */

const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })
const note = z.string().trim().max(300)

export const ACTIVITIES = [
  'gym',
  'badminton',
  'tableTennis',
  'pool',
  'snooker',
  'basketball',
  'library',
  'musicRoom',
  'chillZone',
] as const
export const activitySchema = z.enum(ACTIVITIES)
export type Activity = z.infer<typeof activitySchema>

export const activityLabel: Record<Activity, string> = {
  gym: 'Gym',
  badminton: 'Badminton',
  tableTennis: 'Table Tennis',
  pool: 'Pool',
  snooker: 'Snooker',
  basketball: 'Basketball',
  library: 'Library',
  musicRoom: 'Music Room',
  chillZone: 'Chill Zone',
}
export const resourceNoun: Record<Activity, string> = {
  gym: 'session',
  badminton: 'court',
  tableTennis: 'table',
  pool: 'table',
  snooker: 'table',
  basketball: 'court',
  library: 'room',
  musicRoom: 'room',
  chillZone: 'spot',
}
export const OTHER_SPORTS: readonly Activity[] = ['tableTennis', 'pool', 'snooker', 'basketball']
/** Space reservations (COS-SPACES-001) use the same engine, store and lifecycle as sports. */
export const SPACE_ACTIVITIES: readonly Activity[] = ['library', 'musicRoom', 'chillZone']

/** Rules are data per activity, never copied blindly from badminton. */
export const policySchema = z.object({
  /** False means "information only": no reserve action is ever offered. */
  bookable: z.boolean(),
  slotMinutes: z.number().int().min(15).max(240),
  horizonDays: z.number().int().min(1).max(30),
  maxActive: z.number().int().min(1).max(10),
  graceMinutes: z.number().int().min(0).max(120),
  bufferMinutes: z.number().int().min(0).max(60),
  /** Unknown unless a source says so. Never invented. */
  participantMax: z.number().int().min(1).max(100).optional(),
  allowPartner: z.boolean(),
  allowWaitlist: z.boolean(),
  /** Activities sharing a group count toward ONE upcoming-booking limit (the three space services). */
  limitGroup: z.string().max(30).optional(),
})
export type Policy = z.infer<typeof policySchema>

export const sportsConfigSchema = z.object({
  policies: z.object({
    gym: policySchema,
    badminton: policySchema,
    tableTennis: policySchema,
    pool: policySchema,
    // Added with the two-table snooker facility. `default` lets a store saved before it loads unchanged.
    snooker: policySchema.default(() => defaultSnookerPolicy()),
    basketball: policySchema,
    // Added with COS-SPACES-001. `default` lets a store saved before this existed load unchanged.
    library: policySchema.default(() => defaultSpacePolicies().library),
    musicRoom: policySchema.default(() => defaultSpacePolicies().musicRoom),
    chillZone: policySchema.default(() => defaultSpacePolicies().chillZone),
  }),
  offerLifetimeMinutes: z.number().int().min(1).max(240),
  reminderMinutes: z.number().int().min(0).max(1440),
  occupancyStaleMinutes: z.number().int().min(5).max(600),
  gymSessionStaleMinutes: z.number().int().min(10).max(600),
  /** The longest a self-reported check-in stays open (a demo default, not a campus rule). */
  checkInMaxMinutes: z.number().int().min(5).max(480).default(60),
})
export type SportsConfig = z.infer<typeof sportsConfigSchema>

export const resourceSchema = z.object({
  id,
  activity: activitySchema,
  /** False for a facility that is only described (e.g. the library itself): no slot is ever offered. */
  bookable: z.boolean().optional(),
  label: z.string().min(1).max(60),
  location: z.string().max(80).optional(),
  /** Owner-supplied people-at-a-time figure (see capacity.ts); never treated as measured occupancy. */
  referenceCapacity: z.number().int().min(1).max(1000).optional(),
  referenceCapacityApproximate: z.boolean().optional(),
  /** How many separate reservations one slot holds. Absent means exclusive (one). The gym uses it. */
  slotCapacity: z.number().int().min(1).max(100).optional(),
  /** Published opening hours. Null means not supplied. A `close` at or before `open` means the next day. */
  hours: z.object({ open: localTimeSchema, close: localTimeSchema }).nullable(),
  status: z.enum(['open', 'closed', 'unknown']),
  closureNote: note.optional(),
  sourceLabel: z.string().min(1).max(80),
  asOf: iso,
  provenance: provenanceSchema,
})
export type Resource = z.infer<typeof resourceSchema>

export const RESERVATION_STATES = [
  'confirmedDemo',
  'checkedIn',
  'inUse',
  'completed',
  'cancelled',
  'noShow',
  'checkInExpired',
] as const
export const reservationStateSchema = z.enum(RESERVATION_STATES)
export type ReservationState = z.infer<typeof reservationStateSchema>

export const reservationStateLabel: Record<ReservationState, string> = {
  confirmedDemo: 'Confirmed (local)',
  checkedIn: 'Checked in (self-reported)',
  inUse: 'In use',
  completed: 'Finished (self-reported)',
  cancelled: 'Cancelled',
  noShow: 'Released after no-show (local)',
  checkInExpired: 'Check-in expired; physical use unconfirmed',
}

/** These hold a claim on the slot. `inUse` exists for activities that need it; courts skip it. */
export const ACTIVE_STATES: readonly ReservationState[] = ['confirmedDemo', 'checkedIn', 'inUse']

export const sportsReservationSchema = z.object({
  id,
  ownerProfileId: id,
  resourceId: id,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  /** Present only when the interval ends on a later date (overnight). Never assumed to be `date`. */
  endDate: dateOnlySchema.optional(),
  state: reservationStateSchema,
  /** A closure or fault touched this booking. It stays traceable until someone resolves it. */
  disrupted: z.boolean(),
  disruptionNote: note.optional(),
  /** A free-text personal note. A listed partner is NOT a verified or accepting person. */
  partnerNote: z.string().trim().max(80).optional(),
  participants: z.number().int().min(1).max(100).optional(),
  idempotencyKey: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  version: z.number().int().min(1),
  provenance: provenanceSchema,
  history: z.array(auditEventSchema).min(1),
})
export type SportsReservation = z.infer<typeof sportsReservationSchema>

export const WAITLIST_STATES = ['waiting', 'offered', 'accepted', 'declined', 'expired'] as const
export const waitlistEntrySchema = z.object({
  id,
  resourceId: id,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  profileId: id,
  /** Creation order among RECORDED entries only. Never a campus-wide rank. */
  sequence: z.number().int().min(1),
  state: z.enum(WAITLIST_STATES),
  createdAt: iso,
  offeredAt: iso.optional(),
  offerExpiresAt: iso.optional(),
  resultingReservationId: id.optional(),
  updatedAt: iso,
})
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>

export const gymSessionSchema = z.object({
  id,
  profileId: id,
  /** Which facility the self-report is for. Missing means the gym (stores saved before the library). */
  facilityId: id.optional(),
  startedAt: iso,
  endedAt: iso.optional(),
  /** When the self-reported check-in stops counting. Not proof the person left. */
  expiresAt: iso.optional(),
  lastConfirmedAt: iso.optional(),
  closeReason: z.enum(['MANUAL', 'AUTO_EXPIRED']).optional(),
  provenance: provenanceSchema,
})
export type GymSession = z.infer<typeof gymSessionSchema>

export const occupancySchema = z.object({
  /** Null means unknown. It is never shown as zero. */
  count: z.number().int().min(0).max(1000).nullable(),
  level: z.enum(['quiet', 'moderate', 'busy']).optional(),
  completeness: z.enum(['partial', 'unknown']),
  asOf: iso,
  sourceLabel: z.string().min(1).max(80),
  provenance: provenanceSchema,
})
export type Occupancy = z.infer<typeof occupancySchema>

export const EQUIPMENT_STATUSES = [
  'reportedAvailable',
  'reportedUnavailable',
  'underMaintenance',
  'unknown',
] as const
export const equipmentStatusLabel: Record<(typeof EQUIPMENT_STATUSES)[number], string> = {
  reportedAvailable: 'Reported available',
  reportedUnavailable: 'Reported unavailable',
  underMaintenance: 'Reported under maintenance',
  unknown: 'Status unknown',
}
export const equipmentSchema = z.object({
  id,
  /** Which facility this belongs to. Missing means the gym. */
  facilityId: id.optional(),
  label: z.string().min(1).max(60),
  status: z.enum(EQUIPMENT_STATUSES),
  sourceLabel: z.string().min(1).max(80),
  asOf: iso,
  provenance: provenanceSchema,
})
export type Equipment = z.infer<typeof equipmentSchema>

/** A local local note. It is not a ticket in the future complaints module (F12) and starts no repair. */
export const faultReportSchema = z.object({
  id,
  equipmentId: id,
  profileId: id,
  note,
  at: iso,
  evidence: z.array(evidenceMetaSchema).max(3).optional(),
})
export type FaultReport = z.infer<typeof faultReportSchema>

/** Every simulator action, kept apart from the student audit trail. */
export const demoOperationSchema = z.object({
  id,
  action: z.string().min(1).max(60),
  actorLabel: z.literal('Local demo simulator'),
  entityId: id,
  previous: z.string().max(200),
  next: z.string().max(200),
  at: iso,
})
export type DemoOperation = z.infer<typeof demoOperationSchema>

/** A fictional illustrative catalogue entry. No real library system is connected. */
export const bookSchema = z.object({
  id,
  title: z.string().min(1).max(120),
  author: z.string().max(80).optional(),
  /** A snapshot label, never a guarantee that the book is on the shelf now. */
  status: z.enum(['availableSnapshot', 'onLoanSnapshot', 'unknown']),
  asOf: iso,
  sourceLabel: z.string().min(1).max(80),
  provenance: provenanceSchema,
})
export type Book = z.infer<typeof bookSchema>

/** A loan someone entered. It is not a library circulation record, and a student cannot certify a return. */
export const loanSchema = z.object({
  id,
  profileId: id,
  bookId: id,
  issuedOn: dateOnlySchema.optional(),
  /** Date-only: it never gains an invented due hour. */
  dueDate: dateOnlySchema,
  returnedOn: dateOnlySchema.optional(),
  studentNote: z.string().trim().max(200).optional(),
  reminderNotifiedAt: iso.optional(),
  updatedAt: iso,
  provenance: provenanceSchema,
})
export type Loan = z.infer<typeof loanSchema>

export const sportsStoreSchema = z.object({
  schemaVersion: z.literal(1),
  /** Marks the one-time upgrade from the information-only gym. */
  gymScheduleVersion: z.literal(1).optional(),
  config: sportsConfigSchema,
  resources: z.array(resourceSchema),
  reservations: z.array(sportsReservationSchema),
  waitlist: z.array(waitlistEntrySchema),
  gymSessions: z.array(gymSessionSchema),
  occupancy: occupancySchema.nullable(),
  libraryOccupancy: occupancySchema.nullable().default(null),
  equipment: z.array(equipmentSchema),
  catalogue: z.array(bookSchema).default([]),
  loans: z.array(loanSchema).default([]),
  faultReports: z.array(faultReportSchema),
  operations: z.array(demoOperationSchema),
  nextSequence: z.number().int().min(1),
})
export type SportsStore = z.infer<typeof sportsStoreSchema>

/** Illustrative policy rows for the three space services (COS-SPACES-001 §3.3). Not campus rules. */
export function defaultSpacePolicies(): Record<'library' | 'musicRoom' | 'chillZone', Policy> {
  const base = {
    bookable: true,
    horizonDays: 7,
    maxActive: 2,
    graceMinutes: 10,
    bufferMinutes: 0,
    allowPartner: false,
    allowWaitlist: false,
    limitGroup: 'space',
  }
  return {
    library: { ...base, slotMinutes: 60 },
    musicRoom: { ...base, slotMinutes: 90, allowPartner: true },
    chillZone: { ...base, slotMinutes: 30, allowPartner: true },
  }
}

/** Illustrative policy for the two supplied snooker tables. The table count is supplied; slot rules are not. */
export function defaultSnookerPolicy(): Policy {
  return {
    bookable: true,
    slotMinutes: 60,
    horizonDays: 7,
    maxActive: 1,
    graceMinutes: 10,
    bufferMinutes: 0,
    allowPartner: true,
    allowWaitlist: false,
  }
}
