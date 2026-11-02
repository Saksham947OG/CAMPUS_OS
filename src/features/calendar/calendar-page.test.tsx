import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// FIXED_NOW = Monday 2 Nov 2026, 10:00 IST. Section 1 has Course A on Mon/Wed 09:00.
const MON = '2026-11-02'
const button = (name: RegExp) => screen.findAllByRole('button', { name })

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('Calendar page', () => {
  it('C-D08: opens in Week and shows the current week with a deadline/all-day lane', async () => {
    renderApp(`/calendar?date=${MON}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
    expect(await button(/Class: Sample Course A — lecture/)).not.toHaveLength(0)
    expect(screen.getAllByText(/All day & due/i).length).toBeGreaterThan(0)
  })

  it('C-T01: the same source item appears in Month, Week, Day and Agenda for one date', async () => {
    renderApp(`/calendar?date=${MON}`)
    const user = userEvent.setup()
    for (const view of ['Week', 'Day', 'Agenda', 'Month']) {
      await user.click(await screen.findByRole('button', { name: view }))
      await waitFor(() =>
        expect(screen.getByRole('button', { name: view })).toHaveAttribute('aria-pressed', 'true'),
      )
      expect((await button(/Class: Sample Course A — lecture/)).length).toBeGreaterThan(0)
    }
  })

  it('C-T03: a date-only deadline reads "Due date only" and never shows an invented time', async () => {
    renderApp(`/calendar?view=agenda&date=${MON}`)
    const [row] = await button(/Assignment: Sample Assignment 1/)
    expect(row).toHaveAccessibleName(/Due date only/)
    expect(row).not.toHaveAccessibleName(/23:59|11:59/)
    await userEvent.click(row!)
    const details = await screen.findByRole('article', { name: /Details: Sample Assignment 1/ })
    expect(within(details).getByText(/Due date only \(no time given\)/)).toBeInTheDocument()
    expect(within(details).getByText('Tentative')).toBeInTheDocument()
    expect(within(details).getByText('Illustrative')).toBeInTheDocument()
  })

  it('C-T26: unknown fields read "Not provided" rather than being guessed', async () => {
    renderApp(`/calendar?view=agenda&date=${MON}`)
    const [row] = await button(/Class: Sample Course A — lecture/)
    await userEvent.click(row!)
    const details = await screen.findByRole('article', { name: /Details: Sample Course A/ })
    const instructor = within(details).getByText('Instructor').nextElementSibling!
    expect(instructor).toHaveTextContent('Not provided')
  })

  it('C-T05: a cancelled occurrence is shown as cancelled and stays addressable', async () => {
    // Section 1, Course B on Tuesday of next week is cancelled in the sample exceptions.
    renderApp(`/calendar?view=agenda&date=2026-11-10`)
    const rows = await button(/Sample Course B — lecture/)
    expect(rows.some((r) => /cancelled/i.test(r.getAttribute('aria-label') ?? ''))).toBe(true)
  })

  it('C-T16: a deep link to an event hidden by filters explains why and can reveal it without saving filters', async () => {
    const { services } = renderApp(
      `/calendar?view=agenda&date=2026-11-03&event=ev-club-meetup@2026-11-03&panel=details`,
    )
    expect(await screen.findByText('Hidden by filters')).toBeInTheDocument()
    expect(screen.getByText(/hidden by the current layers or preset/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show this event' }))
    await waitFor(() => expect(screen.queryByText('Hidden by filters')).not.toBeInTheDocument())
    expect(screen.getByRole('article', { name: /Details: Sample club meetup/ })).toBeInTheDocument()
    // Revealing is session-only: nothing was persisted.
    expect(services.storage.read('campusos:calendar:v1:demo-student-a', z.unknown())).toEqual({
      status: 'missing',
    })
  })

  it('shows a friendly missing-record state for an unknown deep link', async () => {
    renderApp(`/calendar?date=${MON}&event=nope@2026-11-02&panel=details`)
    expect(await screen.findByText('That record could not be found')).toBeInTheDocument()
  })

  it('C-T15 / C-A06: presets change visibility only and "Custom" appears after a manual change', async () => {
    renderApp(`/calendar?view=agenda&date=${MON}`)
    const user = userEvent.setup()
    expect(await button(/Class: Sample Course A — lecture/)).not.toHaveLength(0)
    await user.click(await screen.findByRole('radio', { name: 'Campus Life' }))
    await waitFor(() =>
      expect(
        screen.queryAllByRole('button', { name: /Class: Sample Course A — lecture/ }),
      ).toHaveLength(0),
    )
    // Records are untouched: switching back brings them back.
    await user.click(screen.getByRole('radio', { name: 'Balanced Campus' }))
    expect(await button(/Class: Sample Course A — lecture/)).not.toHaveLength(0)
    await user.click(screen.getByRole('checkbox', { name: 'Administration' }))
    expect(await screen.findByText(/Custom: your own combination/)).toBeInTheDocument()
  })

  it('shows a filtered-empty state distinct from a no-data state', async () => {
    renderApp(`/calendar?view=agenda&date=${MON}`)
    const user = userEvent.setup()
    await user.type(
      await screen.findByRole('searchbox', { name: /search the calendar/i }),
      'zzzz-nothing',
    )
    expect(await screen.findByText(/No events match these filters/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Clear all filters' })).toBeInTheDocument()
  })

  it('C-T10: the dining overlay shows serving windows as information, not as items', async () => {
    renderApp(`/calendar?view=day&date=${MON}`)
    const user = userEvent.setup()
    expect(screen.queryByText(/sample serving window/)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('checkbox', { name: /Show dining times on the grid/ }))
    expect((await screen.findAllByText(/sample serving window/)).length).toBeGreaterThan(0)
    // Never listed as a commitment in the agenda.
    expect(screen.queryByRole('button', { name: /Breakfast|Lunch|Dinner/ })).not.toBeInTheDocument()
  })

  it('persists the chosen view per profile across a reload (C-T24)', async () => {
    const first = renderApp(`/calendar?date=${MON}`)
    await userEvent.click(await screen.findByRole('button', { name: 'Month' }))
    await waitFor(() =>
      expect(
        first.services.storage.read('campusos:calendar:v1:demo-student-a', z.unknown()),
      ).toMatchObject({ status: 'ok' }),
    )
    first.unmount()
    renderApp('/calendar', { services: first.services })
    expect(await screen.findByRole('button', { name: 'Month' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('C-T27: view switcher and items are reachable and operable by keyboard alone', async () => {
    renderApp(`/calendar?view=agenda&date=${MON}`)
    const user = userEvent.setup()
    const [row] = await button(/Class: Sample Course A — lecture/)
    row!.focus()
    await user.keyboard('{Enter}')
    expect(
      await screen.findByRole('article', { name: /Details: Sample Course A/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Day' })).toBeVisible()
  })

  it('narrow screens swap the 7-column grid for a day strip', async () => {
    setViewport(375)
    renderApp(`/calendar?date=${MON}`)
    expect(await screen.findByRole('group', { name: 'Days of the week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Layers & filters/ })).toBeInTheDocument()
  })
})
