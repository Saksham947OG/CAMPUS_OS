import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { WORKSPACE_STORE_KEY } from '@/data/workspace/workspace-repository'
import { createCanvas } from '@/domain/workspace-ext'
import { addMember, createSpace, createTask } from '@/domain/workspace-logic'
import { roomOptions } from '@/features/workspace/team-helpers'
import type { DateOnly, LocalTime } from '@/lib/time'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST. The three personas are Student A, B and (no schedule).
const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

async function switchTo(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
  await user.click(await screen.findByRole('menuitemradio', { name }))
}

describe('cross-profile collaboration (WS-T11 … WS-T16)', () => {
  it('WS-T11: a task one persona assigns reaches the other as a notice, a Calendar deadline and a Home widget row', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    await services.workspace.loadTeamProject()
    const made = await services.workspace.mutate((s, c) =>
      createTask(s, c, A, {
        projectId: 'prj-team3',
        title: 'Check the laundry figures',
        assigneeId: B,
        dueDate: '2026-11-06' as DateOnly,
      }),
    )
    expect(made.ok).toBe(true)

    const inbox = await services.prefs.notifications.load(B)
    expect(inbox.value.items.some((i) => i.title === 'A task was assigned to you')).toBe(true)
    expect(
      (await services.prefs.notifications.load(A)).value.items.some(
        (i) => i.title === 'A task was assigned to you',
      ),
    ).toBe(false)

    const bData = await services.campus.load(B)
    expect(bData.deadlines.map((d) => d.title)).toContain('Team task: Check the laundry figures')
    expect((await services.campus.load(A)).deadlines.map((d) => d.title)).not.toContain(
      'Team task: Check the laundry figures',
    )

    renderApp('/', { services })
    await switchTo(user, /Reference Student B/)
    const widget = within(await screen.findByRole('region', { name: 'Workspace' }))
    expect(await widget.findByText('Check the laundry figures')).toBeInTheDocument()
  })

  it('WS-T12: an invited persona sees nothing until it accepts, then sees the space', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    const space = await services.workspace.mutate((s, c) =>
      createSpace(s, c, A, { type: 'project', title: 'Study pod', opId: 'pod' }),
    )
    if (!space.ok) throw new Error('setup')
    await services.workspace.mutate((s, c) => addMember(s, c, A, space.value.id, B, 'editor'))
    renderApp('/workspace', { services })
    await h1('Workspace')
    await switchTo(user, /Reference Student B/)
    const card = within(await screen.findByRole('region', { name: 'Invitations' }))
    expect(card.getByText(/invited you as editor/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Study pod/ })).not.toBeInTheDocument()
    await user.click(card.getByRole('button', { name: /Accept/ }))
    expect(await screen.findByRole('link', { name: /Study pod/ })).toBeInTheDocument()
  })

  it('WS-T13: the shared project can be added once and each persona gets their own assigned work', async () => {
    const user = userEvent.setup()
    renderApp('/workspace')
    await h1('Workspace')
    await user.click(
      await screen.findByRole('button', { name: /Add a project shared by the 3 personas/ }),
    )
    const mine = within(await screen.findByRole('region', { name: 'Assigned to me' }))
    expect(
      await mine.findByText('Write down our shared definition of queue time'),
    ).toBeInTheDocument()
    await switchTo(user, /Reference Student B/)
    await waitFor(async () => {
      const b = within(await screen.findByRole('region', { name: 'Assigned to me' }))
      expect(b.getByText('Collect gym and lunch waits')).toBeInTheDocument()
      expect(b.queryByText('Collect mess and laundry waits')).not.toBeInTheDocument()
    })
  })

  it('WS-T14: a meeting between real personas holds a room and appears in each persona’s Calendar, and rolls back on a clash', async () => {
    const { services } = makeServices()
    await services.workspace.loadTeamProject()
    const rooms = await services.classrooms.load()
    const span = {
      date: '2026-11-07' as DateOnly,
      start: '11:00' as LocalTime,
      end: '11:45' as LocalTime,
    }
    const opt = roomOptions(rooms, span, A, 3)[0]
    expect(opt).toBeDefined()
    const r = await services.workspace.scheduleTeamMeeting(A, {
      projectId: 'prj-team3',
      title: 'Group sync',
      ...span,
      attendees: [
        { userId: B, required: true },
        { userId: C, required: true },
      ],
      room: { room: opt!.room, groupSize: 3, verification: opt!.kind === 'unknown' },
      opId: 'sync-1',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value.calendarMeetingId).toBeDefined()
    expect(r.value.roomId).toBe(opt!.room.id)
    expect(
      (await services.meetings.load()).meetings.some((m) => m.id === r.value.calendarMeetingId),
    ).toBe(true)
    for (const p of [A, B, C]) {
      const bookings = (await services.campus.load(p)).bookings
      expect(bookings.some((b) => b.resource.includes('Group sync'))).toBe(true)
    }
    // The same room at the same time cannot be held twice; the team record is not created either.
    const again = await services.workspace.scheduleTeamMeeting(B, {
      projectId: 'prj-team3',
      title: 'Clash',
      ...span,
      attendees: [{ userId: A, required: false }],
      room: { room: opt!.room, groupSize: 2, verification: opt!.kind === 'unknown' },
      opId: 'sync-2',
    })
    expect(again.ok).toBe(false)
    expect(
      (await services.workspace.load()).meetings.filter((m) => m.title === 'Clash'),
    ).toHaveLength(0)
  })

  it('WS-T15: a save made in another tab of this browser reaches this one without a reload', async () => {
    const backend = window.localStorage
    const storage = createStorageAdapter({ backend })
    const { services } = makeServices({ storage })
    let seen = 0
    services.workspace.subscribe(() => seen++)
    window.dispatchEvent(
      new StorageEvent('storage', { key: WORKSPACE_STORE_KEY, storageArea: backend }),
    )
    expect(seen).toBe(1)
    window.dispatchEvent(
      new StorageEvent('storage', { key: 'campusos:other:v1', storageArea: backend }),
    )
    expect(seen).toBe(1) // another module's key is not Workspace's business
  })

  it('WS-T16: a canvas keeps text cards, lists everything as text, and saves each change', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    await services.workspace.mutate((s, c) =>
      createSpace(s, c, A, { type: 'project', title: 'Pod', opId: 'pod2' }),
    )
    const store = await services.workspace.load()
    const cv = await services.workspace.mutate((s, c) =>
      createCanvas(s, c, A, { spaceId: store.spaces[0]!.id, title: 'Ideas' }),
    )
    if (!cv.ok) throw new Error('setup')
    renderApp(`/workspace/canvases/${cv.value.id}`, { services })
    await h1('Ideas')
    await user.type(await screen.findByLabelText('Text'), 'Queue is not capacity')
    await user.click(screen.getByRole('button', { name: 'Add text card' }))
    const list = within(
      await screen.findByRole('region', { name: 'Everything on this canvas, as a list' }),
    )
    expect(await list.findByText('Queue is not capacity')).toBeInTheDocument()
    expect((await services.workspace.load()).canvases[0]!.cards).toHaveLength(1)
    const card = await screen.findByRole('button', { name: /Text card: Queue is not capacity/ })
    card.focus()
    await user.keyboard('{ArrowRight}')
    await waitFor(async () =>
      expect((await services.workspace.load()).canvases[0]!.cards[0]!.x).toBeGreaterThan(
        40 - 1 + 15,
      ),
    )
  })
})

