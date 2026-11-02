import type { ChillStore, MenuItem, QueueObservation } from '@/domain/chill'
import { recordWalkIn, transitionOrder } from '@/domain/chill-logic'
import type { Provenance } from '@/domain/provenance'
import { isoFromMs } from '@/lib/time'
import type { MenuData } from '@/selectors/chill'

/**
 * ILLUSTRATIVE DEMO DATA. The real Chill Spot menu, prices, hours and queue have not been supplied
 * (COS-CHILL-001 §15). Every name, price and count here is fictional and carries a demo label.
 */
export const CHILL_MENU_LABEL = 'Illustrative sample menu (not the real café menu)'

const demo = (verification: Provenance['verification'] = 'unknown'): Provenance => ({
  dataMode: 'demoSeed',
  verification,
  authority: 'demoIllustration',
  sourceLabel: CHILL_MENU_LABEL,
})

const item = (i: Omit<MenuItem, 'visible' | 'provenance'> & { visible?: boolean }): MenuItem => ({
  visible: true,
  provenance: demo(),
  ...i,
})

export function demoMenu(): MenuData {
  return {
    categories: [
      { id: 'hot', label: 'Sample hot drinks' },
      { id: 'cold', label: 'Sample cold drinks' },
      { id: 'snacks', label: 'Sample snacks' },
    ],
    items: [
      item({
        id: 'hot-a',
        name: 'Sample hot drink A',
        categoryId: 'hot',
        priceMinor: 4000,
        availability: 'available',
        description: 'A fictional drink used to demonstrate ordering.',
        options: [
          { id: 'large', label: 'Sample large size', priceDeltaMinor: 1000 },
          { id: 'extra', label: 'Sample extra portion', priceDeltaMinor: 500 },
        ],
      }),
      item({
        id: 'hot-b',
        name: 'Sample hot drink B',
        categoryId: 'hot',
        priceMinor: 6000,
        availability: 'available',
      }),
      item({
        id: 'cold-a',
        name: 'Sample cold drink A',
        categoryId: 'cold',
        priceMinor: 8000,
        availability: 'available',
      }),
      item({
        id: 'cold-b',
        name: 'Sample cold drink B',
        categoryId: 'cold',
        priceMinor: 9000,
        availability: 'unavailable',
      }),
      item({
        id: 'snack-a',
        name: 'Sample snack A',
        categoryId: 'snacks',
        priceMinor: 7000,
        availability: 'available',
      }),
      item({
        id: 'snack-b',
        name: 'Sample snack B',
        categoryId: 'snacks',
        priceMinor: 5000,
        availability: 'unknown',
      }),
      item({
        id: 'snack-c',
        name: 'Sample snack C',
        categoryId: 'snacks',
        priceMinor: null,
        availability: 'available',
        description: 'Shown for information only: no valid price was supplied.',
      }),
      item({
        id: 'snack-hidden',
        name: 'Hidden sample item',
        categoryId: 'snacks',
        priceMinor: 1000,
        availability: 'available',
        visible: false,
      }),
    ],
  }
}

const observation = (
  metric: QueueObservation['metric'],
  fields: Pick<QueueObservation, 'numericValue' | 'reportedState'>,
  asOf: string,
): QueueObservation => ({
  metric,
  ...fields,
  asOf,
  sourceLabel: 'Demo observation (not a live count)',
  coverage: 'reportedComplete',
  provenance: {
    dataMode: 'demoSeed',
    verification: 'unknown',
    authority: 'demoIllustration',
    sourceLabel: 'Demo observation (not a live count)',
  },
})

export const emptyChillStore = (): ChillStore => ({
  schemaVersion: 1,
  orders: [],
  counter: null,
  busy: null,
  pause: null,
  nextQueueSequence: 1,
  nextOrderNumber: 1,
})

/**
 * The labelled starting scenario (§7.1 step 1): five recorded walk-ins accepted before you arrive
 * (one ready, one being prepared, three queued) and a separately reported counter line of 6 people.
 * Built deterministically from `nowMs`, so tests with a fixed clock get identical data.
 */
export function initialChillStore(nowMs: number): ChillStore {
  let n = 0
  const mk = (minutesAgo: number) => ({
    nowIso: isoFromMs(nowMs - minutesAgo * 60_000),
    newId: (p: string) => `seed-${p}-${++n}`,
  })
  const lines = (name: string, qty = 1, price = 4000) => [
    {
      menuItemId: 'seed',
      nameAtOrder: name,
      selectedOptionIds: [],
      optionLabelsAtOrder: [],
      unitPriceMinorAtOrder: price,
      quantity: qty,
      lineSubtotalMinor: price * qty,
    },
  ]
  let store = emptyChillStore()
  const specs: [string, number, number][] = [
    ['Sample hot drink A', 2, 30],
    ['Sample snack A', 1, 26],
    ['Sample cold drink A', 1, 22],
    ['Sample hot drink B', 3, 18],
    ['Sample snack A', 2, 12],
  ]
  const ids: string[] = []
  for (const [name, qty, ago] of specs) {
    const r = recordWalkIn(store, lines(name, qty), mk(ago))
    store = r.store
    ids.push(r.order.id)
  }
  const step = (id: string, to: 'preparing' | 'ready', ago: number) => {
    const r = transitionOrder(store, id, to, 'demoOperator', mk(ago))
    if (r.ok) store = r.store
  }
  step(ids[0]!, 'preparing', 24)
  step(ids[0]!, 'ready', 6)
  step(ids[1]!, 'preparing', 5)
  // Seeded records are reference data, not "simulated this session".
  store = {
    ...store,
    orders: store.orders.map((o) => ({
      ...o,
      provenance: {
        dataMode: 'demoSeed',
        verification: 'unknown',
        authority: 'demoIllustration',
        sourceLabel: 'Illustrative sample backlog (not real orders)',
      },
    })),
    counter: observation(
      'counterPeople',
      { numericValue: 6, reportedState: undefined },
      isoFromMs(nowMs),
    ),
    busy: observation('busyState', { numericValue: null, reportedState: 'busy' }, isoFromMs(nowMs)),
  }
  return store
}
