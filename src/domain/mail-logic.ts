import type { ExtractedNotice, MailCategory, MailStore, SourceEmail, StageEntry } from './mail'
import {
  fail,
  makeNotice,
  ok as coreOk,
  type Change as CoreChange,
  type Ctx,
  type Notice,
} from './service-core'
import { STAGES } from './mail'

/**
 * Pure rules for the simulated Campus Mail inbox. Email is DATA, never a command: nothing in a body
 * is executed or followed. A seat is applied only when the sender is trusted, the exam is a known
 * one, and exactly one row carries the reader's exact student key. Everything else stops and says why.
 */
type Change<T> = CoreChange<MailStore, T>
const ok = <T>(s: MailStore, v: T, n: Notice[] = []): Change<T> => coreOk(s, v, n)

export interface Incoming {
  messageId: string
  from: string
  subject: string
  body: string
  attachments?: { name: string; readable: boolean }[]
  providerRevision?: string
}

/** Whitespace and case only. Digits are never edited and nothing is fuzzy-matched. */
export const normalizeKey = (s: string) => s.replace(/\s+/g, '').toUpperCase()
export const normalizeLabel = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase()

/** Transparent rules, not a model. An "URGENT!!!" subject earns nothing. */
export function classify(i: Pick<Incoming, 'subject' | 'body'>): MailCategory {
  const text = `${i.subject}\n${i.body}`.toLowerCase()
  if (/\b(seat|seating)\b/.test(text) && /\b(quiz|exam)\b/.test(text)) return 'EXAM'
  if (/\b(quiz|exam|assignment|deadline|syllabus|lecture)\b/.test(text)) return 'ACADEMIC'
  if (/\b(leave|fee|office|hostel|mess)\b/.test(text)) return 'ADMIN'
  if (/\b(club|recruit|society|committee|event)\b/.test(text)) return 'CLUB'
  return 'OTHER'
}

export interface SeatRow {
  student: string
  room?: string
  row?: string
  column?: string
  seat?: string
  line: number
}
export interface Parsed {
  exam?: string
  date?: string
  start?: string
  revision?: number
  rows: SeatRow[]
  roomWide?: { room: string; line: number; raw: string }
  evidence: { field: string; locator: string; raw: string }[]
}

const KEYS = ['exam', 'date', 'start', 'revision', 'student', 'room', 'row', 'column', 'seat']

/** `Key: value` lines. A `Student:` line starts a new row. Values are kept exactly as written. */
export function parseSeating(body: string): Parsed {
  const out: Parsed = { rows: [], evidence: [] }
  let cur: SeatRow | null = null
  body.split(/\r?\n/).forEach((raw, idx) => {
    const line = idx + 1
    const wide = /everyone in (.+?) (?:goes to|is in|will sit in) ([A-Za-z]+\s?\d+[A-Za-z]?)/i.exec(
      raw,
    )
    if (wide) {
      out.roomWide = { room: wide[2]!.trim(), line, raw: raw.trim() }
      return
    }
    const m = /^\s*([A-Za-z]+)\s*:\s*(.+?)\s*$/.exec(raw)
    if (!m) return
    const key = m[1]!.toLowerCase()
    const val = m[2]!
    if (!KEYS.includes(key)) return
    const ev = (field: string) =>
      out.evidence.push({ field, locator: `line ${line}`, raw: raw.trim() })
    if (key === 'exam') {
      out.exam = val
      ev('exam')
    } else if (key === 'date') {
      out.date = val
      ev('date')
    } else if (key === 'start') {
      out.start = val
      ev('start')
    } else if (key === 'revision') {
      const n = Number(val)
      if (Number.isInteger(n) && n >= 1) {
        out.revision = n
        ev('revision')
      }
    } else if (key === 'student') {
      cur = { student: val, line }
      out.rows.push(cur)
      ev('student')
    } else if (cur) {
      if (key === 'room') {
        cur.room = val
        ev('room')
      }
      if (key === 'row') {
        cur.row = val
        ev('row')
      }
      if (key === 'column') {
        cur.column = val
        ev('column')
      }
      if (key === 'seat') {
        cur.seat = val
        ev('seat')
      }
    }
  })
  return out
}

