import { addDays, type DateOnly, type LocalTime } from '@/lib/time'
import { fail, ok, type Change, type Ctx } from './service-core'
import { can, canReadPage, istDate, roleOf } from './workspace-access'
import { addLog, direct, fire, NOTHING, RULES, type RuleId } from './workspace-auto'
import { isResolved } from './workspace-logic'
import type { Attachment, Canvas, WorkspaceStore, WsPoll } from './workspace'

type Out<T> = Change<WorkspaceStore, T>
const projectOf = (s: WorkspaceStore, id: string) => s.projects.find((x) => x.id === id)

/* ---------- team polls (spec §7.2) ---------- */

export interface NewPoll {
  projectId: string
  title: string
  durationMin: number
  candidates: { date: DateOnly; start: LocalTime; end: LocalTime }[]
  voters: { userId: string; required: boolean }[]
  roomPlan: WsPoll['roomPlan']
  opId: string
}

export function createPoll(s: WorkspaceStore, c: Ctx, actor: string, i: NewPoll): Out<WsPoll> {
  const prior = s.ops.find((o) => o.id === i.opId)
  const found = prior && s.polls.find((p) => p.id === prior.ref)
  if (found) return ok(s, found)
  const project = projectOf(s, i.projectId)
  if (!project || !can(roleOf(s, project.spaceId, actor), 'edit'))
    return fail('Only editors and owners can open a time poll.')
  if (i.candidates.length < 2) return fail('A poll needs at least two times to choose between.')
  if (i.candidates.length > 5) return fail('Keep a poll to five times or fewer.')
  const voters = [{ userId: actor, required: true }, ...i.voters.filter((v) => v.userId !== actor)]
  if (voters.some((v) => roleOf(s, project.spaceId, v.userId) === null))
    return fail('Everyone in a poll must be in the space.')
  const poll: WsPoll = {
    id: c.newId('poll'),
    projectId: i.projectId,
    title: i.title.trim().slice(0, 120) || 'Find a time',
    durationMin: i.durationMin,
    candidates: i.candidates.map((x) => ({ ...x, id: c.newId('opt') })),
    voters,
    votes: [],
    roomPlan: i.roomPlan,
    status: 'open',
    createdBy: actor,
    createdAt: c.nowIso,
    dataMode: project.dataMode,
  }
  return ok(
    {
      ...s,
      polls: [...s.polls, poll],
      ops: [...s.ops, { id: i.opId, ref: poll.id }].slice(-300),
    },
    poll,
    direct(
      s,
      actor,
      `poll|${poll.id}`,
      voters.map((v) => v.userId),
      'A meeting time poll is open',
      `“${poll.title}”: choose the times that work for you.`,
      `/workspace/projects/${project.id}?tab=calendar`,
    ),
  )
}

export function votePoll(
  s: WorkspaceStore,
  _c: Ctx,
  userId: string,
  pollId: string,
  candidateId: string,
  vote: 'yes' | 'maybe' | 'no',
): Out<WsPoll> {
  const p = s.polls.find((x) => x.id === pollId)
  if (!p) return fail('That poll no longer exists.')
  if (p.status !== 'open') return fail('This poll is closed, so votes can no longer change.')
  if (!p.voters.some((v) => v.userId === userId)) return fail('You are not part of this poll.')
  if (!p.candidates.some((x) => x.id === candidateId)) return fail('That time is not in the poll.')
  const votes = [
    ...p.votes.filter((v) => !(v.userId === userId && v.candidateId === candidateId)),
    { userId, candidateId, vote },
  ]
  const next = { ...p, votes }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === pollId ? next : x)) }, next)
}

export function closePoll(s: WorkspaceStore, _c: Ctx, actor: string, pollId: string): Out<WsPoll> {
  const p = s.polls.find((x) => x.id === pollId)
  const project = p && projectOf(s, p.projectId)
  if (!p || !project) return fail('That poll no longer exists.')
  if (p.createdBy !== actor && !can(roleOf(s, project.spaceId, actor), 'manage'))
    return fail('Only the organiser or an Owner can close this poll.')
  if (p.status !== 'open') return ok(s, p)
  const next = { ...p, status: 'closed' as const }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === pollId ? next : x)) }, next)
}

export interface Tally {
  candidateId: string
  yes: number
  maybe: number
  no: number
  /** Required people who said no: the time cannot work for them. */
  requiredNo: number
  unanswered: number
}

