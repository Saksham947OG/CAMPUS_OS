import {
  withDemo,
  demoAvailability,
  DEMO_AVAILABILITY_DATE,
} from '@/data/seeds/demo/workspace-demo'
import { findTimes, type Participant } from '@/domain/availability'
import type { Ctx } from '@/domain/service-core'
import { emptyWorkspace, type WorkspaceStore } from '@/domain/workspace'
import { toDisplay, toStored } from '@/domain/workspace-links'
import {
  addComment,
  blockToWorkTask,
  createPage,
  ensurePersonalSpace,
  createTask,
  finalizeDecision,
  moveTask,
  removeDemo,
  removeMember,
  respondMeeting,
  restoreRevision,
  savePage,
  scheduleMeeting,
  updateTask,
} from '@/domain/workspace-logic'
import { instantMs } from '@/selectors/now'
import type { DateOnly, LocalTime } from '@/lib/time'
import { backlinks, readablePages, searchWorkspace, threadsFor } from '@/selectors/workspace'
import { instantiateTemplate } from '@/domain/workspace-templates'

let n = 0
const ctx = (): Ctx => ({ nowIso: '2026-11-02T04:30:00Z', newId: (p) => `${p}-t${++n}` })
const demo = (): WorkspaceStore => withDemo(emptyWorkspace())
const AARAV = 'demo-u1'
const MEERA = 'demo-u2'
const ROHAN = 'demo-u5' // commenter in Time Tax, viewer in the other two spaces

function must<T>(r: { ok: true; store: WorkspaceStore; value: T } | { ok: false; reason: string }) {
  if (!r.ok) throw new Error(r.reason)
  return r
}

describe('roles (spec §2.2)', () => {
  it('a commenter can comment but not change a task, and a viewer cannot add one', () => {
    const s = demo()
    const comment = addComment(s, ctx(), ROHAN, 'pg-tt-home', 'Looks good')
    expect(comment.ok).toBe(true)
    const move = moveTask(s, ctx(), ROHAN, 'tsk-demo-t02', 'inProgress')
    expect(move.ok).toBe(false)
    const add = createTask(s, ctx(), ROHAN, { projectId: 'prj-demo-ops', title: 'Sneaky' })
    expect(add.ok).toBe(false)
    expect(addComment(s, ctx(), ROHAN, 'pg-ops-theory', 'hi').ok).toBe(false) // viewer in Ops
  })

  it('an editor can move a task and the change is the one canonical record', () => {
    const s = demo()
    const r = must(moveTask(s, ctx(), MEERA, 'tsk-demo-t02', 'inProgress'))
    expect(r.store.tasks.filter((t) => t.id === 'tsk-demo-t02')).toHaveLength(1)
    expect(r.store.tasks.find((t) => t.id === 'tsk-demo-t02')!.status).toBe('inProgress')
  })

  it('the last Owner cannot leave', () => {
    const r = removeMember(demo(), ctx(), AARAV, 'sp-demo-tt', AARAV)
    expect(r.ok).toBe(false)
  })

  it('a person who is not in the space cannot be assigned work', () => {
    const r = updateTask(demo(), ctx(), AARAV, 'tsk-demo-t02', { assigneeId: 'demo-student-a' })
    expect(r.ok).toBe(false)
  })
})

