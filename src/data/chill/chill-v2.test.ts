import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import type { Cart } from '@/domain/chill'
import { createMemoryStorage } from '@/test/memory-storage'
import { Temporal } from 'temporal-polyfill'
import type { Clock } from '@/lib/time'
import {
  TRACKER_STEPS,
  nextStep,
  operationsView,
  queueSnapshot,
  recordedAhead,
  recordedBacklog,
  sortMenuItems,
  stepIndex,
  validateCart,
} from '@/selectors/chill'
import {
  hypotheticalWeeklyHours,
  pickupDelaySensitivity,
  compareWaiting,
} from '@/selectors/chill-timetax'
import { demoMenu } from '@/data/seeds/demo/chill-data'
import { createChillRepository, CHILL_STORE_KEY } from './chill-repository'

const NOW = '2026-11-02T04:30:00Z' // 10:00 IST
const A = 'demo-student-a'
const B = 'demo-student-b'

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  let iso = NOW
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const repo = createChillRepository({
    storage,
    clock,
    newId: (p) => `${p}-t${++n}`,
    notifications: prefs.notifications,
  })
  const ok = async <T>(p: Promise<{ ok: boolean; value?: T; error?: { message: string } }>) => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as T
  }
  const bad = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => {
    const r = await p
    expect(r.ok).toBe(false)
    return r.error?.message ?? ''
  }
  const cart = (id: string, q = 1): Cart => ({
    schemaVersion: 1,
    lines: [{ lineId: `l-${id}`, menuItemId: id, optionIds: [], quantity: q }],
  })
  const place = async (profile = A, key = 'k1', item = 'hot-b') => {
    await repo.saveCart(profile, cart(item))
    return (await ok(repo.submitOrder(profile, key))).order
  }
  return {
    repo,
    storage,
    prefs,
    ok,
    bad,
    place,
    cart,
    advance: (ms: number) =>
      (iso = new Date(Temporal.Instant.from(iso).epochMilliseconds + ms).toISOString()),
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}

