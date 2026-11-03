import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { withPersonaWorkspace } from '@/data/seeds/demo/workspace-demo'
import { compositeRange, personaEvidence } from '@/data/campus/evidence'
import { emptyWorkspace } from '@/domain/workspace'
import { pendingInvites } from '@/domain/workspace-logic'
import { collaborationCounts, readablePages } from '@/selectors/workspace'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('sample content built from the personas’ records (WS-T21 … WS-T24)', () => {
  it('WS-T21: every persona starts with notes, tasks, a shared project and evidence instead of an empty Workspace', async () => {
    const { services } = makeServices({ sourceData: true })
    expect(services.workspace.seeded).toBe(true)
    const ws = await services.workspace.load()
    for (const id of [A, B, C]) {
      expect(readablePages(ws, id).length).toBeGreaterThan(4)
      expect(ws.captures.some((c) => c.ownerId === id)).toBe(true)
      expect(ws.tasks.some((t) => t.assigneeId === id)).toBe(true)
      expect(ws.spaces.some((s) => s.id === `sp-me-${id}`)).toBe(true)
    }
    expect(ws.spaces.map((s) => s.id)).toEqual(expect.arrayContaining(['sp-team3', 'sp-club3']))
    expect(ws.meetings.length).toBeGreaterThan(1)
    expect(ws.polls.length).toBeGreaterThan(0)
    expect(ws.canvases.length).toBeGreaterThan(0)
    expect(ws.decisions.some((d) => d.outcome)).toBe(true)
  })

  it('WS-T22: notes use each persona’s own courses, and the evidence rows come from their Time Tax records', async () => {
    const { services } = makeServices({ sourceData: true })
    const ws = await services.workspace.load()
    const mine = (id: string) => readablePages(ws, id).map((p) => p.title)
    expect(mine(A).join(' | ')).toMatch(/Fundamentals of Mathematics/)
    expect(mine(B).join(' | ')).toMatch(/Introduction to Business Operations/)
    const claims = ws.sources.map((s) => s.claim)
    expect(claims).toContain('Abeer: lunch queue takes about 15 min')
    expect(claims.some((c) => c.startsWith('Ananya: ') && c.includes('lunch'))).toBe(true)
    // Only waits the sources report or estimate become evidence; planning assumptions never do.
    for (const row of ws.sources.filter((s) => s.id.startsWith('src-t3-demo-student')))
      expect(row.method).toMatch(/Reported|Estimate/)
    // A private note stays private: Abeer cannot open Ananya’s notes.
    expect(readablePages(ws, B).some((p) => p.id.startsWith('pg-a-'))).toBe(false)
  })

  it('WS-T23: Ananya already works in the club project with Abeer and Myra, and the seed can be added twice without duplicates', async () => {
    const once = withPersonaWorkspace(emptyWorkspace())
    expect(pendingInvites(once, A)).toHaveLength(0)
    expect(readablePages(once, A).some((p) => p.spaceId === 'sp-club3')).toBe(true)
    const twice = withPersonaWorkspace({ ...once, seedVersion: undefined })
    expect(twice.pages).toHaveLength(once.pages.length)
    expect(twice.tasks).toHaveLength(once.tasks.length)
    expect(twice.sources).toHaveLength(once.sources.length)
  })

  it('WS-T24: sample content can be removed on purpose and restored, and is not re-added behind your back', async () => {
    const user = userEvent.setup()
    const { services } = makeServices({ sourceData: true })
    renderApp('/workspace', { services })
    await screen.findByRole('heading', { level: 1, name: 'Workspace' })
    await user.click(await screen.findByRole('button', { name: 'Remove starter content' }))
    await user.click(await screen.findByRole('button', { name: 'Remove starter content' }))
    await waitFor(async () => expect((await services.workspace.load()).seedVersion).toBe('off'))
    expect((await services.workspace.load()).tasks).toHaveLength(0)
    await user.click(await screen.findByRole('button', { name: 'Restore the starter content' }))
    await waitFor(async () =>
      expect((await services.workspace.load()).tasks.length).toBeGreaterThan(5),
    )
  })
})

describe('Time Tax includes cross-collaboration (WS-T25 … WS-T26)', () => {
  it('WS-T25: collaboration is a counted process for every persona and adds a stated share to each total', () => {
    for (const [id, total] of [
      [A, [59, 81]],
      [B, [56, 84]],
      [C, [58, 85]],
    ] as const) {
      const rows = personaEvidence(id)
      const collab = rows.find((r) => r.id === 'collaboration')!
      expect(collab.includeInComposite).toBe(true)
      expect(collab.basis).toBe('illustrative') // a planning assumption, never reported or measured
      expect(compositeRange(rows)).toEqual(total)
      expect(compositeRange(rows.filter((r) => r.id !== 'collaboration'))).toEqual([
        total[0] - 6,
        total[1] - 12,
      ])
    }
  })

  it('WS-T26: the page counts the jobs Workspace holds, and the comparison recalculates from labelled assumptions', async () => {
    const user = userEvent.setup()
    const { services } = makeServices({ sourceData: true })
    renderApp('/time-tax', { services })
    const section = within(
      await screen.findByRole('region', { name: /Cross-collaboration: one place/ }),
    )
    expect(section.getByText('Agree a time')).toBeInTheDocument()
    expect(section.getByText(/Planning scenario:/)).toBeInTheDocument()
    expect(section.getByText(/not a measurement/)).toBeInTheDocument()
    const ws = await services.workspace.load()
    const c = collaborationCounts(ws, A)
    expect(c.sharedSpaces).toBe(2)
    expect(c.tasksAssignedToMe).toBeGreaterThan(0)

    const compare = within(
      await screen.findByRole('region', { name: 'Compare a process before and after' }),
    )
    const set = async (label: string, value: string) => {
      const input = compare.getByLabelText(label)
      await user.clear(input)
      await user.type(input, value)
    }
    await set('Wait today, minutes per use', '20')
    await set('Proposed wait, minutes per use', '5')
    await set('Uses per week', '3')
    expect(compare.getAllByText(/15 min per use · 45 min per week/).length).toBeGreaterThan(0)
    expect(compare.getByText(/Formula: \(today − proposed\) × uses per week/)).toBeInTheDocument()
    await set('Weeks it applies (optional)', '10')
    expect(compare.getAllByText(/450 min over 10 weeks/).length).toBeGreaterThan(0)
  })
})
