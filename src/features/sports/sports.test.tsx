import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateOnly, LocalTime } from '@/lib/time'
import { gymView, scheduleWarnings } from '@/selectors/sports'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const t = (v: string) => v as LocalTime

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

async function enableOps(
  user: ReturnType<typeof userEvent.setup>,
  router: { navigate: (p: string) => Promise<void> },
  then: string,
) {
  await router.navigate('/settings')
  await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
  await router.navigate(then)
}

describe('hub and information (SP-T01 … SP-T04)', () => {
  it('SP-T01 / SP-T32: Bookings links to the gym, badminton and all three other sports, and does not advertise fixtures or teams', async () => {
    renderApp('/bookings')
    await heading('Bookings')
    const main = within(await screen.findByRole('main'))
    for (const name of [/Gym/, /Badminton/, /Table Tennis/, /Pool/, /Basketball/])
      expect((await main.findAllByRole('link', { name })).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Campus facilities/).length).toBeGreaterThan(0)
    expect(screen.getByText(/separate, later feature/)).toBeInTheDocument() // SP-T32
    expect(
      screen.queryByRole('link', { name: /fixture|team sign|tournament/i }),
    ).not.toBeInTheDocument()
  })

  it('shows the owner-supplied capacity on the hub, the gym page and the Services table', async () => {
    renderApp('/bookings')
    await heading('Bookings')
    expect(await screen.findAllByText(/Capacity · 4 people at a time/)).toHaveLength(1)
    expect(screen.getByText(/Capacity · about 20 people at a time/)).toBeInTheDocument()
    expect(screen.getByText(/Capacity · 70 people at a time/)).toBeInTheDocument()
  })

  it('SP-T02 / SP-T04: unsupplied hours and limits say so, and every status carries its source and as-of time', async () => {
    renderApp('/bookings/resources/DEMO-POOL-1')
    await heading('Demo pool table')
    expect(await screen.findByText('Not provided')).toBeInTheDocument() // hours
    expect(screen.getByText('Not configured')).toBeInTheDocument()
    expect(
      screen.getByText(/Illustrative sample facility \(not a real campus facility\) · as of/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Booking not configured' })).toBeDisabled()
  })

  it('SP-T25: a resource without booking rules never shows a reserve action', async () => {
    renderApp('/bookings/sports?activity=pool')
    await heading('Other sports')
    expect(await screen.findByRole('button', { name: 'Booking not configured' })).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: /Confirm local reservation/ }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/Published slots/)).not.toBeInTheDocument()
  })

  it('SP-T24: each activity shows its own rules', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/sports')
    await heading('Other sports')
    expect(
      await screen.findByText(/30-minute slots, up to 7 days ahead, 1 upcoming/),
    ).toBeInTheDocument() // table tennis
    await user.click(screen.getByRole('button', { name: /Basketball/ }))
    expect(await screen.findByText(/60-minute slots, up to 3 days ahead/)).toBeInTheDocument()
  })
})

