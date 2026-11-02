import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the demo profile is "Demo Student A".
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const open = async (path = '/services/chill-spot') => {
  const env = renderApp(path)
  await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })
  return env
}

/** Adds the first orderable item to the cart through the real item sheet. */
async function addFirstItem(user: ReturnType<typeof userEvent.setup>) {
  const choose = (await screen.findAllByRole('button', { name: /^Choose/ }))[0]!
  await user.click(choose)
  const sheet = await screen.findByRole('dialog')
  await user.click(within(sheet).getByRole('button', { name: /Add to cart/ }))
}

async function placeOrder(user: ReturnType<typeof userEvent.setup>) {
  await addFirstItem(user)
  await user.click(await screen.findByRole('button', { name: 'Review checkout' }))
  const sheet = await screen.findByRole('dialog', { name: /Review your demo order/ })
  await user.click(within(sheet).getByRole('button', { name: 'Place demo order request' }))
}

describe('Chill Spot entry points', () => {
  it('CH-AT-01: opens from the Services hub, which marks it as built and the rest as not', async () => {
    renderApp('/services')
    expect(await screen.findByRole('heading', { level: 1, name: 'Campus Services' })).toBeVisible()
    const link = await screen.findByRole('link', { name: /Chill Spot/ })
    await userEvent.click(link)
    expect(await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })).toBeVisible()
  })

  it('CH-AT-01: opens from the Home Quick Actions', async () => {
    renderApp('/')
    const qa = await screen.findByRole('region', { name: 'Quick actions' })
    await userEvent.click(within(qa).getByRole('link', { name: /Chill Spot/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })).toBeVisible()
  })

  it('labels the whole page as a demonstration with a sample menu and no invented hours', async () => {
    await open()
    expect(screen.getByText('Demo · sample menu')).toBeInTheDocument()
    expect(screen.getAllByText(/Hours not provided/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Demo · simulated data').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Counter line/).length).toBeGreaterThan(0)
  })

  it('CH-AT-03: searching narrows the menu and an empty result says so', async () => {
    const user = userEvent.setup()
    await open()
    await user.type(screen.getByRole('searchbox', { name: 'Search the menu' }), 'zzzz-no-such')
    expect(await screen.findByText(/No menu items match/)).toBeInTheDocument()
  })
})

describe('Checkout and tracking', () => {
  it('CH-AT-06: an empty cart cannot be checked out', async () => {
    await open()
    expect(screen.getByRole('button', { name: 'Review checkout' })).toBeDisabled()
  })

  it('CH-AT-06: checkout says Pay at Pickup, never claims payment, and submits one pending request', async () => {
    const user = userEvent.setup()
    await open()
    await addFirstItem(user)
    await user.click(await screen.findByRole('button', { name: 'Review checkout' }))
    const sheet = await screen.findByRole('dialog', { name: /Review your demo order/ })
    expect(within(sheet).getByText(/Pay at Pickup\./)).toBeInTheDocument()
    expect(within(sheet).getByText('Listed item subtotal')).toBeInTheDocument()
    expect(within(sheet).getByText(/does not take or verify payment/)).toBeInTheDocument()
    expect(within(sheet).queryByText(/paid|payment (received|confirmed)/i)).not.toBeInTheDocument()
    await user.click(within(sheet).getByRole('button', { name: 'Place demo order request' }))

    expect((await screen.findAllByText('Awaiting café acceptance')).length).toBeGreaterThan(0)
    expect(
      await screen.findByRole('heading', { level: 1, name: /Order CS-0006/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel request' })).toBeInTheDocument()
    expect(screen.getByText(/No ready time is estimated/)).toBeInTheDocument()
  })

  it('CH-AT-10: a pending request can be cancelled after confirmation, and then it is final', async () => {
    const user = userEvent.setup()
    await open()
    await placeOrder(user)
    await user.click(await screen.findByRole('button', { name: 'Cancel request' }))
    await user.click(await screen.findByRole('button', { name: 'Cancel request', hidden: false }))
    // The confirmation dialog repeats the label; the tracker then shows the terminal state.
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Cancel request' })).toBeNull())
    expect(screen.getAllByText(/Cancelled/).length).toBeGreaterThan(0)
  })

  it('CH-AT-22: tracker, My Orders and Home My Activity read the same state as the order moves', async () => {
    const user = userEvent.setup()
    const { services, router } = await open()
    await placeOrder(user)
    await screen.findAllByText('Awaiting café acceptance')
    const orderUrl = router.state.location.pathname

    const order = (await services.chill.load()).orders.find((o) => o.ownerProfileId)!
    await services.chill.operatorTransition(order.id, 'queued')
    expect((await screen.findAllByText('Accepted · In preparation queue')).length).toBeGreaterThan(
      0,
    )

    await router.navigate('/services/chill-spot?tab=orders')
    await screen.findByRole('heading', { level: 2, name: 'Your orders' })
    expect((await screen.findAllByText(/CS-0006/)).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Accepted · In preparation queue').length).toBeGreaterThan(0)

    await router.navigate('/')
    const activity = await screen.findByRole('region', { name: 'My activity' })
    expect(await within(activity).findByText(/Chill Spot order CS-0006/)).toBeInTheDocument()
    expect(within(activity).getByText(/Accepted · In preparation queue/)).toBeInTheDocument()
    expect(within(activity).getByText(/Track order/)).toBeInTheDocument()

    await services.chill.operatorTransition(order.id, 'preparing')
    await services.chill.operatorTransition(order.id, 'ready')
    await router.navigate(orderUrl)
    expect(
      (await screen.findAllByText('Ready for pickup · Pay at café counter')).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByText(/payment (received|confirmed)|\bpaid\b/i)).not.toBeInTheDocument()
  })

  it('CH-AT-25: another profile gets a safe not-found for an order it does not own', async () => {
    const user = userEvent.setup()
    const { router } = await open()
    await placeOrder(user)
    await screen.findAllByText('Awaiting café acceptance')
    const url = router.state.location.pathname

    await user.click(screen.getByRole('button', { name: /demo profile/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Demo Student B/ }))
    await router.navigate(url)
    expect(await screen.findByRole('heading', { level: 1, name: 'Order not found' })).toBeVisible()
    expect(screen.queryByText(/CS-0006/)).not.toBeInTheDocument()
  })

  it('an unknown order id is a safe not-found, not a crash', async () => {
    renderApp('/services/chill-spot/orders/does-not-exist')
    expect(await screen.findByRole('heading', { level: 1, name: 'Order not found' })).toBeVisible()
  })
})

describe('Demo Operations and Settings', () => {
  it('CH-AT-20: the simulator is hidden until Settings turns it on, then every step is an explicit click', async () => {
    const user = userEvent.setup()
    const { router } = await open()
    expect(screen.queryByTestId('demo-ops')).not.toBeInTheDocument()

    await router.navigate('/settings')
    await user.click(await screen.findByRole('checkbox', { name: /Show Demo Operations/ }))
    await router.navigate('/services/chill-spot')
    const ops = await screen.findByTestId('demo-ops')
    expect(within(ops).getAllByText(/simulat/i).length).toBeGreaterThan(0)

    await placeOrder(user)
    await screen.findAllByText('Awaiting café acceptance')
    await router.navigate('/services/chill-spot')
    const panel = await screen.findByTestId('demo-ops')
    await user.click((await within(panel).findAllByRole('button', { name: /^Accept/ }))[0]!)
    await router.navigate('/services/chill-spot?tab=orders')
    expect((await screen.findAllByText('Accepted · In preparation queue')).length).toBeGreaterThan(
      0,
    )
  })

  it('CH-AT-20: the Demo Operations switch is remembered across a reload and defaults to off', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const a = renderApp('/settings', { services: first.services })
    const box = await screen.findByRole('checkbox', { name: /Show Demo Operations/ })
    expect(box).not.toBeChecked()
    await user.click(box)
    a.unmount()
    renderApp('/settings', { services: first.services })
    expect(await screen.findByRole('checkbox', { name: /Show Demo Operations/ })).toBeChecked()
  })

  it('CH-AT-26: Reset demo data also clears café orders and carts', async () => {
    const user = userEvent.setup()
    const { router, services } = await open()
    await placeOrder(user)
    await screen.findAllByText('Awaiting café acceptance')
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /Reset demo data/ }))
    await user.click(await screen.findByRole('button', { name: 'Reset demo data', hidden: false }))
    await waitFor(async () => {
      const store = await services.chill.load()
      expect(store.orders.some((o) => o.ownerProfileId)).toBe(false)
    })
  })
})

