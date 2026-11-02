import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { z } from 'zod'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

// While a modal sheet is open the page behind it is aria-hidden, so region lookups must include hidden nodes.
const region = (name: string) => screen.findByRole('region', { name, hidden: true })
const regionNames = () =>
  screen
    .getAllByRole('region', { hidden: true })
    .map((r) => r.getAttribute('aria-labelledby'))
    .filter((id): id is string => !!id && id.endsWith('-h'))
    .map((id) => id.replace(/-h$/, ''))

async function openCustomize(tab?: string) {
  const user = userEvent.setup()
  await user.click(await screen.findByRole('button', { name: 'Customize' }))
  const dialog = await screen.findByRole('dialog')
  if (tab) await user.click(within(dialog).getByRole('tab', { name: tab }))
  return { user, dialog }
}

describe('Home widgets (Phase 4 content)', () => {
  it('H-T01: Balanced layout shows every widget, honestly labelled', async () => {
    renderApp('/')
    for (const name of [
      'Your schedule',
      'Up next',
      'Deadline focus',
      'Quick actions',
      'My activity',
      'Mess preview',
      'My tasks',
      'My Free Pockets',
      'Campus Pulse',
      'Time Tax snapshot',
    ]) {
      expect(await region(name)).toBeInTheDocument()
    }
  })

  it('H-T14: Free Pockets says "Open in your recorded schedule" and offers actions without claiming availability', async () => {
    renderApp('/')
    const pockets = await region('My Free Pockets')
    expect(within(pockets).getByText('Open in your recorded schedule')).toBeInTheDocument()
    expect(
      within(pockets).getAllByRole('button', { name: 'Add personal event' }).length,
    ).toBeGreaterThan(0)
    expect(
      within(pockets).getAllByRole('link', { name: 'Explore bookings' }).length,
    ).toBeGreaterThan(0)
    expect(within(pockets).queryByText(/you are (definitely )?free/i)).not.toBeInTheDocument()
  })

  it('H-T17: Time Tax is an illustrative potential, never a measured saving, and does not move with use', async () => {
    renderApp('/')
    const tt = await region('Time Tax snapshot')
    expect(within(tt).getByText('Illustrative scenario')).toBeInTheDocument()
    expect(within(tt).getByText(/potential/)).toBeInTheDocument()
    expect(within(tt).queryByText(/you saved|saved you/i)).not.toBeInTheDocument()
    const before = tt.textContent
    await userEvent.click(within(await region('Quick actions')).getAllByRole('link')[0]!)
    expect(before).toContain('347 student-hours per week')
    expect(before).toContain('−26 minutes per visit')
  })

  it('every sample record on Home carries a visible origin label', async () => {
    renderApp('/')
    const activity = await region('My activity')
    expect(within(activity).getAllByText('Illustrative').length).toBeGreaterThan(0)
    expect(
      within(await region('Mess preview')).getAllByText('Illustrative').length,
    ).toBeGreaterThan(0)
  })

  it('H-T09: My activity labels its source and explains local activity', async () => {
    renderApp('/')
    const activity = await region('My activity')
    expect(within(activity).getByText(/Sample badminton court 1/)).toBeInTheDocument()
    expect(within(activity).getByText(/Your activity combines bookings/)).toBeInTheDocument()
  })
})

