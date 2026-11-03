import type { Profile } from '@/domain/profile'
import { canReadPage, can, roleOf } from '@/domain/workspace-access'
import { blockLinks, toDisplay } from '@/domain/workspace-links'
import { isBlocked, isResolved } from '@/domain/workspace-logic'
import type {
  Comment,
  Decision,
  EvidenceSource,
  Page,
  Project,
  Space,
  WorkTask,
  WorkspaceStore,
  WsMeeting,
} from '@/domain/workspace'
import type { DateOnly } from '@/lib/time'

/** Read-side rules. Every list is filtered by what `actor` may open, so nothing private leaks into search, backlinks or the graph. */
export type Ws = WorkspaceStore

export function nameOf(ws: Ws, profiles: readonly Profile[], userId: string): string {
  return (
    ws.people.find((p) => p.id === userId)?.name ??
    profiles.find((p) => p.id === userId)?.displayName ??
    'Someone'
  )
}

export const spacesFor = (ws: Ws, actor: string): Space[] =>
  ws.spaces
    .filter((s) => !s.archivedAt && roleOf(ws, s.id, actor) !== null)
    .sort(
      (a, b) =>
        Number(b.type === 'personal') - Number(a.type === 'personal') ||
        a.title.localeCompare(b.title),
    )

export const readablePages = (
  ws: Ws,
  actor: string,
  opts: { spaceId?: string; trashed?: boolean } = {},
): Page[] =>
  ws.pages.filter(
    (p) =>
      (opts.spaceId ? p.spaceId === opts.spaceId : true) &&
      Boolean(p.trashedAt) === Boolean(opts.trashed) &&
      canReadPage(ws, p, actor),
  )

export interface TreeNode {
  page: Page
  children: TreeNode[]
}

export function pageTree(ws: Ws, actor: string, spaceId: string): TreeNode[] {
  const pages = readablePages(ws, actor, { spaceId }).filter((p) => p.lifecycle !== 'archived')
  const ids = new Set(pages.map((p) => p.id))
  const build = (parent?: string): TreeNode[] =>
    pages
      .filter((p) => (parent ? p.parentId === parent : !p.parentId || !ids.has(p.parentId)))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.title.localeCompare(b.title))
      .map((page) => ({ page, children: build(page.id) }))
  return build()
}

export const projectsFor = (ws: Ws, actor: string): Project[] =>
  ws.projects.filter((p) => roleOf(ws, p.spaceId, actor) !== null && p.status !== 'done')

export const assignedTo = (ws: Ws, actor: string): WorkTask[] =>
  ws.tasks
    .filter((t) => t.assigneeId === actor && !isResolved(t))
    .filter((t) => {
      const p = ws.projects.find((x) => x.id === t.projectId)
      return p && roleOf(ws, p.spaceId, actor) !== null
    })
    .sort(
      (a, b) =>
        (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title),
    )

export const upcomingMeetings = (ws: Ws, actor: string, today: DateOnly): WsMeeting[] =>
  ws.meetings
    .filter((m) => m.status === 'confirmed' && m.date >= today)
    .filter((m) => {
      const p = ws.projects.find((x) => x.id === m.projectId)
      return p && roleOf(ws, p.spaceId, actor) !== null
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))

export const recentActivity = (ws: Ws, actor: string, limit = 8) =>
  ws.activity.filter((a) => roleOf(ws, a.spaceId, actor) !== null).slice(0, limit)

export const continueWorking = (ws: Ws, actor: string, limit = 6): Page[] =>
  readablePages(ws, actor)
    .filter((p) => p.lifecycle !== 'archived')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit)

export const backlinks = (ws: Ws, actor: string, pageId: string): Page[] =>
  readablePages(ws, actor).filter((p) => p.id !== pageId && blockLinks(p.blocks).includes(pageId))

export const outgoing = (ws: Ws, actor: string, page: Page): Page[] =>
  blockLinks(page.blocks)
    .map((id) => ws.pages.find((p) => p.id === id))
    .filter((p): p is Page => !!p && !p.trashedAt && canReadPage(ws, p, actor))

/** `[[Title]]` → page id for one reader. Prefers the same space; an ambiguous title resolves to nothing. */
export function titleResolver(ws: Ws, actor: string, spaceId: string) {
  const pages = readablePages(ws, actor)
  return (title: string): string | undefined => {
    const t = title.trim().toLowerCase()
    const hits = pages.filter((p) => p.title.trim().toLowerCase() === t)
    const here = hits.filter((p) => p.spaceId === spaceId)
    const pool = here.length ? here : hits
    return pool.length === 1 ? pool[0]!.id : undefined
  }
}

/** Stored text → what the editor shows, hiding titles the reader may not open. */
export function displayText(ws: Ws, actor: string, text: string) {
  return toDisplay(text, (id) => {
    const p = ws.pages.find((x) => x.id === id)
    return p && !p.trashedAt && canReadPage(ws, p, actor) ? p.title || 'Untitled' : undefined
  })
}

