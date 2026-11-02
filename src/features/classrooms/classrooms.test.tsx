import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateOnly, LocalTime } from '@/lib/time'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
const A = 'demo-student-a'
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const room = (id: string) => document.querySelector(`[data-room="${id}"]`) as HTMLElement

describe('Classrooms', () => {
  it('compares all four named rooms, never calls an uncovered or blocked time free, and says the schedule is demo', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/classrooms')
    await heading('Classrooms')
    expect(
      await screen.findByText(/Reference schedule · not a live college timetable/),
    ).toBeInTheDocument()
    for (const n of ['CR Conference Hall', 'CR1', 'CR3', 'G12'])
      expect(
        within(screen.getByLabelText('Rooms')).getByRole('heading', { name: n }),
      ).toBeInTheDocument()
    // 14:00 is outside G12's morning-only demo schedule, so it is UNKNOWN, never free.
    expect(within(room('G12')).getByText('Unknown / not synced')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Start'), String(10 * 60))
    expect(within(room('CR1')).getByText('Blocked')).toBeInTheDocument()
    expect(
      within(room('CR1')).getByText(/Scheduled class \(local\), until 11:00/),
    ).toBeInTheDocument()
    expect(
      within(room('CR1')).getByRole('button', { name: 'Not available for this slot' }),
    ).toBeDisabled()
    expect(within(room('CR3')).getByText('Available for this slot')).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/3 rooms free|currently empty/i)
  })

  it('books straight from a free slot, shows it in My bookings and Calendar data, and refuses the same time again', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/bookings/classrooms')
    await heading('Classrooms')
    await user.click(within(room('CR3')).getByRole('button', { name: /Book this room/ }))
    expect(await screen.findByRole('heading', { name: /Book this room: CR3/ })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Group name (optional)'), 'Ops project')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    await heading('CR3 booking')
    expect(screen.getByText('Confirmed (local)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View My bookings' })).toBeInTheDocument()
    const id = (await services.classrooms.load()).reservations[0]!.id
    expect((await services.campus.load(A)).bookings.filter((b) => b.id === id)).toHaveLength(1)
    await router.navigate('/bookings/my')
    await heading('My bookings')
    expect(await screen.findByText(/Classrooms \(1\)/)).toBeInTheDocument()
    await router.navigate('/bookings/classrooms')
    await heading('Classrooms')
    await waitFor(() => expect(room('CR3')).not.toBeNull())
    expect(await within(room('CR3')).findByText('Booked by you')).toBeInTheDocument()
    // The same interval by another student is refused by the rules even if the screen was stale.
    const again = await services.classrooms.reserve(
      'demo-student-b',
      {
        roomId: 'CR3',
        date: '2026-11-02' as DateOnly,
        start: '14:00' as LocalTime,
        end: '15:00' as LocalTime,
        purpose: 'Other',
      },
      'k2',
    )
    expect(again.ok).toBe(false)
  })

  it('a conflict that appears before confirmation is caught, with other rooms offered and the form kept', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/classrooms')
    await heading('Classrooms')
    await user.click(within(room('CR1')).getByRole('button', { name: /Book this room/ }))
    await user.type(await screen.findByLabelText('Group name (optional)'), 'Keep me')
    await services.classrooms.injectOtherBooking('CR1', {
      date: '2026-11-02' as DateOnly,
      start: '14:00' as LocalTime,
      end: '15:00' as LocalTime,
    })
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent(/Choose another room or time/)
    expect(screen.getByLabelText('Group name (optional)')).toHaveValue('Keep me')
    expect(screen.getByRole('button', { name: 'Confirm booking' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Switch to CR3' }))
    expect(await screen.findByRole('heading', { name: /Book this room: CR3/ })).toBeInTheDocument()
  })

  it('an approval room says "Request", shows "Requested, not reserved", and the simulator then approves it onto the Calendar', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
    await router.navigate('/bookings/classrooms')
    await heading('Classrooms')
    await user.click(
      within(room('CR_CONFERENCE_HALL')).getByRole('button', { name: /Request this room/ }),
    )
    await user.click(await screen.findByRole('button', { name: 'Request this room' }))
    await heading('CR Conference Hall booking')
    expect(screen.getAllByText('Requested, not reserved').length).toBeGreaterThan(0)
    expect(services.classrooms.bookingRefs(A)).toHaveLength(0)
    await router.navigate('/bookings/classrooms')
    await heading('Classrooms')
    const ops = await screen.findByTestId('demo-ops')
    await within(ops).findByText(/Waiting requests \(1\)/)
    await user.click(await within(ops).findByRole('button', { name: 'Approve' }))
    await waitFor(() => expect(services.classrooms.bookingRefs(A)).toHaveLength(1), {
      timeout: 4000,
    })
  })

  it('an uncovered time is UNKNOWN and offers only a verification request', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/classrooms')
    await heading('Classrooms')
    expect(within(room('G12')).getByText('Unknown / not synced')).toBeInTheDocument()
    await user.click(within(room('G12')).getByRole('button', { name: /Request verification/ }))
    expect(await screen.findByText(/outside the reference schedule/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send request for verification' }),
    ).toBeInTheDocument()
  })

  it('cancelling updates the booking, My bookings and recorded availability', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    const r = await services.classrooms.reserve(
      A,
      {
        roomId: 'CR1',
        date: '2026-11-02' as DateOnly,
        start: '14:00' as LocalTime,
        end: '15:00' as LocalTime,
        purpose: 'Study group',
      },
      'k',
    )
    if (!r.ok) throw new Error('setup')
    await router.navigate(`/bookings/classrooms/bookings/${r.value.reservation.id}`)
    await heading('CR1 booking')
    await user.click(screen.getByRole('button', { name: 'Cancel reservation' }))
    await user.click(
      await screen
        .findByRole('button', { name: 'Cancel reservation', hidden: false })
        .then(async () =>
          (await screen.findAllByRole('button', { name: 'Cancel reservation' })).at(-1)!,
        ),
    )
    expect((await screen.findAllByText('Cancelled')).length).toBeGreaterThan(0)
    expect(screen.getByText(/does not mean anyone checked the physical room/)).toBeInTheDocument()
    await router.navigate('/bookings/classrooms')
    await heading('Classrooms')
    await waitFor(() => expect(room('CR1')).not.toBeNull())
    expect(await within(room('CR1')).findByText('Available for this slot')).toBeInTheDocument()
  })

  it('another student cannot open someone else’s booking', async () => {
    const { router, services } = renderApp('/settings')
    const r = await services.classrooms.reserve(
      'demo-student-b',
      {
        roomId: 'CR1',
        date: '2026-11-02' as DateOnly,
        start: '14:00' as LocalTime,
        end: '15:00' as LocalTime,
        purpose: 'Other',
      },
      'kb',
    )
    if (!r.ok) throw new Error('setup')
    await router.navigate(`/bookings/classrooms/bookings/${r.value.reservation.id}`)
    await heading('Booking not found')
  })
})
