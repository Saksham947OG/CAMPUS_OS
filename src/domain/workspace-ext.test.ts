import { withDemo, withTeamProject } from '@/data/seeds/demo/workspace-demo'
import type { Ctx } from '@/domain/service-core'
import { emptyWorkspace, type WorkspaceStore } from '@/domain/workspace'
import {
  addAttachment,
  canReadAttachment,
  checkAttachment,
  closePoll,
  createCanvas,
  createPoll,
  importEvidence,
  importPages,
  markPollFinalized,
  runDueReminders,
  saveCanvas,
  setRule,
  sniffMatches,
  tally,
  votePoll,
} from '@/domain/workspace-ext'
import { guessMapping, parseCsv, parseMarkdown, previewEvidence } from '@/domain/workspace-import'
import {
  addComment,
  addMember,
  createSpace,
  createTask,
  finalizeDecision,
  respondInvite,
  scheduleMeeting,
  updateTask,
} from '@/domain/workspace-logic'
import { roleOf } from '@/domain/workspace-access'
import type { Notice } from '@/domain/service-core'
import { addDays, type DateOnly, type LocalTime } from '@/lib/time'
import {
  proposeActions,
  relatedNotes,
  explainConcept,
  summarize,
} from '@/selectors/workspace-assist'
import { readablePages } from '@/selectors/workspace'

let n = 0
const ctx = (iso = '2026-11-02T04:30:00Z'): Ctx => ({ nowIso: iso, newId: (p) => `${p}-x${++n}` })
const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'
const AARAV = 'demo-u1'
const MEERA = 'demo-u2'

type R<T> =
  { ok: true; store: WorkspaceStore; value: T; notices: Notice[] } | { ok: false; reason: string }
function must<T>(r: R<T>) {
  if (!r.ok) throw new Error(r.reason)
  return r
}
const team = () => withTeamProject(emptyWorkspace())
const demo = () => withDemo(emptyWorkspace())

describe('cross-profile membership (spec §2.2)', () => {
  it('a real profile must accept an invitation before it can see anything', () => {
    const c = ctx()
    const s0 = must(
      createSpace(emptyWorkspace(), c, A, { type: 'project', title: 'Group', opId: 'sp' }),
    ).store
    const spaceId = s0.spaces[0]!.id
    const invited = must(addMember(s0, c, A, spaceId, B, 'editor'))
    expect(roleOf(invited.store, spaceId, B)).toBeNull()
    expect(readablePages(invited.store, B)).toEqual([])
    expect(invited.notices.map((x) => x.recipientProfileId)).toEqual([B])
    const accepted = must(respondInvite(invited.store, c, B, spaceId, true))
    expect(roleOf(accepted.store, spaceId, B)).toBe('editor')
    expect(accepted.notices.map((x) => x.recipientProfileId)).toEqual([A]) // the inviter hears back
  })

  it('a declined invitation stays out, and nobody else can answer for the invitee', () => {
    const c = ctx()
    const s0 = must(
      createSpace(emptyWorkspace(), c, A, { type: 'project', title: 'Group', opId: 'sp2' }),
    ).store
    const id = s0.spaces[0]!.id
    const invited = must(addMember(s0, c, A, id, B, 'viewer')).store
    expect(respondInvite(invited, c, C, id, true).ok).toBe(false)
    const declined = must(respondInvite(invited, c, B, id, false)).store
    expect(roleOf(declined, id, B)).toBeNull()
  })

  it('a fictional demo member joins at once and is never sent a notification', () => {
    const c = ctx()
    const s = demo()
    const added = must(addMember(s, c, AARAV, 'sp-demo-ops', 'demo-u2', 'viewer'))
    expect(added.notices).toEqual([])
  })
})