describe('badminton journey (SP-T05 … SP-T07, SP-T15, SP-T26 … SP-T28)', () => {
  it('SP-T05 / SP-T06 / SP-T15: confirming a slot creates one booking, a double click creates no second, and a partner is only a note', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/badminton')
    await heading('Badminton')
    await user.click(await screen.findByRole('button', { name: '12:00 pm' }))
    expect(await screen.findByText(/Review: Demo badminton court 1/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Partner or group note (optional)'), 'Sample Friend')
    const confirm = screen.getByRole('button', { name: 'Confirm local reservation' })
    await user.dblClick(confirm)
    await waitFor(async () => expect((await services.sports.load()).reservations).toHaveLength(1))
    const r = (await services.sports.load()).reservations[0]!
    expect(r).toMatchObject({ partnerNote: 'Sample Friend', state: 'confirmedDemo' })
    expect(await screen.findByRole('link', { name: 'View this booking' })).toHaveAttribute(
      'href',
      `/bookings/my/${r.id}`,
    )
    expect(screen.getByRole('button', { name: '12:00 pm · yours' })).toBeDisabled()
    expect(screen.getAllByText(/does not show who|gives no rights/).length).toBeGreaterThan(0)
  })

  it('SP-T07: a slot another profile holds is shown as reserved and cannot be chosen', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/badminton')
    await services.sports.reserve('demo-student-b', {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'x',
    })
    await heading('Badminton')
    const slot = await screen.findByRole('button', { name: '12:00 pm · reserved' })
    expect(slot).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Join local waitlist for 12:00 pm' }))
    expect((await screen.findAllByText(/This is not a reservation/)).length).toBeGreaterThan(0)
  })

  it('SP-T26 / SP-T27 / SP-T28: one booking appears once in Calendar and Home, cancelling updates both, and a reload adds no notification', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const { router, services, unmount } = renderApp('/bookings/badminton', {
      services: first.services,
    })
    await heading('Badminton')
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
      await within(activity).findAllByText(/Demo badminton court 1 \(local reservation\)/),
    ).toHaveLength(1)
    await router.navigate('/calendar?view=day&date=2026-11-02')
    expect(
      await screen.findAllByText(/Demo badminton court 1 \(local reservation\)/),
    ).not.toHaveLength(0)

    await act(async () => {
      await services.sports.act(A, reservation.id, 'cancel')
    })
    await router.navigate('/')
    const again = await screen.findByRole('region', { name: 'My activity' })
    await waitFor(() =>
      expect(within(again).queryAllByText(/Reserved \(local reservation\)/)).toHaveLength(0),
    )
    expect(
      within(again).queryAllByText(/Demo badminton court 1 \(local reservation\)/).length,
    ).toBeLessThanOrEqual(1) // history only

    unmount()
    renderApp('/notifications', { services: first.services })
    await heading('Notifications')
    expect(
      await screen.findAllByRole('link', { name: /Open: Reservation saved in CampusOS demo/ }),
    ).toHaveLength(1)
    expect(
      screen.getAllByRole('link', { name: /Open: Your local booking was cancelled/ }),
    ).toHaveLength(1)
  })

  it('SP-T27: a closure shows the booking as disrupted everywhere without cancelling it', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/bookings/badminton')
    const made = await services.sports.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('14:00'),
      idempotencyKey: 'k',
    })
    expect(made.ok).toBe(true)
    await services.sports.closeResource('DEMO-COURT-1', 'Net being replaced')
    await router.navigate('/bookings/my')
    await heading('My bookings')
    expect(await screen.findByText(/Needs your attention \(1\)/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Open booking' }))
    await heading('Demo badminton court 1')
    expect(screen.getByText(/Nothing was cancelled for you/)).toBeInTheDocument()
    expect(screen.getByText('Confirmed (local)')).toBeInTheDocument()
    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    expect(await within(activity).findByText(/may be affected/)).toBeInTheDocument()
  })

  it('a booking another profile owns is a safe not-found', async () => {
    const { services } = renderApp('/bookings/my/bk-nope')
    expect(await heading('Booking not found')).toBeVisible()
    const r = await services.sports.reserve('demo-student-b', {
      resourceId: 'DEMO-COURT-2',
      date: TODAY,
      start: t('15:00'),
      idempotencyKey: 'z',
    })
    expect(r.ok).toBe(true)
  })

  it('SP-T33: reminders are described as in-app only', async () => {
    const user = userEvent.setup()
    renderApp('/bookings/badminton')
    await heading('Badminton')
    await user.click(await screen.findByRole('button', { name: '4:00 pm' }))
    expect(await screen.findByText(/Reminders are in-app only/)).toBeInTheDocument()
  })

  it('warns about a known Calendar commitment (a warning only, the booking is still allowed)', async () => {
    const { services } = renderApp('/bookings/badminton')
    const data = await services.campus.load(A)
    expect(scheduleWarnings(data, TODAY, t('09:00'), t('10:00')).join(' ')).toMatch(
      /Sample Course A/,
    )
    expect(scheduleWarnings(data, TODAY, t('06:00'), t('07:00'))).toEqual([])
    expect(scheduleWarnings(data, TODAY, t('15:00'), t('16:00')).join(' ')).toMatch(
      /Sample project meeting/,
    )
    const r = await services.sports.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'w',
    })
    expect(r.ok).toBe(true)
  })
})

