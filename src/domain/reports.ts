import { z } from 'zod'

/**
 * App issue reports (COS-V3 §4.9): bugs, wrong timetable or room data, UI problems and ideas. A report
 * is a record in this browser with a status a demo reviewer can move. Nothing is sent to developers.
 */
export const REPORT_CATEGORIES = [
  'Bug',
  'Timetable/Data Error',
  'UI/UX Issue',
  'Feature Idea',
] as const
export const REPORT_STATUSES = [
  'RECEIVED',
  'TRIAGED',
  'IN_PROGRESS',
  'RESOLVED',
  'WONT_FIX',
] as const
export const reportStatusLabel: Record<(typeof REPORT_STATUSES)[number], string> = {
  RECEIVED: 'Recorded on this device',
  TRIAGED: 'Looked at',
  IN_PROGRESS: 'Being worked on',
  RESOLVED: 'Marked resolved',
  WONT_FIX: 'Not planned',
}

export const issueSchema = z.object({
  id: z.string().min(1).max(80),
  ownerProfileId: z.string().min(1).max(80),
  category: z.enum(REPORT_CATEGORIES),
  description: z.string().trim().min(1).max(1000),
  steps: z.string().trim().max(1000).optional(),
  contact: z.string().trim().max(120).optional(),
  /** Only the screen the report was made from. No academic, mail or seating content is attached. */
  route: z.string().max(200),
  entityRef: z.string().max(120).optional(),
  attachments: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        type: z.string(),
        size: z.number(),
        storage: z.literal('device'),
        addedAt: z.string(),
      }),
    )
    .max(3),
  status: z.enum(REPORT_STATUSES),
  opId: z.string().optional(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  history: z
    .array(
      z.object({
        at: z.iso.datetime({ offset: true }),
        actor: z.enum(['student', 'demoReviewer']),
        status: z.enum(REPORT_STATUSES),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1),
})
export type Issue = z.infer<typeof issueSchema>

export const reportStoreSchema = z.object({
  schemaVersion: z.literal(1),
  issues: z.array(issueSchema),
})
export type ReportStore = z.infer<typeof reportStoreSchema>
