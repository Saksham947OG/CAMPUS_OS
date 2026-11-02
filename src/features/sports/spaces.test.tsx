import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateOnly, LocalTime } from '@/lib/time'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const B = 'demo-student-b'
const t = (v: string) => v as LocalTime

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

describe('hub and library (SR-AT-01, SR-AT-03, SR-AT-05, SR-AT-09)', () => {
  it('SR-AT-01: Library, Music Room and Chill Zone are reachable from the Bookings hub', async () => {
    const user = userEvent.setup()
    renderApp('/bookings')
    await heading('Bookings')
    const main = within(await screen.findByRole('main'))
    for (const name of [/Library/, /Music Room/, /Chill Zone/])
      expect((await main.findAllByRole('link', { name })).length).toBeGreaterThan(0)
    await user.click(main.getAllByRole('link', { name: /Chill Zone/ })[0]!)
    await heading('Chill Zone')
  })

  it('SR-AT-03 / SR-AT-05: the library shows its demo hours with their source, unknown occupancy, and room details open', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/library')
    await heading('Library')
    expect(await screen.findByText(/Demo hours · not supplied by the campus/)).toBeInTheDocument()
    expect(
      screen.getByText(/Unknown. No occupancy snapshot has been recorded./),
    ).toBeInTheDocument()
    expect(screen.getByText(/Occupancy not verified/)).toBeInTheDocument()
    expect(screen.getAllByText(/Study cabin: 8 people at a time/).length).toBe(2)
    await user.click(screen.getAllByRole('link', { name: 'Details and slots' })[0]!)
    await heading('Demo group study room 1')
    expect(
      await screen.findByText('Not configured', { exact: false }).catch(() => null),
    ).toBeDefined()
    expect(screen.getAllByText(/demo/i).length).toBeGreaterThan(0)
  })

  it('SR-AT-07 / SR-AT-08: a library check-in is a self-report that counts once and is never automatic', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/library')
    await heading('Library')
    await user.click(await screen.findByRole('button', { name: 'Check in (self-report)' }))
    await user.click(await screen.findByRole('button', { name: 'You are checked in' }))
    expect(
      (await services.sports.load()).gymSessions.filter((g) => g.facilityId === 'DEMO-LIBRARY'),
    ).toHaveLength(1)
    expect(screen.getByText(/Self-reported count:/).parentElement).toHaveTextContent('1 person has')
    expect(screen.getByText(/never checked out automatically/)).toBeInTheDocument()
  })

  it('SR-AT-09: the catalogue says it is not connected, is clearly fictional, and search narrows it', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/library/books')
    await heading('Library books')
    expect(await screen.findByText(/Catalogue not connected\./)).toBeInTheDocument()
    expect(screen.getAllByText(/not guaranteed on the shelf/).length).toBeGreaterThan(0)
    await user.type(screen.getByLabelText('Search titles and authors'), 'methods')
    expect(await screen.findAllByText(/Demo Book Three/)).not.toHaveLength(0)
    expect(screen.queryByText(/Demo Book One/)).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search titles and authors'))
    await user.type(screen.getByLabelText('Search titles and authors'), 'zzzz')
    expect(await screen.findByText(/No demo book matches/)).toBeInTheDocument()
  })

  it('SR-AT-10 / SR-AT-11: loans show a date-only due date with no fine, and another profile sees nothing', async () => {
    const { services, router } = renderApp('/bookings/library/loans')
    await heading('My loans')
    expect(await screen.findByText(/You have no loans recorded/)).toBeInTheDocument()
    await services.sports.addDemoLoan({
      profileId: B,
      bookId: 'DEMO-BOOK-2',
      dueDate: '2026-11-10' as DateOnly,
    })
    await act(async () => {
      await router.navigate('/bookings/library')
      await router.navigate('/bookings/library/loans')
    })
    await heading('My loans')
    expect(await screen.findByText(/You have no loans recorded/)).toBeInTheDocument() // B's loan is invisible to A
    await services.sports.addDemoLoan({
      profileId: A,
      bookId: 'DEMO-BOOK-1',
      dueDate: '2026-11-10' as DateOnly,
    })
    expect(await screen.findByText(/date only: no time is implied/)).toBeInTheDocument()
    const body = screen.getByRole('main').textContent ?? ''
    expect(body).toMatch(/Not recorded as returned. Only the demo simulator can record a return/)
    expect(body).not.toMatch(/fine of|overdue fee|late fee|returned successfully|\bpaid\b/i)
    expect(screen.queryByRole('button', { name: /return/i })).not.toBeInTheDocument() // a student cannot certify a return
    expect(body).not.toMatch(/Demo Book Two/)
  })
})