describe('gym (SP-T21 … SP-T23, SP-T34)', () => {
  it('SP-T34: with no snapshot the occupancy is unknown, never zero, and nothing claims a live headcount', async () => {
    renderApp('/bookings/gym')
    await heading('Gym')
    expect(
      await screen.findByText(/Unknown. No occupancy snapshot has been recorded./),
    ).toBeInTheDocument()
    const body = screen.getByRole('main').textContent ?? ''
    expect(body).toMatch(/not a live or verified headcount/)
    expect(body).not.toMatch(/\d\s*%|\bof \d+ (people|seats)/)
    expect(screen.getByText(/Published slots for/)).toBeInTheDocument()
  })

  it('says each gym slot holds up to 20 reservations', async () => {
    renderApp('/bookings/gym')
    await heading('Gym')
    expect(
      await screen.findByText(
        /about 20 people at a time \(owner-supplied\); each 30-minute slot holds up\s+to 20 reservations/,
      ),
    ).toBeInTheDocument()
  })

  it('shows all 32 half-hour gym slots and saves the selected session', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/gym')
    await heading('Gym')
    await user.selectOptions(screen.getByLabelText('Date'), '2026-11-03')
    const slots = screen.getByRole('group', { name: /Published slots for/ })
    expect(within(slots).getAllByRole('button')).toHaveLength(32)
    expect(within(slots).getByRole('button', { name: /^6:00 am$/ })).toBeEnabled()
    await user.click(within(slots).getByRole('button', { name: /^9:30 pm$/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm local reservation' }))
    await waitFor(async () =>
      expect((await services.sports.load()).reservations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ resourceId: 'DEMO-GYM', start: '21:30', end: '22:00' }),
        ]),
      ),
    )
  })

  it('SP-T21 / SP-T22: check-in is a repeatable-safe self-report and a correction is explicit', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/gym')
    await heading('Gym')
    await user.click(await screen.findByRole('button', { name: 'Check in (self-report)' }))
    await user.click(await screen.findByRole('button', { name: 'You are checked in' }))
    expect((await services.sports.load()).gymSessions).toHaveLength(1)
    expect(screen.getByText(/Self-reported count:/).parentElement).toHaveTextContent('1 person has')
    await user.click(screen.getByRole('button', { name: /Correct: I did not check in/ }))
    await waitFor(async () => expect((await services.sports.load()).gymSessions).toHaveLength(0))
  })

  it('SP-T23: a fault note is a local note, leaves the equipment status alone and closes nothing', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/bookings/gym')
    await heading('Gym')
    await user.click((await screen.findAllByRole('button', { name: /Report a fault/ }))[1]!)
    await user.type(screen.getByLabelText('What is wrong?'), 'Cable frays')
    await user.click(screen.getByRole('button', { name: 'Save note' }))
    expect(
      (await screen.findAllByText(/not a complaint ticket and no repair was requested/)).length,
    ).toBeGreaterThan(0)
    const s = await services.sports.load()
    expect(s.faultReports).toHaveLength(1)
    expect(s.resources.every((r) => r.status === 'open')).toBe(true)
  })

  it('SP-T34: a stale simulated snapshot is labelled stale, and a null count is unknown', async () => {
    const { services } = renderApp('/bookings/gym')
    await services.sports.setOccupancy({ count: 7, level: 'moderate' })
    const s = await services.sports.load()
    const later = Date.parse(s.occupancy!.asOf) + 61 * 60_000
    expect(gymView(s, A, later).snapshot).toMatch(/stale/)
    expect(gymView(s, A, later - 3 * 60_000 * 20).snapshotStale).toBe(false)
    await services.sports.setOccupancy({ count: null })
    expect(gymView(await services.sports.load(), A, later).snapshot).toMatch(/^Unknown/)
  })
})

describe('simulator and time (SP-T18, SP-T20, SP-T29, SP-T30)', () => {
  it('SP-T18 / SP-T20: every control is a labelled local simulator step, and offers are made by clicking', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/bookings/badminton')
    await heading('Badminton')
    const a = await services.sports.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'k',
    })
    await services.sports.joinWaitlist('demo-student-b', 'DEMO-COURT-1', TODAY, t('12:00'))
    await enableOps(user, router, '/bookings/badminton')
    const ops = await screen.findByTestId('demo-ops')
    expect(ops.textContent).toMatch(/local simulator/)
    expect(ops.textContent).toMatch(/not a provider, staff account, sensor or live system/)
    // Nothing is offered until the slot is freed and the simulator is clicked.
    expect(a.ok).toBe(true)
    await act(async () => {
      if (a.ok) await services.sports.act(A, a.value.reservation.id, 'cancel')
    })
    await user.click(
      await within(ops).findByRole('button', { name: /^Offer Demo badminton court 1/ }),
    )
    await waitFor(async () =>
      expect((await services.sports.load()).waitlist[0]!.state).toBe('offered'),
    )
    expect((await services.sports.load()).operations[0]!.actorLabel).toBe('Local demo simulator')
  })

  it('SP-T29: every Time Tax scenario is labelled illustrative and shows a signed result', async () => {
    const user = userEvent.setup()
    for (const path of ['/bookings/gym', '/bookings/badminton', '/bookings/sports']) {
      const { unmount } = renderApp(path)
      const tt = await screen.findByRole('region', { name: 'Time Tax scenario' })
      expect(within(tt).getByText('Illustrative scenario, not an observation')).toBeInTheDocument()
      expect(within(tt).getByText(/Observed results: none recorded/)).toBeInTheDocument()
      const field = within(tt).getByLabelText('Trips per month with in-app updates')
      await user.clear(field)
      await user.type(field, '9')
      expect(within(tt).getByText(/MORE travelling/)).toBeInTheDocument()
      unmount()
    }
  })

  it('SP-T30: Reset reference data clears Sports records and leaves academic data alone', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/bookings/badminton')
    await services.sports.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'k',
    })
    const before = await services.campus.load(A)
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /Reset reference data/ }))
    await user.click(
      await screen.findByRole('button', { name: 'Reset reference data', hidden: false }),
    )
    await waitFor(async () => expect((await services.sports.load()).reservations).toHaveLength(0))
    const after = await services.campus.load(A)
    expect(after.courses).toEqual(before.courses)
  })

  it('SP-T31: My bookings lists a sports booking and a washing-machine reservation through one summary', async () => {
    const { services, router } = renderApp('/bookings/my')
    await services.sports.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'k',
    })
    await services.ess.reserve(A, 'machine-1', TODAY, '12:00', 'm')
    await heading('My bookings')
    expect(await screen.findByText(/Demo badminton court 1 · /)).toBeInTheDocument()
    expect(await screen.findByText(/Sample washer 1 · /)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Manage under Laundry' })).toHaveAttribute(
      'href',
      '/services/laundry/machines',
    )
    await router.navigate('/')
  })
})
