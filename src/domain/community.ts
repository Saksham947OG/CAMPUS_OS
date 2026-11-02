import { z } from 'zod'
import { provenanceSchema } from './provenance'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Community (COS-COMMUNITY-001): Lost & Found, Clubs & Committees, Sports teams and fixtures.
 * Nothing here is sent to a real person. A possible match is not an owner, a claim is not proof,
 * a followed club is not a membership, a roster place is not committee approval, and a team is
 * not a booked court.
 */
const id = z.string().min(1).max(80)
const iso = z.iso.datetime({ offset: true })
const text = (max: number) => z.string().trim().max(max)

/** Append-only. The actor is a student or a clearly labelled simulated role. */
export const COMMUNITY_ACTORS = [
  'student',
  'demoReviewer',
  'demoCaptain',
  'demoCommittee',
  'demoOrganizer',
] as const
export type CommunityActor = (typeof COMMUNITY_ACTORS)[number]
export const eventSchema = z.object({
  id,
  actorType: z.enum(COMMUNITY_ACTORS),
  eventType: z.string().min(1).max(60),
  from: z.string().max(60).optional(),
  to: z.string().max(60).optional(),
  at: iso,
  reason: text(300).optional(),
})
export type CommunityEvent = z.infer<typeof eventSchema>

/* ───────────────────────────── Lost & Found ───────────────────────────── */

export const ITEM_CATEGORIES = [
  'bag',
  'electronics',
  'keys',
  'idCard',
  'clothing',
  'books',
  'bottle',
  'other',
] as const
export type ItemCategory = (typeof ITEM_CATEGORIES)[number]
export const categoryLabel: Record<ItemCategory, string> = {
  bag: 'Bag',
  electronics: 'Electronics',
  keys: 'Keys',
  idCard: 'ID or card',
  clothing: 'Clothing',
  books: 'Books and notes',
  bottle: 'Bottle or lunchbox',
  other: 'Other',
}
/** Broad area names only. A precise room is never a public field. */
export const AREAS = [
  'Library area',
  'Mess area',
  'Sports ground',
  'Lecture block',
  'Hostel area',
  'Café area',
  'Other',
] as const

export const photoSchema = z.object({
  name: z.string().min(1).max(120),
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.number().int().min(1).max(2_000_000),
})
export type PhotoMeta = z.infer<typeof photoSchema>

/** Client-side checks only. The picture itself is not stored, and nothing claims it was scanned. */
export function validatePhoto(f: { name: string; type: string; size: number }): string | null {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    return 'Only JPEG, PNG or WebP pictures are accepted.'
  if (f.size > 2_000_000) return 'That picture is larger than 2 MB.'
  if (f.size < 1) return 'That file is empty.'
  return null
}

export const REPORT_STATUSES = ['draft', 'published', 'returned', 'closed'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]
export const reportStatusLabel: Record<ReportStatus, string> = {
  draft: 'Draft (only you can see it)',
  published: 'Published on this device',
  returned: 'Returned',
  closed: 'Closed',
}

export const reportSchema = z.object({
  id,
  ownerProfileId: id,
  kind: z.enum(['lost', 'found']),
  title: text(80).min(1),
  category: z.enum(ITEM_CATEGORIES),
  /** Safe to show to everyone. */
  description: text(300).optional(),
  colour: text(30).optional(),
  /** Unknown stays unknown. Never filled with today. */
  approxDate: dateOnlySchema.optional(),
  area: z.enum(AREAS).optional(),
  photo: photoSchema.optional(),
  /** Only the owner ever sees this. */
  privateDetails: text(300).optional(),
  status: z.enum(REPORT_STATUSES),
  handoverAt: iso.optional(),
  idempotencyKey: z.string().optional(),
  createdAt: iso,
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(eventSchema),
})
export type Report = z.infer<typeof reportSchema>

export const CLAIM_STATUSES = [
  'requested',
  'reviewPending',
  'demoApproved',
  'demoRejected',
  'withdrawn',
] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]
export const claimStatusLabel: Record<ClaimStatus, string> = {
  requested: 'Requested (not yet reviewed)',
  reviewPending: 'Under demo review',
  demoApproved: 'Approved locally (simulated)',
  demoRejected: 'Not approved locally',
  withdrawn: 'Withdrawn',
}
export const CLAIM_ACTIVE: readonly ClaimStatus[] = ['requested', 'reviewPending']

export const claimSchema = z.object({
  id,
  reportId: id,
  claimantProfileId: id,
  /** Never shown to anyone except the claimant (and the labelled demo reviewer). */
  privateAnswer: text(300).min(1),
  status: z.enum(CLAIM_STATUSES),
  statusVersion: z.number().int().min(1),
  decisionReason: text(300).optional(),
  createdAt: iso,
  updatedAt: iso,
  history: z.array(eventSchema).min(1),
})
export type Claim = z.infer<typeof claimSchema>

/* ───────────────────────────── Clubs ───────────────────────────── */

export const RECRUITMENT_STATES = ['notAnnounced', 'open', 'closed', 'archived'] as const
export const recruitmentSchema = z.object({
  state: z.enum(RECRUITMENT_STATES),
  /** Raw dates only. No closing time is ever invented. */
  openDate: dateOnlySchema.optional(),
  closeDate: dateOnlySchema.optional(),
  /** A real https link, or absent. Absent means "not provided". */
  url: z.string().max(300).optional(),
})
export type Recruitment = z.infer<typeof recruitmentSchema>

