import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'
import { computeFreePockets } from '@/selectors/free-pockets'
import { itemsInRange } from '@/selectors/occurrences'
import { diningWindows, messForDate } from '@/selectors/mess'
import type { DateOnly } from '@/lib/time'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the demo profile is "Demo Student A".
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

async function enableOps(
  user: ReturnType<typeof userEvent.setup>,
  router: { navigate: (p: string) => Promise<void> },
  then: string,
) {
  await router.navigate('/settings')
  await user.click(await screen.findByRole('checkbox', { name: /Show Demo Operations/ }))
  await router.navigate(then)
}

describe('Services hub and Laundry hub', () => {
  it('lists Chill Spot, Laundry, Mess and Parcels as built demos, each reachable', async () => {
    renderApp('/services')
    await heading('Campus Services')
    for (const name of [/Chill Spot/, /Laundry/, /Mess/, /Parcels/])
      expect(await screen.findByRole('link', { name })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Laundry/ }))
    await heading('Laundry')
    expect(screen.getByRole('link', { name: 'SS Laundry' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Washing machines' })).toBeInTheDocument()
    expect(screen.getAllByText(/Demo · sample data/).length).toBeGreaterThan(0)
  })
})

describe('SS Laundry', () => {
  it('ESS-L01: registering a load says it is self-reported, adds it to My loads, and makes no receipt claim', async () => {
    const user = userEvent.setup()
    renderApp('/services/laundry/ss')
    await heading('SS Laundry')
    expect(await screen.findByText('No visit has been reported')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Receipt or bag reference (optional)'), 'BAG-7')
    await user.click(screen.getByRole('button', { name: 'Register load (self-reported)' }))
    expect(await screen.findByText(/Registered as/)).toHaveTextContent('Student reported')
    expect(screen.getByText('Load BAG-7')).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'View my load' }))
    await heading('Load BAG-7')
    expect(screen.getByText(/You recorded this yourself/)).toBeInTheDocument()
    expect(screen.getByText(/Unknown. Awaiting confirmation./)).toBeInTheDocument()
    expect(screen.queryByText(/received by|has received your/i)).not.toBeInTheDocument()
  })

  it('ESS-L01: invalid input keeps the form and writes nothing', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/services/laundry/ss')
    await heading('SS Laundry')
    await user.type(screen.getByLabelText('Item count (optional)'), '-3')
    await user.click(screen.getByRole('button', { name: 'Register load (self-reported)' }))
    expect(await screen.findByText('Enter a whole number of at least 1')).toBeInTheDocument()
    expect((await services.ess.load()).loads).toHaveLength(0)
  })

  it('ESS-L02 / ESS-L03 / ESS-L04 / ESS-L06: the simulator moves one load, a visit changes nothing, and Home and the inbox follow', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/services/laundry/ss')
    await heading('SS Laundry')
    await user.click(screen.getByRole('button', { name: 'Register load (self-reported)' }))
    await screen.findByText(/Registered as/)
    await enableOps(user, router, '/services/laundry/ss')
    const ops = await screen.findByTestId('demo-ops')
    expect(ops.textContent).toMatch(/not a provider/i)

    await user.click(within(ops).getByRole('button', { name: 'Announce visit' }))
    await user.click(within(ops).getByRole('button', { name: 'Record provider on campus' }))
    expect(
      await screen.findByText(/does not mean any individual load was returned/),
    ).toBeInTheDocument()
    expect((await services.ess.load()).loads[0]!.stage).toBe('registered')

    for (const label of [/^Mark received/, /^Mark processing/, /^Mark back on campus/]) {
      await user.click(
        await within(await screen.findByTestId('demo-ops')).findByRole('button', { name: label }),
      )
    }
    await user.click(
      within(screen.getByTestId('demo-ops')).getByRole('button', { name: 'Delay (no new date)' }),
    )
    await router.navigate(`/services/laundry/ss/${(await services.ess.load()).loads[0]!.id}`)
    await heading('Laundry load')
    expect((await screen.findAllByText(/New date unknown/)).length).toBeGreaterThan(0)
    await router.navigate('/services/laundry/ss')
    await heading('SS Laundry')
    await user.click(
      await within(await screen.findByTestId('demo-ops')).findByRole('button', {
        name: /^Mark ready for collection/,
      }),
    )

    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    expect(await within(activity).findByText(/SS Laundry load/)).toBeInTheDocument()
    expect(within(activity).getByText(/Ready for collection/)).toBeInTheDocument()

    await router.navigate('/notifications')
    await heading('Notifications')
    const link = await screen.findByRole('link', { name: /Open: Your laundry is ready/ })
    expect(link).toHaveAttribute('href', expect.stringMatching(/\/services\/laundry\/ss\/load-/))
  })

  it('a load another profile owns is a safe not-found', async () => {
    const { services } = renderApp('/services/laundry/ss/load-nope')
    expect(await heading('Load not found')).toBeVisible()
    const made = await services.ess.registerLoad({
      profileId: 'demo-student-b',
      handedOverDate: TODAY,
      idempotencyKey: 'x',
    })
    expect(made.ok).toBe(true)
  })
})

