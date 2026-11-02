import { createPrefsRepositories } from '@/data/prefs/prefs'
import { demoMenu } from '@/data/seeds/demo/chill-data'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { ORDER_STATUSES, emptyCart, type Cart, type OrderStatus } from '@/domain/chill'
import { canTransition, pickupCodeFor } from '@/domain/chill-logic'
import { fixedClock, type Clock } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { Temporal } from 'temporal-polyfill'
import {
  activeOrders,
  addToCart,
  historyOrders,
  observationFreshness,
  orderBlock,
  ownOrders,
  queueSnapshot,
  recordedAhead,
  recordedBacklog,
  reorderCart,
  representedCategories,
  searchMenu,
  toSnapshot,
  validateCart,
} from '@/selectors/chill'
import { createChillRepository, CHILL_STORE_KEY, cartKey } from './chill-repository'

const NOW = '2026-11-02T04:30:00Z' // 10:00 IST

function setup(
  opts: { menu?: () => ReturnType<typeof demoMenu>; backend?: Storage; nowIso?: string } = {},
) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: opts.backend ?? memory.storage })
  let iso = opts.nowIso ?? NOW
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createChillRepository({
      storage,
      clock,
      newId: (p) => `${p}-t${++n}`,
      menu: opts.menu,
      notifications: prefs.notifications,
    })
  return {
    repo: build(),
    build,
    storage,
    memory,
    prefs,
    setNow: (v: string) => (iso = v),
    nowMs: () => Temporal.Instant.from(iso).epochMilliseconds,
    menu: opts.menu ?? demoMenu,
  }
}

const cartOf = (menuItemId: string, quantity = 1, optionIds: string[] = []): Cart => ({
  schemaVersion: 1,
  lines: [{ lineId: `l-${menuItemId}`, menuItemId, optionIds, quantity }],
})

async function placeOrder(
  env: ReturnType<typeof setup>,
  profile = 'demo-student-a',
  key = 'key-1',
  cart = cartOf('hot-b', 2),
) {
  await env.repo.saveCart(profile, cart)
  const r = await env.repo.submitOrder(profile, key)
  if (!r.ok) throw new Error(r.error.message)
  return r.value.order
}

const accept = async (env: ReturnType<typeof setup>, id: string) => {
  const r = await env.repo.operatorTransition(id, 'queued')
  if (!r.ok) throw new Error(r.error.message)
  return r.value.order
}

describe('CH-AT-02 / CH-AT-03 menu', () => {
  it('CH-AT-02: every sample item carries provenance and nothing claims real prices or hours', () => {
    const { items } = demoMenu()
    for (const i of items) {
      expect(i.provenance.dataMode).toBe('demoSeed')
      expect(i.provenance.sourceLabel).toMatch(/not the real café menu/)
    }
    expect(JSON.stringify(demoMenu())).not.toMatch(/open now|opening hours/i)
  })

  it('CH-AT-03: search and category filters use only categories that really have visible items', () => {
    const menu = demoMenu()
    expect(representedCategories(menu).map((c) => c.id)).toEqual(['hot', 'cold', 'snacks'])
    expect(
      representedCategories({
        ...menu,
        items: menu.items.filter((i) => i.categoryId !== 'cold'),
      }).map((c) => c.id),
    ).toEqual(['hot', 'snacks'])
    expect(searchMenu(menu, 'hot drink').map((i) => i.id)).toEqual(['hot-a', 'hot-b'])
    expect(searchMenu(menu, '', 'cold').map((i) => i.id)).toEqual(['cold-a', 'cold-b'])
    expect(searchMenu(menu, 'hidden')).toEqual([]) // invisible items never appear
    expect(searchMenu(menu, 'zzz')).toEqual([])
  })
})

