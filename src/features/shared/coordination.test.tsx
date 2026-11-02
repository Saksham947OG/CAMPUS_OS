import { screen, within } from '@testing-library/react'
import type { DateOnly, LocalTime } from '@/lib/time'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('Time Tax coordination activity (V3 §11)', () => {
  it('shows counts from local records only, and never a minute, a percentage or a saving', async () => {
    const { services } = makeServices()
    await services.sports.reserve('demo-student-a', {
      resourceId: 'DEMO-SNOOKER-2',
      date: '2026-11-03' as DateOnly,
      start: '11:00' as LocalTime,
      idempotencyKey: 'tt-1',
    })
    renderApp('/time-tax', { services })
    const card = within(
      await screen.findByRole('region', { name: 'Coordination activity in this demo' }),
    )
    expect(card.getByText('Snooker unit reservations').nextSibling).toHaveTextContent('1')
    expect(card.getByText('Meetings you organised').nextSibling).toHaveTextContent('0')
    expect(
      card.getByText(/not time saved, not measured outcomes and not campus results/),
    ).toBeInTheDocument()
    expect(card.queryByText(/%|minutes saved|hours saved/)).not.toBeInTheDocument()
  })
})