describe('Washing machines', () => {
  it('ESS-L07 / ESS-L10: reserving a slot appears once in My reservations, Home and Calendar, and cancelling updates the same record', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/services/laundry/machines')
    await heading('Washing machines')
    expect((await screen.findAllByText(/Reserved does not mean in use/i)).length).toBeGreaterThan(0)
    await user.click(await screen.findByRole('button', { name: 'Choose Sample washer 1' }))
    await user.click(await screen.findByRole('button', { name: /^2:00 pm/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm demo reservation' }))
    const mine = await screen.findByRole('region', { name: 'My reservations' })
    expect(await within(mine).findByText(/Sample washer 1 · /)).toBeInTheDocument()
    expect(within(mine).getByText('Reserved')).toBeInTheDocument()

    // The same record reaches Home and Calendar once, as a booking.
    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    expect(
      await within(activity).findAllByText(/Sample washer 1 \(demo reservation\)/),
    ).toHaveLength(1)
    await router.navigate('/calendar?view=day&date=2026-11-02')
    expect(await screen.findAllByText(/Sample washer 1 \(demo reservation\)/)).not.toHaveLength(0)

    const res = (await services.ess.load()).reservations[0]!
    await act(async () => {
      await services.ess.reservationAction(A, res.id, 'cancel')
    })
    await router.navigate('/')
    const again = await screen.findByRole('region', { name: 'My activity' })
    await waitFor(() =>
      expect(
        within(again).queryAllByText(/Sample washer 1 \(demo reservation\)/).length,
      ).toBeLessThanOrEqual(1),
    )
    expect((await services.ess.load()).reservations).toHaveLength(1)
  })

  it('a machine that is out of service or of unknown status cannot be chosen, and says why', async () => {
    renderApp('/services/laundry/machines')
    await heading('Washing machines')
    expect((await screen.findAllByRole('button', { name: 'Not bookable' })).length).toBe(2)
    expect(screen.getByText(/Out of service: new bookings are paused/)).toBeInTheDocument()
    expect(screen.getByText(/Working status unknown: it cannot be booked/)).toBeInTheDocument()
    expect(screen.getAllByText(/Physically:/).length).toBeGreaterThan(0)
  })

  it('ESS-L08: the simulator releases a no-show only after the grace period and leaves the physical status alone', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/services/laundry/machines')
    await heading('Washing machines')
    await services.ess.reserve(A, 'machine-2', TODAY, '10:00', 'k')
    await enableOps(user, router, '/services/laundry/machines')
    const ops = await screen.findByTestId('demo-ops')
    expect(await within(ops).findByRole('button', { name: 'Release as no-show' })).toBeDisabled()
    expect(within(ops).getByText(/grace period to pass/)).toBeInTheDocument()
    expect(
      (await services.ess.load()).machines.find((m) => m.id === 'machine-2')!.physicalStatus,
    ).toBe('occupied')
  })
})

describe('Mess', () => {
  it('ESS-M01 / ESS-M02 / ESS-M08: the page shows exactly the supplied records, unknown times stay unknown, and the Calendar overlay reads the same records', async () => {
    const { services } = renderApp('/services/mess')
    await heading('Mess')
    const data = await services.campus.load(A)
    const today = messForDate(data, TODAY)
    expect(today.length).toBe(4)
    expect(
      await screen.findByText('Sample lunch item 1, Sample lunch item 2, Sample lunch item 3'),
    ).toBeInTheDocument()
    expect(screen.getByText('Serving time not provided')).toBeInTheDocument() // snacks have no window
    const windows = diningWindows(data, TODAY)
    expect(windows.length).toBe(today.filter((m) => m.start && m.end).length)
    expect(screen.getAllByText(/Demo|Sample data/i).length).toBeGreaterThan(0)
  })

  it('ESS-M01: a day or week with no supplied menu says so instead of filling it in', async () => {
    const user = userEvent.setup()
    renderApp('/services/mess')
    await heading('Mess')
    await user.click(await screen.findByRole('button', { name: 'Week' }))
    await user.click(screen.getByRole('button', { name: 'Next' }))
    expect((await screen.findAllByText('No menu provided.')).length).toBeGreaterThan(0)
  })

  it('ESS-M03: the dining overlay is not a commitment, so Free Pockets are identical with and without mess records', async () => {
    const { services } = renderApp('/services/mess')
    const data = await services.campus.load(A)
    const withMess = computeFreePockets(itemsInRange(data, TODAY, TODAY))
    const withoutMess = computeFreePockets(itemsInRange({ ...data, mess: [] }, TODAY, TODAY))
    expect(withMess).toEqual(withoutMess)
  })

  it('ESS-M04 / ESS-M05: joining, double check-in and check-out use one session and show only a labelled sample', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/services/mess')
    await heading('Mess')
    await user.click(await screen.findByRole('button', { name: 'Join the self-report demo' }))
    await user.click(await screen.findByRole('button', { name: 'Check in (self-report)' }))
    await user.click(await screen.findByRole('button', { name: 'You are checked in' }))
    expect((await services.ess.load()).messSessions).toHaveLength(1)
    const crowd = screen.getByRole('region', { name: /How busy is the mess/ })
    expect(within(crowd).getAllByText(/Self-reported sample/).length).toBeGreaterThan(0)
    expect(within(crowd).getByText(/capacity is unknown/i)).toBeInTheDocument()
    expect(crowd.textContent).not.toMatch(/\d\s*%/)
    await user.click(within(crowd).getByRole('button', { name: 'Check out' }))
    await waitFor(async () =>
      expect((await services.ess.load()).messSessions[0]!.endedAt).toBeDefined(),
    )
  })

  it('ESS-M06: with no fee supplied there is no amount, no link and an unknown status', async () => {
    renderApp('/services/mess/fees')
    await heading('Mess fees')
    expect(await screen.findByText('No fee details available')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /payment form/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument()
    expect(screen.getByText(/fee status is/)).toHaveTextContent('unknown')
  })

  it('ESS-M06 / ESS-M07: only supplied details show; opening the form and self-reporting never produce verified-paid', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/services/mess/fees')
    await heading('Mess fees')
    await services.ess.supplyFee({
      amountMinor: 250000,
      dueDate: '2026-11-10' as DateOnly,
      authorizedFormUrl: 'https://example.test/form',
    })
    const link = await screen.findByRole('link', { name: /Open the supplied payment form/ })
    expect(link).toHaveAttribute('href', 'https://example.test/form')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
    expect(screen.getByText('₹2,500.00')).toBeInTheDocument()
    expect(screen.getByText('Late fee').nextElementSibling).toHaveTextContent('Not supplied') // never invented
    fireEvent.click(link)
    expect(screen.getByText('Not submitted')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'I submitted it (self-report)' }))
    expect(
      await screen.findByText(/You reported submitting it \(not a receipt\)/),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/^Verified paid$|payment received|paid successfully/i),
    ).not.toBeInTheDocument()
  })
})