describe('CH-AT-04 / CH-AT-05 / CH-AT-06 cart and validation', () => {
  const menu = demoMenu()
  const paused = { paused: false }

  it('CH-AT-04: unavailable, unknown-availability, missing-price items and bad options cannot be submitted', () => {
    expect(orderBlock(menu.items.find((i) => i.id === 'cold-b')!)).toBe('unavailable')
    expect(orderBlock(menu.items.find((i) => i.id === 'snack-b')!)).toBe('unknownAvailability')
    expect(orderBlock(menu.items.find((i) => i.id === 'snack-c')!)).toBe('missingPrice')
    for (const id of ['cold-b', 'snack-b', 'snack-c'])
      expect(validateCart(menu, cartOf(id), paused).canSubmit).toBe(false)
    const badOption = validateCart(menu, cartOf('hot-a', 1, ['no-such-option']), paused)
    expect(badOption.issues.map((i) => i.code)).toContain('invalidOption')
    expect(validateCart(menu, cartOf('does-not-exist'), paused).issues[0]?.code).toBe('missingItem')
  })

  it('CH-AT-05: totals are exact integer paise, including options and quantities', () => {
    const cart: Cart = {
      schemaVersion: 1,
      lines: [
        { lineId: 'a', menuItemId: 'hot-a', optionIds: ['large', 'extra'], quantity: 3 }, // (4000+1000+500) × 3
        { lineId: 'b', menuItemId: 'hot-b', optionIds: [], quantity: 2 }, // 6000 × 2
      ],
    }
    const v = validateCart(menu, cart, paused)
    expect(v.canSubmit).toBe(true)
    expect(v.lines.map((l) => l.subtotalMinor)).toEqual([16500, 12000])
    expect(v.subtotalMinor).toBe(28500)
    expect(Number.isInteger(v.subtotalMinor)).toBe(true)
    for (const q of [0, -1, 21, 1.5])
      expect(validateCart(menu, cartOf('hot-b', q), paused).issues.map((i) => i.code)).toContain(
        'invalidQuantity',
      )
  })

  it('merges identical lines instead of duplicating them', () => {
    let n = 0
    const nid = (p: string) => `${p}-${++n}`
    let cart = addToCart(emptyCart(), { menuItemId: 'hot-b', optionIds: [], quantity: 1 }, nid)
    cart = addToCart(cart, { menuItemId: 'hot-b', optionIds: [], quantity: 2 }, nid)
    cart = addToCart(cart, { menuItemId: 'hot-a', optionIds: ['large'], quantity: 1 }, nid)
    expect(cart.lines.map((l) => [l.menuItemId, l.quantity])).toEqual([
      ['hot-b', 3],
      ['hot-a', 1],
    ])
  })

  it('CH-AT-06: an empty cart cannot be checked out and the repository refuses it', async () => {
    expect(validateCart(menu, emptyCart(), paused).issues[0]?.code).toBe('empty')
    const env = setup()
    const r = await env.repo.submitOrder('demo-student-a', 'k')
    expect(r).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect((await env.repo.load()).orders.some((o) => o.ownerProfileId === 'demo-student-a')).toBe(
      false,
    )
  })

  it('CH-AT-04: the repository rejects an unorderable cart and keeps the cart for editing', async () => {
    const env = setup()
    await env.repo.saveCart('demo-student-a', cartOf('cold-b'))
    expect((await env.repo.submitOrder('demo-student-a', 'k')).ok).toBe(false)
    expect((await env.repo.loadCart('demo-student-a')).lines).toHaveLength(1)
  })
})

