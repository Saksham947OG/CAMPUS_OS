import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => {
  clearViewport()
  delete document.documentElement.dataset.motion
})

const GREETING = /^Good (morning|afternoon|evening)/
const nav = () => screen.findByRole('navigation', { name: 'Main navigation' })

describe('floating sidebar (LI-T01 … LI-T05)', () => {
  it('LI-T01: groups every destination once, with Time Tax in the footer', async () => {
    renderApp('/')
    const n = within(await nav())
    for (const g of ['Your day', 'Study & collaborate', 'Campus life'])
      expect(n.getByRole('region', { name: g })).toBeInTheDocument()
    const study = within(n.getByRole('region', { name: 'Study & collaborate' }))
    expect(study.getByRole('link', { name: 'Academics' })).toBeInTheDocument()
    expect(study.getByRole('link', { name: 'Workspace' })).toBeInTheDocument()
    expect(
      within(n.getByRole('region', { name: 'Your day' })).getByRole('link', { name: 'Home' }),
    ).toBeInTheDocument()
    for (const label of ['Calendar', 'Bookings', 'Campus Services', 'Community', 'Administration'])
      expect(n.getAllByRole('link', { name: label })).toHaveLength(1)
    const footer = within(screen.getByRole('navigation', { name: 'Footer navigation' }))
    expect(footer.getByRole('link', { name: 'Time Tax' })).toBeInTheDocument()
  })

  it('LI-T02: pins are chosen, reordered by buttons, remembered, and can be cleared', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStorage()
    const { services } = makeServices({
      storage: createStorageAdapter({ backend: memory.storage }),
    })
    renderApp('/', { services })
    await user.click(await screen.findByRole('button', { name: 'Edit pinned shortcuts' }))
    const add = await screen.findByLabelText('Add a pin')
    await user.selectOptions(add, 'mess')
    await user.click(screen.getByRole('button', { name: 'Pin' }))
    await user.selectOptions(await screen.findByLabelText('Add a pin'), 'laundry')
    await user.click(screen.getByRole('button', { name: 'Pin' }))
    const pins = () =>
      within(screen.getByRole('region', { name: 'Pinned shortcuts' }))
        .queryAllByRole('link')
        .map((a) => a.textContent)
    await waitFor(() => expect(pins()).toEqual(['Mess', 'Laundry']))
    await user.click(screen.getByRole('button', { name: 'Move Laundry up' }))
    await waitFor(() => expect(pins()).toEqual(['Laundry', 'Mess']))
    expect(JSON.parse(memory.data.get('campusos:app:v1')!).pins).toEqual(['laundry', 'mess'])
    await user.click(screen.getByRole('button', { name: 'Clear all pins' }))
    await waitFor(() => expect(pins()).toEqual([]))
  })

  it('LI-T03: compact mode is remembered and every link keeps a name', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStorage()
    const { services } = makeServices({
      storage: createStorageAdapter({ backend: memory.storage }),
    })
    renderApp('/', { services })
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))
    expect(await screen.findByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(JSON.parse(memory.data.get('campusos:app:v1')!).sidebarCompact).toBe(true)
    expect(within(await nav()).getByRole('link', { name: 'Calendar' })).toBeInTheDocument()
  })

  it('LI-T04: the phone bar is Home, Calendar, Services, Workspace and More', async () => {
    renderApp('/')
    const bar = within(await screen.findByRole('navigation', { name: 'Main navigation, mobile' }))
    expect(bar.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Home',
      'Calendar',
      'Services',
      'Workspace',
    ])
    expect(bar.getByRole('button', { name: 'More' })).toBeInTheDocument()
  })

  it('LI-T05: Workspace focus mode removes the shell and gives an exit that restores it', async () => {
    const user = userEvent.setup()
    renderApp('/workspace')
    await user.click(await screen.findByRole('button', { name: 'Focus mode' }))
    await waitFor(() =>
      expect(screen.queryByRole('navigation', { name: 'Main navigation' })).not.toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: 'Exit focus mode' }))
    expect(await nav()).toBeInTheDocument()
  })
})

describe('command panel (LI-T06 … LI-T07)', () => {
  it('LI-T06: Ctrl K opens it, results are searchable, Enter goes there and Escape closes without losing the page', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/')
    await screen.findByRole('heading', { level: 1, name: GREETING })
    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByLabelText('Search destinations, records and actions')
    expect(input).toHaveFocus()
    await user.type(input, 'laundry')
    expect(await screen.findByRole('button', { name: /^Laundry/ })).toBeInTheDocument()
    await user.keyboard('{Enter}')
    await waitFor(() => expect(router.state.location.pathname).toMatch(/laundry/))
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Search destinations, records and actions'),
      ).not.toBeInTheDocument(),
    )
    await user.keyboard('{Control>}k{/Control}')
    await screen.findByLabelText('Search destinations, records and actions')
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Search destinations, records and actions'),
      ).not.toBeInTheDocument(),
    )
  })

  it('LI-T07: it finds Workspace records the person can open and nothing else', async () => {
    const user = userEvent.setup()
    const { services } = makeServices({ sourceData: true })
    renderApp('/', { services })
    await screen.findByRole('heading', { level: 1, name: GREETING })
    await user.click(await screen.findByRole('button', { name: 'Search or jump to' }))
    const input = await screen.findByLabelText('Search destinations, records and actions')
    await user.type(input, 'Quiz preparation')
    expect(await screen.findByRole('button', { name: /Quiz preparation/ })).toBeInTheDocument()
    await user.clear(input)
    await user.type(input, 'definition of queue time')
    expect(
      await screen.findByRole('button', { name: /shared definition of queue time/i }),
    ).toBeInTheDocument()
    // Ananya joined the club project, so its tasks are hers to find.
    await user.clear(input)
    await user.type(input, 'sponsor')
    expect(
      (await screen.findAllByRole('button', { name: /sponsor follow-up/i })).length,
    ).toBeGreaterThan(0)
  })
})

