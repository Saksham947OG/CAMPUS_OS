import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Shared Experience (COS-SHARED-001): notification triage, exam seating and the Time Tax scenario
 * layer. Seating is private to its owner, every figure says whether it is observed or simulated,
 * and nothing here claims an external delivery, an official allotment or a measured saving.
 */

const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })

export const NOTIFICATION_CATEGORIES = [
  'calendar',
  'orders',
  'laundry',
  'parcels',
  'mess',
  'bookings',
  'administration',
  'academics',
  'exams',
  'community',
  'other',
] as const
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number]

export const categoryName: Record<NotificationCategory, string> = {
  calendar: 'Calendar reminders',
  orders: 'Café orders',
  laundry: 'Laundry',
  parcels: 'Parcels',
  mess: 'Mess',
  bookings: 'Bookings',
  administration: 'Administration',
  academics: 'Academics',
  exams: 'Exams',
  community: 'Community',
  other: 'Other',
}

export const PRIORITIES = ['critical', 'important', 'standard', 'optional'] as const
export type Priority = (typeof PRIORITIES)[number]

/** A mute hides standard and optional messages of a category. Critical and important always stay. */
export const notificationPrefsSchema = z.object({
  schemaVersion: z.literal(1),
  muted: z.array(z.enum(NOTIFICATION_CATEGORIES)),
})
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>
export const defaultNotificationPrefs = (): NotificationPrefs => ({ schemaVersion: 1, muted: [] })

/* ───────────────────────────── Exams ───────────────────────────── */

export const examSchema = z.object({
  id,
  courseId: id,
  name: z.string().min(1).max(100),
  date: dateOnlySchema,
  /** Absent means date-only. A start time is never invented. */
  startTime: localTimeSchema.optional(),
  venue: z.string().max(80).optional(),
  status: z.enum(['scheduled', 'changed', 'cancelled']),
  version: z.number().int().min(1),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Exam = z.infer<typeof examSchema>

const seatFields = {
  hall: z.string().max(60).optional(),
  room: z.string().max(60).optional(),
  row: z.string().max(10).optional(),
  column: z.string().max(10).optional(),
  seat: z.string().max(10).optional(),
}
export const seatVersionSchema = z.object({
  version: z.number().int().min(1),
  at: iso,
  ...seatFields,
})
export type SeatVersion = z.infer<typeof seatVersionSchema>

export const seatAllocationSchema = z.object({
  id,
  examId: id,
  ownerProfileId: id,
  ...seatFields,
  version: z.number().int().min(1),
  updatedAt: iso,
  /** Two allocations for one profile, exam and version cannot both be right, so neither is chosen. */
  needsVerification: z.boolean(),
  sourceLabel: z.string().min(1).max(100),
  /** Set only when a seat came from a (simulated) email. The seat is still not an official allotment. */
  sourceNoticeId: id.optional(),
  sourceEmailId: id.optional(),
  sourceRevision: z.number().int().min(1).optional(),
  validation: z.enum(['CONFIRMED_DEMO']).optional(),
  provenance: provenanceSchema,
  history: z.array(seatVersionSchema),
})
export type SeatAllocation = z.infer<typeof seatAllocationSchema>

/* ───────────────────────────── Time Tax scenarios ───────────────────────────── */

export const MEASURES = ['onSiteWaiting', 'failedTrips', 'followUps'] as const
export type Measure = (typeof MEASURES)[number]
export const measureLabel: Record<Measure, string> = {
  onSiteWaiting: 'On-site waiting',
  failedTrips: 'Failed or avoidable trips',
  followUps: 'Follow-up visits and checks',
}

export const scenarioSchema = z.object({
  id,
  ownerProfileId: id,
  serviceId: z.string().min(1).max(40),
  measure: z.enum(MEASURES),
  baselineMinutes: z.number().min(0).max(1000),
  scenarioMinutes: z.number().min(0).max(1000),
  eligibleStudents: z.number().int().min(0).max(100000),
  visitsPerWeek: z.number().min(0).max(50),
  adoptionPercent: z.number().min(0).max(100),
  weeks: z.number().int().min(1).max(60),
  updatedAt: iso,
})
export type Scenario = z.infer<typeof scenarioSchema>

export const sharedStoreSchema = z.object({
  schemaVersion: z.literal(1),
  exams: z.array(examSchema),
  seats: z.array(seatAllocationSchema),
  scenarios: z.array(scenarioSchema),
})
export type SharedStore = z.infer<typeof sharedStoreSchema>