describe('queue truthfulness and fairness (CH2-AT-01 … CH2-AT-10)', () => {
  it('CH2-AT-01: the counter report and the recorded backlog change independently', async () => {
    const e = setup()
    await e.repo.load()
    const before = queueSnapshot(await e.repo.load(), Date.parse(NOW))
    await e.ok(e.repo.recordSampleWalkIn(['hot-a']))
    const afterOrder = queueSnapshot(await e.repo.load(), Date.parse(NOW))
    expect(afterOrder.preparation.backlog.unfinished).toBe(
      before.preparation.backlog.unfinished + 1,
    )
    expect(afterOrder.counter.text).toBe(before.counter.text)
    await e.ok(e.repo.setCounterObservation(2, 'reportedComplete'))
    const afterCounter = queueSnapshot(await e.repo.load(), Date.parse(NOW))
    expect(afterCounter.preparation.backlog.unfinished).toBe(
      afterOrder.preparation.backlog.unfinished,
    )
    expect(afterCounter.counter.text).toMatch(/2 people/)
  })

  it('CH2-AT-02: a pending request has no order-ahead count and is not in the backlog', async () => {
    const e = setup()
    const o = await e.place()
    const s = await e.repo.load()
    expect(o.status).toBe('pending')
    expect(
      recordedAhead(
        s.orders,
        s.orders.find((x) => x.id === o.id)!,
      ),
    ).toBeUndefined()
    expect(recordedBacklog(s.orders).unfinished).toBe(
      recordedBacklog(s.orders.filter((x) => x.id !== o.id)).unfinished,
    )
  })

  it('CH2-AT-03: existing recorded walk-ins precede a newly accepted online order in the sequence', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    const s = await e.repo.load()
    const mine = s.orders.find((x) => x.id === o.id)!
    const walkIns = s.orders.filter((x) => x.channel === 'walkInRecorded')
    expect(walkIns.length).toBeGreaterThan(0)
    expect(walkIns.every((w) => w.queueSequence! < mine.queueSequence!)).toBe(true)
    expect(recordedAhead(s.orders, mine)).toBe(
      recordedBacklog(s.orders.filter((x) => x.id !== o.id)).unfinished,
    )
  })

  it('CH2-AT-04: with the option on, starting ahead of an older queued order needs a logged reason', async () => {
    const e = setup()
    const a = await e.place(A, 'k1')
    const b = await e.place(B, 'k2', 'hot-a')
    await e.ok(e.repo.operatorTransition(a.id, 'queued'))
    await e.ok(e.repo.operatorTransition(b.id, 'queued'))
    // Option off: V1 behaviour, no note needed.
    await e.ok(e.repo.setRequireHandlingNote(true))
    // Walk-ins that are still queued are older too, so choose the reason once.
    expect(await e.bad(e.repo.operatorTransition(b.id, 'preparing'))).toMatch(
      /earlier-accepted order/,
    )
    expect(
      await e.bad(e.repo.operatorTransition(b.id, 'preparing', undefined, { kind: 'other' })),
    ).toMatch(/Describe the reason/)
    const started = await e.ok(
      e.repo.operatorTransition(b.id, 'preparing', undefined, { kind: 'parallel_station' }),
    )
    const last = started.order.history[started.order.history.length - 1]!
    expect(last.handlingNote).toEqual({ kind: 'parallel_station' })
    expect(last.dataMode).toBe('simulated')
    await e.ok(e.repo.setRequireHandlingNote(false))
    // With the option off nothing is required.
    const c = await e.place(A, 'k3')
    await e.ok(e.repo.operatorTransition(c.id, 'queued'))
    await e.ok(e.repo.operatorTransition(c.id, 'preparing'))
  })

  it('CH2-AT-05: the student never sees a guaranteed finish rank or a time estimate', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    const s = await e.repo.load()
    const order = s.orders.find((x) => x.id === o.id)!
    const text = [
      nextStep(order),
      JSON.stringify(queueSnapshot(s, Date.parse(NOW)).preparation),
    ].join(' ')
    expect(text).not.toMatch(/minutes? (left|remaining)|\bETA\b|will be ready at|position #|rank/i)
    expect(nextStep(order)).toMatch(/recorded preparation backlog/)
  })

  it('CH2-AT-06: ready, rejected, cancelled and collected orders never inflate the unfinished backlog', async () => {
    const e = setup()
    const base = recordedBacklog((await e.repo.load()).orders).unfinished
    const a = await e.place(A, 'k1')
    const b = await e.place(B, 'k2')
    const c = await e.place(A, 'k3')
    await e.ok(e.repo.operatorTransition(a.id, 'rejected', 'Out of stock'))
    await e.ok(e.repo.cancelPending(A, c.id))
    await e.ok(e.repo.operatorTransition(b.id, 'queued'))
    expect(recordedBacklog((await e.repo.load()).orders).unfinished).toBe(base + 1)
    await e.ok(e.repo.operatorTransition(b.id, 'preparing'))
    await e.ok(e.repo.operatorTransition(b.id, 'ready'))
    expect(recordedBacklog((await e.repo.load()).orders).unfinished).toBe(base)
    await e.ok(e.repo.operatorTransition(b.id, 'collected'))
    expect(recordedBacklog((await e.repo.load()).orders).unfinished).toBe(base)
  })

  it('CH2-AT-07: no counter observation reads Unknown, not zero and not busy', async () => {
    const e = setup()
    await e.ok(e.repo.setCounterObservation(null, 'unknown'))
    const snap = queueSnapshot(await e.repo.load(), Date.parse(NOW))
    expect(snap.counter.text).toBe('Counter queue unknown')
    const { counter: _c, busy: _b, ...rest } = await e.repo.load()
    const empty = queueSnapshot({ ...rest, counter: null, busy: null }, Date.parse(NOW))
    expect(empty.condition).toBe('unknown')
    expect(empty.counter.text).toBe('Counter queue unknown')
    expect(empty.busy.text).toBe('No recent report')
  })

  it('CH2-AT-08 / CH2-AT-09: staleness follows the observation time, and an order change does not refresh it', async () => {
    const e = setup()
    await e.ok(e.repo.setCounterObservation(4, 'reportedComplete'))
    await e.ok(e.repo.setReportedState('busy'))
    const reportedAt = (await e.repo.load()).counter!.asOf
    e.advance(11 * 60_000)
    await e.ok(e.repo.recordSampleWalkIn(['hot-a']))
    const s = await e.repo.load()
    expect(s.counter!.asOf).toBe(reportedAt) // an unrelated order change leaves the report's clock alone
    const snap = queueSnapshot(s, Date.parse(NOW) + 11 * 60_000)
    expect(snap.counter.freshness.state).toBe('stale')
    expect(snap.condition).toBe('unknown') // a stale busy report is not shown as current
    expect(snap.backlogAsOfLabel).toBeTruthy()
    const early = queueSnapshot(s, Date.parse(NOW) + 2 * 60_000)
    expect(early.counter.freshness.state).toBe('fresh')
    expect(early.condition).toBe('busy')
  })

  it('CH2-AT-10: paused blocks new requests but leaves existing ones processable', async () => {
    const e = setup()
    const a = await e.place(A, 'k1')
    await e.ok(e.repo.setPause('Rush hour (local)'))
    await e.repo.saveCart(B, e.cart('hot-a'))
    expect(await e.bad(e.repo.submitOrder(B, 'k2'))).toBeTruthy()
    expect(queueSnapshot(await e.repo.load(), Date.parse(NOW)).condition).toBe('paused')
    await e.ok(e.repo.operatorTransition(a.id, 'queued'))
    await e.ok(e.repo.operatorTransition(a.id, 'preparing'))
    const s = await e.repo.load()
    expect(s.orders.find((o) => o.id === a.id)!.status).toBe('preparing')
  })
})

