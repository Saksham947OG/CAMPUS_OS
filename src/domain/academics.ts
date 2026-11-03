import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Academics & Faculty (COS-ACADEMICS-001): Course Hub extras, faculty and office meetings, project
 * groups and mentorship. Courses, classes and deadlines stay in the Calendar records. A request is
 * never a confirmed meeting, an invitation is never an agreement to mentor, and nothing is delivered
 * to a real person.
 */
const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })
const text = (max: number) => z.string().trim().max(max)

/** Append-only. The actor is a student or a clearly labelled simulated role, never a real person. */
export const EVENT_ACTORS = [
  'student',
  'demoFaculty',
  'demoOffice',
  'demoClub',
  'demoMentor',
] as const
export type EventActor = (typeof EVENT_ACTORS)[number]
export const requestEventSchema = z.object({
  id,
  requestId: id,
  actorType: z.enum(EVENT_ACTORS),
  eventType: z.string().min(1).max(60),
  from: z.string().max(40).optional(),
  to: z.string().max(40).optional(),
  at: iso,
  reason: text(300).optional(),
})
export type RequestEvent = z.infer<typeof requestEventSchema>

export const NOTICE_TYPES = ['lecture', 'material', 'reminder', 'general'] as const
export const noticeLabel: Record<(typeof NOTICE_TYPES)[number], string> = {
  lecture: 'Lecture update',
  material: 'New material',
  reminder: 'Reminder',
  general: 'General notice',
}

export const announcementSchema = z.object({
  id,
  courseId: id,
  title: text(100).min(1),
  body: text(500),
  noticeType: z.enum(NOTICE_TYPES),
  /** Unknown stays unknown. */
  publishedOn: dateOnlySchema.optional(),
  /** A generic label, never a real faculty member. */
  authorLabel: z.string().min(1).max(60),
  audienceLabel: z.string().min(1).max(60),
  sourceLabel: z.string().min(1).max(100),
})
export type Announcement = z.infer<typeof announcementSchema>

export const resourceSchema = z.object({
  id,
  courseId: id,
  title: text(100).min(1),
  kind: z.enum(['slides', 'reading', 'link', 'recording', 'case']),
  /** A real https link, or absent. A missing link is "Resource not provided", never an invented URL. */
  uri: z.string().max(300).optional(),
  accessLabel: z.string().max(100).optional(),
  sourceLabel: z.string().min(1).max(100),
})
export type Resource = z.infer<typeof resourceSchema>