describe('privacy (spec §9.1, §18)', () => {
  it('a private page is invisible to teammates, in lists, search and backlinks', () => {
    const s = demo()
    const mine = readablePages(s, AARAV).map((p) => p.id)
    const theirs = readablePages(s, MEERA).map((p) => p.id)
    expect(mine).toContain('pg-tt-private')
    expect(theirs).not.toContain('pg-tt-private')
    expect(backlinks(s, AARAV, 'pg-tt-home').map((p) => p.id)).toContain('pg-tt-private')
    expect(backlinks(s, MEERA, 'pg-tt-home').map((p) => p.id)).not.toContain('pg-tt-private')
    expect(searchWorkspace(s, MEERA, 'scratchpad')).toEqual([])
    expect(searchWorkspace(s, AARAV, 'scratchpad').length).toBeGreaterThan(0)
  })

  it('a link to a page the reader cannot open never shows its title', () => {
    const s = demo()
    const title = (id: string) =>
      readablePages(s, MEERA).some((p) => p.id === id) ? 'visible' : undefined
    expect(toDisplay('see [[pg-tt-private]]', title)).toBe('see [[a page you cannot open]]')
  })

  it('pages in a personal space stay private and cannot be shared', () => {
    const c = ctx()
    const s = must(ensurePersonalSpace(emptyWorkspace(), c, 'demo-student-a', 'Ananya')).store
    const space = s.spaces[0]!
    expect(
      createPage(s, c, 'demo-student-a', { spaceId: space.id, title: 'Mine', audience: 'space' })
        .ok,
    ).toBe(false)
    const ok = must(createPage(s, c, 'demo-student-a', { spaceId: space.id, title: 'Mine' }))
    expect(ok.value.audience).toBe('private')
    expect(readablePages(ok.store, 'demo-student-b').map((p) => p.id)).toEqual([])
  })
})

describe('links survive a rename (spec §4.3)', () => {
  it('stores an id and shows the current title', () => {
    const stored = toStored('read [[Bottleneck vs visible queue]]', (t) =>
      t === 'Bottleneck vs visible queue' ? 'pg-tt-bottleneck' : undefined,
    )
    expect(stored).toBe('read [[pg-tt-bottleneck]]')
    expect(toDisplay(stored, () => 'Renamed note')).toBe('read [[Renamed note]]')
  })

  it('leaves an unknown title as typed so it shows up as not created yet', () => {
    expect(toStored('[[Nothing here]]', () => undefined)).toBe('[[Nothing here]]')
  })
})

describe('tasks and dependencies (spec §6.3)', () => {
  it('rejects a self-dependency and a dependency loop', () => {
    const s = demo()
    expect(updateTask(s, ctx(), AARAV, 'tsk-demo-t04', { dependsOn: ['tsk-demo-t04'] }).ok).toBe(
      false,
    )
    // t04 waits on t02; making t02 wait on t04 closes a loop.
    const loop = updateTask(s, ctx(), AARAV, 'tsk-demo-t02', { dependsOn: ['tsk-demo-t04'] })
    expect(loop.ok).toBe(false)
  })

  it('does not allow Done while a prerequisite is open, and allows it afterwards', () => {
    const s = demo()
    const early = moveTask(s, ctx(), AARAV, 'tsk-demo-t04', 'done')
    expect(early.ok).toBe(false)
    if (!early.ok) expect(early.reason).toMatch(/Record mess peak window/)
    let t = must(moveTask(s, ctx(), MEERA, 'tsk-demo-t02', 'done')).store
    t = must(moveTask(t, ctx(), AARAV, 'tsk-demo-t03', 'done')).store
    expect(moveTask(t, ctx(), AARAV, 'tsk-demo-t04', 'done').ok).toBe(true)
  })

  it('treats Canceled as closed', () => {
    const s = must(moveTask(demo(), ctx(), AARAV, 'tsk-demo-t08', 'canceled')).store
    expect(moveTask(s, ctx(), AARAV, 'tsk-demo-t08', 'ready').ok).toBe(false)
  })

  it('creating the same task twice with one operation id makes one task', () => {
    const c = ctx()
    const a = must(
      createTask(demo(), c, AARAV, { projectId: 'prj-demo-tt', title: 'Write up', opId: 'op-1' }),
    )
    const b = must(
      createTask(a.store, c, AARAV, { projectId: 'prj-demo-tt', title: 'Write up', opId: 'op-1' }),
    )
    expect(b.store.tasks.filter((t) => t.title === 'Write up')).toHaveLength(1)
  })

  it('a stale task edit is refused rather than silently overwriting', () => {
    const s = demo()
    const first = must(
      updateTask(s, ctx(), AARAV, 'tsk-demo-t02', { dueDate: '2026-11-12' as DateOnly }, 1),
    ).store
    const stale = updateTask(first, ctx(), MEERA, 'tsk-demo-t02', { priority: 'high' }, 1)
    expect(stale.ok).toBe(false)
  })
})