describe('checkout, order and pickup (CH2-AT-11 … CH2-AT-20)', () => {
  it('CH2-AT-11: the same submission token creates one order; a new token a new one', async () => {
    const e = setup()
    await e.repo.saveCart(A, e.cart('hot-b'))
    const first = await e.ok(e.repo.submitOrder(A, 'same'))
    await e.repo.saveCart(A, e.cart('hot-b'))
    const again = await e.ok(e.repo.submitOrder(A, 'same'))
    expect(again.created).toBe(false)
    expect(again.order.id).toBe(first.order.id)
    await e.repo.saveCart(A, e.cart('hot-b'))
    const other = await e.ok(e.repo.submitOrder(A, 'different'))
    expect(other.order.id).not.toBe(first.order.id)
  })

  it('CH2-AT-12: unavailable, unknown or unpriced items cannot be ordered through a stale cart', async () => {
    const e = setup()
    const menu = demoMenu()
    const blocked = menu.items.find((i) => i.availability !== 'available' || i.priceMinor === null)
    expect(blocked).toBeDefined()
    await e.repo.saveCart(A, e.cart(blocked!.id))
    expect(await e.bad(e.repo.submitOrder(A, 'k'))).toBeTruthy()
    expect(validateCart(menu, e.cart(blocked!.id), { paused: false }).canSubmit).toBe(false)
    expect((await e.repo.load()).orders.filter((o) => o.ownerProfileId === A)).toHaveLength(0)
  })

  it('CH2-AT-14: later menu edits never change an order snapshot', async () => {
    const e = setup()
    const o = await e.place()
    const price = o.items[0]!.unitPriceMinorAtOrder
    const repo2 = createChillRepository({
      storage: e.storage,
      clock: { now: () => Temporal.Instant.from(NOW) },
      newId: (p) => `${p}-z`,
      notifications: e.prefs.notifications,
      menu: () => ({
        ...demoMenu(),
        items: demoMenu().items.map((i) => (i.id === 'hot-b' ? { ...i, priceMinor: 99_900 } : i)),
      }),
    })
    const order = (await repo2.load()).orders.find((x) => x.id === o.id)!
    expect(order.items[0]!.unitPriceMinorAtOrder).toBe(price)
    expect(order.listedSubtotalMinor).toBe(o.listedSubtotalMinor)
  })

  it('CH2-AT-15: every one of the seven states has a next step and no progress percentage', async () => {
    const e = setup()
    const o = await e.place()
    const s = await e.repo.load()
    const base = s.orders.find((x) => x.id === o.id)!
    const texts = (
      ['pending', 'queued', 'preparing', 'ready', 'collected', 'rejected', 'cancelled'] as const
    ).map((st) => nextStep({ ...base, status: st }))
    expect(new Set(texts).size).toBe(7)
    for (const t of texts) expect(t).not.toMatch(/%|percent/i)
    expect(TRACKER_STEPS).toHaveLength(5)
    expect(stepIndex('pending')).toBe(0)
    expect(stepIndex('collected')).toBe(4)
    expect(stepIndex('rejected')).toBeNull()
    expect(stepIndex('cancelled')).toBeNull()
  })

  it('CH2-AT-16: opening or reading the ticket cannot collect the order; only the simulator can', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    await e.ok(e.repo.operatorTransition(o.id, 'preparing'))
    await e.ok(e.repo.operatorTransition(o.id, 'ready'))
    await e.ok(e.repo.recordArrival(A, o.id))
    expect((await e.repo.load()).orders.find((x) => x.id === o.id)!.status).toBe('ready')
    await e.ok(e.repo.operatorTransition(o.id, 'collected'))
  })

  it('CH2-AT-17: a student cannot cancel once the order is accepted', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    expect(await e.bad(e.repo.cancelPending(A, o.id))).toMatch(
      /isn't available for accepted orders/,
    )
  })

  it('CH2-AT-18: an accepted order that cannot be made is flagged, not rejected, and stays in the backlog', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    expect(await e.bad(e.repo.operatorTransition(o.id, 'rejected', 'Sold out'))).toBeTruthy()
    expect(await e.bad(e.repo.flagException(o.id, '  '))).toMatch(/what needs attention/)
    const before = recordedBacklog((await e.repo.load()).orders).unfinished
    const flagged = await e.ok(e.repo.flagException(o.id, 'Item may be sold out'))
    expect(flagged.order.status).toBe('queued')
    expect(flagged.order.exceptionFlag).toMatchObject({
      kind: 'needsAttention',
      source: 'simulated',
    })
    expect(flagged.order.version).toBe(
      (await e.repo.load()).orders.find((x) => x.id === o.id)!.version,
    )
    expect(recordedBacklog((await e.repo.load()).orders).unfinished).toBe(before)
    // A pending request cannot be flagged: it should simply be declined.
    const p = await e.place(B, 'k9')
    expect(await e.bad(e.repo.flagException(p.id, 'x'))).toMatch(/Only an accepted order/)
    await e.ok(e.repo.clearException(o.id))
    expect((await e.repo.load()).orders.find((x) => x.id === o.id)!.exceptionFlag).toBeUndefined()
  })

  it('CH2-AT-19: favourites and carts are per profile and survive a reload', async () => {
    const e = setup()
    await e.ok(e.repo.toggleFavorite(A, 'hot-a'))
    await e.ok(e.repo.toggleFavorite(A, 'hot-b'))
    await e.ok(e.repo.toggleFavorite(A, 'hot-b')) // toggled off again
    expect(await e.repo.loadFavorites(A)).toEqual(['hot-a'])
    expect(await e.repo.loadFavorites(B)).toEqual([])
    await e.repo.saveCart(A, e.cart('hot-a'))
    const again = createChillRepository({
      storage: e.storage,
      clock: { now: () => Temporal.Instant.from(NOW) },
      newId: (p) => `${p}-q`,
      notifications: e.prefs.notifications,
    })
    expect(await again.loadFavorites(A)).toEqual(['hot-a'])
    expect((await again.loadCart(A)).lines).toHaveLength(1)
    expect((await again.loadCart(B)).lines).toHaveLength(0)
    await again.resetAll([{ id: A } as never, { id: B } as never])
    expect(await again.loadFavorites(A)).toEqual([])
  })

  it('CH2-AT-20: a reorder uses the current menu, so a changed price is flagged for review', async () => {
    const e = setup()
    const o = await e.place()
    const { reorderCart } = await import('@/selectors/chill')
    const changed = {
      ...demoMenu(),
      items: demoMenu().items.map((i) => (i.id === 'hot-b' ? { ...i, priceMinor: 12_300 } : i)),
    }
    const r = reorderCart(
      changed,
      (await e.repo.load()).orders.find((x) => x.id === o.id)!,
      (p) => `${p}-n`,
    )
    expect(r.cart.lines).toHaveLength(1)
    expect(r.changes.join(' ')).toMatch(/price/i)
    expect((await e.repo.load()).orders.filter((x) => x.ownerProfileId === A)).toHaveLength(1) // nothing was submitted
  })
})