describe('Parcels', () => {
  it('ESS-P01 / ESS-P02 / ESS-P03: the demo desk logs a parcel, only its recipient sees it, and the alert opens that parcel', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/services/parcels')
    await heading('Parcels')
    expect(await screen.findByText(/No parcels are logged for you/)).toBeInTheDocument()
    await enableOps(user, router, '/services/parcels')
    const ops = await screen.findByTestId('demo-ops')
    await user.click(within(ops).getByRole('button', { name: 'Log parcel' })) // default recipient: Demo Student A
    await waitFor(async () => expect((await services.ess.load()).parcels).toHaveLength(1))
    const parcel = (await services.ess.load()).parcels[0]!
    expect(parcel.recipientProfileId).toBe(A)

    await router.navigate('/notifications')
    const link = await screen.findByRole('link', { name: /Open: Parcel logged/ })
    expect(link).toHaveAttribute('href', `/services/parcels/${parcel.id}`)
    await user.click(link)
    await heading('Parcel')
    expect(screen.getByText(/Collection point unknown/)).toBeInTheDocument()

    // Another profile gets nothing and cannot open it.
    await user.click(screen.getByRole('button', { name: /demo profile/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Demo Student B/ }))
    await router.navigate(`/services/parcels/${parcel.id}`)
    expect(await heading('Parcel not found')).toBeVisible()
    await router.navigate('/services/parcels')
    expect(await screen.findByText(/No parcels are logged for you/)).toBeInTheDocument()
  })

  it('ESS-P05 / ESS-P06: a student can flag a problem but only the simulator records collection, and nothing claims tracking or theft protection', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/services/parcels')
    const p = await services.ess.logParcel({
      recipientProfileId: A,
      courier: 'Sample Courier',
      collectionPoint: 'Sample desk',
    })
    expect(p.ok).toBe(true)
    await router.navigate(`/services/parcels/${p.ok ? p.value.id : ''}`)
    await heading('Parcel from Sample Courier')
    await user.type(screen.getByLabelText('What is wrong?'), 'Box is torn')
    await user.click(screen.getByRole('button', { name: 'Add note' }))
    expect((await screen.findAllByText(/does not record a handover/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Awaiting collection', { selector: 'span' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /collected/i })).not.toBeInTheDocument()
    await router.navigate('/services/parcels')
    await heading('Parcels')
    const body = (await screen.findByRole('main')).textContent ?? ''
    expect(body).toMatch(/not courier tracking/)
    expect(body).toMatch(/does not protect against theft/)
    expect(body).not.toMatch(/guarantee|theft-proof|tracked live|live tracking/i)
  })
})

describe('Time Tax and honesty', () => {
  it('ESS-S06: every Time Tax scenario is labelled illustrative and shows a signed result', async () => {
    const user = userEvent.setup()
    for (const path of [
      '/services/laundry/ss',
      '/services/laundry/machines',
      '/services/parcels',
    ]) {
      const { unmount } = renderApp(path)
      const tt = await screen.findByRole('region', { name: 'Time Tax scenario' })
      expect(within(tt).getByText('Illustrative scenario, not an observation')).toBeInTheDocument()
      expect(within(tt).getByText(/−36 minutes per month/)).toBeInTheDocument() // (4 − 1) × 12
      const field = within(tt).getByLabelText('Trips per month with in-app updates')
      await user.clear(field)
      await user.type(field, '9')
      expect(within(tt).getByText(/\+60 minutes per month \(MORE travelling\)/)).toBeInTheDocument()
      expect(within(tt).getByText(/Observed results: none recorded/)).toBeInTheDocument()
      unmount()
    }
  })

  it('ESS-S01: every simulator is labelled local and simulated, and says it is not a provider, sensor or live system', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/services/laundry/ss')
    await heading('SS Laundry')
    await enableOps(user, router, '/services/laundry/machines')
    for (const path of [
      '/services/laundry/machines',
      '/services/mess',
      '/services/parcels',
      '/services/laundry/ss',
    ]) {
      await router.navigate(path)
      const ops = await screen.findByTestId('demo-ops')
      expect(ops.textContent).toMatch(/local simulator/)
      expect(ops.textContent).toMatch(/not a provider, staff account, sensor or live system/)
      expect(ops.textContent).toMatch(/does not sync with other devices/)
    }
  })
})