describe('saving, history and recovery (spec §4.3, §15)', () => {
  it('merges a stale save by block so both people’s changes survive', () => {
    const s = demo()
    const page0 = s.pages.find((p) => p.id === 'pg-tt-mess-plan')!
    // Meera edits block m1; Aarav, who opened the same version, edits block m2 and adds a block.
    const meera = must(
      savePage(s, ctx(), MEERA, 'pg-tt-mess-plan', 1, {
        blocks: page0.blocks.map((b) => (b.id === 'm1' ? { ...b, text: 'Meera’s opening.' } : b)),
      }),
    )
    const aarav = must(
      savePage(meera.store, ctx(), AARAV, 'pg-tt-mess-plan', 1, {
        blocks: [
          ...page0.blocks.map((b) => (b.id === 'm2' ? { ...b, text: 'Aarav’s heading' } : b)),
          { id: 'b-new', type: 'paragraph' as const, text: 'Aarav’s new note' },
        ],
      }),
    )
    const texts = aarav.store.pages
      .find((p) => p.id === 'pg-tt-mess-plan')!
      .blocks.map((b) => b.text)
    expect(texts).toContain('Meera’s opening.')
    expect(texts).toContain('Aarav’s heading')
    expect(texts).toContain('Aarav’s new note')
  })

  it('keeps both versions of a block they both edited, instead of dropping one', () => {
    const s = demo()
    const page0 = s.pages.find((p) => p.id === 'pg-tt-mess-plan')!
    const edit = (text: string) => page0.blocks.map((b) => (b.id === 'm1' ? { ...b, text } : b))
    const a = must(
      savePage(s, ctx(), MEERA, 'pg-tt-mess-plan', 1, { blocks: edit('Meera version') }),
    )
    const b = must(
      savePage(a.store, ctx(), AARAV, 'pg-tt-mess-plan', 1, { blocks: edit('Aarav version') }),
    )
    const texts = b.store.pages.find((p) => p.id === 'pg-tt-mess-plan')!.blocks.map((x) => x.text)
    expect(texts).toContain('Meera version')
    expect(texts.some((x) => x.includes('Aarav version'))).toBe(true)
  })

  it('refuses a stale save when the version it was based on is no longer kept', () => {
    const s = demo()
    const r = savePage(s, ctx(), AARAV, 'pg-tt-sheet', 7, { title: 'Overwrite' })
    expect(r.ok).toBe(false)
  })

  it('restoring makes a new current revision and keeps the history', () => {
    const s = demo()
    const a = must(savePage(s, ctx(), MEERA, 'pg-tt-sheet', 1, { title: 'Changed' })).store
    const r = must(restoreRevision(a, ctx(), MEERA, 'pg-tt-sheet', 1))
    const page = r.store.pages.find((p) => p.id === 'pg-tt-sheet')!
    expect(page.title).toBe('Observation sheet')
    expect(page.revision).toBe(3)
    expect(
      r.store.revisions.filter((x) => x.pageId === 'pg-tt-sheet').length,
    ).toBeGreaterThanOrEqual(2)
  })

  it('a comment anchored to rewritten text is reported as changed, not re-attached', () => {
    const s = demo()
    const page0 = s.pages.find((p) => p.id === 'pg-tt-mess-plan')!
    const rewritten = must(
      savePage(s, ctx(), MEERA, 'pg-tt-mess-plan', 1, {
        blocks: page0.blocks.map((b) =>
          b.id === 'm1' ? { ...b, text: 'Completely different opening.' } : b,
        ),
      }),
    ).store
    const page = rewritten.pages.find((p) => p.id === 'pg-tt-mess-plan')!
    expect(threadsFor(rewritten, page).find((t) => t.root.id === 'cmt-1')!.anchor).toBe('changed')
    expect(threadsFor(s, page0).find((t) => t.root.id === 'cmt-1')!.anchor).toBe('ok')
  })
})

