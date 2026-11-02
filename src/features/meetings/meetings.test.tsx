import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

describe('Find a time', () => {
  it('Calendar offers Find a time, Exam Schedule and My Seating directly', async () => {
    renderApp('/calendar')
    await heading('Calendar')
    expect(await screen.findByRole('link', { name: 'Find a time' })).toHaveAttribute(
      'href',
      '/calendar/find-a-time',
    )
    expect(screen.getByRole('link', { name: 'Exam Schedule' })).toHaveAttribute(
      'href',
      '/academics/exams',
    )
    expect(screen.getByRole('link', { name: /My Seating/ })).toBeInTheDocument()
  })

  it('runs the whole journey: add a person, see real suggestions, choose a time and a room, confirm, then reply as the guest', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/calendar/find-a-time')
    await heading('Find a time')
    expect(
      screen.getByText('Add at least one other person to see shared times.'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('Add people (search by name)'), 'Student B')
    await user.click(await screen.findByRole('button', { name: 'Add Reference Student B' }))
    const list = await screen.findByTestId('suggestions')
    const cards = within(list)
      .getAllByRole('listitem')
      .filter((li) => li.querySelector('button'))
    expect(cards.length).toBeGreaterThan(0)
    expect(cards.length).toBeLessThanOrEqual(3)
    expect(within(list).getAllByLabelText('Why')[0]!.textContent).toMatch(/required people free/)
    await user.type(screen.getByLabelText('Meeting title'), 'Ops project sync')
    await user.click(within(cards[0]!).getByRole('button', { name: /Choose this time/ }))
    const rooms = await screen.findByTestId('rooms')
    expect(within(rooms).getAllByRole('listitem')).toHaveLength(4)
    expect(within(rooms).getAllByText(/Up to 70 people/).length).toBe(4)
    await user.click(
      within(rooms)
        .getAllByRole('button')
        .find((b) => /CR3$/.test(b.textContent ?? ''))!,
    )
    await user.click(screen.getByRole('button', { name: 'Confirm meeting' }))
    await heading('Ops project sync')
    expect(await screen.findByTestId('room-state')).toHaveTextContent(
      /Room reserved \(local\) · CR3/,
    )
    expect(screen.getByText(/not everyone’s acceptance/)).toBeInTheDocument()
    const id = (await services.meetings.load()).meetings[0]!.id
    expect(
      (await services.campus.load('demo-student-a')).bookings.filter((b) => b.id === id),
    ).toHaveLength(1)
    // The guest sees the invitation and replies.
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))
    await router.navigate(`/calendar/meetings/${id}`)
    await heading('Ops project sync')
    await user.click(await screen.findByRole('button', { name: 'Accept' }))
    await waitFor(async () =>
      expect(
        (await services.meetings.load()).meetings[0]!.attendees.find(
          (a) => a.profileId === 'demo-student-b',
        )!.rsvp,
      ).toBe('ACCEPTED'),
    )
    // A person who was never invited cannot open it.
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /empty/i }))
    await router.navigate(`/calendar/meetings/${id}`)
    await heading('Meeting not found')
  })

  it('says plainly when nobody is free, and treats a person without a timetable as unknown', async () => {
    const user = userEvent.setup()
    renderApp('/calendar/find-a-time')
    await heading('Find a time')
    await user.type(screen.getByLabelText('Add people (search by name)'), 'no schedule')
    const add = await screen.findAllByRole('button', { name: /^Add / })
    await user.click(add[0]!)
    expect(await screen.findByText('No recorded timetable')).toBeInTheDocument()
    expect(await screen.findByText(/Needs availability confirmation/)).toBeInTheDocument()
    expect(screen.getByText(/never treated as free/)).toBeInTheDocument()
  })
})