export function tally(p: WsPoll): Tally[] {
  return p.candidates.map((cand) => {
    const mine = p.votes.filter((v) => v.candidateId === cand.id)
    const count = (k: 'yes' | 'maybe' | 'no') => mine.filter((v) => v.vote === k).length
    const answered = new Set(mine.map((v) => v.userId))
    return {
      candidateId: cand.id,
      yes: count('yes'),
      maybe: count('maybe'),
      no: count('no'),
      requiredNo: mine.filter(
        (v) => v.vote === 'no' && p.voters.find((x) => x.userId === v.userId)?.required,
      ).length,
      unanswered: p.voters.filter((v) => !answered.has(v.userId)).length,
    }
  })
}

/** After the poll is closed and a time confirmed, the poll records the meeting it produced. */
export function markPollFinalized(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  pollId: string,
  meetingId: string,
): Out<WsPoll> {
  const p = s.polls.find((x) => x.id === pollId)
  if (!p) return fail('That poll no longer exists.')
  if (p.createdBy !== actor) return fail('Only the organiser can finalize this poll.')
  if (p.status === 'finalized') return fail('This poll already produced a meeting.')
  if (p.status !== 'closed')
    return fail('Close the poll first. Votes are a preference, not a booking.')
  const next = { ...p, status: 'finalized' as const, meetingId }
  return ok({ ...s, polls: s.polls.map((x) => (x.id === pollId ? next : x)) }, next)
}

/* ---------- attachments (spec §4.4) ---------- */

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])
const BLOCKED_EXT =
  /\.(exe|bat|cmd|com|msi|sh|js|mjs|jar|html?|svg|php|py|app|dmg|apk|scr|vbs|ps1)$/i
const BY_EXT: Record<string, string> = {
  md: 'text/markdown',
  csv: 'text/csv',
  txt: 'text/plain',
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}
export const ATTACHMENT_HELP =
  'PDF, images (PNG, JPEG, GIF, WebP), text, Markdown, CSV and Word, Excel or PowerPoint files, up to 5 MB each.'

/** Returns the media type to keep, or a plain-words reason the file is refused. Programs and web pages are never accepted. */
export function checkAttachment(
  name: string,
  mime: string,
  bytes: number,
): { ok: true; mime: string } | { ok: false; reason: string } {
  if (BLOCKED_EXT.test(name))
    return { ok: false, reason: `${name} is a program or web page, which cannot be attached.` }
  if (bytes === 0) return { ok: false, reason: `${name} is empty.` }
  if (bytes > MAX_ATTACHMENT_BYTES) return { ok: false, reason: `${name} is larger than 5 MB.` }
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const type = ALLOWED.has(mime) ? mime : (BY_EXT[ext] ?? '')
  if (!type || !ALLOWED.has(type))
    return { ok: false, reason: `${name} is not a supported type. Allowed: ${ATTACHMENT_HELP}` }
  return { ok: true, mime: type }
}

/** Magic-number check so a renamed file cannot pass as a picture or PDF. */
export function sniffMatches(mime: string, head: Uint8Array): boolean {
  const is = (...b: number[]) => b.every((x, i) => head[i] === x)
  if (mime === 'application/pdf') return is(0x25, 0x50, 0x44, 0x46)
  if (mime === 'image/png') return is(0x89, 0x50, 0x4e, 0x47)
  if (mime === 'image/jpeg') return is(0xff, 0xd8, 0xff)
  if (mime === 'image/gif') return is(0x47, 0x49, 0x46, 0x38)
  if (mime === 'image/webp') return is(0x52, 0x49, 0x46, 0x46)
  if (mime.startsWith('application/vnd.openxml')) return is(0x50, 0x4b)
  return true
}

export interface NewAttachment {
  spaceId: string
  pageId?: string
  projectId?: string
  filename: string
  mime: string
  bytes: number
  storageRef: string
  audience: 'private' | 'space'
}

export function addAttachment(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: NewAttachment,
): Out<Attachment> {
  const space = s.spaces.find((x) => x.id === i.spaceId)
  if (!space || !can(roleOf(s, i.spaceId, actor), 'edit'))
    return fail('You can read this space but not add files to it.')
  const checked = checkAttachment(i.filename, i.mime, i.bytes)
  if (!checked.ok) return fail(checked.reason)
  if (space.type === 'personal' && i.audience === 'space')
    return fail('Files in your personal space stay private.')
  const a: Attachment = {
    id: c.newId('att'),
    spaceId: i.spaceId,
    ...(i.projectId ? { projectId: i.projectId } : {}),
    ...(i.pageId ? { pageId: i.pageId } : {}),
    filename: i.filename.slice(0, 160),
    mime: checked.mime,
    bytes: i.bytes,
    storageRef: i.storageRef,
    uploaderId: actor,
    audience: i.audience,
    createdAt: c.nowIso,
    dataMode: space.dataMode,
  }
  return ok({ ...s, attachments: [...s.attachments, a] }, a)
}