const stage = (
  stage: StageEntry['stage'],
  status: StageEntry['status'],
  note: string,
  c: Ctx,
): StageEntry => ({
  stage,
  status,
  note,
  at: c.nowIso,
})

export interface SeatEffect {
  profileId: string
  examId: string
  fields: { room?: string; row?: string; column?: string; seat?: string }
  revision: number
  noticeId: string
  emailId: string
}

export interface IngestContext {
  /** The mailbox owner. Null for the broadcast feed. */
  profileId: string | null
  nowMs: number
  exam: (examId: string) => { name: string; date: string; startTime?: string } | undefined
  /** The seat this profile already has for the exam, with the revision it came from. */
  currentSeat: (
    profileId: string,
    examId: string,
  ) =>
    { revision?: number; room?: string; row?: string; column?: string; seat?: string } | undefined
}

export type IngestOutcome =
  { kind: 'duplicate'; emailId: string } | { kind: 'stored'; emailId: string; effect?: SeatEffect }

const sameSeat = (
  a: { room?: string; row?: string; column?: string; seat?: string },
  b: typeof a,
) =>
  (a.room ?? '') === (b.room ?? '') &&
  (a.row ?? '') === (b.row ?? '') &&
  (a.column ?? '') === (b.column ?? '') &&
  (a.seat ?? '') === (b.seat ?? '')