describe('notifications and automations (spec §5.4, §8.4)', () => {
  it('assigning a real profile a task sends one in-app notice, and never repeats for the same event', () => {
    const c = ctx()
    const made = must(
      createTask(team(), c, A, {
        projectId: 'prj-team3',
        title: 'Write intro',
        assigneeId: B,
        dueDate: '2026-11-06' as DateOnly,
      }),
    )
    expect(made.notices).toHaveLength(1)
    expect(made.notices[0]).toMatchObject({
      recipientProfileId: B,
      href: '/workspace/projects/prj-team3?tab=tasks',
    })
    expect(made.store.automationLog[0]!.rule).toBe('task-assigned')
    // Re-assigning the same person to the same task is the same trigger.
    const again = must(updateTask(made.store, c, A, made.value.id, { assigneeId: C }))
    const back = must(updateTask(again.store, c, A, made.value.id, { assigneeId: B }))
    expect(back.notices).toEqual([]) // the key already fired
  })

  it('assigning yourself, or a fictional member, notifies nobody', () => {
    const c = ctx()
    const self = must(
      createTask(team(), c, A, { projectId: 'prj-team3', title: 'Mine', assigneeId: A }),
    )
    expect(self.notices).toEqual([])
    const fiction = must(
      createTask(demo(), c, AARAV, { projectId: 'prj-demo-tt', title: 'F', assigneeId: MEERA }),
    )
    expect(fiction.notices).toEqual([])
  })

  it('an Owner can switch a rule off, and a rule that is off does nothing', () => {
    const c = ctx()
    const off = must(setRule(team(), c, A, 'sp-team3', 'task-assigned', false)).store
    expect(setRule(off, c, B, 'sp-team3', 'task-assigned', true).ok).toBe(false) // editor, not Owner
    const made = must(
      createTask(off, c, A, { projectId: 'prj-team3', title: 'Quiet', assigneeId: B }),
    )
    expect(made.notices).toEqual([])
    expect(made.store.automationLog).toHaveLength(0)
  })

  it('scheduling a meeting creates an agenda page that lists open decisions, and tells the invited', () => {
    const c = ctx()
    const m = must(
      scheduleMeeting(team(), c, A, {
        projectId: 'prj-team3',
        title: 'Sync',
        date: '2026-11-05' as DateOnly,
        start: '17:00' as LocalTime,
        end: '17:45' as LocalTime,
        attendees: [{ userId: B, required: true }],
        opId: 'm1',
      }),
    )
    const page = m.store.pages.find((p) => p.id === m.value.agendaPageId)!
    expect(page.title).toContain('Agenda: Sync')
    expect(page.blocks.some((b) => b.text.includes('pool waits as ranges'))).toBe(true)
    expect(m.notices.map((x) => x.recipientProfileId)).toEqual([B])
  })

  it('finalizing decisions fills one Decision log page rather than one page each', () => {
    const c = ctx()
    let s = demo()
    s = must(finalizeDecision(s, c, AARAV, 'dec-d03', { outcome: '6' })).store
    s = must(finalizeDecision(s, c, AARAV, 'dec-d06', { outcome: 'Yes, after the draft' })).store
    const logs = s.pages.filter((p) => p.title === 'Decision log')
    expect(logs).toHaveLength(1)
    expect(logs[0]!.blocks.filter((b) => b.type === 'bullet')).toHaveLength(2)
  })

  it('a due-soon reminder is sent once per task and day, and only to the assignee', () => {
    const c = ctx('2026-11-05T05:00:00Z') // 5 Nov, IST
    const s = team() // tsk-t3-1 due 4 Nov (past), t3-2..4 due 6 Nov (tomorrow)
    const first = must(runDueReminders(s, c, B))
    expect(first.value).toBe(1)
    expect(first.notices[0]).toMatchObject({
      recipientProfileId: B,
      title: 'A team task is due tomorrow',
    })
    const second = must(runDueReminders(first.store, c, B))
    expect(second.value).toBe(0)
    expect(second.notices).toEqual([])
  })

  it('a mention needs access: someone who cannot open the page cannot be mentioned', () => {
    const c = ctx()
    const s = demo()
    expect(addComment(s, c, 'demo-u2', 'pg-tt-private', 'x').ok).toBe(false) // private page, not readable
    const open = must(
      addComment(s, c, MEERA, 'pg-tt-home', 'See this', undefined, undefined, [AARAV]),
    )
    expect(open.value.mentions).toEqual([AARAV])
    expect(addComment(s, c, MEERA, 'pg-tt-private', 'x', undefined, undefined, [AARAV]).ok).toBe(
      false,
    )
    const withPrivate = addComment(
      s,
      c,
      AARAV,
      'pg-tt-private',
      'note to self',
      undefined,
      undefined,
      [MEERA],
    )
    expect(withPrivate.ok).toBe(false) // Meera cannot open Aarav's private page, so a mention would leak it
  })
})

