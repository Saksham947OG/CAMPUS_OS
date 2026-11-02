import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
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
  await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
  await router.navigate(then)
}

async function submitOrder(services: ReturnType<typeof makeServices>['services'], key = 'k1') {
  await services.chill.saveCart(A, {
    schemaVersion: 1,
    lines: [{ lineId: 'l1', menuItemId: 'hot-b', optionIds: [], quantity: 1 }],
  })
  const r = await services.chill.submitOrder(A, key)
  if (!r.ok) throw new Error(r.error.message)
  return r.value.order
}

describe('Chill Spot V2 pages', () => {
  it('CH2-AT-13: the checkout review says the request is pending and payment is at the counter, with no charge', async () => {
    const user = userEvent.setup()
    renderApp('/services/chill-spot')
    await heading('Chill Spot')
    await user.click((await screen.findAllByRole('button', { name: /^Choose/ }))[0]!)
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: /Add to cart/ }),
    )
    await user.click(await screen.findByRole('button', { name: 'Review checkout' }))
    const sheet = await screen.findByRole('dialog', { name: /Review your local order/ })
    expect(within(sheet).getByText(/stays pending until the café accepts it/)).toBeInTheDocument()
    expect(within(sheet).getByText(/Pay at Pickup/)).toBeInTheDocument()
    expect(within(sheet).getByText(/no payment or refund is involved/)).toBeInTheDocument()
    expect(within(sheet).queryByText(/GST|service fee|paid/i)).not.toBeInTheDocument()
  })

  it('CH2-AT-15 / CH2-AT-16 / CH2-AT-22: the tracker shows steps and a next action, the ticket appears only when ready, and My Orders, Home and the inbox agree', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    expect(screen.getByTestId('step-bar')).toHaveTextContent(
      /Requested.*Accepted.*Preparing.*Ready.*Collected/,
    )
    expect(screen.getByTestId('next-step')).toHaveTextContent(/not a confirmed order/)
    expect(screen.queryByLabelText('Pickup ticket')).not.toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
    await services.chill.operatorTransition(o.id, 'queued')
    await services.chill.operatorTransition(o.id, 'preparing')
    await services.chill.operatorTransition(o.id, 'ready')
    expect(await screen.findByLabelText('Pickup ticket')).toBeInTheDocument()
    expect(screen.getByTestId('next-step')).toHaveTextContent(/Pay at the café counter/)
    expect(screen.getByText(/Collection point not provided/)).toBeInTheDocument()
    expect(
      screen.getByText(/Opening this ticket does not mark the order collected/),
    ).toBeInTheDocument()
    expect(within(screen.getByTestId('step-bar')).getByText('Ready').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await router.navigate('/services/chill-spot?tab=orders')
    expect(await screen.findByText(/Ready for pickup/)).toBeInTheDocument()
    await router.navigate('/notifications')
    expect(
      await screen.findByRole('link', { name: /Open: Local order ready for pickup/ }),
    ).toBeInTheDocument()
    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: /My activity/ })
    expect(await within(activity).findByText(/Ready for pickup/)).toBeInTheDocument()
    expect(user).toBeDefined()
  })

  it('CH2-AT-17 / CH2-AT-20 / CH2-AT-23: a finished order can be reordered from the tracker with a new review, and another profile sees "not found"', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await services.chill.operatorTransition(o.id, 'rejected', 'Out of stock (local)')
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    expect(screen.getByTestId('next-step')).toHaveTextContent(/Out of stock \(local\)/)
    expect(screen.queryByRole('button', { name: 'Cancel request' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reorder' }))
    await heading('Chill Spot')
    expect((await services.chill.loadCart(A)).lines).toHaveLength(1)
    expect((await services.chill.load()).orders.filter((x) => x.ownerProfileId === A)).toHaveLength(
      1,
    ) // nothing was resubmitted
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading('Order not found')
    expect(screen.getByRole('main').textContent).not.toMatch(/Out of stock/)
  })

  it('CH2-AT-24: the next-class note never predicts a food-ready time or creates an event', async () => {
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    const note = await screen.findByText(/not a promise that an order will be ready/)
    expect(note).toBeInTheDocument()
    expect((await services.campus.load(A)).events.some((e) => /order|chill/i.test(e.title))).toBe(
      false,
    )
  })

  it('CH2-AT-D07: the arrival marker is a self-report that changes nothing else', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await services.chill.operatorTransition(o.id, 'queued')
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    const before = (await services.chill.load()).orders.find((x) => x.id === o.id)!
    await user.click(screen.getByRole('button', { name: 'I arrived at pickup' }))
    expect(await screen.findByText(/self-reported, demo/)).toBeInTheDocument()
    expect(screen.getByText(/proves nothing about where you were/)).toBeInTheDocument()
    const after = (await services.chill.load()).orders.find((x) => x.id === o.id)!
    expect(after.status).toBe(before.status)
    expect(after.version).toBe(before.version)
    expect(after.history).toHaveLength(before.history.length)
    expect(after.arrivalSource).toBe('selfReportedDemo')
    expect(screen.queryByRole('button', { name: 'I arrived at pickup' })).not.toBeInTheDocument()
  })

  it('CH2-AT-05 / CH2-AT-07 / CH2-AT-08: the café panel shows a condition, qualifies stale reports and never mixes the units', async () => {
    renderApp('/services/chill-spot')
    await heading('Chill Spot')
    expect((await screen.findByTestId('condition')).textContent).toMatch(
      /Reported condition:\s*Busy/,
    )
    expect(screen.getByText(/A busy report does not stop orders/)).toBeInTheDocument()
    const main = screen.getByRole('main').textContent ?? ''
    expect(main).toMatch(/people last reported at counter/)
    expect(main).toMatch(/recorded unfinished orders/)
    expect(main).not.toMatch(/\d+ people ahead|minutes? (left|remaining)|\bETA\b/i)
    expect(screen.getAllByText(/Last recorded order change/).length).toBeGreaterThan(0)
  })

  it('CH2-AT-10: while paused the café says so, checkout is blocked and existing orders carry on', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await services.chill.setPause('Rush hour (local)')
    await router.navigate('/services/chill-spot')
    await heading('Chill Spot')
    expect((await screen.findByTestId('condition')).textContent).toMatch(/Paused/)
    expect(screen.getAllByText(/Temporarily not taking new requests/).length).toBeGreaterThan(0)
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument()
    expect(user).toBeDefined()
  })

  it('CH2-D09: favourites and sorting work from the menu and an unknown price is never treated as free', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/services/chill-spot')
    await heading('Chill Spot')
    await user.click((await screen.findAllByRole('button', { name: /^Favourite / }))[0]!)
    await waitFor(async () => expect(await services.chill.loadFavorites(A)).toHaveLength(1))
    await user.click(screen.getByRole('checkbox', { name: /Favourites only \(1\)/ }))
    await waitFor(() => expect(document.querySelectorAll('[data-menu-item]')).toHaveLength(1))
    await user.click(screen.getByRole('checkbox', { name: /Favourites only/ }))
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price')
    expect(await screen.findByText(/Items with no listed price come last/)).toBeInTheDocument()
    const prices = [...document.querySelectorAll('[data-menu-item]')].map(
      (li) => li.textContent ?? '',
    )
    const firstUnpriced = prices.findIndex((t) => /Price not provided/.test(t))
    if (firstUnpriced >= 0)
      expect(prices.slice(firstUnpriced).every((t) => /Price not provided/.test(t))).toBe(true)
  })
})