export const clubSchema = z.object({
  id,
  name: z.string().min(1).max(60),
  type: z.enum(['club', 'committee']),
  category: z.enum(['Academic', 'Cultural', 'Sports', 'Social', 'Technical']),
  purpose: text(200),
  /** Published role titles with generic labels. No phone, handle or personal link ever. */
  roles: z.array(
    z.object({ title: z.string().min(1).max(40), holderLabel: z.string().min(1).max(40) }),
  ),
  recruitment: recruitmentSchema,
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Club = z.infer<typeof clubSchema>

export const clubEventSchema = z.object({
  id,
  clubId: id,
  title: text(80).min(1),
  date: dateOnlySchema,
  start: localTimeSchema.optional(),
  end: localTimeSchema.optional(),
  venue: text(80).optional(),
  status: z.enum(['scheduled', 'rescheduled', 'cancelled']),
  version: z.number().int().min(1),
  history: z.array(eventSchema),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type ClubEvent = z.infer<typeof clubEventSchema>

/* ───────────────────────────── Sports teams and fixtures ───────────────────────────── */

export const SPORTS = [
  'Football',
  'Cricket',
  'Basketball',
  'Volleyball',
  'Badminton',
  'Table tennis',
] as const

export const TEAM_STATUSES = [
  'recruiting',
  'rosterClosed',
  'submitted',
  'approvedDemo',
  'declinedDemo',
  'withdrawn',
] as const
export type TeamStatus = (typeof TEAM_STATUSES)[number]
export const teamStatusLabel: Record<TeamStatus, string> = {
  recruiting: 'Recruiting',
  rosterClosed: 'Roster closed',
  submitted: 'Submitted for demo approval',
  approvedDemo: 'Approved locally (simulated committee)',
  declinedDemo: 'Declined locally',
  withdrawn: 'Cancelled by captain',
}

export const teamSchema = z.object({
  id,
  sport: z.enum(SPORTS),
  name: text(40).min(1),
  /** A persona who captains the team, or absent for a fictional captain. */
  captainProfileId: id.optional(),
  captainLabel: z.string().min(1).max(40),
  maxRoster: z.number().int().min(2).max(30),
  description: text(200).optional(),
  status: z.enum(TEAM_STATUSES),
  /** Accepted members only. Pending requests are never counted. */
  members: z.array(id),
  createdAt: iso,
  updatedAt: iso,
  provenance: provenanceSchema,
  history: z.array(eventSchema),
})
export type Team = z.infer<typeof teamSchema>

export const joinRequestSchema = z.object({
  id,
  teamId: id,
  profileId: id,
  status: z.enum(['requested', 'accepted', 'rejected', 'withdrawn']),
  createdAt: iso,
  decidedAt: iso.optional(),
})
export type JoinRequest = z.infer<typeof joinRequestSchema>

export const needSchema = z.object({
  id,
  teamId: id,
  fixtureId: id.optional(),
  description: text(200).min(1),
  positions: text(60).optional(),
  /** The explicit configured expiry. A post closes only when this date has passed, or by hand. */
  expiresOn: dateOnlySchema,
  closed: z.boolean(),
  createdAt: iso,
})
export type PlayerNeed = z.infer<typeof needSchema>

export const FIXTURE_STATUSES = [
  'scheduled',
  'tentative',
  'rescheduled',
  'cancelled',
  'completedDemo',
] as const
export type FixtureStatus = (typeof FIXTURE_STATUSES)[number]
export const fixtureStatusLabel: Record<FixtureStatus, string> = {
  scheduled: 'Scheduled',
  tentative: 'Tentative',
  rescheduled: 'Rescheduled',
  cancelled: 'Cancelled',
  completedDemo: 'Marked completed locally',
}

export const fixtureSchema = z.object({
  id,
  sport: z.enum(SPORTS),
  title: text(80).min(1),
  teamIds: z.array(id),
  date: dateOnlySchema.optional(),
  start: localTimeSchema.optional(),
  end: localTimeSchema.optional(),
  venue: text(80).optional(),
  status: z.enum(FIXTURE_STATUSES),
  /** Shown only when deliberately set through the demo controls. */
  result: text(80).optional(),
  version: z.number().int().min(1),
  revisions: z.array(
    z.object({
      version: z.number().int().min(1),
      at: iso,
      date: dateOnlySchema.optional(),
      start: localTimeSchema.optional(),
      end: localTimeSchema.optional(),
      venue: text(80).optional(),
      reason: text(200).optional(),
    }),
  ),
  sourceLabel: z.string().min(1).max(100),
  provenance: provenanceSchema,
})
export type Fixture = z.infer<typeof fixtureSchema>

export const communityConfigSchema = z.object({
  /** A demo setting. The real maximum is unknown until the sports committee supplies it. */
  defaultMaxRoster: z.number().int().min(2).max(30),
  /** A demo threshold for "closing soon". */
  closingSoonDays: z.number().int().min(1).max(30),
})

export const communityStoreSchema = z.object({
  schemaVersion: z.literal(1),
  config: communityConfigSchema,
  reports: z.array(reportSchema),
  claims: z.array(claimSchema),
  clubs: z.array(clubSchema),
  clubEvents: z.array(clubEventSchema),
  /** Which clubs each profile follows. Following is not membership. */
  follows: z.record(z.string(), z.array(id)),
  teams: z.array(teamSchema),
  joinRequests: z.array(joinRequestSchema),
  needs: z.array(needSchema),
  fixtures: z.array(fixtureSchema),
})
export type CommunityStore = z.infer<typeof communityStoreSchema>