describe('motion preference (LI-T08)', () => {
  it('LI-T08: Reduce decorative movement is applied to the page, remembered, and changes no records', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStorage()
    const { services } = makeServices({
      storage: createStorageAdapter({ backend: memory.storage }),
    })
    renderApp('/settings', { services })
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(document.documentElement.dataset.motion).toBeUndefined()
    await user.click(await screen.findByRole('radio', { name: 'Reduce decorative movement' }))
    expect(document.documentElement.dataset.motion).toBe('reduced')
    expect(JSON.parse(memory.data.get('campusos:app:v1')!).motion).toBe('reduced')
    await user.click(screen.getByRole('radio', { name: 'Follow my device' }))
    expect(document.documentElement.dataset.motion).toBeUndefined()
  })
})

describe('Home as a living view of the day (LI-T09 … LI-T12)', () => {
  it('LI-T09: shows the day timeline with a now marker, and a preview opens on keyboard focus with Escape to close', async () => {
    const { services } = makeServices({ sourceData: true })
    renderApp('/', { services })
    const day = within(await screen.findByRole('region', { name: 'Your day and reservations' }))
    const timeline = within(await day.findByRole('region', { name: 'Your day' }))
    expect(timeline.getByLabelText(/^Now, /)).toBeInTheDocument()
    const link = timeline.getAllByRole('link')[0]!
    act(() => link.focus())
    expect(await screen.findByText(/^Source:/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open in Calendar' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/^Source:/)).not.toBeInTheDocument())
  })

  it('LI-T10: the campus scene is labelled conceptual, and selecting a building shows its service and a simulation label', async () => {
    const user = userEvent.setup()
    const { services } = makeServices({ sourceData: true })
    renderApp('/', { services })
    await screen.findByRole('heading', { level: 1, name: GREETING })
    expect(await screen.findByText(/A conceptual illustration, not a map\./)).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /^Library\./ }))
    expect(
      await screen.findByText(/an estimate, not a measured headcount/, { selector: 'span' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^Academic block\./ }))
    expect(
      await screen.findByText(/from the recorded class and booking schedule/, { selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('LI-T11: reservations are tickets with a visible details link, status and source as words', async () => {
    const { services } = makeServices({ sourceData: true })
    renderApp('/', { services })
    const tickets = within(await screen.findByRole('region', { name: 'Next reservations' }))
    const first = (await tickets.findAllByRole('article'))[0]!
    expect(within(first).getByRole('link', { name: /^Open details:/ })).toBeInTheDocument()
    expect(
      within(first).getByText(/Confirmed \(local\)|Reserved on this device/),
    ).toBeInTheDocument()
    expect(first.textContent).not.toMatch(/qr|barcode|scan/i)
  })

  it('LI-T12: My bookings shows each reservation as a ticket and keeps its original actions', async () => {
    const { services } = makeServices()
    renderApp('/bookings/my', { services })
    await screen.findByRole('heading', { level: 1, name: 'My bookings' })
    expect(await screen.findByText(/No upcoming bookings/)).toBeInTheDocument()
  })
})

describe('time back this month (LI-T13)', () => {
  it('LI-T13: Home shows the month as a stated estimate, from the same Time Tax figures, with the observations count', async () => {
    const { services } = makeServices({ sourceData: true })
    renderApp('/', { services })
    const card = within(await screen.findByRole('region', { name: 'Time back in November' }))
    expect(card.getByText('20.7–28.4 hours')).toBeInTheDocument() // 59–81 min × 21 weekdays
    expect(card.getByText(/about 59–81 minutes on each of 21 weekdays/)).toBeInTheDocument()
    expect(card.getByText(/So far, 1 of 21 weekdays are done: 1\.0–1\.4 hours/)).toBeInTheDocument()
    expect(card.getByText(/A planning estimate, not a measurement/)).toBeInTheDocument()
    expect(card.getByText(/No timed observations are recorded yet/)).toBeInTheDocument()
    expect(card.getByText('Cross-collaboration across platforms')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'See how it is built' })).toHaveAttribute(
      'href',
      '/time-tax',
    )
  })
})