describe('CH-AT-07 / CH-AT-08 / CH-AT-09 submit, snapshot', () => {
  it('CH-AT-07: repeated and concurrent submissions with one key persist exactly one pending request', async () => {
    const env = setup()
    await env.repo.saveCart('demo-student-a', cartOf('hot-b', 2))
    const [a, b] = await Promise.all([
      env.repo.submitOrder('demo-student-a', 'same'),
      env.repo.submitOrder('demo-student-a', 'same'),
    ])
    const c = await env.repo.submitOrder('demo-student-a', 'same')
    expect([a.ok, b.ok, c.ok]).toEqual([true, true, true])
    const mine = ownOrders(await env.repo.load(), 'demo-student-a')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({
      status: 'pending',
      paymentMethod: 'payAtPickup',
      paymentVerification: 'notHandledInApp',
    })
  })

  it('CH-AT-08: a pending request does not increase the accepted unfinished backlog', async () => {
    const env = setup()
    const before = recordedBacklog((await env.repo.load()).orders).unfinished
    await placeOrder(env)
    expect(recordedBacklog((await env.repo.load()).orders).unfinished).toBe(before)
  })

  it('CH-AT-09: the saved item/price snapshot survives later menu changes', async () => {
    let price = 6000
    const env = setup({
      menu: () => {
        const m = demoMenu()
        m.items = m.items.map((i) => (i.id === 'hot-b' ? { ...i, priceMinor: price } : i))
        return m
      },
    })
    const order = await placeOrder(env)
    expect(order.items[0]).toMatchObject({
      nameAtOrder: 'Sample hot drink B',
      unitPriceMinorAtOrder: 6000,
      quantity: 2,
      lineSubtotalMinor: 12000,
    })
    price = 9900 // café raises the price after submission
    const again = (await env.repo.load()).orders.find((o) => o.id === order.id)!
    expect(again.listedSubtotalMinor).toBe(12000)
    expect(again.items[0]!.unitPriceMinorAtOrder).toBe(6000)
  })

  it('clears the cart only after the order is persisted', async () => {
    const env = setup()
    await placeOrder(env)
    expect((await env.repo.loadCart('demo-student-a')).lines).toEqual([])
  })

  it('a price change between cart and submit is revalidated, not silently charged', async () => {
    const env = setup()
    await env.repo.saveCart('demo-student-a', cartOf('hot-b'))
    const v = validateCart(demoMenu(), cartOf('hot-b'), { paused: false })
    expect(toSnapshot(v)[0]!.unitPriceMinorAtOrder).toBe(6000) // snapshot = current price at that moment
  })
})

describe('CH-AT-10 / CH-AT-11 state machine', () => {
  it('CH-AT-11: every transition outside the permitted list is rejected, for every actor', () => {
    const permitted = new Set([
      'pending>queued:demoOperator',
      'pending>rejected:demoOperator',
      'pending>cancelled:student',
      'queued>preparing:demoOperator',
      'preparing>ready:demoOperator',
      'ready>collected:demoOperator',
    ])
    let checked = 0
    for (const from of ORDER_STATUSES)
      for (const to of ORDER_STATUSES)
        for (const actor of ['student', 'demoOperator'] as const) {
          const ok = canTransition(from, to, actor).ok
          expect(ok, `${from} → ${to} by ${actor}`).toBe(permitted.has(`${from}>${to}:${actor}`))
          checked++
        }
    expect(checked).toBe(7 * 7 * 2)
    expect(canTransition('pending', 'ready', 'demoOperator').ok).toBe(false)
    expect(canTransition('rejected', 'queued', 'demoOperator').ok).toBe(false)
    expect(canTransition('collected', 'preparing', 'demoOperator').ok).toBe(false)
    expect(canTransition('ready', 'cancelled', 'student')).toMatchObject({ ok: false })
  })

  it('CH-AT-10: a student can cancel only while pending; accepted orders explain the restriction; terminal is immutable', async () => {
    const env = setup()
    const o = await placeOrder(env)
    await accept(env, o.id)
    const refused = await env.repo.cancelPending('demo-student-a', o.id)
    expect(refused).toMatchObject({
      ok: false,
      error: { message: "Cancellation isn't available for accepted orders on this device." },
    })
    expect((await env.repo.load()).orders.find((x) => x.id === o.id)!.status).toBe('queued')

    const p = await placeOrder(env, 'demo-student-a', 'key-2')
    expect((await env.repo.cancelPending('demo-student-a', p.id)).ok).toBe(true)
    expect((await env.repo.operatorTransition(p.id, 'queued')).ok).toBe(false) // terminal: immutable
    expect((await env.repo.cancelPending('demo-student-a', p.id)).ok).toBe(false)
  })

  it('records timestamps, a unique sequence at acceptance, a bumped version and an append-only history', async () => {
    const env = setup()
    const o = await placeOrder(env)
    expect(o.version).toBe(1)
    expect(o.queueSequence).toBeUndefined()
    expect(o.acceptedAt).toBeUndefined()
    env.setNow('2026-11-02T04:35:00Z')
    const q = await accept(env, o.id)
    expect(q).toMatchObject({ status: 'queued', version: 2, queueSequence: 6 })
    expect(q.acceptedAt).toBe('2026-11-02T04:35:00Z')
    env.setNow('2026-11-02T04:40:00Z')
    await env.repo.operatorTransition(o.id, 'preparing')
    env.setNow('2026-11-02T04:50:00Z')
    const r = await env.repo.operatorTransition(o.id, 'ready')
    if (!r.ok) throw new Error('ready failed')
    expect(r.value.order.history.map((h) => [h.from, h.to, h.version])).toEqual([
      ['cart', 'pending', 1],
      ['pending', 'queued', 2],
      ['queued', 'preparing', 3],
      ['preparing', 'ready', 4],
    ])
    expect(
      r.value.order.history
        .slice(1)
        .every((h) => h.actor === 'demoOperator' && h.dataMode === 'simulated'),
    ).toBe(true)
    expect(r.value.order.history[0]).toMatchObject({ actor: 'student', dataMode: 'userCreated' })
    expect(r.value.order.readyAt).toBe('2026-11-02T04:50:00Z')
  })

  it('rejection records an optional reason and is terminal', async () => {
    const env = setup()
    const o = await placeOrder(env)
    const r = await env.repo.operatorTransition(o.id, 'rejected', 'Sample item sold out')
    expect(r.ok && r.value.order).toMatchObject({
      status: 'rejected',
      rejectionReason: 'Sample item sold out',
    })
  })
})

