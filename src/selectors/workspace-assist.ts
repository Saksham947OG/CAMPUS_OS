import { isBlocked, isResolved } from '@/domain/workspace-logic'
import { blockLinks } from '@/domain/workspace-links'
import type { Block, Page } from '@/domain/workspace'
import { displayText, readablePages, threadsFor, type Ws } from './workspace'

/**
 * The Workspace helper (spec §17). It is a local, rule-based tool: there is no AI provider, no
 * network call and no learned model, so it only rearranges what is already written. Everything it
 * produces is a DRAFT with its sources named, built only from pages the reader can open. It never
 * creates a task, assigns anyone or publishes anything: a person reviews and chooses.
 */
export interface Source {
  id: string
  title: string
}
export interface Draft {
  kind: 'summary' | 'actions' | 'agenda' | 'related' | 'questions' | 'explain'
  heading: string
  lines: { text: string; pageId?: string; blockId?: string }[]
  sources: Source[]
  /** An honest limit, shown when the notes did not contain enough. */
  limitation?: string
}

const src = (p: Page): Source => ({ id: p.id, title: p.title || 'Untitled' })
const text = (ws: Ws, actor: string, b: Block) => displayText(ws, actor, b.text).trim()
const firstSentence = (s: string) => {
  const m = /^(.+?[.!?])(\s|$)/.exec(s.trim())
  return (m ? m[1]! : s.trim()).slice(0, 200)
}
const ACTION = /\b(to|will|should|must|need to|needs to|action|follow up|todo)\b/i
const STOP = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'to',
  'in',
  'on',
  'for',
  'is',
  'are',
  'vs',
  'with',
  'we',
  'our',
  'how',
])
const words = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  )