describe('team polls (spec §7.2)', () => {
  const cands = [
    { date: '2026-11-05' as DateOnly, start: '12:00' as LocalTime, end: '12:45' as LocalTime },
    { date: '2026-11-05' as DateOnly, start: '16:00' as LocalTime, end: '16:45' as LocalTime },
  ]
  const poll = (c: Ctx) =>
    must(
      createPoll(team(), c, A, {
        projectId: 'prj-team3',
        title: 'Sync',
        durationMin: 45,
        candidates: cands,
        voters: [
          { userId: B, required: true },
          { userId: C, required: false },
        ],
        roomPlan: 'none',
        opId: 'poll-1',
      }),
    )

  it('needs two times, tallies answers, and stops taking votes once closed', () => {
    const c = ctx()
    const p = poll(c)
    expect(p.notices.map((x) => x.recipientProfileId).sort()).toEqual([B, C].sort())
    const [o1, o2] = p.value.candidates
    let s = must(votePoll(p.store, c, B, p.value.id, o1!.id, 'yes')).store
    s = must(votePoll(s, c, C, p.value.id, o1!.id, 'no')).store
    s = must(votePoll(s, c, B, p.value.id, o2!.id, 'no')).store
    const t = tally(s.polls[0]!)
    expect(t[0]).toMatchObject({ yes: 1, no: 1, requiredNo: 0 })
    expect(t[1]).toMatchObject({ no: 1, requiredNo: 1 })
    expect(votePoll(s, c, 'demo-student-x', p.value.id, o1!.id, 'yes').ok).toBe(false)
    s = must(closePoll(s, c, A, p.value.id)).store
    expect(votePoll(s, c, B, p.value.id, o1!.id, 'maybe').ok).toBe(false)
  })

  it('a single time is not a poll, and a result is not a meeting until it is finalized after closing', () => {
    const c = ctx()
    expect(
      createPoll(team(), c, A, {
        projectId: 'prj-team3',
        title: 'x',
        durationMin: 30,
        candidates: [cands[0]!],
        voters: [],
        roomPlan: 'none',
        opId: 'p',
      }).ok,
    ).toBe(false)
    const p = poll(c)
    expect(markPollFinalized(p.store, c, A, p.value.id, 'mtg-1').ok).toBe(false) // still open
    const closed = must(closePoll(p.store, c, A, p.value.id)).store
    expect(markPollFinalized(closed, c, B, p.value.id, 'mtg-1').ok).toBe(false) // not the organiser
    const done = must(markPollFinalized(closed, c, A, p.value.id, 'mtg-1'))
    expect(done.value).toMatchObject({ status: 'finalized', meetingId: 'mtg-1' })
  })
})

