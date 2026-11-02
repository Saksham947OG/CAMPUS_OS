import { z } from 'zod'
import { provenanceSchema } from './provenance'

/**
 * Campus Mail (COS-MASTER-V2 §D): a SIMULATED inbox. No mailbox is connected, no OAuth token exists,
 * and nothing here reads real email. A message "arriving" is a button in the demo lab. The result of
 * each stage (received, classified, extracted, identity matched, seat updated, alerted) is recorded so
 * a reader can see where a message stopped.
 */
const id = z.string().min(1).max(120)
const iso = z.iso.datetime({ offset: true })

export const MAIL_CATEGORIES = ['EXAM', 'ACADEMIC', 'ADMIN', 'CLUB', 'OTHER'] as const
export type MailCategory = (typeof MAIL_CATEGORIES)[number]
export const categoryTab: Record<MailCategory, string> = {
  EXAM: 'Exams & Quizzes',
  ACADEMIC: 'Academic',
  ADMIN: 'Administration',
  CLUB: 'Student Life',
  OTHER: 'Other',
}

export const connectionSchema = z.object({
  id,
  /** null only for an authorized institutional broadcast feed. */
  ownerProfileId: id.nullable(),
  mode: z.enum(['PERSONAL', 'AUTHORIZED_BROADCAST']),
  /** A made-up address on a reserved domain. Never a real one. */
  accountAlias: z.string().min(1).max(80),
  /** Always DEMO here. A real connection would also need a server, which does not exist. */
  state: z.literal('DEMO'),
})
export type MailConnection = z.infer<typeof connectionSchema>

export const STAGES = ['received', 'classified', 'extracted', 'identity', 'seat', 'alert'] as const
export type Stage = (typeof STAGES)[number]
export const stageEntrySchema = z.object({
  stage: z.enum(STAGES),
  status: z.enum(['done', 'skipped', 'review', 'duplicate', 'blocked']),
  note: z.string().max(240),
  at: iso,
})
export type StageEntry = z.infer<typeof stageEntrySchema>

export const emailSchema = z.object({
  id,
  connectionId: id,
  /** The provider's id for the message. A replay of the same id is a duplicate. */
  messageId: z.string().min(1).max(120),
  providerRevision: z.string().max(20).optional(),
  from: z.string().min(1).max(120),
  subject: z.string().min(1).max(160),
  receivedAt: iso,
  /** Plain text only. It is rendered as text, never as HTML. */
  body: z.string().max(4000),
  attachments: z.array(z.object({ name: z.string().max(80), readable: z.boolean() })).max(5),
  category: z.enum(MAIL_CATEGORIES),
  provenance: z.enum(['DEMO_SIMULATED', 'SOURCE_IMPORTED_UNVERIFIED']),
  syncState: z.enum(['IMPORTED', 'UPDATED', 'NEEDS_REVIEW', 'QUARANTINED']),
  readAt: iso.optional(),
  stages: z.array(stageEntrySchema),
})
export type SourceEmail = z.infer<typeof emailSchema>

export const noticeSchema = z.object({
  id,
  sourceEmailId: id,
  kind: z.enum(['SEATING', 'ROOM_NOTICE', 'ANNOUNCEMENT']),
  status: z.enum(['EXTRACTED_CANDIDATE', 'NEEDS_REVIEW', 'VALIDATED', 'SUPERSEDED']),
  reviewReason: z.string().max(200).optional(),
  fields: z.record(z.string(), z.string().nullable()),
  evidence: z.array(z.object({ field: z.string(), locator: z.string(), raw: z.string() })),
  examId: id.optional(),
  studentProfileId: id.optional(),
  revision: z.number().int().min(1).optional(),
  extractedAt: iso,
})
export type ExtractedNotice = z.infer<typeof noticeSchema>

export const mailStoreSchema = z.object({
  schemaVersion: z.literal(1),
  config: z.object({
    /** Senders the demo trusts. A display name or From header alone never authenticates a real notice. */
    trustedSenders: z.array(z.string()),
    /** A seat change this close to the start (or inside it) is urgent. */
    urgentWithinHours: z.number().int().min(1).max(168),
  }),
  /** Fictional unique student keys per demo profile. A name is never used to match a seat. */
  studentKeys: z.record(z.string(), z.string()),
  /** Normalized exam label in a notice → the exam it names. Unknown labels need review. */
  examIndex: z.record(z.string(), z.string()),
  connections: z.array(connectionSchema),
  emails: z.array(emailSchema),
  notices: z.array(noticeSchema),
  /** `connection|messageId|revision` already processed. A replay changes nothing. */
  seen: z.array(z.string()),
  provenance: provenanceSchema,
})
export type MailStore = z.infer<typeof mailStoreSchema>
