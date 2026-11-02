import { screen, within } from '@testing-library/react'
import { createServices, type Services } from '@/app/services'
import { createMemoryStorage } from '@/test/memory-storage'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixedClock } from '@/lib/time'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const open = (memory: ReturnType<typeof createMemoryStorage>): Services =>
  createServices({
    sourceData: false,
    storage: createStorageAdapter({ backend: memory.storage }),
    clock: fixedClock('2026-11-02T04:30:00Z'),
  })

describe('persistent example bookings (V3 §4.4, G06)', () => {
  it('My bookings shows a confirmed badminton court and a cancelled study room as real records, with Book again', async () => {
    const memory = createMemoryStorage()
    renderApp('/bookings/my', { services: open(memory) })
    await screen.findByRole('heading', { level: 1, name: 'My bookings' })
    const upcoming = within(await screen.findByRole('region', { name: /Upcoming \(1\)/ }))
    expect(upcoming.getByText(/Demo badminton court 2/)).toBeInTheDocument()
    expect(upcoming.getByText('Confirmed (local)')).toBeInTheDocument()
    const cancelled = within(
      await screen.findByRole('region', { name: /Cancelled or released \(1\)/ }),
    )
    expect(cancelled.getByText(/Demo group study room 1/)).toBeInTheDocument()
    expect(cancelled.getByRole('link', { name: 'Book again' })).toHaveAttribute(
      'href',
      '/bookings/library',
    )
    expect(upcoming.queryByRole('link', { name: 'Book again' })).not.toBeInTheDocument()
  })

  it('they persist across a reload, belong to the first profile only and are not duplicated', async () => {
    const memory = createMemoryStorage()
    const first = open(memory)
    const s1 = await first.sports.load()
    await first.sports.reserve('demo-student-a', {
      resourceId: 'DEMO-COURT-1',
      date: '2026-11-04' as never,
      start: '17:00' as never,
      idempotencyKey: 'x1',
    })
    const again = open(memory)
    const s2 = await again.sports.load()
    expect(s2.reservations.filter((r) => r.id.startsWith('DEMO-EX-'))).toHaveLength(2)
    expect(s2.reservations).toHaveLength(s1.reservations.length + 1)
    expect(again.sports.bookingRefs('demo-student-b')).toEqual([])
    expect(
      s2.reservations.every((r) => r.provenance.dataMode === 'demoSeed' || r.id.startsWith('bk')),
    ).toBe(true)
  })
})
