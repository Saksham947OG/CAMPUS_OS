import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Classroom availability and reservations (COS-MASTER-V2 §Booking extension). The four room NAMES come
 * from the owner; capacity, equipment, hours and approval rules are not known, so they stay unset.
 * Every schedule and policy below is a labelled DEMO default. A recorded reservation is never proof
 * that a room is physically empty or occupied.
 */
const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })

export const ROOM_IDS = ['CR_CONFERENCE_HALL', 'CR1', 'CR3', 'G12'] as const

export const roomSchema = z.object({
  id,
  displayName: z.string().min(1).max(40),
  /** Visual identity only ("Conference / presentation room"), never a fact about the real room. */
  kindLabel: z.string().max(60),
  /** Unknown unless a source supplies it. */
  capacity: z.number().int().min(1).max(500).optional(),
  features: z.array(z.string().max(40)).optional(),
  /** `instant`: a free demo slot confirms at once. `approval`: a request that needs a reviewer. */
  bookingMode: z.enum(['instant', 'approval']),
  /** The hours the demo schedule covers. Outside it a slot is UNKNOWN, never "free". */
  knownWindow: z.object({ from: localTimeSchema, to: localTimeSchema }).nullable(),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Room = z.infer<typeof roomSchema>

/** Something that makes a room busy that is not a student's booking: a mapped class or a closure. */
export const blockerSchema = z.object({
  id,
  roomId: id,
  kind: z.enum(['class', 'maintenance', 'otherBooking']),
  /** Weekly recurrence (0 = Sunday) or a single date. */
  weekday: z.number().int().min(0).max(6).optional(),
  date: dateOnlySchema.optional(),
  start: localTimeSchema,
  end: localTimeSchema,
  /** Public busy label only. A private organizer or reason is never stored here. */
  label: z.string().min(1).max(60),
  provenance: provenanceSchema,
})
export type Blocker = z.infer<typeof blockerSchema>

export const PURPOSES = [
  'Study group',
  'Project meeting',
  'Club activity',
  'Presentation',
  'Other',
] as const

export const RESERVATION_STATES = [
  'pendingApproval',
  'confirmedDemo',
  'rejected',
  'cancelled',
  'disrupted',
  'completed',
] as const
export type ReservationState = (typeof RESERVATION_STATES)[number]
export const reservationLabel: Record<ReservationState, string> = {
  pendingApproval: 'Requested, not reserved',
  confirmedDemo: 'Confirmed (local)',
  rejected: 'Not approved (local)',
  cancelled: 'Cancelled',
  disrupted: 'Disrupted by a closure',
  completed: 'Finished',
}
/** Only these hold the slot. A pending request never does. */
export const HOLDING: readonly ReservationState[] = ['confirmedDemo', 'disrupted']

export const eventSchema = z.object({
  id,
  actor: z.enum(['student', 'demoReviewer', 'demoOps']),
  type: z.string().min(1).max(40),
  at: iso,
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  reason: z.string().max(200).optional(),
})
export type RoomEvent = z.infer<typeof eventSchema>

export const reservationSchema = z.object({
  id,
  ownerProfileId: id,
  roomId: id,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  purpose: z.enum(PURPOSES),
  groupName: z.string().trim().max(60).optional(),
  attendees: z.number().int().min(1).max(500).optional(),
  notes: z.string().trim().max(300).optional(),
  state: z.enum(RESERVATION_STATES),
  /** A request for a slot the demo schedule does not cover. It is verification, not a booking. */
  needsVerification: z.boolean().optional(),
  /** Set when a group meeting owns this booking. The meeting is then what Calendar shows. */
  meetingId: z.string().max(80).optional(),
  decisionReason: z.string().max(200).optional(),
  idempotencyKey: z.string().optional(),
  version: z.number().int().min(1),
  createdAt: iso,
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(eventSchema).min(1),
})
export type Reservation = z.infer<typeof reservationSchema>

export const classroomConfigSchema = z.object({
  slotMinutes: z.number().int().min(15).max(240),
  horizonDays: z.number().int().min(1).max(60),
  maxActivePerStudent: z.number().int().min(1).max(10),
})

export const classroomStoreSchema = z.object({
  schemaVersion: z.literal(1),
  config: classroomConfigSchema,
  rooms: z.array(roomSchema),
  blockers: z.array(blockerSchema),
  reservations: z.array(reservationSchema),
})
export type ClassroomStore = z.infer<typeof classroomStoreSchema>

/** What a slot looks like for a given student. The five states of the spec, never merged. */
export type SlotStatus =
  | { kind: 'available' }
  | { kind: 'booked'; until: string; mine: boolean }
  | { kind: 'pending'; mine: true }
  | { kind: 'blocked'; label: string; until: string }
  | { kind: 'unknown' }