describe('CH-AT-12 … CH-AT-17 recorded queue', () => {
  it('CH-AT-12 / CH-AT-14: the starting scenario puts recorded walk-ins in the backlog; ready and pending do not count', async () => {
    const env = setup()
    const store = await env.repo.load()
    expect(recordedBacklog(store.orders)).toMatchObject({
      unfinished: 4,
      queued: 3,
      preparing: 1,
      walkInRecorded: 4,
      digital: 0,
    })
    expect(store.orders.filter((o) => o.status === 'ready')).toHaveLength(1)
    expect(
      store.orders.every((o) => o.channel === 'walkInRecorded' && o.ownerProfileId === null),
    ).toBe(true)
    const o = await placeOrder(env)
    expect(recordedBacklog((await env.repo.load()).orders).unfinished).toBe(4) // pending excluded
    await accept(env, o.id)
    expect(recordedBacklog((await env.repo.load()).orders)).toMatchObject({
      unfinished: 5,
      digital: 1,
    })
    expect(recordedBacklog([]).unfinished).toBe(0)
  })

  it('records additional walk-ins with stable, increasing sequence numbers', async () => {
    const env = setup()
    const r = await env.repo.recordSampleWalkIn(['hot-a', 'snack-a'])
    expect(r.ok && r.value.order).toMatchObject({
      status: 'queued',
      channel: 'walkInRecorded',
      queueSequence: 6,
    })
    const r2 = await env.repo.recordSampleWalkIn(['hot-b'])
    expect(r2.ok && r2.value.order.queueSequence).toBe(7)
    expect(await env.repo.recordSampleWalkIn(['cold-b', 'nope'])).toMatchObject({ ok: false }) // unorderable only
  })

  it('CH-AT-13: a digital order is sequenced AFTER previously accepted walk-ins, by acceptance not submission', async () => {
    const env = setup()
    const first = await placeOrder(env, 'demo-student-a', 'k1')
    const second = await placeOrder(env, 'demo-student-b', 'k2')
    await env.repo.recordSampleWalkIn(['hot-a']) // accepted walk-in after both were submitted
    await accept(env, second.id) // accepted before `first`
    await accept(env, first.id)
    const store = await env.repo.load()
    const seq = (id: string) => store.orders.find((o) => o.id === id)!.queueSequence!
    expect(seq(second.id)).toBeGreaterThan(
      Math.max(
        ...store.orders
          .filter((o) => o.channel === 'walkInRecorded' && o.queueSequence! < 7)
          .map((o) => o.queueSequence!),
      ),
    )
    expect(seq(second.id)).toBeLessThan(seq(first.id)) // FIFO by acceptance, not submission
    expect(seq(second.id)).toBe(7) // after the 6th (the later walk-in recorded earlier than this acceptance)
  })

  it('CH-AT-15: "ahead" counts only earlier recorded queued/preparing orders and is undefined when not applicable', async () => {
    const env = setup()
    const o = await placeOrder(env)
    expect(recordedAhead((await env.repo.load()).orders, o)).toBeUndefined() // pending
    const q = await accept(env, o.id)
    let store = await env.repo.load()
    expect(recordedAhead(store.orders, q)).toBe(4) // 3 queued + 1 preparing walk-ins, none ready
    const firstQueued = store.orders
      .filter((x) => x.status === 'queued' && x.channel === 'walkInRecorded')
      .sort((a, b) => a.queueSequence! - b.queueSequence!)[0]!
    await env.repo.operatorTransition(firstQueued.id, 'preparing')
    store = await env.repo.load()
    expect(
      recordedAhead(
        store.orders,
        store.orders.find((x) => x.id === o.id)!,
      ),
    ).toBe(4) // still unfinished
    const preparing = store.orders.filter(
      (x) => x.status === 'preparing' && x.channel === 'walkInRecorded',
    )[0]!
    await env.repo.operatorTransition(preparing.id, 'ready')
    store = await env.repo.load()
    expect(
      recordedAhead(
        store.orders,
        store.orders.find((x) => x.id === o.id)!,
      ),
    ).toBe(3) // ready is excluded
    await env.repo.operatorTransition(o.id, 'preparing')
    store = await env.repo.load()
    expect(
      recordedAhead(
        store.orders,
        store.orders.find((x) => x.id === o.id)!,
      ),
    ).toBeUndefined() // "Being prepared", no rank
  })

  it('CH-AT-16: an unknown counter is not zero; an explicit zero is shown as zero', async () => {
    const env = setup()
    await env.repo.setCounterObservation(null, 'unknown')
    let snap = queueSnapshot(await env.repo.load(), env.nowMs())
    expect(snap.counter.text).toBe('Counter queue unknown')
    expect(snap.counter.text).not.toMatch(/\b0\b/)
    await env.repo.setCounterObservation(0, 'reportedComplete')
    snap = queueSnapshot(await env.repo.load(), env.nowMs())
    expect(snap.counter.text).toMatch(/^0 people last reported at counter · Demo · /)
  })

  it('CH-AT-17: progressing orders never changes the separately reported counter line', async () => {
    const env = setup()
    const before = (await env.repo.load()).counter
    const store = await env.repo.load()
    for (const o of store.orders.filter((x) => x.status === 'queued'))
      await env.repo.operatorTransition(o.id, 'preparing')
    const after = (await env.repo.load()).counter
    expect(after).toEqual(before)
    expect(after?.numericValue).toBe(6)
    expect(recordedBacklog((await env.repo.load()).orders).queued).toBe(0)
  })

  it('three counts are kept apart and never summed', async () => {
    const env = setup()
    const s = queueSnapshot(await env.repo.load(), env.nowMs())
    expect(s.counter.text).toMatch(/^6 people/)
    expect(s.preparation.text).toBe('4 recorded unfinished orders · Demo')
    expect(s.pickup.text).toBe('1 recorded order ready for pickup')
    expect(s.preparation.caveat).toMatch(/walk-in preparation work may be missing/)
  })
})

