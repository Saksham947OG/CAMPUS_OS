import { screen, within } from '@testing-library/react'
import { makeServices, renderApp } from '@/test/render-app'

describe('Services capacity board', () => {
  it('shows capacity visually, classrooms as rooms booked, and the Time Tax at stake', async () => {
    renderApp('/services', { services: makeServices({ sourceData: true }).services })
    const board = await screen.findByRole('region', {
      name: /How full is campus, and what does a wait cost/,
    })
    const b = within(board)
    expect(b.getByRole('meter', { name: /Classrooms booked: \d of 6/ })).toBeInTheDocument()
    expect(b.getByRole('meter', { name: /Gym: \d+ of 20/ })).toBeInTheDocument()
    expect(b.getByText(/Time Tax at stake: 59–81 min/)).toBeInTheDocument()
    expect(b.getByText(/Time Tax · Lunch queue:/)).toBeInTheDocument()
    expect(b.getAllByText(/no wait has been measured yet/).length).toBeGreaterThan(0)
  })
})