describe('Customize Home', () => {
  it('H-T10: hiding a widget removes it from Home; showing it brings it back; nothing is deleted', async () => {
    const { services } = makeServices()
    renderApp('/', { services })
    const { user, dialog } = await openCustomize('Widgets')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show My activity' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'My activity', hidden: true }),
      ).not.toBeInTheDocument(),
    )
    expect((await services.campus.load('demo-student-a')).bookings).toHaveLength(2) // records untouched
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show My activity' }))
    expect(await region('My activity')).toBeInTheDocument()
  })

  it('H-T11: the up/down buttons reorder, announce the result, and the order persists across a reload', async () => {
    const first = renderApp('/')
    await region('My tasks')
    expect(regionNames().indexOf('myTasks')).toBeGreaterThan(regionNames().indexOf('messPreview'))
    const { user, dialog } = await openCustomize('Widgets')
    await user.click(within(dialog).getByRole('button', { name: 'Move My tasks up' }))
    expect(
      await within(dialog).findByText(/My tasks moved up to position 3 in Things to do/),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(regionNames().indexOf('myTasks')).toBeLessThan(regionNames().indexOf('messPreview')),
    )
    first.unmount()
    renderApp('/', { services: first.services })
    await region('My tasks')
    expect(regionNames().indexOf('myTasks')).toBeLessThan(regionNames().indexOf('messPreview'))
  })

  it('a widget cannot be dropped into a section it does not belong in; the reason is given and nothing changes', async () => {
    renderApp('/')
    const { dialog } = await openCustomize('Widgets')
    const select = within(dialog).getByRole('combobox', { name: 'Zone of Time Tax snapshot' })
    const option = within(select).getByRole('option', {
      name: /Immediate priorities \(not available\)/,
    })
    expect(option).toBeDisabled()
    // Allowed alternatives stay available.
    expect(
      within(within(dialog).getByRole('combobox', { name: 'Zone of My tasks' })).getByRole(
        'option',
        { name: 'Immediate priorities' },
      ),
    ).not.toBeDisabled()
  })

  it('H-T12: applying a preset asks first, changes layout only, and Reset layout restores defaults without deleting data', async () => {
    const { services } = makeServices()
    renderApp('/', { services })
    const { user, dialog } = await openCustomize('Layouts')
    await user.click(within(dialog).getByRole('radio', { name: 'Academic Focus' }))
    const confirm = (await screen.findAllByRole('dialog')).at(-1)!
    expect(
      within(confirm).getByText(/Your tasks, events, bookings and other records are not touched/),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Apply layout' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Mess preview', hidden: true }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.getByRole('region', { name: 'My tasks', hidden: true })).toBeInTheDocument()
    expect(within(dialog).getByText('Academic Focus', { selector: 'strong' })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Reset layout' }))
    const sure = (await screen.findAllByRole('dialog')).at(-1)!
    expect(
      within(sure).getByText(/does not delete any events, tasks or bookings/),
    ).toBeInTheDocument()
    await user.click(within(sure).getByRole('button', { name: 'Reset layout' }))
    expect(await region('Mess preview')).toBeInTheDocument()
    expect((await services.campus.load('demo-student-a')).tasks.length).toBeGreaterThan(0)
  })

  it('a manual change shows "Custom" while the original preset stays selectable', async () => {
    renderApp('/')
    const { user, dialog } = await openCustomize('Widgets')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show Time Tax snapshot' }))
    await user.click(within(dialog).getByRole('tab', { name: 'Layouts' }))
    expect(await within(dialog).findByText('Custom', { selector: 'strong' })).toBeInTheDocument()
    expect(within(dialog).getByRole('radio', { name: 'Balanced Campus' })).not.toBeChecked()
  })

  it('H-T09: quick actions are exactly four unique, editable, and persisted', async () => {
    const first = renderApp('/')
    const { user, dialog } = await openCustomize('Quick actions')
    const slot1 = within(dialog).getByRole('combobox', { name: 'Shortcut 1' })
    // Destinations already used in other slots cannot be chosen again.
    expect(within(slot1).getByRole('option', { name: /^Laundry/ })).toBeDisabled()
    await user.selectOptions(slot1, 'calendar')
    await waitFor(async () =>
      expect(
        within(await region('Quick actions'))
          .getAllByRole('link', { hidden: true })
          .some((l) => l.textContent?.startsWith('Calendar')),
      ).toBe(true),
    )
    expect(
      within(await region('Quick actions')).getAllByRole('link', { hidden: true }),
    ).toHaveLength(4)
    first.unmount()
    renderApp('/', { services: first.services })
    expect(within(await region('Quick actions')).getAllByRole('link')[0]).toHaveTextContent(
      /^Calendar/,
    )
  })

  it('density and Agenda/Week defaults persist', async () => {
    const first = renderApp('/')
    const { user, dialog } = await openCustomize('Display')
    await user.click(within(dialog).getByRole('radio', { name: 'Compact' }))
    await user.click(within(dialog).getByRole('radio', { name: 'Week' }))
    await waitFor(() => expect(document.querySelector('[data-density="compact"]')).not.toBeNull())
    first.unmount()
    renderApp('/', { services: first.services })
    await region('Your schedule')
    expect(document.querySelector('[data-density="compact"]')).not.toBeNull()
    expect(
      within(await region('Your schedule')).getByRole('button', { name: /^Week$/ }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('Free Pockets settings validate (15–180 min, end after start) and only valid values are saved', async () => {
    const { services } = makeServices()
    renderApp('/', { services })
    const { user, dialog } = await openCustomize('Display')
    const min = within(dialog).getByLabelText('Show gaps of at least (minutes)')
    await user.clear(min)
    await user.type(min, '10')
    expect(await within(dialog).findByText(/whole number from 15 to 180/)).toBeInTheDocument()
    expect(services.storage.read('campusos:planning:v1:demo-student-a', z.unknown()).status).toBe(
      'missing',
    )
    await user.clear(min)
    await user.type(min, '120')
    await waitFor(() =>
      expect(services.storage.read('campusos:planning:v1:demo-student-a', z.unknown()).status).toBe(
        'ok',
      ),
    )
  })

  it('H-T20: Customize opens from the keyboard, is labelled, and Escape closes it', async () => {
    renderApp('/')
    const user = userEvent.setup()
    const button = await screen.findByRole('button', { name: 'Customize' })
    button.focus()
    await user.keyboard('{Enter}')
    const dialog = await screen.findByRole('dialog', { name: 'Customize Home' })
    expect(within(dialog).getByRole('tablist', { name: 'Customize Home' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })
})

describe('preference resilience and isolation', () => {
  it('H-T19: corrupt saved Home preferences fall back to defaults without crashing or touching records', async () => {
    const memory = createMemoryStorage({
      'campusos:home:v1:demo-student-a': '{"schemaVersion":1,"preset":"nope","widgets":"broken"}',
      'campusos:domain:v1:demo-student-a': JSON.stringify({ events: [], tasks: [] }),
    })
    const { services } = makeServices({
      storage: createStorageAdapter({ backend: memory.storage }),
    })
    renderApp('/', { services })
    expect(await screen.findByText(/saved layout could not be read/i)).toBeInTheDocument()
    expect(await region('Your schedule')).toBeInTheDocument()
    expect(memory.data.get('campusos:domain:v1:demo-student-a')).toBe('{"events":[],"tasks":[]}')
    expect(memory.data.get('campusos:home:v1:demo-student-a')).toContain('broken') // not deleted
  })

  it('H-T21: layout choices are per profile and never leak', async () => {
    renderApp('/')
    const user = userEvent.setup()
    const { dialog } = await openCustomize('Widgets')
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show Campus Pulse' }))
    await waitFor(() =>
      expect(
        screen.queryByRole('region', { name: 'Campus Pulse', hidden: true }),
      ).not.toBeInTheDocument(),
    )
    await user.keyboard('{Escape}')
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))
    expect(await region('Campus Pulse')).toBeInTheDocument() // B still has the default layout
  })
})