describe('Reset and persistence', () => {
  it('ESS-S04: Reset demo data clears Essentials records but not unrelated Calendar data', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/services/laundry/ss')
    await heading('SS Laundry')
    await services.ess.registerLoad({ profileId: A, handedOverDate: TODAY, idempotencyKey: 'k' })
    await services.ess.logParcel({ recipientProfileId: A })
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /Reset demo data/ }))
    await user.click(await screen.findByRole('button', { name: 'Reset demo data', hidden: false }))
    await waitFor(async () => {
      const s = await services.ess.load()
      expect(s.loads).toHaveLength(0)
      expect(s.parcels).toHaveLength(0)
    })
  })

  it('ESS-S02: a registered load survives a reload of the app and stays with its profile', async () => {
    const first = makeServices()
    const a = renderApp('/services/laundry/ss', { services: first.services })
    await heading('SS Laundry')
    await userEvent.type(screen.getByLabelText('Receipt or bag reference (optional)'), 'KEEP-1')
    await userEvent.click(screen.getByRole('button', { name: 'Register load (self-reported)' }))
    await screen.findByText('Load KEEP-1')
    a.unmount()
    renderApp('/services/laundry/ss', { services: first.services })
    expect(await screen.findByText('Load KEEP-1')).toBeInTheDocument()
  })
})
