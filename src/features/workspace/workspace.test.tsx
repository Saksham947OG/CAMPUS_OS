import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

async function loadDemo(user: ReturnType<typeof userEvent.setup>) {
  await h1('Workspace')
  await user.click((await screen.findAllByRole('button', { name: 'Load the demo team' }))[0]!)
  await screen.findByRole('option', { name: /Aarav Mehta \(demo member\)/ })
}

describe('Workspace home (WS-T01 … WS-T03)', () => {
  it('WS-T01: starts empty and honest, with templates and a labelled local-only notice', async () => {
    renderApp('/workspace')
    await h1('Workspace')
    expect(
      await screen.findByText(/Start with a project, course notebook or quick note/),
    ).toBeInTheDocument()
    expect(screen.getByText(/saved in this browser/i)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Create team space.*Team assignment/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Viewing as/)).not.toBeInTheDocument() // no fictional collaborators until chosen
  })

  it('WS-T02: loading the demo team acts as a fictional member and shows assigned work from the canonical tasks', async () => {
    const user = userEvent.setup()
    renderApp('/workspace')
    await loadDemo(user)
    const assigned = within(await screen.findByRole('region', { name: 'Assigned to me' }))
    expect(await assigned.findByText('Identify likely bottleneck')).toBeInTheDocument()
    expect(screen.getByLabelText('Viewing as')).toHaveValue('demo-u1')
    expect(screen.getByText(/not a second signed-in person/)).toBeInTheDocument()
  })

  it('WS-T03: a quick capture lands in the inbox and can be filed as a private note', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await h1('Workspace')
    await user.type(await screen.findByLabelText('Quick capture'), 'Ask about the library slots')
    await user.click(screen.getByRole('button', { name: 'Capture' }))
    await router.navigate('/workspace/capture')
    expect(await screen.findByText('Ask about the library slots')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Make a note' }))
    await waitFor(() =>
      expect(screen.queryByText('Ask about the library slots')).not.toBeInTheDocument(),
    )
  })
})

describe('Team project (WS-T04 … WS-T07)', () => {
  it('WS-T04: moving a task changes the one record everywhere it is shown', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/projects/prj-demo-tt?tab=tasks')
    const move = await screen.findByLabelText('Move “Record mess peak window” to')
    await user.selectOptions(move, 'inProgress')
    const col = within(await screen.findByRole('region', { name: 'In progress' }))
    expect(await col.findByText('Record mess peak window', { selector: 'p' })).toBeInTheDocument()
    await router.navigate('/workspace')
    expect(await screen.findByText(/Identify likely bottleneck/)).toBeInTheDocument()
  })

  it('WS-T05: Done is refused while a prerequisite is open, with the reason', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/projects/prj-demo-tt?tab=tasks')
    await user.selectOptions(
      await screen.findByLabelText('Move “Clean paired observations” to'),
      'done',
    )
    expect(await screen.findByText(/Finish .*Record mess peak window.* first/)).toBeInTheDocument()
    const backlog = within(await screen.findByRole('region', { name: 'Backlog' }))
    expect(backlog.getByText('Clean paired observations', { selector: 'p' })).toBeInTheDocument()
  })

  it('WS-T06: a viewer sees the board but no way to change it', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await user.selectOptions(screen.getByLabelText('Viewing as'), 'demo-u5') // Rohan: viewer in Operations
    await router.navigate('/workspace/projects/prj-demo-ops?tab=tasks')
    expect(
      await screen.findByText(/can read the board and comment on pages, but not change tasks/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Add a task' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Move “Draft theory summary” to')).toBeDisabled()
  })

  it('WS-T07: find a team time offers the two real windows and holds the demo room', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/projects/prj-demo-tt?tab=calendar')
    await user.click(await screen.findByRole('checkbox', { name: 'Rohan Das' })) // no recorded availability: leave him out
    await user.click(screen.getByRole('button', { name: 'Find times' }))
    const found = within(await screen.findByRole('region', { name: 'Suggested times' }))
    expect(await found.findAllByText(/12:00|4:00/)).not.toHaveLength(0)
    await user.click(found.getAllByRole('button', { name: 'Choose this time' })[0]!)
    await user.click(await screen.findByRole('button', { name: 'Confirm meeting' }))
    expect(await screen.findByText(/Meeting scheduled for the team/)).toBeInTheDocument()
  })
})

describe('Pages, privacy and recovery (WS-T08 … WS-T10)', () => {
  it('WS-T08: editing a page saves on leaving the block and says where it was saved', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/pages/pg-tt-sheet')
    const first = await screen.findByLabelText(/Text block 1/)
    await user.click(first)
    await user.type(first, ' Added a column.')
    expect(screen.getByText(/Unsaved changes/)).toBeInTheDocument()
    await user.tab()
    expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument()
    await router.navigate('/workspace/pages/pg-tt-sheet')
    expect(await screen.findByDisplayValue(/Added a column\./)).toBeInTheDocument()
  })

  it('WS-T09: a teammate’s private page is not found by search, and opening it directly shows nothing about it', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/knowledge?q=scratchpad')
    expect((await screen.findAllByText(/Aarav's private scratchpad/)).length).toBeGreaterThan(0) // the author can find it
    await user.selectOptions(screen.getByLabelText('Viewing as'), 'demo-u2')
    expect(await screen.findByText(/Nothing you can open matches/)).toBeInTheDocument()
    await router.navigate('/workspace/pages/pg-tt-private')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not available' }),
    ).toBeInTheDocument()
    expect(screen.queryAllByText(/private scratchpad/i)).toHaveLength(0)
  })

  it('WS-T10: a failed save keeps the text on screen and offers a retry', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/workspace')
    await loadDemo(user)
    await router.navigate('/workspace/pages/pg-tt-sheet')
    const first = await screen.findByLabelText(/Text block 1/)
    await user.click(first)
    await user.type(first, ' Unsaved words.')
    // Another tab saves the page first, so this edit is now based on an old version.
    const spy = vi.spyOn(services.workspace, 'mutate').mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'storage',
        message: 'This device could not save that change, so nothing was changed.',
      },
    })
    await user.tab()
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/)
    expect(screen.getByDisplayValue(/Unsaved words\./)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument()
    spy.mockRestore()
  })
})