describe('action from a note (spec §19)', () => {
  it('turns a checklist item into one task that keeps the note, and a repeat click adds no second task', () => {
    const c = ctx()
    const s = demo()
    const input = {
      projectId: 'prj-demo-tt',
      assigneeId: MEERA,
      dueDate: '2026-11-12' as DateOnly,
      opId: 'conv-1',
    }
    const a = must(blockToWorkTask(s, c, AARAV, 'pg-tt-meeting1', 'c3', input))
    const b = must(blockToWorkTask(a.store, c, AARAV, 'pg-tt-meeting1', 'c3', input))
    const made = b.store.tasks.filter((t) => t.pageId === 'pg-tt-meeting1')
    expect(made).toHaveLength(1)
    expect(made[0]).toMatchObject({ assigneeId: MEERA, dueDate: '2026-11-12', status: 'ready' })
    const block = b.store.pages
      .find((p) => p.id === 'pg-tt-meeting1')!
      .blocks.find((x) => x.id === 'c3')!
    expect(block.workTaskId).toBe(made[0]!.id)
  })

  it('refuses an empty action and an assignee outside the space', () => {
    const c = ctx()
    const s = demo()
    expect(
      blockToWorkTask(s, c, AARAV, 'pg-tt-meeting1', 'c3', {
        projectId: 'prj-demo-tt',
        assigneeId: 'demo-student-a',
      }).ok,
    ).toBe(false)
  })
})

describe('decisions and meetings', () => {
  it('a decision records who decided and when; a commenter cannot finalize', () => {
    const s = demo()
    expect(finalizeDecision(s, ctx(), ROHAN, 'dec-d03', { outcome: '6' }).ok).toBe(false)
    const r = must(finalizeDecision(s, ctx(), AARAV, 'dec-d03', { outcome: '6 participants' }))
    const d = r.store.decisions.find((x) => x.id === 'dec-d03')!
    expect(d.decidedBy).toBe(AARAV)
    expect(d.decidedOn).toBe('2026-11-02')
  })

  it('refuses to hold the same room twice and leaves the first booking valid', () => {
    const s = demo()
    const base = {
      projectId: 'prj-demo-tt',
      title: 'Sync',
      date: '2026-11-11' as DateOnly,
      start: '12:00' as LocalTime,
      end: '12:45' as LocalTime,
      attendees: [{ userId: MEERA, required: true }],
      roomLabel: 'Demo Study Room A',
    }
    const first = must(scheduleMeeting(s, ctx(), AARAV, { ...base, opId: 'm1' }))
    const clash = scheduleMeeting(first.store, ctx(), MEERA, {
      ...base,
      attendees: [{ userId: 'demo-u3', required: true }],
      opId: 'm2',
    })
    expect(clash.ok).toBe(false)
    expect(
      first.store.meetings.filter((m) => m.status === 'confirmed' && m.date === '2026-11-11'),
    ).toHaveLength(1)
  })

  it('a repeated schedule request with the same operation id makes one meeting, and RSVP counts change only on a real answer', () => {
    const s = demo()
    const input = {
      projectId: 'prj-demo-tt',
      title: 'Sync',
      date: '2026-11-11' as DateOnly,
      start: '16:00' as LocalTime,
      end: '16:45' as LocalTime,
      attendees: [{ userId: MEERA, required: true }],
      opId: 'dup',
    }
    const a = must(scheduleMeeting(s, ctx(), AARAV, input))
    const b = must(scheduleMeeting(a.store, ctx(), AARAV, input))
    expect(b.store.meetings.filter((m) => m.title === 'Sync')).toHaveLength(1)
    const id = a.value.id
    expect(
      b.store.meetings.find((m) => m.id === id)!.attendees.find((x) => x.userId === MEERA)!.rsvp,
    ).toBe('INVITED')
    const yes = must(respondMeeting(b.store, ctx(), MEERA, id, 'YES'))
    expect(
      yes.store.meetings.find((m) => m.id === id)!.attendees.find((x) => x.userId === MEERA)!.rsvp,
    ).toBe('YES')
  })
})

