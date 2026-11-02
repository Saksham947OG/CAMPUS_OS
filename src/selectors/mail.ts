import { categoryTab, type MailCategory, type MailStore, type SourceEmail } from '@/domain/mail'
import type { SharedStore } from '@/domain/shared'
import { instantMs } from './now'
import type { DateOnly, LocalTime } from '@/lib/time'

/** This profile's own simulated mailbox plus the authorized broadcast feed. Nobody else's mail. */
export function inboxFor(s: MailStore, profileId: string): SourceEmail[] {
  const mine = new Set(
    s.connections
      .filter((c) => c.ownerProfileId === profileId || c.ownerProfileId === null)
      .map((c) => c.id),
  )
  return s.emails
    .filter((e) => mine.has(e.connectionId))
    .sort((a, b) =>
      a.receivedAt < b.receivedAt ? 1 : a.receivedAt > b.receivedAt ? -1 : a.id.localeCompare(b.id),
    )
}

export const mailboxAlias = (s: MailStore, profileId: string) =>
  s.connections.find((c) => c.ownerProfileId === profileId)?.accountAlias

export const MAIL_TABS: { id: 'all' | MailCategory; label: string }[] = [
  { id: 'all', label: 'All mail' },
  { id: 'ACADEMIC', label: categoryTab.ACADEMIC },
  { id: 'EXAM', label: categoryTab.EXAM },
  { id: 'ADMIN', label: categoryTab.ADMIN },
  { id: 'CLUB', label: categoryTab.CLUB },
  { id: 'OTHER', label: categoryTab.OTHER },
]

export const filterMail = (list: readonly SourceEmail[], tab: 'all' | MailCategory, q: string) => {
  const t = q.trim().toLowerCase()
  return list
    .filter((e) => tab === 'all' || e.category === tab)
    .filter((e) => (t ? `${e.subject} ${e.from} ${e.body}`.toLowerCase().includes(t) : true))
}

/** An unread message that needs a look: an exam notice, or one that stopped for review. */
export const actionableUnread = (list: readonly SourceEmail[]) =>
  list.filter((e) => !e.readAt && (e.category === 'EXAM' || e.syncState === 'NEEDS_REVIEW')).length

export interface UrgentSignal {
  examId: string
  examName: string
  seat: string
  startMs: number
  emailId?: string
}

/**
 * The seat to put above everything else on Home: a seat that arrived by (simulated) email, for an
 * exam that has not started yet and starts within the urgency window. Read from the seat record
 * itself, so it can never disagree with the exam page.
 */
export function urgentSignal(
  shared: SharedStore,
  profileId: string,
  nowMs: number,
  withinHours = 24,
): UrgentSignal | null {
  const found = shared.seats
    .filter(
      (x) =>
        x.ownerProfileId === profileId && x.validation === 'CONFIRMED_DEMO' && !x.needsVerification,
    )
    .map((x): UrgentSignal | null => {
      const e = shared.exams.find((y) => y.id === x.examId)
      if (!e?.startTime) return null
      const startMs = instantMs(e.date as DateOnly, e.startTime as LocalTime)
      if (startMs <= nowMs || startMs - nowMs > withinHours * 3_600_000) return null
      const seat = [x.room, x.column ? `Column ${x.column}` : '', x.row ? `Row ${x.row}` : '']
        .filter(Boolean)
        .join(', ')
      return {
        examId: e.id,
        examName: e.name,
        seat,
        startMs,
        ...(x.sourceEmailId ? { emailId: x.sourceEmailId } : {}),
      }
    })
    .filter((x): x is UrgentSignal => x !== null)
    .sort((a, b) => a.startMs - b.startMs)
  return found[0] ?? null
}