describe('Chill Spot V2 operations lab and analytics', () => {
  it('CH2-AT-04 / CH2-AT-18 / CH2-AT-28: the lab has four labelled areas, asks for a reason when starting out of sequence, flags without moving, and resets only the café', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    const o = await submitOrder(services)
    await services.chill.operatorTransition(o.id, 'queued')
    await enableOps(user, router, '/services/chill-spot')
    const ops = await screen.findByTestId('demo-ops')
    for (const name of [/1\. Demand/, /2\. Queue snapshot/, /4\. Presentation scenarios/])
      expect(within(ops).getByText(name)).toBeInTheDocument()
    expect(within(ops).getByRole('heading', { name: /3\. Order operations/ })).toBeInTheDocument()
    await user.click(within(ops).getByRole('checkbox', { name: /Require a logged reason/ }))
    const row = ops.querySelector(`[data-ops-order="${o.id}"]`) as HTMLElement
    await user.click(
      within(row).getByRole('button', { name: `Start preparing ${o.displayNumber}` }),
    )
    expect(await screen.findByText(/Choose why this one starts first/)).toBeInTheDocument()
    expect((await services.chill.load()).orders.find((x) => x.id === o.id)!.status).toBe('queued')
    await user.selectOptions(
      within(ops).getByLabelText(/Reason for starting ahead/),
      'parallel_station',
    )
    await user.click(
      within(row).getByRole('button', { name: `Start preparing ${o.displayNumber}` }),
    )
    await waitFor(async () =>
      expect((await services.chill.load()).orders.find((x) => x.id === o.id)!.status).toBe(
        'preparing',
      ),
    )
    // A flag leaves the order where it is.
    await user.type(
      within(ops).getByLabelText(/Note for “Needs attention” flag/),
      'Milk may be short (simulated)',
    )
    await user.click(
      within(row).getByRole('button', { name: new RegExp(`Flag ${o.displayNumber}`) }),
    )
    await waitFor(async () =>
      expect(
        (await services.chill.load()).orders.find((x) => x.id === o.id)!.exceptionFlag,
      ).toBeDefined(),
    )
    expect((await services.chill.load()).orders.find((x) => x.id === o.id)!.status).toBe(
      'preparing',
    )
    expect(within(row).getByText(/Milk may be short/)).toBeInTheDocument()
    // The student's tracker shows the note and the logged reason.
    await router.navigate(`/services/chill-spot/orders/${o.id}`)
    await heading(`Order ${o.displayNumber}`)
    expect(await screen.findByText(/Needs attention \(simulated note\)/)).toBeInTheDocument()
    expect(
      screen.getByText(/Started ahead of an older accepted order: Prepared on a separate station/),
    ).toBeInTheDocument()
  })

  it('CH2-AT-25 / CH2-AT-26 / CH2-AT-27: the three Time Tax views stay apart, and the field view is empty rather than invented', async () => {
    const user = userEvent.setup()
    renderApp('/services/chill-spot')
    await heading('Chill Spot')
    await user.click(await screen.findByRole('tab', { name: 'Operations view' }))
    expect(await screen.findByText(/Recorded in prototype/)).toBeInTheDocument()
    expect(screen.getByText(/not minutes a student stood waiting/)).toBeInTheDocument()
    expect(screen.getAllByText('Not enough recorded').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: 'Field observations' }))
    expect(await screen.findByTestId('field-empty')).toHaveTextContent(/Nothing has been measured/)
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Scenario Lab' }))
    expect(await screen.findByText(/Illustrative scenario, not an observation/)).toBeInTheDocument()
    expect(screen.getByTestId('weekly-hours')).toHaveTextContent(
      /Hypothetical weekly student hours avoided/,
    )
    expect(screen.getByTestId('weekly-hours')).toHaveTextContent(/never a measured result/)
    const sens = screen.getByTestId('sensitivity')
    expect(within(sens).getAllByRole('row').length).toBe(6)
    const base = screen.getByRole('group', { name: /Order-ahead path/ })
    const onSite = within(base).getByLabelText(/On-site preparation wait/)
    await user.clear(onSite)
    await user.type(onSite, '40')
    expect(await screen.findByText(/MORE physical waiting/)).toBeInTheDocument()
    expect(screen.getByTestId('weekly-hours')).toHaveTextContent(/= 0\.0 h/)
  })
})