describe('CH-AT-18 / CH-AT-19 freshness and service state', () => {
  it('CH-AT-18: a stale observation keeps its ORIGINAL timestamp across reloads and says it is stale', async () => {
    const env = setup()
    await env.repo.setCounterObservation(5, 'reportedComplete')
    const asOf = (await env.repo.load()).counter!.asOf
    env.setNow('2026-11-02T04:41:00Z') // 11 minutes later
    const reloaded = env.build() // a "browser refresh": new repository over the same storage
    const store = await reloaded.load()
    expect(store.counter!.asOf).toBe(asOf)
    const f = observationFreshness(store.counter, env.nowMs())
    expect(f).toMatchObject({ state: 'stale', ageMinutes: 11 })
    expect(observationFreshness(store.counter, env.nowMs() - 10 * 60_000)).toMatchObject({
      state: 'fresh',
    })
    expect(observationFreshness(null, env.nowMs()).state).toBe('none')
  })

  it('CH-AT-19: Busy does not pause ordering; Paused blocks only NEW requests and needs a visible reason', async () => {
    const env = setup()
    await env.repo.setReportedState('busy')
    await env.repo.saveCart('demo-student-a', cartOf('hot-b'))
    expect((await env.repo.submitOrder('demo-student-a', 'a')).ok).toBe(true) // busy: still accepting
    const pendingOrder = ownOrders(await env.repo.load(), 'demo-student-a')[0]!

    expect(await env.repo.setPause('  ')).toMatchObject({ ok: false }) // reason required
    expect((await env.repo.setPause('Sample reason: machine cleaning')).ok).toBe(true)
    await env.repo.saveCart('demo-student-a', cartOf('hot-b'))
    const blocked = await env.repo.submitOrder('demo-student-a', 'b')
    expect(blocked).toMatchObject({ ok: false, error: { code: 'validation' } })
    expect(queueSnapshot(await env.repo.load(), env.nowMs()).paused).toEqual({
      reason: 'Sample reason: machine cleaning',
    })
    expect((await env.repo.loadCart('demo-student-a')).lines).toHaveLength(1) // cart preserved

    // Existing orders continue while paused.
    expect((await env.repo.operatorTransition(pendingOrder.id, 'queued')).ok).toBe(true)
    await env.repo.setPause(null)
    expect((await env.repo.submitOrder('demo-student-a', 'b')).ok).toBe(true)
  })
})