export function ingest(
  s: MailStore,
  connectionId: string,
  inc: Incoming,
  c: Ctx,
  x: IngestContext,
): Change<IngestOutcome> {
  const conn = s.connections.find((k) => k.id === connectionId)
  if (!conn) return fail('That mailbox was not found.')
  const parsed = parseSeating(inc.body)
  const revKey = `${connectionId}|${inc.messageId}|${inc.providerRevision ?? parsed.revision ?? 1}`
  if (s.seen.includes(revKey)) {
    const prior = s.emails.find(
      (e) => e.connectionId === connectionId && e.messageId === inc.messageId,
    )
    if (!prior) return fail('That message was already processed.')
    const note = stage(
      'received',
      'duplicate',
      'The same message arrived again. Nothing was changed and nobody was alerted.',
      c,
    )
    const emails = s.emails.map((e) =>
      e.id === prior.id ? { ...e, stages: [...e.stages, note] } : e,
    )
    return ok({ ...s, emails }, { kind: 'duplicate', emailId: prior.id })
  }
  const category = classify(inc)
  const trusted = s.config.trustedSenders.includes(inc.from.trim().toLowerCase())
  const stages: StageEntry[] = [
    stage(
      'received',
      'done',
      `Received in the simulated ${conn.mode === 'PERSONAL' ? 'personal' : 'broadcast'} mailbox. Nothing was fetched from a real account.`,
      c,
    ),
    stage(
      'classified',
      'done',
      `Rule-based category: ${category}.${trusted ? '' : ' Sender is not on the demo allowlist.'}`,
      c,
    ),
  ]
  const emailId = c.newId('mail')
  const noticeId = `ntc-${emailId}`
  let syncState: SourceEmail['syncState'] = 'IMPORTED'
  let notice: ExtractedNotice | undefined
  let effect: SeatEffect | undefined
  const base = {
    id: noticeId,
    sourceEmailId: emailId,
    extractedAt: c.nowIso,
    evidence: parsed.evidence,
  }

  const attachmentOnly =
    (inc.attachments ?? []).length > 0 &&
    !parsed.rows.length &&
    !parsed.roomWide &&
    category === 'EXAM'
  if (category !== 'EXAM') {
    stages.push(
      stage('extracted', 'skipped', 'Not an exam or quiz notice, so nothing was extracted.', c),
    )
  } else if (attachmentOnly) {
    syncState = 'NEEDS_REVIEW'
    stages.push(
      stage(
        'extracted',
        'review',
        'New notice received; inspect the source. The attachment could not be read, so no seat was extracted.',
        c,
      ),
    )
  } else if (!trusted) {
    syncState = 'NEEDS_REVIEW'
    stages.push(
      stage(
        'extracted',
        'blocked',
        'The sender is not trusted on this device, so nothing was extracted or applied. A display name alone never authenticates a notice.',
        c,
      ),
    )
  } else if (parsed.roomWide && parsed.rows.length === 0) {
    notice = {
      ...base,
      kind: 'ROOM_NOTICE',
      status: 'EXTRACTED_CANDIDATE',
      fields: { room: parsed.roomWide.room },
      evidence: [
        ...parsed.evidence,
        { field: 'room', locator: `line ${parsed.roomWide.line}`, raw: parsed.roomWide.raw },
      ],
    }
    stages.push(
      stage(
        'extracted',
        'done',
        `A room-wide notice (${parsed.roomWide.room}). It is not a personal seat, so no row or column is shown for anyone.`,
        c,
      ),
    )
    stages.push(stage('identity', 'skipped', 'No student row, so nobody was matched.', c))
  } else if (parsed.rows.length === 0) {
    notice = {
      ...base,
      kind: 'SEATING',
      status: 'NEEDS_REVIEW',
      reviewReason: 'No seat row found',
      fields: {},
    }
    syncState = 'NEEDS_REVIEW'
    stages.push(
      stage(
        'extracted',
        'review',
        'A seating notice, but no seat row could be read. Verify the original notice.',
        c,
      ),
    )
  } else {
    const label = parsed.exam ? normalizeLabel(parsed.exam) : ''
    const examId = label ? s.examIndex[label] : undefined
    const exam = examId ? x.exam(examId) : undefined
    const mismatch =
      exam &&
      ((parsed.date && parsed.date !== exam.date) ||
        (parsed.start && exam.startTime && parsed.start !== exam.startTime))
    const fields = { exam: parsed.exam ?? null, revision: String(parsed.revision ?? 1) }
    if (!examId || !exam || mismatch) {
      notice = {
        ...base,
        kind: 'SEATING',
        status: 'NEEDS_REVIEW',
        reviewReason:
          !examId || !exam ? 'Exam not recognised' : 'Date or time does not match the exam',
        fields,
      }
      syncState = 'NEEDS_REVIEW'
      stages.push(
        stage(
          'extracted',
          'done',
          `Read ${parsed.rows.length} seat row(s) for “${parsed.exam ?? 'no exam named'}”.`,
          c,
        ),
      )
      stages.push(stage('identity', 'review', notice.reviewReason + '. No seat was applied.', c))
    } else {
      stages.push(
        stage(
          'extracted',
          'done',
          `Read ${parsed.rows.length} seat row(s) for ${exam.name}, with evidence by line.`,
          c,
        ),
      )
      const mine = x.profileId ? s.studentKeys[x.profileId] : undefined
      const matches = mine
        ? parsed.rows.filter((r) => normalizeKey(r.student) === normalizeKey(mine))
        : []
      if (!x.profileId || !mine) {
        notice = {
          ...base,
          kind: 'SEATING',
          status: 'NEEDS_REVIEW',
          reviewReason: 'No student key on this profile',
          fields,
          examId,
        }
        stages.push(
          stage(
            'identity',
            'skipped',
            'This mailbox has no student key, so no seat can be matched. Seating notice arrived; verify the original notice.',
            c,
          ),
        )
      } else if (matches.length !== 1) {
        notice = {
          ...base,
          kind: 'SEATING',
          status: 'NEEDS_REVIEW',
          reviewReason: matches.length ? 'More than one matching row' : 'No row for this student',
          fields,
          examId,
          studentProfileId: x.profileId,
        }
        stages.push(
          stage(
            'identity',
            matches.length ? 'review' : 'skipped',
            matches.length
              ? 'More than one row carries this key, so none was applied.'
              : 'No row in this notice carries your student key. Seating notice arrived; verify the original notice.',
            c,
          ),
        )
      } else {
        const row = matches[0]!
        const seat = { room: row.room, row: row.row, column: row.column, seat: row.seat }
        if (!row.room) {
          notice = {
            ...base,
            kind: 'SEATING',
            status: 'NEEDS_REVIEW',
            reviewReason: 'Room missing',
            fields: { ...fields, student: row.student },
            examId,
            studentProfileId: x.profileId,
          }
          stages.push(
            stage(
              'identity',
              'review',
              'Your row is present but has no room, so nothing was applied or invented.',
              c,
            ),
          )
        } else {
          stages.push(
            stage(
              'identity',
              'done',
              'Exact student key and exam matched. Names are never used.',
              c,
            ),
          )
          const revision = parsed.revision ?? 1
          const cur = x.currentSeat(x.profileId, examId)
          const curRev = cur?.revision
          if (cur && curRev !== undefined && revision < curRev) {
            notice = {
              ...base,
              kind: 'SEATING',
              status: 'SUPERSEDED',
              reviewReason: 'Older revision',
              fields: {
                ...fields,
                room: row.room,
                row: row.row ?? null,
                column: row.column ?? null,
              },
              examId,
              studentProfileId: x.profileId,
              revision,
            }
            stages.push(
              stage(
                'seat',
                'skipped',
                `Revision ${revision} is older than the revision ${curRev} already applied, so it was kept for history only.`,
                c,
              ),
            )
          } else if (cur && curRev === revision && !sameSeat(cur, seat)) {
            notice = {
              ...base,
              kind: 'SEATING',
              status: 'NEEDS_REVIEW',
              reviewReason: 'Conflict',
              fields: { ...fields, room: row.room },
              examId,
              studentProfileId: x.profileId,
              revision,
            }
            syncState = 'NEEDS_REVIEW'
            stages.push(
              stage(
                'seat',
                'review',
                'CONFLICT — VERIFY WITH OFFICE. Two notices of the same revision disagree, so neither was chosen.',
                c,
              ),
            )
          } else if (cur && sameSeat(cur, seat)) {
            notice = {
              ...base,
              kind: 'SEATING',
              status: 'VALIDATED',
              fields: {
                ...fields,
                room: row.room,
                row: row.row ?? null,
                column: row.column ?? null,
              },
              examId,
              studentProfileId: x.profileId,
              revision,
            }
            stages.push(
              stage(
                'seat',
                'skipped',
                'The seat is the same as the one already shown, so nothing changed and nobody was alerted.',
                c,
              ),
            )
          } else {
            notice = {
              ...base,
              kind: 'SEATING',
              status: 'VALIDATED',
              fields: {
                ...fields,
                room: row.room,
                row: row.row ?? null,
                column: row.column ?? null,
              },
              examId,
              studentProfileId: x.profileId,
              revision,
            }
            effect = { profileId: x.profileId, examId, fields: seat, revision, noticeId, emailId }
            stages.push(stage('seat', 'done', 'Pending: applying the seat to your exam record.', c))
          }
        }
      }
    }
  }
  const email: SourceEmail = {
    id: emailId,
    connectionId,
    messageId: inc.messageId,
    ...(inc.providerRevision ? { providerRevision: inc.providerRevision } : {}),
    from: inc.from,
    subject: inc.subject,
    receivedAt: c.nowIso,
    body: inc.body,
    attachments: inc.attachments ?? [],
    category,
    provenance: 'DEMO_SIMULATED',
    syncState,
    stages,
  }
  return ok(
    {
      ...s,
      emails: [email, ...s.emails],
      notices: notice ? [notice, ...s.notices] : s.notices,
      seen: [...s.seen, revKey],
    },
    { kind: 'stored', emailId, effect },
  )
}