describe('attachments (spec §4.4)', () => {
  it('refuses programs, web pages, empty, oversize and unknown files with a reason', () => {
    for (const bad of ['run.exe', 'page.html', 'logo.svg', 'script.js'])
      expect(checkAttachment(bad, 'application/octet-stream', 10).ok).toBe(false)
    expect(checkAttachment('a.pdf', 'application/pdf', 0)).toMatchObject({ ok: false })
    expect(checkAttachment('a.pdf', 'application/pdf', 6 * 1024 * 1024)).toMatchObject({
      ok: false,
    })
    expect(checkAttachment('a.xyz', '', 10)).toMatchObject({ ok: false })
    expect(checkAttachment('notes.md', '', 10)).toEqual({ ok: true, mime: 'text/markdown' })
  })

  it('checks the bytes, so a renamed file cannot pass as a picture or PDF', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])
    expect(sniffMatches('image/png', png)).toBe(true)
    expect(sniffMatches('application/pdf', png)).toBe(false)
  })

  it('a viewer cannot add a file, and a private file is invisible to the rest of the space', () => {
    const c = ctx()
    const s = demo()
    const input = {
      spaceId: 'sp-demo-ops',
      filename: 'a.pdf',
      mime: 'application/pdf',
      bytes: 100,
      storageRef: 'blob-1',
      audience: 'space' as const,
    }
    expect(addAttachment(s, c, 'demo-u5', input).ok).toBe(false) // viewer in Operations
    const mine = must(addAttachment(s, c, AARAV, { ...input, audience: 'private' }))
    expect(canReadAttachment(mine.store, mine.value, AARAV)).toBe(true)
    expect(canReadAttachment(mine.store, mine.value, 'demo-u4')).toBe(false)
  })
})

describe('canvas (spec §9.4)', () => {
  it('stores note cards as references, refuses stale layouts and pages the saver cannot open', () => {
    const c = ctx()
    const s0 = must(createCanvas(demo(), c, AARAV, { spaceId: 'sp-demo-tt', title: 'Map' }))
    const id = s0.value.id
    const card = { id: 'c1', kind: 'page' as const, pageId: 'pg-tt-home', x: 0, y: 0 }
    const saved = must(
      saveCanvas(s0.store, c, AARAV, id, 1, {
        cards: [card, { id: 'c2', kind: 'text', text: 'idea', x: 200, y: 0 }],
        edges: [{ id: 'e1', from: 'c1', to: 'c2', label: 'leads to' }],
      }),
    )
    expect(saved.value.layoutRevision).toBe(2)
    expect(saved.value.cards[0]).not.toHaveProperty('text') // a note card holds no copy of the note
    expect(saveCanvas(saved.store, c, AARAV, id, 1, { cards: [], edges: [] }).ok).toBe(false) // stale
    // Meera cannot open Aarav's private page, so she cannot put it on a canvas.
    expect(
      saveCanvas(saved.store, c, MEERA, id, 2, {
        cards: [{ id: 'p', kind: 'page', pageId: 'pg-tt-private', x: 0, y: 0 }],
        edges: [],
      }).ok,
    ).toBe(false)
    expect(
      saveCanvas(saved.store, c, AARAV, id, 2, {
        cards: [card],
        edges: [{ id: 'e', from: 'c1', to: 'gone', label: '' }],
      }).ok,
    ).toBe(false)
    expect(saveCanvas(saved.store, c, 'demo-u5', id, 2, { cards: [], edges: [] }).ok).toBe(false) // commenter
  })
})