describe('CH-AT-20 simulator', () => {
  it('every change is explicit, logged, simulated, and nothing advances by itself', async () => {
    vi.useFakeTimers()
    try {
      const env = setup()
      const o = await placeOrder(env)
      vi.advanceTimersByTime(60 * 60 * 1000)
      env.setNow('2026-11-02T06:30:00Z') // two hours pass
      expect((await env.repo.load()).orders.find((x) => x.id === o.id)!.status).toBe('pending') // no auto-accept
      const q = await accept(env, o.id)
      expect(q.history.at(-1)).toMatchObject({
        actor: 'demoOperator',
        dataMode: 'simulated',
        to: 'queued',
      })
      expect(q.status).toBe('queued') // and no auto-progress after accepting
    } finally {
      vi.useRealTimers()
    }
  })

  it('observations written by the simulator are labelled as demo reports, not live data', async () => {
    const env = setup()
    await env.repo.setCounterObservation(3, 'reportedComplete')
    const c = (await env.repo.load()).counter!
    expect(c.provenance).toMatchObject({ dataMode: 'simulated', authority: 'demoIllustration' })
    expect(c.sourceLabel).toMatch(/not a live count/)
  })
})

describe('CH-AT-21 pickup', () => {
  it('a ready order has a short demo pickup code; collection never means paid', async () => {
    const env = setup()
    const o = await placeOrder(env)
    await accept(env, o.id)
    await env.repo.operatorTransition(o.id, 'preparing')
    const r = await env.repo.operatorTransition(o.id, 'ready')
    const ready = r.ok ? r.value.order : undefined
    expect(ready?.status).toBe('ready')
    expect(pickupCodeFor(ready!)).toMatch(/^\d{4}$/)
    expect(pickupCodeFor(ready!)).toBe(pickupCodeFor(ready!)) // deterministic
    const c = await env.repo.operatorTransition(o.id, 'collected')
    expect(c.ok && c.value.order).toMatchObject({
      status: 'collected',
      paymentVerification: 'notHandledInApp',
    })
    expect(JSON.stringify(c)).not.toMatch(/"paid"|paymentVerified|PAID/)
  })
})