export const facultySchema = z.object({
  id,
  displayName: z.string().min(1).max(60),
  courseIds: z.array(id),
  /** Published office hours as text, only if supplied. Never inferred from presence. */
  officeHoursText: z.string().max(120).optional(),
  locationText: z.string().max(80).optional(),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Faculty = z.infer<typeof facultySchema>

export const officeSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  hoursText: z.string().max(120).optional(),
  locationText: z.string().max(80).optional(),
  topics: z.array(z.string().min(1).max(60)),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Office = z.infer<typeof officeSchema>

export const ACTOR_KINDS = ['faculty', 'office', 'club'] as const
export type MeetingActorKind = (typeof ACTOR_KINDS)[number]

/** A requestable window. Demo windows are not official availability and are not presence. */
export const availabilitySchema = z.object({
  id,
  actorKind: z.enum(ACTOR_KINDS),
  actorId: id,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  capacity: z.number().int().min(1).max(5),
  sourceLabel: z.string().min(1).max(100),
})
export type Availability = z.infer<typeof availabilitySchema>

export const MEETING_STATUSES = [
  'requested',
  'alternativeProposed',
  'alternativeAccepted',
  'acceptedDemo',
  'rejectedDemo',
  'withdrawn',
  'cancellationRequested',
  'cancelledDemo',
  'completedDemo',
] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const meetingStatusLabel: Record<MeetingStatus, string> = {
  requested: 'Awaiting response',
  alternativeProposed: 'Alternative time proposed',
  alternativeAccepted: 'You accepted the alternative; awaiting confirmation',
  acceptedDemo: 'Accepted locally (not an official appointment)',
  rejectedDemo: 'Declined locally',
  withdrawn: 'Withdrawn',
  cancellationRequested: 'Cancellation requested',
  cancelledDemo: 'Cancelled locally',
  completedDemo: 'Marked completed locally',
}
export const MEETING_OPEN: readonly MeetingStatus[] = [
  'requested',
  'alternativeProposed',
  'alternativeAccepted',
  'acceptedDemo',
  'cancellationRequested',
]

export const TOPICS = [
  'Academic doubt',
  'Project guidance',
  'Office hours',
  'Administrative query',
  'Learn about a club',
  'Other',
] as const

export const meetingSchema = z.object({
  id,
  ownerProfileId: id,
  actorKind: z.enum(ACTOR_KINDS),
  actorId: id,
  /** A display name for an actor that is not in the Academics store (a club). */
  actorLabel: z.string().max(60).optional(),
  /** Set when the student picked a published window. Absent for a proposed time. */
  slotId: id.optional(),
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  topic: z.enum(TOPICS),
  note: text(300).optional(),
  /** The proposal a simulated actor made, kept apart until the student responds. */
  alternative: z
    .object({ date: dateOnlySchema, start: localTimeSchema, end: localTimeSchema })
    .optional(),
  status: z.enum(MEETING_STATUSES),
  statusVersion: z.number().int().min(1),
  /** A group a mentorship meeting relates to, if any. */
  groupId: id.optional(),
  idempotencyKey: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(requestEventSchema).min(1),
})
export type Meeting = z.infer<typeof meetingSchema>

export const groupSchema = z.object({
  id,
  ownerProfileId: id,
  courseId: id.optional(),
  title: text(80).min(1),
  description: text(300).optional(),
  /** Fictional aliases typed by the owner. Nobody is invited or verified. */
  memberAliases: z.array(text(40).min(1)).max(8),
  milestones: z.array(
    z.object({
      id,
      title: text(80).min(1),
      dueDate: dateOnlySchema.optional(),
      status: z.enum(['notStarted', 'inProgress', 'done']),
    }),
  ),
  createdAt: iso,
  updatedAt: iso,
})
export type Group = z.infer<typeof groupSchema>

export const INVITE_STATUSES = [
  'sent',
  'accepted',
  'declined',
  'feedbackRequested',
  'withdrawn',
] as const
export type InviteStatus = (typeof INVITE_STATUSES)[number]
export const inviteStatusLabel: Record<InviteStatus, string> = {
  sent: 'Sent locally (nothing was delivered)',
  accepted: 'Accepted locally (simulated mentor)',
  declined: 'Declined locally',
  feedbackRequested: 'Feedback requested',
  withdrawn: 'Withdrawn',
}
export const INVITE_ACTIVE: readonly InviteStatus[] = ['sent', 'accepted', 'feedbackRequested']

export const inviteSchema = z.object({
  id,
  groupId: id,
  ownerProfileId: id,
  facultyId: id,
  note: text(300),
  status: z.enum(INVITE_STATUSES),
  statusVersion: z.number().int().min(1),
  /** Always simulated and attributed to a generic Demo Mentor, never to a real professor. */
  feedback: text(300).optional(),
  createdAt: iso,
  updatedAt: iso,
  history: z.array(requestEventSchema).min(1),
})
export type Invite = z.infer<typeof inviteSchema>

export const academicsConfigSchema = z.object({
  /** When a faculty member has published nothing, allow a student to propose a time. */
  allowProposals: z.boolean(),
})

export const academicsStoreSchema = z.object({
  schemaVersion: z.literal(1),
  config: academicsConfigSchema,
  announcements: z.array(announcementSchema),
  resources: z.array(resourceSchema),
  faculty: z.array(facultySchema),
  office: officeSchema,
  availability: z.array(availabilitySchema),
  /** Which announcements each profile has read. A personal state. */
  read: z.record(z.string(), z.array(id)),
  /** Private notes, per profile and course. */
  notes: z.array(
    z.object({ id, ownerProfileId: id, courseId: id, text: text(1000), updatedAt: iso }),
  ),
  groups: z.array(groupSchema),
  invites: z.array(inviteSchema),
  meetings: z.array(meetingSchema),
})
export type AcademicsStore = z.infer<typeof academicsStoreSchema>
