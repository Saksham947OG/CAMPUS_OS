import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateOnly, LocalTime } from '@/lib/time'
import { unitSummary } from '@/selectors/sports'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST.
const TOMORROW = '2026-11-03' as DateOnly
const AT = '11:00' as LocalTime
const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'
const T1 = 'DEMO-SNOOKER-1'
const T2 = 'DEMO-SNOOKER-2'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const book = (
  services: ReturnType<typeof makeServices>['services'],
  who: string,
  resourceId: string,
  key: string,
) => services.sports.reserve(who, { resourceId, date: TOMORROW, start: AT, idempotencyKey: key })

describe('snooker: two distinguishable tables under one facility (V3 T5)', () => {
  it('two different tables can be reserved at once, a third overlapping reservation fails', async () => {
    const { services } = makeServices()
    expect((await book(services, A, T1, 'k1')).ok).toBe(true)
    expect((await book(services, B, T1, 'k2')).ok).toBe(false) // same table, same time
    expect((await book(services, B, T2, 'k3')).ok).toBe(true) // the other table
    expect((await book(services, C, T1, 'k4')).ok).toBe(false)
    expect((await book(services, C, T2, 'k5')).ok).toBe(false)
    const s = await services.sports.load()
    const sum = unitSummary(
      s,
      'snooker',
      TOMORROW,
      TOMORROW,
      AT,
      C,
      Date.parse('2026-11-02T04:30:00Z'),
    )
    expect(sum.total).toBe(2)
    expect(sum.reservable).toBe(0)
  })

  it('maintenance blocks only the affected table, and cancelling Table 1 leaves Table 2 alone', async () => {
    const { services } = makeServices()
    const now = Date.parse('2026-11-02T04:30:00Z')
    const first = await book(services, A, T1, 'k1')
    await book(services, B, T2, 'k2')
    await services.sports.closeResource(T2, 'Demo maintenance')
    let s = await services.sports.load()
    let sum = unitSummary(s, 'snooker', TOMORROW, TOMORROW, AT, C, now)
    expect(sum.units.map((u) => u.state)).toEqual(['reserved', 'maintenance'])
    expect(sum.total).toBe(2) // maintenance never changes the physical count
    expect(sum.reservable).toBe(0)
    if (!first.ok) throw new Error('setup')
    await services.sports.act(A, first.value.reservation.id, 'cancel')
    s = await services.sports.load()
    sum = unitSummary(s, 'snooker', TOMORROW, TOMORROW, AT, C, now)
    expect(sum.units.map((u) => u.state)).toEqual(['available', 'maintenance'])
    expect(sum.reservable).toBe(1)
    expect(s.reservations.find((r) => r.resourceId === T2)?.state).toBe('confirmedDemo')
  })

  it('choosing Any allocates one named table and shows 1 of 2 tables reservable', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    await book(services, B, T1, 'k0') // Table 1 is already taken at 11:00 tomorrow
    renderApp('/bookings/sports?activity=snooker', { services })
    await screen.findByRole('heading', { level: 1, name: 'Other sports' })
    await user.selectOptions(await screen.findByLabelText('Snooker table'), 'any')
    await user.selectOptions(screen.getByLabelText('Date'), TOMORROW)
    await user.click(await screen.findByRole('button', { name: /11:00/ }))
    const panel = await screen.findByTestId('unit-status')
    expect(within(panel).getByText(/1 of 2 tables reservable locally schedule/)).toBeInTheDocument()
    expect(within(panel).getByText(/Snooker table 1: Reserved$/)).toBeInTheDocument()
    expect(
      within(panel).getByText(/Snooker table 2: Available locally schedule/),
    ).toBeInTheDocument()
    expect(screen.getByText(/will reserve/)).toHaveTextContent('Snooker table 2')
    await user.click(screen.getByRole('button', { name: 'Confirm local reservation' }))
    expect(
      (await screen.findAllByText(/Reservation saved on this device: Snooker table 2/)).length,
    ).toBeGreaterThan(0)
    const s = await services.sports.load()
    expect(s.reservations.filter((r) => r.ownerProfileId === A).map((r) => r.resourceId)).toEqual([
      T2,
    ])
  })

  it('capacity uses the right unit, or says it was not provided', async () => {
    renderApp('/bookings/resources/DEMO-SNOOKER-1')
    await screen.findByRole('heading', { level: 1, name: 'Snooker table 1' })
    expect(screen.getByText(/2 tables listed on this device fixtures/)).toBeInTheDocument()
  })
})
