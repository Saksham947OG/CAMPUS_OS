import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Temporal } from 'temporal-polyfill'
import { z } from 'zod'
import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { parseLocalTime } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

const t = parseLocalTime
const MON = '2026-11-02'
const dialog = () => screen.findByRole('dialog')
const setField = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

function env(nowIso = '2026-11-02T04:30:00Z') {
  const memory = createMemoryStorage()
  let current = nowIso
  const clock = { now: () => Temporal.Instant.from(current) }
  let n = 0
  const services = createServices({
    storage: createStorageAdapter({ backend: memory.storage }),
    clock,
    newId: (p) => `${p}-t${++n}`,
  })
  return { services, memory, setNow: (iso: string) => (current = iso) }
}

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('creating and validating personal events', () => {
  it('C-A08: + Add → Personal event creates one profile-owned record that appears in the views and persists', async () => {
    const { services, memory } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Personal event' }))
    const d = await dialog()
    await user.type(within(d).getByLabelText('Title'), 'Library visit')
    setField(within(d).getByLabelText('Date'), '2026-11-03')
    setField(within(d).getByLabelText('Start time'), '16:00')
    setField(within(d).getByLabelText('End time'), '17:00')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(
      (await screen.findAllByRole('button', { name: /Personal event: Library visit/ })).length,
    ).toBe(1)
    expect(memory.data.get('campusos:domain:v1:demo-student-a')).toContain('Library visit')
    expect(memory.data.get('campusos:domain:v1:demo-student-b')).toBeUndefined()
  })

  it('C-A09 / C-T25: invalid input keeps the draft, shows field errors and writes nothing', async () => {
    const { services, memory } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Personal event' }))
    const d = await dialog()
    await user.type(within(d).getByLabelText('Location (optional)'), 'Somewhere')
    setField(within(d).getByLabelText('Date'), '2026-11-03')
    setField(within(d).getByLabelText('Start time'), '10:00')
    setField(within(d).getByLabelText('End time'), '09:00')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await within(d).findByText('Title is required')).toBeInTheDocument()
    expect(within(d).getByText('End time must be after the start time')).toBeInTheDocument()
    expect(within(d).getByLabelText('Location (optional)')).toHaveValue('Somewhere') // draft preserved
    expect(within(d).getByLabelText('Title')).toHaveAttribute('aria-invalid', 'true')
    expect(memory.data.size).toBe(0)
  })

  it('an empty end time is not guessed: the student must choose it', async () => {
    const { services } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Personal event' }))
    const d = await dialog()
    await user.type(within(d).getByLabelText('Title'), 'No end yet')
    setField(within(d).getByLabelText('Date'), '2026-11-03')
    setField(within(d).getByLabelText('Start time'), '10:00')
    await user.click(within(d).getByRole('button', { name: 'Save' }))
    expect(await within(d).findByText(/Choose an end time/)).toBeInTheDocument()
  })

  it('C-A18: an overlapping personal event warns, offers a gap, and saves anyway only by choice (nothing moves)', async () => {
    const { services } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Add' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Personal event' }))
    const d = await dialog()
    await user.type(within(d).getByLabelText('Title'), 'Overlapping plan')
    setField(within(d).getByLabelText('Date'), MON)
    setField(within(d).getByLabelText('Start time'), '09:30')
    setField(within(d).getByLabelText('End time'), '10:30')
    expect(await within(d).findByText('This overlaps another commitment')).toBeInTheDocument()
    expect(within(d).getByText(/Sample Course A — lecture/)).toBeInTheDocument()

    await user.click(within(d).getByRole('button', { name: 'Find candidate gap' }))
    expect(
      within(d).getAllByRole('button', { name: /Open on your CampusOS calendar/ }).length,
    ).toBeGreaterThan(0)

    await user.click(within(d).getByRole('button', { name: 'Save anyway' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // Both commitments are still there, unchanged.
    expect(
      (await screen.findAllByRole('button', { name: /Overlapping plan/ })).length,
    ).toBeGreaterThanOrEqual(1)
    expect(
      screen.getAllByRole('button', {
        name: /Class: Sample Course A — lecture.*overlaps another commitment/,
      }).length,
    ).toBeGreaterThan(0)
  })

  it('C-T17: sample/supplied classes offer no edit or delete, only personal additions', async () => {
    const { services } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(
      (await screen.findAllByRole('button', { name: /Class: Sample Course A — lecture/ }))[0]!,
    )
    const details = await screen.findByRole('article', { name: /Details: Sample Course A/ })
    expect(within(details).queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument()
    expect(within(details).queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument()
    expect(within(details).getByText(/cannot be edited here/)).toBeInTheDocument()
    expect(
      within(details).getByRole('button', { name: /Add preparation task/ }),
    ).toBeInTheDocument()
  })
})

describe('recurring personal events', () => {
  it('C-A10 / C-T05: deleting "this occurrence" cancels only that one; the rest of the series stays', async () => {
    const { services } = env()
    await services.campus.saveSeries('demo-student-a', {
      id: 'series-mine',
      title: 'Weekly review',
      category: 'personal',
      timing: { kind: 'timed', start: t('18:00'), end: t('19:00') },
      blocksTime: true,
      rule: {
        freq: 'weekly',
        interval: 1,
        startDate: MON as never,
        endDate: '2026-12-28' as never,
      },
    })
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await waitFor(() => expect(document.querySelector('main ol')).not.toBeNull())
    const agenda = () => within(document.querySelector('main ol') as HTMLElement)
    const rows = await agenda().findAllByRole('button', { name: /Personal event: Weekly review/ })
    expect(rows.length).toBeGreaterThanOrEqual(1)
    await user.click(rows[0]!)
    await user.click(await screen.findByRole('button', { name: /^Delete/ }))
    const confirm = await dialog()
    expect(
      within(confirm).queryByText(/this and following/i, { selector: 'button' }),
    ).not.toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'This occurrence' }))
    await waitFor(() =>
      expect(
        agenda().getAllByRole('button', { name: /Personal event: Weekly review.*cancelled/i })
          .length,
      ).toBe(1),
    )
    const all = agenda().getAllByRole('button', { name: /Personal event: Weekly review/ })
    expect(all.length).toBe(rows.length) // still listed (subdued), nothing else cancelled
    expect(all.filter((r) => /cancelled/i.test(r.getAttribute('aria-label') ?? '')).length).toBe(1)
  })
})

