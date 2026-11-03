import { z } from 'zod'
import { dateOnlySchema, localTimeSchema } from './records'

/**
 * Workspace (COS-WORKSPACE-001, DEC-165): spaces, pages, project work, meetings, decisions and
 * evidence, all held in one LOCAL store on this device. Nothing here is shared between devices:
 * the "viewing as" switch simulates roles in one browser and is labelled that way (spec §15 Stage A).
 */
const id = z.string().min(1).max(120)
const iso = z.iso.datetime({ offset: true })
const name = z.string().trim().min(1, 'A title is required').max(120)
const mode = z.enum(['userCreated', 'demoSeed'])

export const ROLES = ['owner', 'editor', 'commenter', 'viewer'] as const
export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const SPACE_TYPES = ['personal', 'course', 'project', 'club', 'section'] as const
export const spaceSchema = z.object({
  id,
  type: z.enum(SPACE_TYPES),
  title: name,
  ownerId: id,
  purpose: z.string().trim().max(400).optional(),
  archivedAt: iso.optional(),
  /** Automation rules switched off for this space. Every rule is on until somebody turns it off. */
  automationsOff: z.array(z.string()).max(10).optional(),
  createdAt: iso,
  revision: z.number().int().min(1),
  dataMode: mode,
})
export type Space = z.infer<typeof spaceSchema>

export const memberSchema = z.object({
  spaceId: id,
  userId: id,
  role: roleSchema,
  joinedAt: iso,
  /** Absent means accepted. A pending or declined invitation gives no access (spec §2.2, §18). */
  invitation: z.enum(['pending', 'declined']).optional(),
  invitedBy: id.optional(),
})
export type Member = z.infer<typeof memberSchema>

/** A fictional team member (demo only). Real people are the CampusOS profiles. */
export const personSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60),
  focus: z.string().trim().max(80).optional(),
  dataMode: z.literal('demoSeed'),
})
export type Person = z.infer<typeof personSchema>

export const BLOCK_TYPES = [
  'paragraph',
  'h1',
  'h2',
  'h3',
  'bullet',
  'numbered',
  'todo',
  'quote',
  'callout',
  'divider',
  'code',
] as const
export const blockSchema = z.object({
  id,
  type: z.enum(BLOCK_TYPES),
  /** `[[<pageId>]]` tokens point at pages by ID, so a rename never breaks a link (spec §4.3). */
  text: z.string().max(6000),
  checked: z.boolean().optional(),
  /** A checklist item turned into a CampusOS task keeps that task's ID; the task stays the one record. */
  taskId: id.optional(),
  /** A checklist item turned into a team task. */
  workTaskId: id.optional(),
})
export type Block = z.infer<typeof blockSchema>
export type BlockType = Block['type']

export const NOTE_TYPES = [
  'note',
  'lecture',
  'concept',
  'research',
  'meeting',
  'revision',
  'daily',
  'field',
  'decision',
] as const
export const LIFECYCLES = ['draft', 'inReview', 'approved', 'archived'] as const
export const pageSchema = z.object({
  id,
  spaceId: id,
  parentId: id.optional(),
  title: z.string().trim().max(120),
  icon: z.string().max(8).optional(),
  blocks: z.array(blockSchema).max(400),
  authorId: id,
  /** `private` = author only. `space` = everyone in the space, at their role. */
  audience: z.enum(['private', 'space']),
  lifecycle: z.enum(LIFECYCLES),
  trashedAt: iso.optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12),
  noteType: z.enum(NOTE_TYPES),
  projectId: id.optional(),
  courseCode: z.string().max(20).optional(),
  /** Daily notes: one per owner and date. */
  dailyDate: dateOnlySchema.optional(),
  /** File name this page was imported from, kept so an import is traceable. */
  importedFrom: z.string().max(160).optional(),
  createdAt: iso,
  updatedAt: iso,
  revision: z.number().int().min(1),
  dataMode: mode,
})
export type Page = z.infer<typeof pageSchema>

export const revisionSchema = z.object({
  id,
  pageId: id,
  revision: z.number().int().min(1),
  authorId: id,
  at: iso,
  title: z.string(),
  blocks: z.array(blockSchema),
  restoredFrom: z.number().int().optional(),
})
export type Revision = z.infer<typeof revisionSchema>

export const PROJECT_STATUSES = ['planning', 'active', 'paused', 'done'] as const
export const projectSchema = z.object({
  id,
  spaceId: id,
  title: name,
  purpose: z.string().trim().max(500).optional(),
  ownerId: id,
  /** The team's own target, which is not a professor's deadline. */
  targetDate: dateOnlySchema.optional(),
  /** Set only when somebody supplied the real deadline. */
  deadline: z
    .object({ date: dateOnlySchema, source: z.string().trim().min(1).max(120) })
    .optional(),
  status: z.enum(PROJECT_STATUSES),
  homePageId: id.optional(),
  courseCode: z.string().max(20).optional(),
  createdAt: iso,
  dataMode: mode,
})
export type Project = z.infer<typeof projectSchema>