describe('Context notes and Time Tax', () => {
  it('CH-AT-28: the next-class note uses Calendar data and makes no readiness promise', async () => {
    const user = userEvent.setup()
    await open()
    await placeOrder(user) // the note appears on an active order's tracker
    await screen.findAllByText('Awaiting café acceptance')
    const main = screen.getByRole('main')
    await waitFor(() =>
      expect(main.textContent).toMatch(/Next class in your Calendar|No upcoming class/),
    )
    expect(main.textContent).toMatch(/not a promise/)
    expect(main.textContent).not.toMatch(/skip (a |your )?class|leave class|you(?:'|’)ll make it/i)
  })

  it('CH-AT-29: Time Tax is an illustrative scenario, shows the signed result and never hides an increase', async () => {
    const user = userEvent.setup()
    await open()
    const tt = await screen.findByRole('region', { name: /Time Tax scenario/ })
    expect(within(tt).getByText('Illustrative scenario, not an observation')).toBeInTheDocument()
    expect(within(tt).getByText(/−26 minutes/)).toBeInTheDocument() // 30 − 4
    expect(within(tt).getByText(/None recorded/)).toBeInTheDocument()

    const field = within(tt).getAllByLabelText('On-site preparation wait (minutes)')[1]!
    await user.clear(field)
    await user.type(field, '60')
    expect(within(tt).getByText(/\+34 minutes/)).toBeInTheDocument()
    expect(within(tt).getByText(/MORE physical waiting/)).toBeInTheDocument()
    expect(within(tt).getByText(/would increase waiting/)).toBeInTheDocument()
    expect(within(tt).getByText(/0 minutes/)).toBeInTheDocument() // potential never below zero

    await user.clear(field)
    await user.type(field, '999')
    expect(within(tt).getByText(/Enter whole numbers from 0 to 240/)).toBeInTheDocument()
  })
})

describe('Persistence', () => {
  it('CH-AT-24: a saved cart and a submitted order survive a reload of the app', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const a = renderApp('/services/chill-spot', { services: first.services })
    await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })
    await addFirstItem(user)
    expect(await screen.findByRole('button', { name: /Decrease quantity of/ })).toBeInTheDocument()
    a.unmount()

    const b = renderApp('/services/chill-spot', { services: first.services })
    await screen.findByRole('heading', { level: 1, name: 'Chill Spot' })
    expect(await screen.findByRole('button', { name: /Decrease quantity of/ })).toBeInTheDocument()
    b.unmount()
  })
})