export function removeAttachment(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  id: string,
): Out<Attachment> {
  const a = s.attachments.find((x) => x.id === id)
  if (!a) return fail('That file is already gone.')
  if (a.uploaderId !== actor && !can(roleOf(s, a.spaceId, actor), 'manage'))
    return fail('Only the person who added a file, or an Owner, can remove it.')
  return ok({ ...s, attachments: s.attachments.filter((x) => x.id !== id) }, a)
}

export const canReadAttachment = (s: WorkspaceStore, a: Attachment, userId: string) =>
  can(roleOf(s, a.spaceId, userId), 'read') && (a.audience === 'space' || a.uploaderId === userId)

/* ---------- canvas (spec §9.4) ---------- */

export const canReadCanvas = (s: WorkspaceStore, cv: Canvas, userId: string) =>
  can(roleOf(s, cv.spaceId, userId), 'read') && (cv.audience === 'space' || cv.authorId === userId)

export function createCanvas(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: { spaceId: string; title: string; audience?: Canvas['audience'] },
): Out<Canvas> {
  const space = s.spaces.find((x) => x.id === i.spaceId)
  if (!space || !can(roleOf(s, i.spaceId, actor), 'edit'))
    return fail('You cannot add a canvas here.')
  if (!i.title.trim()) return fail('Give the canvas a name.')
  const audience = space.type === 'personal' ? 'private' : (i.audience ?? 'space')
  const cv: Canvas = {
    id: c.newId('cv'),
    spaceId: i.spaceId,
    title: i.title.trim().slice(0, 120),
    authorId: actor,
    audience,
    cards: [],
    edges: [],
    layoutRevision: 1,
    createdAt: c.nowIso,
    dataMode: space.dataMode,
  }
  return ok({ ...s, canvases: [...s.canvases, cv] }, cv)
}

/**
 * Saves cards and connections together. A note card must point at a page the saver can open in the same
 * space; the canvas never stores a copy of a note. A stale layout revision is refused, not overwritten.
 */
export function saveCanvas(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  canvasId: string,
  expectedRevision: number,
  next: { cards: Canvas['cards']; edges: Canvas['edges']; title?: string },
): Out<Canvas> {
  const cv = s.canvases.find((x) => x.id === canvasId)
  if (!cv || !canReadCanvas(s, cv, actor)) return fail('That canvas is not available to you.')
  if (!can(roleOf(s, cv.spaceId, actor), 'edit'))
    return fail('You can look at this canvas but not change it.')
  if (cv.layoutRevision !== expectedRevision)
    return fail('This canvas was changed somewhere else. Reload it to see the latest layout.')
  const ids = new Set(next.cards.map((x) => x.id))
  if (ids.size !== next.cards.length) return fail('Two cards share an identity.')
  for (const card of next.cards) {
    if (card.kind === 'page') {
      const page = s.pages.find((p) => p.id === card.pageId)
      if (!page || page.spaceId !== cv.spaceId || !canReadPage(s, page, actor))
        return fail('A note card points at a page you cannot open in this space.')
    } else if (!(card.text ?? '').trim()) return fail('A text card cannot be empty.')
  }
  for (const e of next.edges) {
    if (!ids.has(e.from) || !ids.has(e.to))
      return fail('A connection points at a card that is gone.')
    if (e.from === e.to) return fail('A card cannot connect to itself.')
  }
  const saved: Canvas = {
    ...cv,
    title: next.title?.trim() ? next.title.trim().slice(0, 120) : cv.title,
    cards: next.cards,
    edges: next.edges,
    layoutRevision: cv.layoutRevision + 1,
  }
  return ok({ ...s, canvases: s.canvases.map((x) => (x.id === canvasId ? saved : x)) }, saved)
}

export function deleteCanvas(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  canvasId: string,
): Out<void> {
  const cv = s.canvases.find((x) => x.id === canvasId)
  if (!cv || !can(roleOf(s, cv.spaceId, actor), 'edit'))
    return fail('You cannot remove this canvas.')
  return ok({ ...s, canvases: s.canvases.filter((x) => x.id !== canvasId) }, undefined)
}

/* ---------- automation switches and the due-date check (spec §5.4) ---------- */

export function setRule(
  s: WorkspaceStore,
  _c: Ctx,
  actor: string,
  spaceId: string,
  rule: RuleId,
  on: boolean,
): Out<void> {
  if (!can(roleOf(s, spaceId, actor), 'manage'))
    return fail('Only an Owner can change automation rules.')
  if (!RULES.some((r) => r.id === rule)) return fail('That rule does not exist.')
  const space = s.spaces.find((x) => x.id === spaceId)!
  const off = new Set(space.automationsOff ?? [])
  if (on) off.delete(rule)
  else off.add(rule)
  const next = { ...space, automationsOff: off.size ? [...off] : undefined }
  return ok({ ...s, spaces: s.spaces.map((x) => (x.id === spaceId ? next : x)) }, undefined)
}

