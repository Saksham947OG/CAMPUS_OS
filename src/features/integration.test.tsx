import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Temporal } from 'temporal-polyfill'
import { createServices, type Services } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { parseDateOnly } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

const clock = { now: () => Temporal.Instant.from('2026-11-02T04:30:00Z') }
const make = (backend: Storage | null = createMemoryStorage().storage): Services => {
  let n = 0
  return createServices({
    sourceData: false,
    storage: createStorageAdapter({ backend }),
    clock,
    newId: (p) => `${p}-i${++n}`,
  })
}

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('C-T02 Month density', () => {
  it('"+N more" reveals every item for the day; nothing is dropped', async () => {
    const services = make()
    const day = parseDateOnly('2026-11-20')
    for (let i = 1; i <= 6; i++) {
      await services.campus.saveEvent('demo-student-a', {
        id: `ev-m${i}`,
        title: `Busy day item ${i}`,
        category: 'personal',
        date: day,
        timing: { kind: 'allDay' },
        blocksTime: false,
      })
    }
    renderApp(`/calendar?view=month&date=${day}`, { services })
    const user = userEvent.setup()
    await screen.findByRole('table')
    const more = (await screen.findAllByText(/^\+3 more/))
      .map((n) => n.closest('button')!)
      .find((b) => /Friday, 20 November/.test(b.textContent ?? ''))!
    expect(more).toBeTruthy()
    const cell = more.closest('td')!
    expect(within(cell).getAllByRole('button', { name: /Busy day item/ })).toHaveLength(3)
    await user.click(more)
    const panel = await screen.findByRole('tabpanel')
    await waitFor(() =>
      expect(within(panel).getAllByRole('button', { name: /Busy day item/ })).toHaveLength(6),
    )
  })
})

describe('C-T18 (partial) booking ownership', () => {
  it('a booking is a read-only reference: only "Manage booking" is offered, never delete or edit', async () => {
    renderApp(`/calendar?view=agenda&date=2026-11-02&event=bk-a-1%402026-11-03&panel=details`, {
      services: make(),
    })
    const details = await screen.findByRole('article', {
      name: /Details: Sample badminton court 1/,
    })
    expect(
      within(details).getByRole('link', { name: /Manage booking \(coming later\)/ }),
    ).toBeInTheDocument()
    expect(within(details).queryByRole('button', { name: /^Edit|Delete/ })).not.toBeInTheDocument()
    expect(
      within(details).getByText(/managed in the Bookings module, which is not built yet/),
    ).toBeInTheDocument()
  })
})

describe('C-T28 reset separation and C-A25 Reset demo', () => {
  it('Clear filters never deletes records; Reset demo needs confirmation, can be cancelled, and then restores the seed', async () => {
    const services = make()
    await services.campus.saveTask('demo-student-a', {
      id: 'task-a-reading',
      title: 'Read sample chapter',
      state: 'personallyCompleted',
      subtasks: [],
      dueDate: parseDateOnly('2026-11-02'),
    })
    await services.campus.saveEvent('demo-student-a', {
      id: 'ev-keep',
      title: 'My own event',
      category: 'personal',
      date: parseDateOnly('2026-11-03'),
      timing: { kind: 'allDay' },
      blocksTime: false,
    })

    renderApp('/settings', { services })
    const user = userEvent.setup()
    const card = (await screen.findByRole('heading', { name: 'Reset reference data' })).closest(
      'section',
    )!
    expect(within(card).getByText(/never delete anything you created/)).toBeInTheDocument()

    // Cancel: nothing happens.
    await user.click(within(card).getByRole('button', { name: /Reset reference data/ }))
    let confirm = await screen.findByRole('dialog')
    expect(within(confirm).getByText(/cannot be undone/)).toBeInTheDocument()
    expect(within(confirm).getByText(/every/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      (await services.campus.load('demo-student-a')).events.some((e) => e.id === 'ev-keep'),
    ).toBe(true)

    // Confirm: user data is gone, seed restored.
    await user.click(within(card).getByRole('button', { name: /Reset reference data/ }))
    confirm = await screen.findByRole('dialog')
    await user.click(within(confirm).getByRole('button', { name: 'Reset reference data' }))
    await waitFor(async () => {
      const data = await services.campus.load('demo-student-a')
      expect(data.events.some((e) => e.id === 'ev-keep')).toBe(false)
      expect(data.tasks.find((t) => t.id === 'task-a-reading')?.state).toBe('notStarted')
    })
  })

  it('Data sources panel states what is sample, what is personal and that nothing is supplied yet', async () => {
    renderApp('/settings', { services: make() })
    const panel = (
      await screen.findByRole('heading', { name: 'Data sources on this profile' })
    ).closest('section')!
    expect(within(panel).getByText(/No supplied data has been imported yet/)).toBeInTheDocument()
    expect(within(panel).getByText('No import warnings.')).toBeInTheDocument()
    expect(within(panel).getAllByText(/^0 records$/).length).toBeGreaterThan(0) // supplied
  })
})

describe('error and degraded states', () => {
  it('a failed load shows an actionable error (not a blank page) and Try again recovers', async () => {
    const real = make()
    let fail = true
    const services: Services = {
      ...real,
      campus: {
        ...real.campus,
        load: async (id) => {
          if (fail) throw new Error('Simulated read failure')
          return real.campus.load(id)
        },
      },
    }
    renderApp('/calendar', { services })
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText('Your records could not be loaded')).toBeInTheDocument()
    expect(within(alert).getByText(/Simulated read failure/)).toBeInTheDocument()
    fail = false
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }))
    expect(await screen.findByRole('button', { name: 'Week' })).toBeInTheDocument()
  })

  it('without browser storage, changes still work for the session and the app says exactly that', async () => {
    const services = make(null)
    renderApp('/calendar?view=agenda&date=2026-11-02', { services })
    const user = userEvent.setup()
    expect(
      await screen.findByText(
        /Browser storage is unavailable, so changes are kept in temporary memory/,
      ),
    ).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Personal event' }))
    const d = await screen.findByRole('dialog')
    await user.type(within(d).getByLabelText('Title'), 'Session only')
    fireEvent.change(within(d).getByLabelText('Date'), { target: { value: '2026-11-04' } })
    await user.click(within(d).getByLabelText('All day'))
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await screen.findAllByText(/kept for this session only/)).not.toHaveLength(0)
    expect(screen.queryByText(/saved on this device/)).not.toBeInTheDocument() // never a false "Saved"
    expect((await screen.findAllByRole('button', { name: /Session only/ })).length).toBeGreaterThan(
      0,
    )
  })

  it('a corrupt saved-data blob is reported, left in place, and does not stop the app', async () => {
    const memory = createMemoryStorage({ 'campusos:domain:v1:demo-student-a': '{not json' })
    renderApp('/calendar', { services: make(memory.storage) })
    expect(await screen.findByText('Some records were not shown')).toBeInTheDocument()
    expect(
      screen.getByText(/could not be read, so it is not shown. It was not deleted/),
    ).toBeInTheDocument()
    expect(memory.data.get('campusos:domain:v1:demo-student-a')).toBe('{not json')
  })
})