describe('team polls in the interface (WS-T17)', () => {
  it('WS-T17: a poll is opened from suggestions, voted on, closed, re-checked and booked', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await h1('Workspace')
    await user.click((await screen.findAllByRole('button', { name: 'Load the demo team' }))[0]!)
    await screen.findByRole('option', { name: /Aarav Mehta \(demo member\)/ })
    await router.navigate('/workspace/projects/prj-demo-tt?tab=calendar')
    await user.click(await screen.findByRole('checkbox', { name: 'Rohan Das' }))
    await user.click(screen.getByRole('button', { name: 'Find times' }))
    await user.click(await screen.findByRole('button', { name: /Open a poll with these 2 times/ }))
    const polls = within(await screen.findByRole('region', { name: 'Time polls' }))
    expect(polls.getByText('Voting open')).toBeInTheDocument()
    const answer = polls.getAllByLabelText(/Your answer/)[0]!
    await user.selectOptions(answer, 'yes')
    await user.click(polls.getByRole('button', { name: 'Close voting' }))
    await user.click((await polls.findAllByRole('button', { name: 'Book this time' }))[0]!)
    await user.click(await screen.findByRole('button', { name: 'Confirm booking' }))
    expect(await polls.findByText('Booked')).toBeInTheDocument()
  })
})

describe('files and import in the interface (WS-T18 … WS-T19)', () => {
  it('WS-T18: a program is refused with the reason and nothing is stored', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    await services.workspace.mutate((s, c) =>
      createSpace(s, c, A, { type: 'project', title: 'Pod', opId: 'pod3' }),
    )
    const id = (await services.workspace.load()).spaces[0]!.id
    renderApp(`/workspace/spaces/${id}`, { services })
    await h1('Pod')
    const input = await screen.findByLabelText('Add files')
    await user.upload(input, new File(['MZ'], 'run.exe', { type: 'application/octet-stream' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/program or web page/)
    expect((await services.workspace.load()).attachments).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('WS-T19: a Markdown file is previewed first and only written when confirmed', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    renderApp('/workspace', { services })
    await h1('Workspace')
    const input = await screen.findByLabelText('Markdown files')
    await user.upload(
      input,
      new File(['# Lecture 4\n\n- [ ] read chapter\n\nSome text.'], 'lecture4.md', {
        type: 'text/markdown',
      }),
    )
    const preview = within(await screen.findByLabelText('Import preview'))
    expect(preview.getByText('Lecture 4')).toBeInTheDocument()
    expect((await services.workspace.load()).pages.some((p) => p.title === 'Lecture 4')).toBe(false) // nothing written yet
    await user.click(screen.getByRole('button', { name: /Import 1 page/ }))
    await waitFor(async () =>
      expect(
        (await services.workspace.load()).pages.some(
          (p) => p.title === 'Lecture 4' && p.importedFrom === 'lecture4.md',
        ),
      ).toBe(true),
    )
  })
})

describe('availability of the source-backed personas (WS-T20)', () => {
  it('WS-T20: a supplied dated schedule counts as recorded availability, so people are not all shown as unknown', async () => {
    const { services } = makeServices({ sourceData: true })
    for (const id of [A, B, C]) {
      const av = await services.meetings.availabilityOf(
        id,
        '2026-11-04' as DateOnly,
        '2026-11-06' as DateOnly,
      )
      expect(av.coverage).toBe('known')
      expect(av.busy.length).toBeGreaterThan(0)
    }
  })
})