export const TASK_STATUSES = [
  'backlog',
  'ready',
  'inProgress',
  'inReview',
  'done',
  'canceled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]
export const taskSchema = z.object({
  id,
  projectId: id,
  title: name,
  description: z.string().trim().max(1000).optional(),
  assigneeId: id.optional(),
  status: z.enum(TASK_STATUSES),
  /** An explicit block (waiting on somebody outside the team). Dependencies add their own. */
  blockedReason: z.string().trim().max(200).optional(),
  priority: z.enum(['low', 'normal', 'high']),
  /** Optional: a missing estimate is shown as missing, never counted as zero. */
  estimateMin: z.number().int().min(5).max(6000).optional(),
  dueDate: dateOnlySchema.optional(),
  dependsOn: z.array(id).max(20),
  pageId: id.optional(),
  createdBy: id,
  createdAt: iso,
  updatedAt: iso,
  completedAt: iso.optional(),
  revision: z.number().int().min(1),
  dataMode: mode,
})
export type WorkTask = z.infer<typeof taskSchema>

export const rsvpSchema = z.enum(['INVITED', 'YES', 'NO', 'MAYBE'])
export type WsRsvp = z.infer<typeof rsvpSchema>
export const meetingSchema = z.object({
  id,
  projectId: id,
  title: name,
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  attendees: z.array(z.object({ userId: id, required: z.boolean(), rsvp: rsvpSchema })).max(30),
  roomLabel: z.string().max(80).optional(),
  /** A real campus room held through Classrooms. Absent for a demo-inventory room. */
  roomId: id.optional(),
  /** The meeting in the main Calendar's meeting engine, when everyone is a real CampusOS profile. */
  calendarMeetingId: id.optional(),
  pollId: id.optional(),
  status: z.enum(['confirmed', 'cancelled']),
  agendaPageId: id.optional(),
  organizerId: id,
  createdAt: iso,
  revision: z.number().int().min(1),
  dataMode: mode,
})
export type WsMeeting = z.infer<typeof meetingSchema>

export const decisionSchema = z.object({
  id,
  projectId: id,
  question: name,
  options: z.array(z.string().trim().min(1).max(160)).max(8),
  rationale: z.string().trim().max(800).optional(),
  outcome: z.string().trim().max(400).optional(),
  decidedBy: id.optional(),
  decidedOn: dateOnlySchema.optional(),
  evidenceIds: z.array(id).max(20),
  revisitWhen: z.string().trim().max(200).optional(),
  createdAt: iso,
  dataMode: mode,
})
export type Decision = z.infer<typeof decisionSchema>

/** One row of the research evidence register. */
export const sourceSchema = z.object({
  id,
  projectId: id,
  claim: name,
  source: z.string().trim().max(200),
  method: z.string().trim().max(200).optional(),
  observedOn: dateOnlySchema.optional(),
  finding: z.string().trim().max(600).optional(),
  limitations: z.string().trim().max(400).optional(),
  pageId: id.optional(),
  createdBy: id,
  createdAt: iso,
  dataMode: mode,
})
export type EvidenceSource = z.infer<typeof sourceSchema>

export const commentSchema = z.object({
  id,
  pageId: id,
  /** Anchored to a block; `quote` is what the block said then, so a moved or rewritten block is noticed. */
  blockId: id.optional(),
  quote: z.string().max(200).optional(),
  parentId: id.optional(),
  authorId: id,
  body: z.string().trim().min(1, 'Write a comment first').max(1000),
  mentions: z.array(id).max(10).optional(),
  createdAt: iso,
  resolvedAt: iso.optional(),
  dataMode: mode,
})
export type Comment = z.infer<typeof commentSchema>

export const reviewSchema = z.object({
  id,
  pageId: id,
  /** The exact revision that was put up for review. */
  revision: z.number().int().min(1),
  requestedBy: id,
  reviewerId: id,
  requestedAt: iso,
  dueDate: dateOnlySchema.optional(),
  state: z.enum(['requested', 'changesRequested', 'reviewed']),
  decidedAt: iso.optional(),
  note: z.string().max(400).optional(),
})
export type Review = z.infer<typeof reviewSchema>

export const attachmentSchema = z.object({
  id,
  spaceId: id,
  projectId: id.optional(),
  pageId: id.optional(),
  filename: z.string().trim().min(1).max(160),
  mime: z.string().min(1).max(100),
  bytes: z.number().int().min(0),
  /** Where the bytes are kept: a local blob on this device, never a server. */
  storageRef: id,
  uploaderId: id,
  audience: z.enum(['private', 'space']),
  createdAt: iso,
  dataMode: mode,
})
export type Attachment = z.infer<typeof attachmentSchema>

export const canvasSchema = z.object({
  id,
  spaceId: id,
  title: name,
  authorId: id,
  audience: z.enum(['private', 'space']),
  cards: z
    .array(
      z.object({
        id,
        kind: z.enum(['page', 'text']),
        /** A note card points at an existing page; a text card is canvas-only content. */
        pageId: id.optional(),
        text: z.string().max(400).optional(),
        x: z.number().min(-5000).max(5000),
        y: z.number().min(-5000).max(5000),
      }),
    )
    .max(80),
  edges: z.array(z.object({ id, from: id, to: id, label: z.string().max(60) })).max(160),
  /** Layout is stored apart from note text and has its own revision. */
  layoutRevision: z.number().int().min(1),
  createdAt: iso,
  dataMode: mode,
})
export type Canvas = z.infer<typeof canvasSchema>

export const pollSchema = z.object({
  id,
  projectId: id,
  title: name,
  durationMin: z.number().int().min(5).max(480),
  candidates: z
    .array(z.object({ id, date: dateOnlySchema, start: localTimeSchema, end: localTimeSchema }))
    .min(2)
    .max(5),
  /** People whose answer matters; everyone invited can vote. */
  voters: z.array(z.object({ userId: id, required: z.boolean() })).max(30),
  votes: z.array(z.object({ userId: id, candidateId: id, vote: z.enum(['yes', 'maybe', 'no']) })),
  roomPlan: z.enum(['none', 'demo', 'campus']),
  status: z.enum(['open', 'closed', 'finalized']),
  meetingId: id.optional(),
  createdBy: id,
  createdAt: iso,
  dataMode: mode,
})
export type WsPoll = z.infer<typeof pollSchema>

export const automationLogSchema = z.object({
  id,
  spaceId: id,
  rule: z.string().min(1).max(40),
  text: z.string().min(1).max(240),
  /** Dedupe key: the same trigger never logs or notifies twice. */
  key: z.string().max(200).optional(),
  at: iso,
})
export type AutomationLog = z.infer<typeof automationLogSchema>

export const activitySchema = z.object({
  id,
  actorId: id,
  spaceId: id,
  entityId: id,
  type: z.string().min(1).max(40),
  text: z.string().min(1).max(240),
  href: z.string().startsWith('/').optional(),
  at: iso,
  dataMode: mode,
})
export type Activity = z.infer<typeof activitySchema>

export const captureSchema = z.object({
  id,
  ownerId: id,
  text: z.string().trim().min(1, 'Type something to capture').max(1000),
  createdAt: iso,
})
export type Capture = z.infer<typeof captureSchema>

export const workspaceStoreSchema = z.object({
  schemaVersion: z.literal(1),
  people: z.array(personSchema),
  spaces: z.array(spaceSchema),
  members: z.array(memberSchema),
  pages: z.array(pageSchema),
  revisions: z.array(revisionSchema),
  projects: z.array(projectSchema),
  tasks: z.array(taskSchema),
  meetings: z.array(meetingSchema),
  decisions: z.array(decisionSchema),
  sources: z.array(sourceSchema),
  comments: z.array(commentSchema),
  reviews: z.array(reviewSchema),
  activity: z.array(activitySchema),
  captures: z.array(captureSchema),
  attachments: z.array(attachmentSchema).default([]),
  canvases: z.array(canvasSchema).default([]),
  polls: z.array(pollSchema).default([]),
  automationLog: z.array(automationLogSchema).default([]),
  /** Operation IDs already applied, so a repeated click or retry cannot create a second copy. */
  ops: z.array(z.object({ id, ref: id })).max(300),
  /** The demo member this device is acting as (a labelled simulation). Absent means the signed-in profile. */
  viewAs: z.string().min(1).max(120).optional(),
  /** Which sample content has been added from the personas' records. `off` means it was removed on purpose. */
  seedVersion: z.string().max(40).optional(),
})
export type WorkspaceStore = z.infer<typeof workspaceStoreSchema>

export const emptyWorkspace = (): WorkspaceStore => ({
  schemaVersion: 1,
  people: [],
  spaces: [],
  members: [],
  pages: [],
  revisions: [],
  projects: [],
  tasks: [],
  meetings: [],
  decisions: [],
  sources: [],
  comments: [],
  reviews: [],
  activity: [],
  captures: [],
  attachments: [],
  canvases: [],
  polls: [],
  automationLog: [],
  ops: [],
})

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  ready: 'Ready',
  inProgress: 'In progress',
  inReview: 'In review',
  done: 'Done',
  canceled: 'Canceled',
}
export const LIFECYCLE_LABEL: Record<Page['lifecycle'], string> = {
  draft: 'Draft',
  inReview: 'In review',
  approved: 'Approved by team',
  archived: 'Archived',
}
export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  editor: 'Editor',
  commenter: 'Commenter',
  viewer: 'Viewer',
}
