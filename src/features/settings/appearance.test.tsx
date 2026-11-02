import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixedClock } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => {
  clearViewport()
  delete document.documentElement.dataset.theme
})

const open = (memory: ReturnType<typeof createMemoryStorage>) =>
  createServices({
    sourceData: false,
    storage: createStorageAdapter({ backend: memory.storage }),
    clock: fixedClock('2026-11-02T04:30:00Z'),
  })

describe('appearance (V3 design foundation)', () => {
  it('Dark is a persisted override: it sets the document theme, survives a reload and changes no records', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStorage()
    const first = open(memory)
    const view = renderApp('/settings', { services: first })
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(document.documentElement.dataset.theme).toBeUndefined() // "Match my device" by default
    await user.click(await screen.findByRole('radio', { name: 'Dark' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    const before = await first.campus.load('demo-student-a')

    view.unmount()
    delete document.documentElement.dataset.theme // a fresh page load
    const second = open(memory)
    renderApp('/settings', { services: second })
    await screen.findByRole('heading', { level: 1, name: 'Settings' })
    expect(await screen.findByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(await second.campus.load('demo-student-a')).toEqual(before)

    await user.click(screen.getByRole('radio', { name: 'Match my device' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})