describe('integration and analytics (CH2-AT-21 … CH2-AT-28)', () => {
  it('CH2-AT-21: the ready notification exists exactly once, even after a reload and a replay', async () => {
    const e = setup()
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    await e.ok(e.repo.operatorTransition(o.id, 'preparing'))
    await e.ok(e.repo.operatorTransition(o.id, 'ready'))
    const reloaded = createChillRepository({
      storage: e.storage,
      clock: { now: () => Temporal.Instant.from(NOW) },
      newId: (p) => `${p}-r`,
      notifications: e.prefs.notifications,
    })
    await reloaded.load()
    expect(await e.bad(reloaded.operatorTransition(o.id, 'ready'))).toBeTruthy()
    const ready = (await e.notes(A)).filter((n) => /ready for pickup/i.test(n.title))
    expect(ready).toHaveLength(1)
    expect(ready[0]!.significance).toBe('important')
    expect(ready[0]!.href).toBe(`/services/chill-spot/orders/${o.id}`)
  })

  it('CH2-AT-23: another profile cannot reach an order, and gets no notification about it', async () => {
    const e = setup()
    const o = await e.place(A)
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    expect(await e.bad(e.repo.cancelPending(B, o.id))).toMatch(/could not be found/)
    expect(await e.bad(e.repo.recordArrival(B, o.id))).toMatch(/could not be found/)
    expect(await e.notes(B)).toHaveLength(0)
  })

  it('CH2-AT-25: request turnaround, queue delay and ready-to-collection are separate, and missing pairs are "not enough recorded"', async () => {
    const e = setup()
    const o = await e.place()
    e.advance(2 * 60_000)
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    e.advance(6 * 60_000)
    await e.ok(e.repo.operatorTransition(o.id, 'preparing'))
    e.advance(4 * 60_000)
    await e.ok(e.repo.operatorTransition(o.id, 'ready'))
    const v = operationsView((await e.repo.load()).orders)
    const by = (label: RegExp) => v.durations.find((d) => label.test(d.label))!
    expect(by(/submitted to ready/).medianMinutes).toBe(12)
    expect(by(/submission to acceptance/i).medianMinutes).toBe(2)
    expect(by(/accepted to preparation start/).medianMinutes).toBeGreaterThanOrEqual(6)
    expect(by(/Preparation start to ready/).n).toBeGreaterThanOrEqual(1)
    expect(by(/Ready to recorded collection/).n).toBe(0)
    expect(by(/Ready to recorded collection/).medianMinutes).toBeNull()
    expect(v.rejectionRate).toEqual({ n: 0, of: 1 })
    expect(v.digitalSubmitted).toBe(1)
    expect(v.walkInRecorded).toBeGreaterThan(0)
    // Nothing recorded at all: counts are zero and durations are empty, never invented.
    const none = operationsView([])
    expect(none.durations.every((d) => d.n === 0 && d.medianMinutes === null)).toBe(true)
    expect(none.rejectionRate).toEqual({ n: 0, of: 0 })
  })

  it('CH2-AT-26: the scenario shows assumed numbers, a negative result as MORE waiting, and weekly hours only from assumptions', () => {
    const worse = compareWaiting(
      { counter: 0, onSite: 0, pickup: 4 },
      { counter: 0, onSite: 10, pickup: 4 },
    )
    expect(worse.netChangeMinutes).toBe(-10)
    expect(worse.direction).toBe('more')
    expect(worse.potentialAvoidedMinutes).toBe(0)
    const base = { counter: 6, onSite: 20, pickup: 4 }
    const ahead = { counter: 0, onSite: 0, pickup: 4 }
    expect(compareWaiting(base, ahead).netChangeMinutes).toBe(26)
    expect(hypotheticalWeeklyHours(200, 26)).toBeCloseTo(86.67, 1)
    expect(hypotheticalWeeklyHours(-1, 26)).toBeNull()
    expect(hypotheticalWeeklyHours(1.5, 26)).toBeNull()
    expect(hypotheticalWeeklyHours(0, 26)).toBe(0)
    const rows = pickupDelaySensitivity(base, ahead)
    expect(rows.map((r) => r.net)).toEqual([26, 21, 16, 11, 6])
    expect(pickupDelaySensitivity(base, ahead, [40])[0]!.net).toBe(-14)
  })

  it('CH2-AT-28: resetting the café scenario is deterministic and touches nothing else', async () => {
    const e = setup()
    await e.place()
    await e.ok(e.repo.setPause('x'))
    await e.storage.write('campusos:home:v1:demo-student-a', { sentinel: true })
    await e.ok(e.repo.resetScenario())
    const a = await e.repo.load()
    await e.ok(e.repo.resetScenario())
    const b = await e.repo.load()
    expect(a.orders.map((o) => [o.displayNumber, o.status, o.queueSequence])).toEqual(
      b.orders.map((o) => [o.displayNumber, o.status, o.queueSequence]),
    )
    expect(a.pause).toBeNull()
    expect(
      e.storage.read(CHILL_STORE_KEY, (await import('@/domain/chill')).chillStoreSchema).status,
    ).toBe('ok')
    expect(
      JSON.stringify(
        e.storage.read('campusos:home:v1:demo-student-a', (await import('zod')).z.any()),
      ),
    ).toContain('sentinel')
  })

  it('CH2-AT-30: the preset scenario runs from recorded walk-ins to a student collection, each step by a visible action', async () => {
    const e = setup()
    const before = await e.repo.load()
    expect(before.orders.filter((o) => o.channel === 'walkInRecorded')).toHaveLength(5)
    expect(before.counter?.numericValue).toBe(6)
    const o = await e.place()
    await e.ok(e.repo.operatorTransition(o.id, 'queued'))
    await e.ok(e.repo.setRequireHandlingNote(true))
    // The two older walk-ins that are still queued make a plain start fail until a reason is given.
    expect(await e.bad(e.repo.operatorTransition(o.id, 'preparing'))).toMatch(/Choose why/)
    await e.ok(
      e.repo.operatorTransition(o.id, 'preparing', undefined, { kind: 'item_ready_in_batch' }),
    )
    await e.ok(e.repo.operatorTransition(o.id, 'ready'))
    const done = await e.ok(e.repo.operatorTransition(o.id, 'collected'))
    expect(done.order.paymentVerification).toBe('notHandledInApp')
    expect(done.order.history.map((h) => h.to)).toEqual([
      'pending',
      'queued',
      'preparing',
      'ready',
      'collected',
    ])
    expect(
      done.order.history.every((h) => h.dataMode === 'userCreated' || h.dataMode === 'simulated'),
    ).toBe(true)
  })

  it('the menu sort never treats an unknown price as free', () => {
    const items = demoMenu().items.filter((i) => i.visible)
    const sorted = sortMenuItems(items, 'price')
    const priced = sorted.filter((i) => i.priceMinor !== null)
    expect(priced.map((i) => i.priceMinor)).toEqual(
      [...priced.map((i) => i.priceMinor!)].sort((a, b) => a - b),
    )
    const lastPriced = sorted.lastIndexOf(priced[priced.length - 1]!)
    expect(sorted.slice(lastPriced + 1).every((i) => i.priceMinor === null)).toBe(true)
    expect(
      sortMenuItems(items, 'name')[0]!.name.localeCompare(sortMenuItems(items, 'name')[1]!.name),
    ).toBeLessThanOrEqual(0)
    expect(sortMenuItems(items, 'menu').map((i) => i.id)).toEqual(items.map((i) => i.id))
  })
})
