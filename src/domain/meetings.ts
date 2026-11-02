import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Group meetings and polls (COS-V3 §3, §4.3). One canonical record per meeting: Calendar, Home and
 * notifications only project it. An organizer's chosen time is not everyone's acceptance, and a
 * poll vote is a preference that never overrides a hard conflict. All of it is local demo state:
 * personas simulate the other people, and nothing here reaches another device.
 */
const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })

export const RSVPS = ['INVITED', 'ACCEPTED', 'TENTATIVE', 'DECLINED'] as const
export type Rsvp = (typeof RSVPS)[number]
export const rsvpLabel: Record<Rsvp, string> = {
  INVITED: 'Invited, no reply yet',
  ACCEPTED: 'Accepted',
  TENTATIVE: 'Maybe',
  DECLINED: 'Declined',
}

export const attendeeSchema = z.object({
  profileId: id,
  required: z.boolean(),
  rsvp: z.enum(RSVPS),
  respondedAt: iso.optional(),
  /** A material change reset this person's reply. They must answer again. */
  needsReconfirm: z.boolean().optional(),
})
export type Attendee = z.infer<typeof attendeeSchema>

export const MEETING_STATUSES = ['CONFIRMED', 'CANCELLED', 'COMPLETED'] as const

export const meetingEventSchema = z.object({
  id,
  at: iso,
  actor: id,
  type: z.string().min(1).max(40),
  note: z.string().max(200).optional(),
})
export type MeetingEvent = z.infer<typeof meetingEventSchema>

export const meetingSchema = z.object({
  id,
  organizerProfileId: id,
  title: z.string().trim().min(1).max(80),
  purpose: z.string().trim().max(200).optional(),
  agenda: z.string().trim().max(500).optional(),
  links: z.array(z.string().max(300)).max(5).optional(),
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  attendees: z.array(attendeeSchema).min(1),
  /** The classroom reservation that holds the room. Its state is the room's truth. */
  roomReservationId: id.optional(),
  roomId: id.optional(),
  /** Where the group came from, for polls and clubs. */
  scope: z
    .object({
      kind: z.enum(['course', 'project', 'club', 'committee', 'peer', 'other']),
      label: z.string().max(60),
    })
    .optional(),
  status: z.enum(MEETING_STATUSES),
  revision: z.number().int().min(1),
  /** Stable operation id so a double click makes one meeting. */
  opId: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(meetingEventSchema).min(1),
})
export type Meeting = z.infer<typeof meetingSchema>

export const VOTES = ['YES', 'IF_NEEDED', 'NO'] as const
export type Vote = (typeof VOTES)[number]
export const voteLabel: Record<Vote, string> = { YES: 'Yes', IF_NEEDED: 'If needed', NO: 'No' }

export const pollSchema = z.object({
  id,
  organizerProfileId: id,
  title: z.string().trim().min(1).max(80),
  durationMin: z.number().int().min(15).max(480),
  scope: z.object({
    kind: z.enum(['course', 'project', 'club', 'committee', 'peer', 'other']),
    label: z.string().max(60),
  }),
  /** Only these profiles may vote. A section's poll never includes another section by default. */
  eligible: z.array(id).min(1),
  requiredIds: z.array(id),
  candidates: z
    .array(z.object({ id, date: dateOnlySchema, start: localTimeSchema, end: localTimeSchema }))
    .min(1)
    .max(8),
  /** One current ballot per profile; the latest replaces the earlier one. */
  ballots: z.record(z.string(), z.object({ votes: z.record(z.string(), z.enum(VOTES)), at: iso })),
  status: z.enum(['OPEN', 'CLOSED', 'FINALIZED']),
  finalMeetingId: id.optional(),
  createdAt: iso,
  updatedAt: iso,
})
export type Poll = z.infer<typeof pollSchema>

export const meetingStoreSchema = z.object({
  schemaVersion: z.literal(1),
  meetings: z.array(meetingSchema),
  polls: z.array(pollSchema),
})
export type MeetingStore = z.infer<typeof meetingStoreSchema>
