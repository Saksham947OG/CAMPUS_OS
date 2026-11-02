import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// FIXED_NOW = Monday 2 Nov 2026, 10:00 IST ("Good morning").
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const widget = (name: string) => screen.findByRole('region', { name })

describe('Home page', () => {
  it('H-T01: first visit shows greeting, date, default Agenda mode and the core widgets', async () => {
    renderApp('/')
    expect(
      await screen.findByRole('heading', { level: 1, name: /Good morning, Demo Student A/ }),
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Monday, 2 November 2026/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
    for (const name of ['Your schedule', 'Up next', 'Deadline focus', 'Quick actions']) {
      expect(await widget(name)).toBeInTheDocument()
    }
    expect(screen.getByTestId('briefing')).toHaveTextContent(/scheduled class/)
  })

  it('H-T02 / H-T03: Agenda and Week show the same records; selecting a day shows only that day', async () => {
    renderApp('/')
    const user = userEvent.setup()
    const schedule = await widget('Your schedule')
    expect(
      within(schedule).getAllByRole('link', { name: /Sample Course A — lecture/ }),
    ).toHaveLength(1)

    await user.click(within(schedule).getByRole('button', { name: 'Week' }))
    expect(
      within(schedule).getAllByRole('link', { name: /Sample Course A — lecture/ }),
    ).toHaveLength(1) // Monday selected

    await user.click(within(schedule).getByRole('button', { name: /^Wednesday/ }))
    const rows = within(schedule).getAllByRole('link')
    expect(
      rows.some((r) => /Sample Course A — lecture/.test(r.getAttribute('aria-label') ?? '')),
    ).toBe(true)
    expect(
      rows.every((r) => !/Sample project meeting/.test(r.getAttribute('aria-label') ?? '')),
    ).toBe(true)
  })

  it('H-T04: Today returns from any other date', async () => {
    renderApp('/')
    const user = userEvent.setup()
    const schedule = await widget('Your schedule')
    await user.click(within(schedule).getByRole('button', { name: 'Next day' }))
    await user.click(within(schedule).getByRole('button', { name: 'Next day' }))
    expect(within(schedule).queryByText('Today', { selector: 'span' })).not.toBeInTheDocument()
    await user.click(within(schedule).getByRole('button', { name: 'Today' }))
    expect(within(schedule).getByText('Today', { selector: 'span' })).toBeInTheDocument()
  })

  it('H-T02: the Agenda/Week choice persists per profile across a reload', async () => {
    const first = renderApp('/')
    const schedule = await widget('Your schedule')
    await userEvent.click(within(schedule).getByRole('button', { name: 'Week' }))
    await waitFor(() =>
      expect(
        first.services.storage.read('campusos:home:v1:demo-student-a', z.unknown()),
      ).toMatchObject({ status: 'ok' }),
    )
    first.unmount()
    renderApp('/', { services: first.services })
    expect(
      within(await widget('Your schedule')).getByRole('button', { name: 'Week' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('H-T06: a date-only deadline never shows an invented time', async () => {
    renderApp('/')
    const focus = await widget('Deadline focus')
    expect(within(focus).getAllByText(/\(date only\)/).length).toBeGreaterThan(0)
    expect(within(focus).queryByText(/23:59|11:59 pm/)).not.toBeInTheDocument()
  })

  it('H-T07 / C-T11 / C-T12: completing a task on Home is reflected in the Calendar and never becomes a submission', async () => {
    const memory = createMemoryStorage()
    const { services } = makeServices({
      storage: createStorageAdapter({ backend: memory.storage }),
    })
    const home = renderApp('/', { services })
    const focus = await widget('Deadline focus')
    expect(within(focus).getByText('Review sample notes')).toBeInTheDocument() // overdue task ranks first
    const [button] = within(focus).getAllByRole('button', { name: 'Mark personally completed' })
    await userEvent.click(button!)
    // Completed tasks rank after pending work, so it leaves the top three.
    await waitFor(() =>
      expect(within(focus).queryByText('Review sample notes')).not.toBeInTheDocument(),
    )
    expect(within(focus).queryByText(/submitted/i)).not.toBeInTheDocument()
    home.unmount()

    renderApp('/calendar?view=agenda&date=2026-11-01', { services })
    const rows = await screen.findAllByRole('button', {
      name: /Task: Review sample notes.*personally completed/i,
    })
    expect(rows.length).toBeGreaterThan(0)
  })

  it('double-clicking "Mark personally completed" completes once and does not toggle back', async () => {
    const { services } = makeServices()
    renderApp('/', { services })
    const focus = await widget('Deadline focus')
    const [button] = within(focus).getAllByRole('button', { name: 'Mark personally completed' })
    await userEvent.dblClick(button!)
    await waitFor(() =>
      expect(within(focus).queryByText('Review sample notes')).not.toBeInTheDocument(),
    )
    const stored = services.storage.read('campusos:domain:v1:demo-student-a', z.unknown())
    expect(stored).toMatchObject({ status: 'ok' })
    expect(JSON.stringify((stored as { value: unknown }).value)).toContain(
      '"state":"personallyCompleted"',
    )
    expect(JSON.stringify((stored as { value: unknown }).value)).not.toContain(
      '"state":"notStarted"',
    )
  })

  it('H-T09: quick actions are four unique real destinations, tagged honestly', async () => {
    renderApp('/')
    const qa = await widget('Quick actions')
    const links = within(qa).getAllByRole('link')
    expect(links.map((l) => l.textContent?.replace(/Coming later/, '').trim())).toEqual([
      'Chill Spot',
      'Laundry',
      'Bookings',
      'Mess',
    ])
    expect(new Set(links.map((l) => l.getAttribute('href'))).size).toBe(4)
    await userEvent.click(links[0]!)
    expect(await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })).toBeInTheDocument()
    expect(screen.getByText('Café status')).toBeInTheDocument()
  })

  it('H-T18: with no personal schedule the widgets show honest empty states', async () => {
    renderApp('/')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /demo profile/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /no schedule/ }))
    const focus = await widget('Deadline focus')
    await waitFor(() =>
      expect(
        within(focus).getByText('No deadlines found in the available records.'),
      ).toBeInTheDocument(),
    )
    expect(
      within(await widget('Up next')).getByText('No more scheduled timed events today.'),
    ).toBeInTheDocument()
  })

  it("H-T21: switching profile shows that profile's own tasks only", async () => {
    renderApp('/')
    const user = userEvent.setup()
    expect(
      within(await widget('Deadline focus')).getByText('Review sample notes'),
    ).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: /demo profile/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Demo Student B/ }))
    const focus = await widget('Deadline focus')
    await waitFor(() =>
      expect(within(focus).queryByText('Review sample notes')).not.toBeInTheDocument(),
    )
    expect(within(focus).getByText('Sample task for Student B')).toBeInTheDocument()
  })

  it('H-T22: Home rows link to the same canonical occurrence key the Calendar uses', async () => {
    renderApp('/')
    const schedule = await widget('Your schedule')
    const link = within(schedule).getByRole('link', { name: /Sample Course A — lecture/ })
    expect(link.getAttribute('href')).toContain('event=s1-course-a%402026-11-02')
  })

  it('H-T13: the schedule filter drawer only hides items and says so', async () => {
    renderApp('/')
    const user = userEvent.setup()
    const schedule = await widget('Your schedule')
    await user.click(within(schedule).getByRole('button', { name: /^Filter/ }))
    await user.click(await screen.findByRole('checkbox', { name: 'Classes & meetings' }))
    await waitFor(() =>
      expect(
        within(schedule).queryByRole('link', { name: /Sample Course A — lecture/ }),
      ).not.toBeInTheDocument(),
    )
    expect(within(schedule).getByText(/hidden by your schedule filters/)).toBeInTheDocument()
  })
})