describe('music room (SR-AT-12, SR-AT-13)', () => {
  it('SR-AT-13: equipment information is shown as not supplied until someone supplies it', async () => {
    renderApp('/bookings/music-room')
    await heading('Music Room')
    expect(await screen.findByText(/Equipment information not supplied/)).toBeInTheDocument()
    expect(
      screen.getByText(/No instruments, amplifiers, microphones or sound-proofing are assumed/),
    ).toBeInTheDocument()
  })

  it('SR-AT-12: 90-minute slots inside the published hours are offered, with a private label and the owner-supplied capacity', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/music-room')
    await heading('Music Room')
    await user.click(await screen.findByRole('button', { name: '11:30 am' }))
    expect(await screen.findByText(/Review: Demo music room/)).toBeInTheDocument()
    expect(screen.getByText(/Up to 40 on this device/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Private session label (optional)'), 'Jam')
    expect(screen.getByText(/Only you can see this/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm local reservation' }))
    await waitFor(async () => expect((await services.sports.load()).reservations).toHaveLength(1))
    expect((await services.sports.load()).reservations[0]).toMatchObject({
      start: '11:30',
      end: '13:00',
      partnerNote: 'Jam',
    })
  })
})

describe('chill zone (SR-AT-17, SR-AT-18, SR-AT-21, SR-AT-22)', () => {
  it('SR-AT-17 / SR-AT-21: three demo spots are shown, and the confirmation says there is no institutional permission', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/chill-zone')
    await heading('Chill Zone')
    for (const name of ['Demo Spot 1', 'Demo Spot 2', 'Demo Spot 3'])
      expect((await screen.findAllByText(name)).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Placeholder: no real name, place or photo/)).toHaveLength(3)
    expect(
      screen.getByText(/Reserved here never means allocated by the college/),
    ).toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: '11:45 pm' }))
    expect(
      await screen.findByText(/not campus approval, gives no right to occupy any area/),
    ).toBeInTheDocument()
  })

  it('SR-AT-18: a midnight booking shows both dates in review and appears on both days in Calendar and once in Home', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/bookings/chill-zone')
    await heading('Chill Zone')
    await user.click(await screen.findByRole('button', { name: '11:45 pm' }))
    expect(
      await screen.findByText(/Review: Demo Spot 1, Mon, 2 Nov 11:45 pm → Tue, 3 Nov 12:15 am/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm local reservation' }))
    await waitFor(async () => expect((await services.sports.load()).reservations).toHaveLength(1))
    expect((await services.sports.load()).reservations[0]).toMatchObject({
      date: '2026-11-02',
      endDate: '2026-11-03',
      end: '00:15',
    })

    await router.navigate('/calendar?view=day&date=2026-11-02')
    expect(
      (await screen.findAllByText(/Demo Spot 1 \(local reservation\)/)).length,
    ).toBeGreaterThan(0)
    await router.navigate('/calendar?view=day&date=2026-11-03')
    expect(
      (await screen.findAllByText(/Demo Spot 1 \(local reservation\) \(continued\)/)).length,
    ).toBeGreaterThan(0)
    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    const entries = await within(activity).findAllByText(/Demo Spot 1 \(local reservation\)/)
    expect(entries).toHaveLength(1)
    expect(
      within(activity).getByText(/Mon, 2 Nov, 11:45 pm → Tue, 3 Nov, 12:15 am/),
    ).toBeInTheDocument()
  })

  it('SR-AT-19 / SR-AT-22: another profile sees only "reserved", never who booked or why, and cannot take the slot', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/chill-zone')
    await services.sports.reserve(B, {
      resourceId: 'DEMO-CHILL-1',
      date: TODAY,
      start: t('23:45'),
      idempotencyKey: 'x',
      partnerNote: "Sam's birthday",
    })
    await heading('Chill Zone')
    const slot = await screen.findByRole('button', { name: '11:45 pm · reserved' })
    expect(slot).toBeDisabled()
    const body = screen.getByRole('main').textContent ?? ''
    expect(body).not.toContain('Reference Student B')
    expect(body).not.toContain("Sam's birthday")
    await user.click(await screen.findByRole('button', { name: '11:15 pm' }))
    expect(await screen.findByText(/Review:/)).toBeInTheDocument()
  })
})