/**
 * Checked when a person opens Workspace (there is no background process): open tasks assigned to them
 * that fall due today or tomorrow each earn one in-app reminder per task and date.
 */
export function runDueReminders(s: WorkspaceStore, c: Ctx, userId: string): Out<number> {
  const today = istDate(c.nowIso)
  const next = addDays(today, 1)
  let store = s
  const notices: ReturnType<typeof fire>['notices'] = []
  let count = 0
  for (const t of s.tasks) {
    if (t.assigneeId !== userId || isResolved(t) || !t.dueDate) continue
    if (t.dueDate !== today && t.dueDate !== next) continue
    const project = projectOf(s, t.projectId)
    if (!project || roleOf(s, project.spaceId, userId) === null) continue
    const f = fire(store, c, '', {
      spaceId: project.spaceId,
      rule: 'due-soon',
      key: `due-soon|${t.id}|${t.dueDate}`,
      text: `Reminded about “${t.title}” (due ${t.dueDate})`,
      to: [userId],
      title: t.dueDate === today ? 'A team task is due today' : 'A team task is due tomorrow',
      body: `“${t.title}” in ${project.title}.`,
      href: `/workspace/projects/${project.id}?tab=tasks`,
    })
    if (f === NOTHING || !f.log.length) continue
    store = { ...store, automationLog: addLog(store, f) }
    notices.push(...f.notices)
    count++
  }
  return ok(store, count, notices)
}

/* ---------- import (spec §13) ---------- */

import { createPage, createSource, savePage, updateSource } from './workspace-logic'
import type { ParsedNote, EvidencePreviewRow } from './workspace-import'
import type { Page } from './workspace'

export interface ImportRequest {
  spaceId: string
  notes: (ParsedNote & { fileName: string })[]
  /** `append` always adds a page. `update` replaces the blocks of a page that has the same title. */
  mode: 'append' | 'update'
  opId: string
}

/** Pages are imported as drafts the importer owns. Existing pages are never changed unless `update` was chosen. */
export function importPages(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: ImportRequest,
): Out<Page[]> {
  let store = s
  const made: Page[] = []
  for (const [k, n] of i.notes.entries()) {
    const same = store.pages.find(
      (p) => p.spaceId === i.spaceId && !p.trashedAt && p.title === n.title,
    )
    if (i.mode === 'update' && same) {
      const r = savePage(store, c, actor, same.id, same.revision, { blocks: n.blocks })
      if (!r.ok) return fail(`${n.fileName}: ${r.reason}`)
      store = r.store
      made.push(r.value)
      continue
    }
    const r = createPage(store, c, actor, {
      spaceId: i.spaceId,
      title: n.title,
      blocks: n.blocks,
      opId: `${i.opId}:${k}`,
    })
    if (!r.ok) return fail(`${n.fileName}: ${r.reason}`)
    const tagged = {
      ...r.value,
      importedFrom: n.fileName,
    }
    store = { ...r.store, pages: r.store.pages.map((p) => (p.id === tagged.id ? tagged : p)) }
    made.push(tagged)
  }
  return ok(store, made)
}

export function importEvidence(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  projectId: string,
  rows: readonly EvidencePreviewRow[],
  mode: 'append' | 'update',
): Out<{ added: number; updated: number; skipped: number }> {
  let store = s
  let added = 0
  let updated = 0
  let skipped = 0
  for (const r of rows) {
    const claim = r.values.claim?.trim()
    if (!claim) {
      skipped++
      continue
    }
    const date =
      r.values.observedOn && /^\d{4}-\d{2}-\d{2}$/.test(r.values.observedOn)
        ? (r.values.observedOn as DateOnly)
        : undefined
    const input = {
      source: r.values.source,
      method: r.values.method,
      finding: r.values.finding,
      limitations: r.values.limitations,
      ...(date ? { observedOn: date } : {}),
    }
    const dupe = store.sources.find(
      (x) => x.projectId === projectId && x.claim.toLowerCase() === claim.toLowerCase(),
    )
    if (dupe && mode === 'append') {
      skipped++ // a duplicate is never silently added twice
      continue
    }
    if (dupe) {
      const u = updateSource(store, c, actor, dupe.id, input)
      if (!u.ok) return fail(`Row ${r.line}: ${u.reason}`)
      store = u.store
      updated++
      continue
    }
    const a = createSource(store, c, actor, { projectId, claim, ...input })
    if (!a.ok) return fail(`Row ${r.line}: ${a.reason}`)
    store = a.store
    added++
  }
  return ok(store, { added, updated, skipped })
}