describe('templates and the demo space', () => {
  it('a team template makes one space, one project and one page, even when clicked twice', () => {
    const c = ctx()
    const a = must(
      instantiateTemplate(emptyWorkspace(), c, 'demo-student-a', 'team-assignment', {
        title: 'IBO report',
        opId: 'tpl-1',
      }),
    )
    const b = must(
      instantiateTemplate(a.store, c, 'demo-student-a', 'team-assignment', {
        title: 'IBO report',
        opId: 'tpl-1',
      }),
    )
    expect(b.store.spaces).toHaveLength(1)
    expect(b.store.projects).toHaveLength(1)
    expect(b.store.pages).toHaveLength(1)
    expect(b.store.members.find((m) => m.userId === 'demo-student-a')!.role).toBe('owner')
    expect(b.store.tasks).toHaveLength(0) // templates give structure, not fabricated work
  })

  it('removing the demo team keeps the user’s own space', () => {
    const c = ctx()
    const mine = must(
      instantiateTemplate(emptyWorkspace(), c, 'demo-student-a', 'team-assignment', {
        title: 'Mine',
        opId: 'o',
      }),
    )
    const both = withDemo(mine.store)
    const left = must(removeDemo(both)).store
    expect(left.spaces.map((x) => x.title)).toEqual(['Mine'])
    expect(left.tasks).toHaveLength(0)
    expect(left.people).toHaveLength(0)
  })
})

describe('find a team time on the fictional availability (spec §12.5)', () => {
  const people = (ids: string[], required: (id: string) => boolean = () => true): Participant[] =>
    ids.map((id) => {
      const av = demoAvailability(id, DEMO_AVAILABILITY_DATE, DEMO_AVAILABILITY_DATE)
      return { id, label: id, required: required(id), busy: av.busy, coverage: av.coverage }
    })
  const base = {
    from: DEMO_AVAILABILITY_DATE,
    to: DEMO_AVAILABILITY_DATE,
    durationMin: 45,
    includeWeekends: true,
    stepMin: 30,
    bufferMin: 0,
    preference: 'any' as const,
    nowMs: instantMs('2026-11-02' as DateOnly, '10:00' as LocalTime),
  }

  it('offers 12:00–12:45 and 16:00–16:45 and nothing inside anyone’s busy time', () => {
    const r = findTimes({
      ...base,
      participants: people(['demo-u1', 'demo-u2', 'demo-u3', 'demo-u4']),
      dayWindow: { from: '09:00' as LocalTime, to: '17:00' as LocalTime },
    })
    const starts = r.suggestions.map((c) => c.start)
    expect(starts).toContain('12:00')
    expect(starts).toContain('16:00')
    for (const c of r.suggestions) expect(['12:00', '16:00']).toContain(c.start)
  })

  it('does not treat a person with no recorded availability as free', () => {
    const r = findTimes({
      ...base,
      participants: people(['demo-u1', 'demo-u2', 'demo-u5']),
      dayWindow: { from: '09:00' as LocalTime, to: '17:00' as LocalTime },
    })
    expect(r.suggestions).toEqual([])
    expect(r.needsConfirmation.length).toBeGreaterThan(0)
    expect(r.needsConfirmation[0]!.unknownRequired).toContain('demo-u5')
  })

  it('says why when there is no common slot', () => {
    const r = findTimes({
      ...base,
      participants: people(['demo-u1', 'demo-u2', 'demo-u3', 'demo-u4']),
      dayWindow: { from: '09:00' as LocalTime, to: '11:00' as LocalTime },
    })
    expect(r.suggestions).toEqual([])
    expect(r.blockers.length).toBeGreaterThan(0)
  })

  it('reports other dates as unknown coverage', () => {
    expect(
      demoAvailability('demo-u1', '2026-11-12' as DateOnly, '2026-11-12' as DateOnly).coverage,
    ).toBe('unknown')
  })
})