export interface SearchHit {
  kind: 'page' | 'task' | 'decision' | 'source'
  id: string
  title: string
  detail: string
  href: string
}

export function searchWorkspace(ws: Ws, actor: string, query: string, limit = 20): SearchHit[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const hits: SearchHit[] = []
  for (const p of readablePages(ws, actor)) {
    const body = p.blocks.map((b) => displayText(ws, actor, b.text)).join(' ')
    const inTitle = p.title.toLowerCase().includes(q)
    if (
      inTitle ||
      body.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    ) {
      const at = body.toLowerCase().indexOf(q)
      hits.push({
        kind: 'page',
        id: p.id,
        title: p.title || 'Untitled',
        detail: inTitle
          ? (spaceTitle(ws, p.spaceId) ?? '')
          : `…${body.slice(Math.max(0, at - 30), at + 70).trim()}…`,
        href: `/workspace/pages/${p.id}`,
      })
    }
  }
  const proj = (id: string) => ws.projects.find((x) => x.id === id)
  const open = (projectId: string) => {
    const p = proj(projectId)
    return !!p && roleOf(ws, p.spaceId, actor) !== null
  }
  for (const t of ws.tasks)
    if (open(t.projectId) && t.title.toLowerCase().includes(q))
      hits.push({
        kind: 'task',
        id: t.id,
        title: t.title,
        detail: `Task in ${proj(t.projectId)!.title}`,
        href: `/workspace/projects/${t.projectId}`,
      })
  for (const d of ws.decisions)
    if (open(d.projectId) && (d.question + ' ' + (d.outcome ?? '')).toLowerCase().includes(q))
      hits.push({
        kind: 'decision',
        id: d.id,
        title: d.question,
        detail: d.outcome ? `Decided: ${d.outcome}` : 'Open decision',
        href: `/workspace/projects/${d.projectId}?tab=decisions`,
      })
  for (const r of ws.sources)
    if (open(r.projectId) && (r.claim + ' ' + (r.finding ?? '')).toLowerCase().includes(q))
      hits.push({
        kind: 'source',
        id: r.id,
        title: r.claim,
        detail: `Evidence · ${r.source || 'no source named'}`,
        href: `/workspace/projects/${r.projectId}?tab=docs`,
      })
  return hits.slice(0, limit)
}

export const spaceTitle = (ws: Ws, id: string) => ws.spaces.find((s) => s.id === id)?.title

/** Completed / total, with canceled work left out and said so. */
export function taskCounts(ws: Ws, projectId: string) {
  const own = ws.tasks.filter((t) => t.projectId === projectId)
  const counted = own.filter((t) => t.status !== 'canceled')
  return {
    done: counted.filter((t) => t.status === 'done').length,
    total: counted.length,
    canceled: own.length - counted.length,
    blocked: counted.filter((t) => isBlocked(ws, t)).length,
  }
}

export interface Load {
  userId: string
  open: number
  estimatedMin: number
  /** Open tasks with no estimate. They are not counted as zero effort. */
  unestimated: number
}

export function workload(ws: Ws, projectId: string): Load[] {
  const by = new Map<string, Load>()
  for (const t of ws.tasks)
    if (t.projectId === projectId && t.assigneeId && !isResolved(t)) {
      const l = by.get(t.assigneeId) ?? {
        userId: t.assigneeId,
        open: 0,
        estimatedMin: 0,
        unestimated: 0,
      }
      l.open++
      if (t.estimateMin) l.estimatedMin += t.estimateMin
      else l.unestimated++
      by.set(t.assigneeId, l)
    }
  return [...by.values()].sort((a, b) => b.open - a.open)
}

export interface Thread {
  root: Comment
  replies: Comment[]
  /** `changed` when the text the comment was written on has moved or been rewritten. */
  anchor: 'page' | 'ok' | 'changed' | 'gone'
}