/** "starts in 1 hour", from the real source time and the current clock, never a stored string. */
export function startsIn(examMs: number, nowMs: number): string {
  const diff = examMs - nowMs
  if (diff <= 0) return 'has started'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `starts in ${mins} minute${mins === 1 ? '' : 's'}`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return `starts in ${hrs} hour${hrs === 1 ? '' : 's'}${rem ? ` ${rem} min` : ''}`
}

const label = (f: { room?: string; row?: string; column?: string }) =>
  [f.room, f.column ? `Column ${f.column}` : '', f.row ? `Row ${f.row}` : '']
    .filter(Boolean)
    .join(', ')

/**
 * Called only after the seat was really applied. It records the last two stages and sends the ONE
 * in-app alert for this revision. The alert key carries the notice id, so a replay cannot repeat it.
 */
export function confirmSeat(
  s: MailStore,
  effect: SeatEffect,
  prev: { room?: string; row?: string; column?: string } | undefined,
  exam: { name: string; startMs: number | null },
  c: Ctx,
  nowMs: number,
): Change<{ alerted: boolean }> {
  const email = s.emails.find((e) => e.id === effect.emailId)
  if (!email) return fail('That message was not found.')
  const changed = prev
    ? (['room', 'column', 'row'] as const).filter(
        (k) => (prev[k] ?? '') !== (effect.fields[k] ?? ''),
      )
    : []
  const first = !prev
  const urgent =
    exam.startMs !== null &&
    exam.startMs > nowMs &&
    exam.startMs - nowMs <= s.config.urgentWithinHours * 3_600_000
  const when = exam.startMs === null ? 'start time not provided' : startsIn(exam.startMs, nowMs)
  const title = first
    ? `Quiz seating updated — ${label(effect.fields)}`
    : `Your ${changed.length ? changed.join(' and ') : 'seat'} changed — ${label(effect.fields)}`
  const body = `${exam.name}: ${when}. Open your seat or the original mail. This is a simulated email, not an official allotment.`
  const entries: StageEntry[] = [
    stage(
      'seat',
      'done',
      `Seat applied to your exam record (revision ${effect.revision}, confirmed in the on this device only).`,
      c,
    ),
    stage('alert', 'done', 'One in-app alert was created. No push, email or SMS was sent.', c),
  ]
  const emails = s.emails.map((e) =>
    e.id === email.id
      ? {
          ...e,
          stages: [
            ...e.stages.filter((x) => !(x.stage === 'seat' && x.note.startsWith('Pending'))),
            ...entries,
          ],
        }
      : e,
  )
  const note = makeNotice(
    'mail',
    effect.profileId,
    effect.noticeId,
    { id: `rev${effect.revision}` },
    title,
    body,
    `/academics/exams/${effect.examId}`,
    urgent ? 'critical' : 'important',
  )
  return ok({ ...s, emails }, { alerted: true }, [note])
}

export function failSeat(s: MailStore, emailId: string, reason: string, c: Ctx): Change<void> {
  const emails = s.emails.map((e) =>
    e.id === emailId
      ? {
          ...e,
          syncState: 'NEEDS_REVIEW' as const,
          stages: [
            ...e.stages.filter((x) => !(x.stage === 'seat' && x.note.startsWith('Pending'))),
            stage('seat', 'blocked', reason, c),
          ],
        }
      : e,
  )
  return ok({ ...s, emails }, undefined)
}

export function markRead(s: MailStore, emailId: string, c: Ctx): Change<void> {
  if (!s.emails.some((e) => e.id === emailId)) return fail('That message was not found.')
  return ok(
    {
      ...s,
      emails: s.emails.map((e) => (e.id === emailId && !e.readAt ? { ...e, readAt: c.nowIso } : e)),
    },
    undefined,
  )
}

export const STAGE_ORDER = STAGES