describe('Task Panel and focus blocks (C-T11, C-T13)', () => {
  it('schedules a focus block from a task; deleting the block keeps the task', async () => {
    const { services } = env()
    renderApp(`/calendar?view=week&date=${MON}&panel=tasks`, { services })
    const user = userEvent.setup()
    const card = (
      await within(await screen.findByRole('tabpanel')).findByText('Read sample chapter')
    ).closest('li')!
    await user.click(within(card).getByRole('button', { name: /Schedule time/ }))
    const d = await dialog()
    expect(within(d).getByLabelText('Linked task (optional)')).toHaveValue('task-a-reading')
    setField(within(d).getByLabelText('Date'), '2026-11-03')
    setField(within(d).getByLabelText('Start time'), '21:00')
    await user.click(within(d).getByRole('button', { name: '60 min' })) // end follows the chosen duration
    expect(within(d).getByLabelText('End time')).toHaveValue('22:00')
    await user.click(within(d).getByRole('button', { name: 'Save focus block' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(/Planned sessions:/)).toBeInTheDocument()
    const data = await services.campus.load('demo-student-a')
    expect(data.focusBlocks).toHaveLength(1)

    await services.campus.deleteFocusBlock('demo-student-a', data.focusBlocks[0]!.id)
    await waitFor(() => expect(screen.queryByText(/Planned sessions:/)).not.toBeInTheDocument())
    expect(
      (await services.campus.load('demo-student-a')).tasks.find((x) => x.id === 'task-a-reading')
        ?.state,
    ).toBe('notStarted')
  })

  it('completing a task with planned sessions asks to keep or remove them; keeping leaves the sessions', async () => {
    const { services } = env()
    await services.campus.saveFocusBlock('demo-student-a', {
      id: 'fb-1',
      taskId: 'task-a-reading',
      title: 'Work on: Read sample chapter',
      date: '2026-11-03' as never,
      start: t('21:00'),
      end: t('22:00'),
    })
    renderApp(`/calendar?view=week&date=${MON}&panel=tasks`, { services })
    const user = userEvent.setup()
    const card = (
      await within(await screen.findByRole('tabpanel')).findByText('Read sample chapter')
    ).closest('li')!
    await user.click(within(card).getByRole('checkbox', { name: /personally completed/ }))
    const confirm = await dialog()
    expect(within(confirm).getByText(/Keep your planned work sessions/)).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Keep sessions' }))
    await waitFor(async () =>
      expect(
        (await services.campus.load('demo-student-a')).tasks.find((x) => x.id === 'task-a-reading')
          ?.state,
      ).toBe('personallyCompleted'),
    )
    expect((await services.campus.load('demo-student-a')).focusBlocks).toHaveLength(1)
  })

  it('C-T12: ticking every checklist item never marks anything officially submitted', async () => {
    const { services } = env()
    renderApp(`/calendar?view=week&date=${MON}&panel=tasks`, { services })
    const user = userEvent.setup()
    const card = (
      await within(await screen.findByRole('tabpanel')).findByText('Draft sample report outline')
    ).closest('li')!
    await user.click(within(card).getByRole('checkbox', { name: 'Collect two sources' }))
    await waitFor(() => expect(within(card).getByText(/Every item is ticked/)).toBeInTheDocument())
    expect(within(card).queryByText(/submitted/i)).toBeNull()
    expect(within(card).getByLabelText('Status of Draft sample report outline')).toHaveValue(
      'inProgress',
    ) // not auto-completed
  })
})

describe('reminders end to end (C-A21, C-A22)', () => {
  it('C-T19: a reminder that comes due while CampusOS is open appears once in the inbox with a real surfaced time', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setInterval', 'clearInterval'] })
    try {
      const e = env('2026-11-02T04:30:00Z') // 10:00 IST
      await e.services.campus.saveEvent('demo-student-a', {
        id: 'ev-soon',
        title: 'Soon event',
        category: 'personal',
        date: MON as never,
        timing: { kind: 'timed', start: t('10:20'), end: t('11:00') },
        blocksTime: true,
      })
      renderApp('/notifications', { services: e.services })
      expect(await screen.findByText(/No reminders have appeared yet/)).toBeInTheDocument()

      e.setNow('2026-11-02T04:36:00Z') // 10:06 IST: past the 10:05 trigger
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      expect(await screen.findByText('Reminder: Soon event')).toBeInTheDocument()
      expect(screen.getByText(/Triggered in-app at/)).toBeInTheDocument()

      // Later ticks do not duplicate it.
      e.setNow('2026-11-02T04:40:00Z')
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000)
      })
      expect(screen.getAllByText('Reminder: Soon event')).toHaveLength(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('C-T20 / C-A22: reopening after the trigger does not invent a delivery; due items are shown honestly instead', async () => {
    const e = env('2026-11-02T04:40:00Z') // 10:10 IST, after the 10:05 trigger
    await e.services.campus.saveEvent('demo-student-a', {
      id: 'ev-missed',
      title: 'Missed event',
      category: 'personal',
      date: MON as never,
      timing: { kind: 'timed', start: t('10:20'), end: t('11:00') },
      blocksTime: true,
    })
    renderApp('/notifications', { services: e.services })
    expect(await screen.findByText(/No reminders have appeared yet/)).toBeInTheDocument()
    expect(
      screen.getByText(/No alert was delivered for them while CampusOS was closed/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Review sample notes/)).toBeInTheDocument() // overdue task shown as due, not as a "sent" reminder
    const stored = e.services.storage.read('campusos:notifications:v1:demo-student-a', z.unknown())
    expect(stored.status).toBe('missing')
  })

  it('per-occurrence "Remind me" is honest about in-app-only delivery and persists', async () => {
    const { services } = env()
    renderApp(`/calendar?view=agenda&date=${MON}`, { services })
    const user = userEvent.setup()
    await user.click(
      (await screen.findAllByRole('button', { name: /Class: Sample Course A — lecture/ }))[0]!,
    )
    const section = await screen.findByRole('region', { name: 'Reminder' })
    expect(within(section).getByText(/never by push, email or SMS/)).toBeInTheDocument()
    await user.click(within(section).getByRole('checkbox', { name: 'Remind me' }))
    await waitFor(() =>
      expect(within(section).getByRole('combobox', { name: /How early/ })).toBeInTheDocument(),
    )
    expect(
      services.storage.read('campusos:reminders:v1:demo-student-a', z.unknown()),
    ).toMatchObject({ status: 'ok' })
  })
})