export function threadsFor(ws: Ws, page: Page): Thread[] {
  return ws.comments
    .filter((c) => c.pageId === page.id && !c.parentId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((root) => {
      const block = root.blockId ? page.blocks.find((b) => b.id === root.blockId) : undefined
      const anchor: Thread['anchor'] = !root.blockId
        ? 'page'
        : !block
          ? 'gone'
          : root.quote && !block.text.startsWith(root.quote.slice(0, 40))
            ? 'changed'
            : 'ok'
      return {
        root,
        anchor,
        replies: ws.comments
          .filter((c) => c.parentId === root.id)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      }
    })
}

export function decisionsFor(ws: Ws, projectId: string): Decision[] {
  return ws.decisions
    .filter((d) => d.projectId === projectId)
    .sort(
      (a, b) => Number(!!a.outcome) - Number(!!b.outcome) || a.createdAt.localeCompare(b.createdAt),
    )
}

export const sourcesFor = (ws: Ws, projectId: string): EvidenceSource[] =>
  ws.sources.filter((s) => s.projectId === projectId)

export interface GraphNode {
  id: string
  title: string
  relation: 'self' | 'links-to' | 'linked-from'
}

/** The local graph around one note (spec §9.4): explicit links only, filtered to what the reader may open. */
export function localGraph(ws: Ws, actor: string, page: Page): GraphNode[] {
  return [
    { id: page.id, title: page.title || 'Untitled', relation: 'self' },
    ...outgoing(ws, actor, page).map((p) => ({
      id: p.id,
      title: p.title || 'Untitled',
      relation: 'links-to' as const,
    })),
    ...backlinks(ws, actor, page.id)
      .filter((b) => !blockLinks(page.blocks).includes(b.id))
      .map((p) => ({ id: p.id, title: p.title || 'Untitled', relation: 'linked-from' as const })),
  ]
}

const MD_PREFIX: Record<string, string> = {
  h1: '# ',
  h2: '## ',
  h3: '### ',
  bullet: '- ',
  quote: '> ',
  callout: '> **Note:** ',
}

export function pageToMarkdown(ws: Ws, actor: string, page: Page): string {
  let n = 0
  const lines = page.blocks.map((b) => {
    const text = displayText(ws, actor, b.text)
    if (b.type !== 'numbered') n = 0
    if (b.type === 'numbered') return `${++n}. ${text}`
    if (b.type === 'todo') return `- [${b.checked ? 'x' : ' '}] ${text}`
    if (b.type === 'divider') return '---'
    if (b.type === 'code') return '```\n' + text + '\n```'
    return `${MD_PREFIX[b.type] ?? ''}${text}`
  })
  return `# ${page.title || 'Untitled'}\n\n${lines.join('\n\n')}\n`
}

/** A backup of everything `actor` may open, with IDs kept so relations survive a restore. */
export function accessibleBackup(ws: Ws, actor: string) {
  const spaces = spacesFor(ws, actor)
  const ids = new Set(spaces.map((s) => s.id))
  const projects = ws.projects.filter((p) => ids.has(p.spaceId))
  const pids = new Set(projects.map((p) => p.id))
  return {
    manifest: {
      app: 'CampusOS Workspace',
      schemaVersion: 1,
      note: 'Contains only records the exporting user can open. Fictional records are marked dataMode "demoSeed".',
    },
    spaces,
    projects,
    pages: readablePages(ws, actor),
    tasks: ws.tasks.filter((t) => pids.has(t.projectId)),
    meetings: ws.meetings.filter((m) => pids.has(m.projectId)),
    decisions: ws.decisions.filter((d) => pids.has(d.projectId)),
    sources: ws.sources.filter((s) => pids.has(s.projectId)),
  }
}

export { can, roleOf, isBlocked }

/** Counts of the coordination jobs this person's Workspace records hold. Counts only: never minutes or savings. */
export function collaborationCounts(ws: Ws, userId: string) {
  const spaces = new Set(spacesFor(ws, userId).map((s) => s.id))
  const projects = new Set(ws.projects.filter((p) => spaces.has(p.spaceId)).map((p) => p.id))
  const shared = [...spaces].filter((id) => ws.spaces.find((s) => s.id === id)?.type !== 'personal')
  const meetings = ws.meetings.filter(
    (m) => projects.has(m.projectId) && m.attendees.some((a) => a.userId === userId),
  )
  return {
    sharedSpaces: shared.length,
    teammates: new Set(
      ws.members
        .filter((m) => shared.includes(m.spaceId) && !m.invitation && m.userId !== userId)
        .map((m) => m.userId),
    ).size,
    polls: ws.polls.filter(
      (p) => projects.has(p.projectId) && p.voters.some((v) => v.userId === userId),
    ).length,
    meetings: meetings.length,
    roomsHeld: meetings.filter((m) => m.calendarMeetingId || m.roomId).length,
    tasksAssignedToMe: ws.tasks.filter((t) => projects.has(t.projectId) && t.assigneeId === userId)
      .length,
    tasksInProjects: ws.tasks.filter((t) => projects.has(t.projectId)).length,
    decisionsRecorded: ws.decisions.filter((d) => projects.has(d.projectId) && d.outcome).length,
    evidenceRows: ws.sources.filter((r) => projects.has(r.projectId)).length,
    comments: ws.comments.filter((c) => readablePagesIds(ws, userId).has(c.pageId)).length,
    files: ws.attachments.filter((a) => spaces.has(a.spaceId)).length,
  }
}

const readablePagesIds = (ws: Ws, userId: string) =>
  new Set(readablePages(ws, userId).map((p) => p.id))