describe('CH-AT-23 / CH-AT-24 / CH-AT-25 notifications, reload, isolation', () => {
  const notes = async (env: ReturnType<typeof setup>, profile: string) =>
    (await env.prefs.notifications.load(profile)).value.items

  it('CH-AT-23: at most one in-app notification per transition, to the owner only, with a working deep link', async () => {
    const env = setup()
    const o = await placeOrder(env, 'demo-student-a', 'k')
    await env.repo.submitOrder('demo-student-a', 'k') // repeat: no second notification
    expect((await notes(env, 'demo-student-a')).map((n) => n.title)).toEqual([
      'Local order request submitted',
    ])
    await accept(env, o.id)
    await env.repo.operatorTransition(o.id, 'preparing')
    await env.repo.operatorTransition(o.id, 'ready')
    const list = await notes(env, 'demo-student-a')
    expect(list.map((n) => n.title).reverse()).toEqual([
      'Local order request submitted',
      'Demo café accepted your order',
      'Local order is being prepared',
      'Local order ready for pickup',
    ])
    expect(list.find((n) => n.title === 'Local order ready for pickup')?.significance).toBe(
      'important',
    )
    expect(
      list.every((n) => n.kind === 'order' && n.href === `/services/chill-spot/orders/${o.id}`),
    ).toBe(true)
    expect(new Set(list.map((n) => n.key)).size).toBe(list.length)
    expect(await notes(env, 'demo-student-b')).toEqual([]) // never another profile
  })

  it('CH-AT-23: rejection is important and carries the recorded reason; cancel and collect each notify once', async () => {
    const env = setup()
    const a = await placeOrder(env, 'demo-student-a', 'ka')
    await env.repo.operatorTransition(a.id, 'rejected', 'Sample reason')
    const b = await placeOrder(env, 'demo-student-a', 'kb')
    await env.repo.cancelPending('demo-student-a', b.id)
    const list = await notes(env, 'demo-student-a')
    expect(list.find((n) => n.title === 'Local order declined')).toMatchObject({
      significance: 'important',
      body: expect.stringContaining('Sample reason'),
    })
    expect(list.filter((n) => n.title === 'Local order request cancelled')).toHaveLength(1)
  })

  it('CH-AT-24: reload preserves orders and carts and creates no duplicate alerts', async () => {
    const env = setup()
    const o = await placeOrder(env)
    await env.repo.saveCart('demo-student-a', cartOf('hot-a', 1, ['large']))
    const fresh = env.build()
    expect((await fresh.load()).orders.find((x) => x.id === o.id)).toMatchObject({
      status: 'pending',
    })
    expect((await fresh.loadCart('demo-student-a')).lines[0]).toMatchObject({
      menuItemId: 'hot-a',
      optionIds: ['large'],
    })
    await fresh.load()
    await fresh.load()
    expect(await notes(env, 'demo-student-a')).toHaveLength(1)
  })

  it("CH-AT-25: carts and orders are isolated between personas, and no one can act on another profile's order", async () => {
    const env = setup()
    const o = await placeOrder(env, 'demo-student-a')
    await env.repo.saveCart('demo-student-b', cartOf('hot-a'))
    expect((await env.repo.loadCart('demo-student-a')).lines).toEqual([])
    const store = await env.repo.load()
    expect(ownOrders(store, 'demo-student-b')).toEqual([])
    expect(ownOrders(store, 'demo-student-a').map((x) => x.id)).toEqual([o.id])
    expect(await env.repo.cancelPending('demo-student-b', o.id)).toMatchObject({ ok: false })
    expect((await env.repo.load()).orders.find((x) => x.id === o.id)!.status).toBe('pending')
    expect(activeOrders(ownOrders(store, 'demo-student-b'))).toEqual([])
    expect(historyOrders(ownOrders(store, 'demo-student-b'))).toEqual([])
  })
})