export function summarize(ws: Ws, actor: string, pages: Page[]): Draft {
  const lines: Draft['lines'] = []
  for (const p of pages) {
    let heading = ''
    for (const b of p.blocks) {
      const t = text(ws, actor, b)
      if (!t) continue
      if (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') heading = t
      else if (b.type === 'paragraph' || b.type === 'callout' || b.type === 'quote') {
        lines.push({
          text: `${pages.length > 1 ? `${p.title || 'Untitled'}: ` : ''}${heading ? `${heading}. ` : ''}${firstSentence(t)}`,
          pageId: p.id,
          blockId: b.id,
        })
        heading = ''
      }
    }
  }
  return {
    kind: 'summary',
    heading: 'Summary draft',
    lines: lines.slice(0, 8),
    sources: pages.map(src),
    ...(lines.length ? {} : { limitation: 'These notes have no paragraphs to summarise yet.' }),
  }
}

/** Candidate actions: open checklist items that are not tasks yet, and lines that say who will do what. */
export function proposeActions(ws: Ws, actor: string, pages: Page[]): Draft {
  const lines: Draft['lines'] = []
  for (const p of pages)
    for (const b of p.blocks) {
      const t = text(ws, actor, b)
      if (!t || b.taskId || b.workTaskId) continue
      if (
        (b.type === 'todo' && !b.checked) ||
        ((b.type === 'bullet' || b.type === 'numbered') && ACTION.test(t) && t.length < 160)
      )
        lines.push({ text: t, pageId: p.id, blockId: b.id })
    }
  return {
    kind: 'actions',
    heading: 'Possible actions (none are tasks until you create them)',
    lines: lines.slice(0, 12),
    sources: pages.map(src),
    ...(lines.length
      ? {}
      : { limitation: 'No open checklist items or “who will do what” lines were found.' }),
  }
}

export function draftAgenda(ws: Ws, actor: string, projectId: string): Draft {
  const open = ws.decisions.filter((d) => d.projectId === projectId && !d.outcome)
  const tasks = ws.tasks.filter((t) => t.projectId === projectId && !isResolved(t))
  const blocked = tasks.filter((t) => isBlocked(ws, t))
  const review = tasks.filter((t) => t.status === 'inReview')
  const pages = readablePages(ws, actor).filter((p) => p.projectId === projectId)
  const threads = pages.flatMap((p) => threadsFor(ws, p)).filter((t) => !t.root.resolvedAt)
  const lines: Draft['lines'] = [
    ...open.map((d) => ({ text: `Decide: ${d.question}` })),
    ...blocked.map((t) => ({ text: `Unblock: ${t.title}` })),
    ...review.map((t) => ({ text: `Review: ${t.title}` })),
    ...(threads.length
      ? [
          {
            text: `${threads.length} open comment thread${threads.length === 1 ? '' : 's'} to settle`,
          },
        ]
      : []),
  ]
  return {
    kind: 'agenda',
    heading: 'Agenda draft',
    lines,
    sources: pages.slice(0, 6).map(src),
    ...(lines.length
      ? {}
      : {
          limitation:
            'Nothing is open: no undecided decisions, blocked or in-review tasks, or open comments.',
        }),
  }
}

/** Notes that share tags, a type or title words with this one and are not linked yet. Suggestions, never links. */
export function relatedNotes(ws: Ws, actor: string, page: Page): Draft {
  const mine = words(page.title + ' ' + page.tags.join(' '))
  const linked = new Set(blockLinks(page.blocks))
  const scored = readablePages(ws, actor)
    .filter((p) => p.id !== page.id && !linked.has(p.id) && !blockLinks(p.blocks).includes(page.id))
    .map((p) => {
      const theirs = words(p.title + ' ' + p.tags.join(' '))
      const shared = [...mine].filter((w) => theirs.has(w))
      const tags = p.tags.filter((t) => page.tags.includes(t))
      return { p, shared, tags, score: shared.length + tags.length * 2 }
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  return {
    kind: 'related',
    heading: 'Suggested related notes (not links yet)',
    lines: scored.map((x) => ({
      text: `${x.p.title || 'Untitled'}: shares ${[...x.tags.map((t) => `the tag “${t}”`), ...x.shared.map((w) => `the word “${w}”`)].join(', ')}`,
      pageId: x.p.id,
    })),
    sources: scored.map((x) => src(x.p)),
    ...(scored.length
      ? {}
      : { limitation: 'No other note you can open shares a tag or title word with this one.' }),
  }
}

export function revisionQuestions(ws: Ws, actor: string, pages: Page[]): Draft {
  const lines: Draft['lines'] = []
  for (const p of pages)
    for (const b of p.blocks) {
      const t = text(ws, actor, b)
      if (!t) continue
      if (b.type === 'h2' || b.type === 'h3')
        lines.push({ text: `What are the key points of “${t}”?`, pageId: p.id, blockId: b.id })
      else if (
        /\bis\b/.test(t) &&
        t.length < 160 &&
        (b.type === 'paragraph' || b.type === 'bullet')
      ) {
        const [head] = t.split(/\bis\b/)
        if (head && head.trim().split(/\s+/).length <= 5)
          lines.push({ text: `What is ${head.trim().toLowerCase()}?`, pageId: p.id, blockId: b.id })
      }
    }
  return {
    kind: 'questions',
    heading: 'Revision questions (drafts: check them against the note)',
    lines: lines.slice(0, 10),
    sources: pages.map(src),
    ...(lines.length
      ? {}
      : { limitation: 'The notes have no headings or definitions to turn into questions yet.' }),
  }
}

/** Looks the term up in the reader's own notes. If nothing explains it, it says so instead of guessing. */
export function explainConcept(ws: Ws, actor: string, term: string): Draft {
  const q = term.trim().toLowerCase()
  const hits: Draft['lines'] = []
  const sources: Source[] = []
  if (q)
    for (const p of readablePages(ws, actor)) {
      const inTitle = p.title.toLowerCase().includes(q)
      const para = p.blocks.find(
        (b) => b.type !== 'divider' && text(ws, actor, b).toLowerCase().includes(q),
      )
      if (inTitle || para) {
        const body = para
          ? text(ws, actor, para)
          : text(ws, actor, p.blocks.find((b) => text(ws, actor, b)) ?? p.blocks[0]!)
        hits.push({
          text: `${p.title || 'Untitled'}: ${firstSentence(body)}`,
          pageId: p.id,
          blockId: para?.id,
        })
        sources.push(src(p))
      }
    }
  return {
    kind: 'explain',
    heading: q ? `What your notes say about “${term.trim()}”` : 'Explain a concept',
    lines: hits.slice(0, 5),
    sources: sources.slice(0, 5),
    ...(hits.length
      ? {}
      : {
          limitation: q
            ? 'None of the notes you can open mention this, so there is nothing to explain it from.'
            : 'Type a concept to look up.',
        }),
  }
}