describe('import (spec §13)', () => {
  const id = (p: string) => `${p}-i${++n}`
  it('turns Markdown into blocks and says what it did not carry over', () => {
    const md =
      '# Plan\n\nIntro line.\n\n## Steps\n- [ ] one\n- [x] two\n- plain\n1. first\n\n> quote\n\n```\ncode\n```\n![pic](a.png)\n'
    const note = parseMarkdown(md, 'plan.md', id)
    expect(note.title).toBe('Plan')
    expect(note.blocks.map((b) => b.type)).toEqual([
      'paragraph',
      'h2',
      'todo',
      'todo',
      'bullet',
      'numbered',
      'quote',
      'code',
      'paragraph',
    ])
    expect(note.blocks[3]!.checked).toBe(true)
    expect(note.unsupported.join(' ')).toMatch(/images/)
  })

  it('appends by default and updates an existing page only when asked, keeping history', () => {
    const c = ctx()
    const s = demo()
    const note = {
      ...parseMarkdown('# Observation sheet\n\nNew body.', 'sheet.md', id),
      fileName: 'sheet.md',
    }
    const appended = must(
      importPages(s, c, AARAV, {
        spaceId: 'sp-demo-tt',
        notes: [note],
        mode: 'append',
        opId: 'i1',
      }),
    )
    expect(appended.store.pages.filter((p) => p.title === 'Observation sheet')).toHaveLength(2)
    expect(appended.value[0]!.importedFrom).toBe('sheet.md')
    const updated = must(
      importPages(s, c, AARAV, {
        spaceId: 'sp-demo-tt',
        notes: [note],
        mode: 'update',
        opId: 'i2',
      }),
    )
    expect(updated.store.pages.filter((p) => p.title === 'Observation sheet')).toHaveLength(1)
    expect(updated.store.revisions.some((r) => r.pageId === 'pg-tt-sheet')).toBe(true)
  })

  it('maps CSV columns, flags duplicates and bad dates, and never adds a duplicate when appending', () => {
    const csv =
      'Statement,Where,Date,Result\nLunch is longest,Report A,2026-11-03,Reported\nPlanning targets are not measured savings,x,not a date,\n,empty claim,,\n'
    const rows = parseCsv(csv)
    const map = guessMapping(rows[0]!)
    expect(Object.values(map)).toEqual(['claim', 'source', 'observedOn', 'finding'])
    const existing = new Map([
      ['planning targets are not measured savings', 'Planning targets are not measured savings'],
    ])
    const preview = previewEvidence(rows, map, existing)
    expect(preview[0]!.problems).toEqual([])
    expect(preview[1]!.duplicateOf).toBeDefined()
    expect(preview[1]!.problems.join(' ')).toMatch(/YYYY-MM-DD/)
    expect(preview[2]!.problems.join(' ')).toMatch(/No claim/)
    const c = ctx()
    const added = must(importEvidence(demo(), c, AARAV, 'prj-demo-tt', preview, 'append'))
    expect(added.value).toEqual({ added: 1, updated: 0, skipped: 2 })
  })
})

describe('local helper (spec §17)', () => {
  it('is built only from pages the reader can open and names them', () => {
    const s = demo()
    const meera = readablePages(s, MEERA).filter((p) => p.projectId === 'prj-demo-tt')
    const summary = summarize(s, MEERA, meera)
    expect(summary.sources.map((x) => x.id)).not.toContain('pg-tt-private')
    expect(summary.lines.length).toBeGreaterThan(0)
  })

  it('proposes actions without creating any, and skips items that are already tasks', () => {
    const s = demo()
    const page = s.pages.find((p) => p.id === 'pg-tt-meeting1')!
    const d = proposeActions(s, AARAV, [page])
    expect(d.lines.map((l) => l.text)).toContain(
      'Meera to confirm the two observer pairs for the peak window',
    )
    expect(s.tasks.filter((t) => t.pageId === 'pg-tt-meeting1')).toHaveLength(0)
  })

  it('says so when nothing explains a concept, and never uses another person’s private note', () => {
    const s = demo()
    expect(explainConcept(s, MEERA, 'quantum chromodynamics').limitation).toMatch(
      /nothing to explain/,
    )
    expect(explainConcept(s, MEERA, 'observers').sources.map((x) => x.id)).not.toContain(
      'pg-tt-private',
    )
    expect(explainConcept(s, AARAV, 'enough observers').sources.map((x) => x.id)).toContain(
      'pg-tt-private',
    )
  })

  it('suggests related notes only among readable pages and never links them', () => {
    const s = demo()
    const page = s.pages.find((p) => p.id === 'pg-tt-limits')!
    const d = relatedNotes(s, MEERA, page)
    for (const l of d.lines) expect(l.pageId).not.toBe('pg-tt-private')
    expect(addDays('2026-11-02' as DateOnly, 1)).toBe('2026-11-03')
  })
})