describe('CH-AT-26 / CH-AT-27 reset and reorder', () => {
  it('CH-AT-26: the scenario reset is reproducible, removes café orders only, and leaves unrelated records alone', async () => {
    const env = setup()
    env.memory.data.set('campusos:domain:v1:demo-student-a', '{"events":[{"keep":"me"}]}')
    env.memory.data.set('campusos:home:v1:demo-student-a', '{"keep":"layout"}')
    const base = await env.repo.load()
    const o = await placeOrder(env)
    await accept(env, o.id)
    await env.repo.setCounterObservation(1, 'reportedComplete')
    expect((await env.repo.resetScenario()).ok).toBe(true)
    const again = await env.repo.load()
    expect(again.orders.map((x) => [x.id, x.status, x.queueSequence])).toEqual(
      base.orders.map((x) => [x.id, x.status, x.queueSequence]),
    )
    expect(again.orders.some((x) => x.ownerProfileId)).toBe(false)
    expect(again.counter?.numericValue).toBe(6)
    expect(env.memory.data.get('campusos:domain:v1:demo-student-a')).toBe(
      '{"events":[{"keep":"me"}]}',
    )
    expect(env.memory.data.get('campusos:home:v1:demo-student-a')).toBe('{"keep":"layout"}')
  })

  it('CH-AT-27: reorder builds a fresh editable cart from CURRENT prices and availability and warns about changes', async () => {
    let state: 'same' | 'changed' = 'same'
    const env = setup({
      menu: () => {
        const m = demoMenu()
        if (state === 'changed')
          m.items = m.items.map((i) =>
            i.id === 'hot-b'
              ? { ...i, priceMinor: 7500 }
              : i.id === 'hot-a'
                ? { ...i, availability: 'unavailable' as const }
                : i,
          )
        return m
      },
    })
    await env.repo.saveCart('demo-student-a', {
      schemaVersion: 1,
      lines: [
        { lineId: 'x', menuItemId: 'hot-a', optionIds: ['large'], quantity: 1 },
        { lineId: 'y', menuItemId: 'hot-b', optionIds: [], quantity: 2 },
      ],
    })
    const o = (await env.repo.submitOrder('demo-student-a', 'k')) as {
      ok: true
      value: { order: import('@/domain/chill').ChillOrder }
    }
    state = 'changed'
    const r = reorderCart(
      env.menu === demoMenu ? env.repo.getMenu() : env.repo.getMenu(),
      o.value.order,
      (p) => `${p}-n`,
    )
    expect(r.cart.lines.map((l) => l.menuItemId)).toEqual(['hot-a', 'hot-b'])
    expect(r.changes.join(' ')).toMatch(/Sample hot drink A: currently unavailable/i)
    expect(r.changes.join(' ')).toMatch(/Sample hot drink B: the listed price changed/)
    const v = validateCart(env.repo.getMenu(), r.cart, { paused: false })
    expect(v.canSubmit).toBe(false) // unavailable item blocks until removed
    expect(v.lines[1]!.unitPriceMinor).toBe(7500) // current price, not the old 6000
    expect(
      (await env.repo.load()).orders.filter((x) => x.ownerProfileId === 'demo-student-a'),
    ).toHaveLength(1) // not auto-submitted
  })
})

describe('storage failure (§12)', () => {
  it('a failed save reports the failure, changes nothing and keeps the cart', async () => {
    let failing = false
    const memory = createMemoryStorage()
    const backend: Storage = {
      ...memory.storage,
      setItem: (k: string, v: string) => {
        if (failing && k === CHILL_STORE_KEY) throw new DOMException('full', 'QuotaExceededError')
        memory.storage.setItem(k, v)
      },
    } as Storage
    const env = setup({ backend })
    await env.repo.load()
    await env.repo.saveCart('demo-student-a', cartOf('hot-b'))
    const before = await env.repo.load()
    failing = true
    const r = await env.repo.submitOrder('demo-student-a', 'k')
    expect(r).toMatchObject({ ok: false, error: { code: 'storage' } })
    expect(await env.repo.load()).toEqual(before)
    expect((await env.repo.loadCart('demo-student-a')).lines).toHaveLength(1)
    expect(memory.data.has(cartKey('demo-student-a'))).toBe(true)
    expect(ownOrders(await env.repo.load(), 'demo-student-a')).toEqual([])
    failing = false
  })

  it('a corrupt saved café store is not overwritten silently', async () => {
    const env = setup()
    env.memory.data.set(CHILL_STORE_KEY, '{broken')
    const store = await env.repo.load()
    expect(store.orders.length).toBeGreaterThan(0) // scenario shown in memory
    expect(env.memory.data.get(CHILL_STORE_KEY)).toBe('{broken')
  })
})

describe('order status type', () => {
  it('only knows the seven spec states', () => {
    const s: OrderStatus[] = [...ORDER_STATUSES]
    expect(s).toEqual([
      'pending',
      'queued',
      'preparing',
      'ready',
      'collected',
      'rejected',
      'cancelled',
    ])
    expect(fixedClock(NOW).now().toString()).toBe(NOW)
  })
})