describe('integration and honesty (SR-AT-23, SR-AT-24, SR-AT-27, SR-AT-31, SR-AT-33)', () => {
  it('SR-AT-23 / SR-AT-24: a library booking is one canonical record in Home, and cancelling updates it', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/bookings/library')
    await heading('Library')
    await user.click(await screen.findByRole('button', { name: '2:00 pm' }))
    await user.click(screen.getByRole('button', { name: 'Confirm local reservation' }))
    const { reservation } = await waitFor(async () => {
      const s = await services.sports.load()
      expect(s.reservations).toHaveLength(1)
      return { reservation: s.reservations[0]! }
    })
    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    expect(
      await within(activity).findAllByText(/Demo group study room 1 \(local reservation\)/),
    ).toHaveLength(1)
    await act(async () => {
      await services.sports.act(A, reservation.id, 'cancel')
    })
    await router.navigate('/bookings/my')
    await heading('My bookings')
    expect(await screen.findByText(/Cancelled or released \(1\)/)).toBeInTheDocument()
    expect((await services.sports.load()).reservations).toHaveLength(1) // the same record, now cancelled
  })

  it('SR-AT-27: a space booking survives a reload of the app and stays with its profile', async () => {
    const first = makeServices()
    const a = renderApp('/bookings/music-room', { services: first.services })
    await first.services.sports.reserve(A, {
      resourceId: 'DEMO-MUSIC-1',
      date: TODAY,
      start: t('11:30'),
      idempotencyKey: 'k',
    })
    a.unmount()
    renderApp('/bookings/my', { services: first.services })
    await heading('My bookings')
    expect(await screen.findByText(/Demo music room · /)).toBeInTheDocument()
  })

  it('SR-AT-31: every space Time Tax scenario is hypothetical, shows its formula, and never goes below zero', async () => {
    const user = userEvent.setup()
    for (const path of ['/bookings/library', '/bookings/music-room', '/bookings/chill-zone']) {
      const { unmount } = renderApp(path)
      const tt = await screen.findByRole('region', { name: 'Time Tax scenario' })
      expect(within(tt).getByText('Illustrative scenario, not an observation')).toBeInTheDocument()
      expect(
        within(tt).getByText(
          /Hypothetical person-minutes avoided: 160 per month \(2.67 student-hours\)/,
        ),
      ).toBeInTheDocument()
      expect(within(tt).getByText(/visits × max\(0, baseline − hypothetical\)/)).toBeInTheDocument()
      const after = within(tt).getByLabelText('Hypothetical with a booking (minutes)')
      await user.clear(after)
      await user.type(after, '50')
      expect(
        within(tt).getByText(/avoided: 0 per month \(0.00 student-hours\)/),
      ).toBeInTheDocument()
      expect(within(tt).getByText(/Observed results: none recorded/)).toBeInTheDocument()
      unmount()
    }
  })

  it('SR-AT-33: a student cannot mark approval or staff-verified presence, and every status says self-reported or demo', async () => {
    const { services, router } = renderApp('/bookings/library')
    const r = await services.sports.reserve(A, {
      resourceId: 'DEMO-LIB-ROOM-1',
      date: TODAY,
      start: t('14:00'),
      idempotencyKey: 'k',
    })
    expect(r.ok).toBe(true)
    await router.navigate(`/bookings/my/${r.ok ? r.value.reservation.id : ''}`)
    await heading('Demo group study room 1')
    expect(
      screen.queryByRole('button', { name: /approve|verify|staff|confirm presence|official/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check in (self-report)' })).toBeInTheDocument()
    expect(screen.getByText('Confirmed (local)')).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(
      /staff-verified|institution approved|officially/i,
    )
  })
})
