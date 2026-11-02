import {
  ORDER_STATUSES,
  isActive,
  isTerminal,
  type Cart,
  type CartLine,
  type ChillOrder,
  type ChillStore,
  type MenuCategory,
  type MenuItem,
  type OrderLineSnapshot,
  type OrderStatus,
  type QueueObservation,
} from '@/domain/chill'
import { formatInstant } from '@/lib/time'
import { Temporal } from 'temporal-polyfill'

export interface MenuData {
  categories: MenuCategory[]
  items: MenuItem[]
}

/** Minutes after which a manual observation is shown as stale (COS-CHILL-001 §6.3, configurable default). */
export const STALE_AFTER_MINUTES = 10
export const MAX_LINE_QUANTITY = 20

/* ─────────────────────────────── Menu ─────────────────────────────── */

/** Categories that actually have a visible item: never an invented category. */
export function representedCategories(menu: MenuData): MenuCategory[] {
  const used = new Set(menu.items.filter((i) => i.visible).map((i) => i.categoryId))
  return menu.categories.filter((c) => used.has(c.id))
}

export function searchMenu(menu: MenuData, query: string, categoryId?: string): MenuItem[] {
  const q = query.trim().toLowerCase()
  return menu.items.filter(
    (i) =>
      i.visible &&
      (!categoryId || i.categoryId === categoryId) &&
      (!q || `${i.name} ${i.description ?? ''}`.toLowerCase().includes(q)),
  )
}

export type OrderBlock = 'unavailable' | 'unknownAvailability' | 'missingPrice' | null

/** Why an item cannot be ordered (default policy: unknown availability also blocks, with an explanation). */
export function orderBlock(item: MenuItem): OrderBlock {
  if (item.availability === 'unavailable') return 'unavailable'
  if (item.availability === 'unknown') return 'unknownAvailability'
  if (item.priceMinor === null) return 'missingPrice'
  return null
}

export const blockMessage: Record<Exclude<OrderBlock, null>, string> = {
  unavailable: 'Currently unavailable',
  unknownAvailability: 'Availability not confirmed, so it cannot be ordered yet',
  missingPrice: 'No valid price was supplied, so it cannot be ordered',
}

/* ─────────────────────────────── Cart ─────────────────────────────── */

export type CartIssueCode =
  | 'empty'
  | 'paused'
  | 'missingItem'
  | 'unavailable'
  | 'unknownAvailability'
  | 'missingPrice'
  | 'invalidOption'
  | 'invalidQuantity'

export interface CartIssue {
  code: CartIssueCode
  lineId?: string
  message: string
}

export interface ValidatedLine {
  line: CartLine
  item?: MenuItem
  optionLabels: string[]
  unitPriceMinor: number
  subtotalMinor: number
  issues: CartIssue[]
}

export interface CartValidation {
  lines: ValidatedLine[]
  issues: CartIssue[]
  /** Sum of the lines that are individually valid (what the student sees while editing). */
  subtotalMinor: number
  canSubmit: boolean
}

/**
 * Revalidates a cart against the CURRENT menu (§4.4). Totals are integer paise; a line with any
 * problem contributes nothing and blocks submission, and nothing is silently corrected.
 */
export function validateCart(
  menu: MenuData,
  cart: Cart,
  opts: { paused: boolean },
): CartValidation {
  const lines: ValidatedLine[] = cart.lines.map((line) => {
    const issues: CartIssue[] = []
    const item = menu.items.find((i) => i.id === line.menuItemId && i.visible)
    const base: ValidatedLine = {
      line,
      item,
      optionLabels: [],
      unitPriceMinor: 0,
      subtotalMinor: 0,
      issues,
    }
    if (!item) {
      issues.push({
        code: 'missingItem',
        lineId: line.lineId,
        message: 'This item is no longer on the menu',
      })
      return base
    }
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1 ||
      line.quantity > MAX_LINE_QUANTITY
    ) {
      issues.push({
        code: 'invalidQuantity',
        lineId: line.lineId,
        message: `Quantity must be a whole number from 1 to ${MAX_LINE_QUANTITY}`,
      })
    }
    const block = orderBlock(item)
    if (block)
      issues.push({
        code: block,
        lineId: line.lineId,
        message: `${item.name}: ${blockMessage[block]}`,
      })
    const picked = line.optionIds.map((id) => item.options?.find((o) => o.id === id))
    if (picked.some((o) => !o))
      issues.push({
        code: 'invalidOption',
        lineId: line.lineId,
        message: `${item.name}: a chosen option is not available`,
      })
    if (issues.length) return { ...base, item }
    const options = picked.filter((o): o is NonNullable<typeof o> => !!o)
    const unit = (item.priceMinor as number) + options.reduce((s, o) => s + o.priceDeltaMinor, 0)
    if (!Number.isInteger(unit) || unit < 0) {
      issues.push({
        code: 'missingPrice',
        lineId: line.lineId,
        message: `${item.name}: the price is not valid`,
      })
      return { ...base, item }
    }
    return {
      ...base,
      item,
      optionLabels: options.map((o) => o.label),
      unitPriceMinor: unit,
      subtotalMinor: unit * line.quantity,
    }
  })
  const issues: CartIssue[] = lines.flatMap((l) => l.issues)
  if (lines.length === 0) issues.unshift({ code: 'empty', message: 'Your cart is empty' })
  if (opts.paused)
    issues.push({ code: 'paused', message: 'The demo café is temporarily not taking new requests' })
  return {
    lines,
    issues,
    subtotalMinor: lines
      .filter((l) => l.issues.length === 0)
      .reduce((s, l) => s + l.subtotalMinor, 0),
    canSubmit: issues.length === 0,
  }
}

/** Immutable snapshot of a valid cart as shown at submission (§4.3). */
export function toSnapshot(validation: CartValidation): OrderLineSnapshot[] {
  return validation.lines.map((l) => ({
    menuItemId: l.line.menuItemId,
    nameAtOrder: l.item!.name,
    selectedOptionIds: [...l.line.optionIds],
    optionLabelsAtOrder: [...l.optionLabels],
    unitPriceMinorAtOrder: l.unitPriceMinor,
    quantity: l.line.quantity,
    lineSubtotalMinor: l.subtotalMinor,
  }))
}

/** Add to a cart, merging identical item+option lines. */
export function addToCart(
  cart: Cart,
  line: Omit<CartLine, 'lineId'>,
  newId: (p: string) => string,
): Cart {
  const key = (l: Omit<CartLine, 'lineId' | 'quantity'>) =>
    `${l.menuItemId}|${[...l.optionIds].sort().join(',')}`
  const same = cart.lines.find((l) => key(l) === key(line))
  if (same) {
    return {
      ...cart,
      lines: cart.lines.map((l) =>
        l === same
          ? { ...l, quantity: Math.min(MAX_LINE_QUANTITY, l.quantity + line.quantity) }
          : l,
      ),
    }
  }
  return { ...cart, lines: [...cart.lines, { ...line, lineId: newId('line') }] }
}

export interface ReorderResult {
  cart: Cart
  /** Plain-language warnings about anything that changed since the original order. */
  changes: string[]
}

/**
 * Reorder = a NEW editable cart from current menu data (§4.2, CH-AT-27). Nothing is submitted, and any
 * change in price or availability is reported rather than hidden.
 */
export function reorderCart(
  menu: MenuData,
  order: ChillOrder,
  newId: (p: string) => string,
): ReorderResult {
  const changes: string[] = []
  const lines: CartLine[] = []
  for (const l of order.items) {
    const item = menu.items.find((i) => i.id === l.menuItemId && i.visible)
    if (!item) {
      changes.push(`${l.nameAtOrder} is no longer on the menu and was left out.`)
      continue
    }
    const validOptions = l.selectedOptionIds.every((id) => item.options?.some((o) => o.id === id))
    if (!validOptions) {
      changes.push(
        `${l.nameAtOrder}: the options you chose are no longer offered, so it was left out.`,
      )
      continue
    }
    const block = orderBlock(item)
    if (block)
      changes.push(
        `${item.name}: ${blockMessage[block].toLowerCase()}. Remove it or wait before ordering.`,
      )
    else {
      const unit =
        (item.priceMinor as number) +
        l.selectedOptionIds.reduce(
          (s, id) => s + (item.options?.find((o) => o.id === id)?.priceDeltaMinor ?? 0),
          0,
        )
      if (unit !== l.unitPriceMinorAtOrder)
        changes.push(`${item.name}: the listed price changed since your earlier order.`)
    }
    lines.push({
      lineId: newId('line'),
      menuItemId: item.id,
      optionIds: [...l.selectedOptionIds],
      quantity: l.quantity,
    })
  }
  return { cart: { schemaVersion: 1, lines }, changes }
}

/* ───────────────────────────── Queue ───────────────────────────── */

export interface Backlog {
  /** queued + preparing, recorded only. Pending, ready and terminal orders are never included. */
  unfinished: number
  queued: number
  preparing: number
  digital: number
  walkInRecorded: number
}

/** The preparation backlog (§6.1 #2). */
export function recordedBacklog(orders: readonly ChillOrder[]): Backlog {
  const open = orders.filter((o) => o.status === 'queued' || o.status === 'preparing')
  return {
    unfinished: open.length,
    queued: open.filter((o) => o.status === 'queued').length,
    preparing: open.filter((o) => o.status === 'preparing').length,
    digital: open.filter((o) => o.channel === 'digital').length,
    walkInRecorded: open.filter((o) => o.channel === 'walkInRecorded').length,
  }
}

/** Pickup (§6.1 #3): orders, not people. */
export const readyCount = (orders: readonly ChillOrder[]) =>
  orders.filter((o) => o.status === 'ready').length

/**
 * "Recorded unfinished orders ahead" for an accepted, not-yet-preparing order: earlier-sequenced
 * orders still queued or preparing. Undefined when it does not apply (pending, preparing, ready, …).
 */
export function recordedAhead(
  orders: readonly ChillOrder[],
  order: ChillOrder,
): number | undefined {
  if (order.status !== 'queued' || order.queueSequence === undefined) return undefined
  const seq = order.queueSequence
  return orders.filter(
    (o) =>
      (o.status === 'queued' || o.status === 'preparing') &&
      o.queueSequence !== undefined &&
      o.queueSequence < seq,
  ).length
}

export interface Freshness {
  state: 'none' | 'fresh' | 'stale'
  ageMinutes: number | null
  /** e.g. "4:10 pm", from the ORIGINAL report time; a reload never refreshes it. */
  asOfLabel: string | null
}

export function observationFreshness(
  obs: QueueObservation | null,
  nowMs: number,
  staleAfter = STALE_AFTER_MINUTES,
): Freshness {
  if (!obs) return { state: 'none', ageMinutes: null, asOfLabel: null }
  const asOfMs = Temporal.Instant.from(obs.asOf).epochMilliseconds
  const age = Math.max(0, Math.floor((nowMs - asOfMs) / 60_000))
  return {
    state: age >= staleAfter ? 'stale' : 'fresh',
    ageMinutes: age,
    asOfLabel: formatInstant(obs.asOf).replace(/^.*?,\s*/, ''),
  }
}

/** The café's reported condition (V2 §3.5). `paused` wins; a stale or missing report is `unknown`, never "quiet". */
export type CafeCondition = 'quiet' | 'moderate' | 'busy' | 'paused' | 'unknown'

/** The most recent recorded order change. A third clock, independent of the counter and busy reports. */
export const lastOrderChangeAt = (orders: readonly ChillOrder[]): string | null =>
  orders.reduce<string | null>((latest, o) => {
    const t = o.history[o.history.length - 1]?.occurredAt ?? null
    return t && (!latest || t > latest) ? t : latest
  }, null)

export interface QueueSnapshot {
  condition: CafeCondition
  /** When the recorded backlog last changed ("4:10 pm"), or null when nothing has been recorded. */
  backlogAsOfLabel: string | null
  busy: { text: string; freshness: Freshness; observation: QueueObservation | null }
  counter: { text: string; freshness: Freshness; observation: QueueObservation | null }
  preparation: { text: string; backlog: Backlog; caveat: string }
  pickup: { text: string; count: number }
  paused: { reason: string } | null
}

/** Everything the student sees about the café's state, each with its honest qualifier (§6.3). */
export function queueSnapshot(store: ChillStore, nowMs: number): QueueSnapshot {
  const backlog = recordedBacklog(store.orders)
  const ready = readyCount(store.orders)
  const busyFresh = observationFreshness(store.busy, nowMs)
  const counterFresh = observationFreshness(store.counter, nowMs)
  const state = store.busy?.reportedState
  const busyText =
    !store.busy || !state || state === 'unknown'
      ? 'No recent report'
      : state === 'busy'
        ? 'Reported busy'
        : state === 'quiet'
          ? 'Reported quiet'
          : 'Reported moderate'
  const counterText =
    !store.counter || store.counter.numericValue === null
      ? 'Counter queue unknown'
      : `${store.counter.numericValue} ${store.counter.numericValue === 1 ? 'person' : 'people'} last reported at counter · Demo · ${counterFresh.asOfLabel}`
  const lastChange = lastOrderChangeAt(store.orders)
  const reported = store.busy?.reportedState
  const condition: CafeCondition = store.pause
    ? 'paused'
    : busyFresh.state === 'fresh' && reported && reported !== 'unknown'
      ? reported
      : 'unknown'
  return {
    condition,
    backlogAsOfLabel: lastChange ? formatInstant(lastChange).replace(/^.*?,\s*/, '') : null,
    busy: { text: busyText, freshness: busyFresh, observation: store.busy },
    counter: { text: counterText, freshness: counterFresh, observation: store.counter },
    preparation: {
      text: `${backlog.unfinished} recorded unfinished ${backlog.unfinished === 1 ? 'order' : 'orders'} · Demo`,
      backlog,
      caveat: 'Recorded orders only; walk-in preparation work may be missing.',
    },
    pickup: {
      text: `${ready} recorded ${ready === 1 ? 'order' : 'orders'} ready for pickup`,
      count: ready,
    },
    paused: store.pause ? { reason: store.pause.reason } : null,
  }
}

/* ───────────────────────────── Orders ───────────────────────────── */

export const lastChangeAt = (o: ChillOrder) => o.history[o.history.length - 1]!.occurredAt

export function ownOrders(store: ChillStore, profileId: string): ChillOrder[] {
  return store.orders.filter((o) => o.ownerProfileId === profileId)
}

const byRecent = (a: ChillOrder, b: ChillOrder) =>
  lastChangeAt(a) < lastChangeAt(b)
    ? 1
    : lastChangeAt(a) > lastChangeAt(b)
      ? -1
      : a.id < b.id
        ? -1
        : 1

export const activeOrders = (orders: readonly ChillOrder[]) =>
  orders.filter((o) => isActive(o.status)).sort(byRecent)
export const historyOrders = (orders: readonly ChillOrder[]) =>
  orders.filter((o) => isTerminal(o.status)).sort(byRecent)

export function itemSummary(order: ChillOrder): string {
  const n = order.items.reduce((s, l) => s + l.quantity, 0)
  return `${n} ${n === 1 ? 'item' : 'items'}`
}

/** Route of one order's tracker. Lives with the selectors so Home can link without importing UI code. */
export const orderPath = (id: string) => `/services/chill-spot/orders/${id}`

/* ───────────────────────────── V2: tracker steps, menu sort, operations view ───────────────────────────── */

/** The five steps of an accepted order. A step marker, never a percentage of cooking time. */
export const TRACKER_STEPS = ['Requested', 'Accepted', 'Preparing', 'Ready', 'Collected'] as const

/** Index (0-4) of the furthest step reached, or null for orders that ended without one (declined, cancelled). */
export function stepIndex(status: OrderStatus): number | null {
  switch (status) {
    case 'pending':
      return 0
    case 'queued':
      return 1
    case 'preparing':
      return 2
    case 'ready':
      return 3
    case 'collected':
      return 4
    default:
      return null
  }
}

/** What the student can do or expect next, for each of the seven states (V2 §2.4). No time is promised. */
export function nextStep(order: ChillOrder): string {
  switch (order.status) {
    case 'pending':
      return 'Awaiting café acceptance; this is not a confirmed order. You can cancel the request until it is accepted.'
    case 'queued':
      return 'Accepted and in the recorded preparation backlog. You cannot cancel it in this demo.'
    case 'preparing':
      return 'Preparation started. No verified pickup time is available.'
    case 'ready':
      return 'Ready for pickup. Pay at the café counter and show your demo pickup code.'
    case 'collected':
      return 'Collection recorded. Payment is not verified in CampusOS.'
    case 'rejected':
      return `Not accepted${order.rejectionReason ? `: ${order.rejectionReason}` : ' (no reason recorded)'}. You can start a new order from the menu.`
    case 'cancelled':
      return 'You cancelled this request before it was accepted. You can start a new order from the menu.'
  }
}

export type MenuSort = 'menu' | 'name' | 'price'

/** Sorts a copy. Items with no valid price go last under a price sort; an unknown price is never treated as zero. */
export function sortMenuItems(items: readonly MenuItem[], by: MenuSort): MenuItem[] {
  const out = [...items]
  if (by === 'name') return out.sort((a, b) => a.name.localeCompare(b.name))
  if (by === 'price')
    return out.sort((a, b) => {
      if (a.priceMinor === null && b.priceMinor === null) return a.name.localeCompare(b.name)
      if (a.priceMinor === null) return 1
      if (b.priceMinor === null) return -1
      return a.priceMinor - b.priceMinor || a.name.localeCompare(b.name)
    })
  return out
}

export interface DurationStat {
  label: string
  /** How many orders had both timestamps. Zero means "not enough recorded", never "0 minutes". */
  n: number
  medianMinutes: number | null
}

export interface OperationsView {
  digitalAccepted: number
  walkInRecorded: number
  perState: Record<OrderStatus, number>
  digitalSubmitted: number
  rejected: number
  cancelled: number
  /** Share of digital requests that were declined / cancelled, with the denominator that makes it meaningful. */
  rejectionRate: { n: number; of: number }
  cancellationRate: { n: number; of: number }
  durations: DurationStat[]
  outOfSequence: number
  flagged: number
  arrivalsReported: number
}

const minutesBetween = (a?: string, b?: string): number | null => {
  if (!a || !b) return null
  const m =
    (Temporal.Instant.from(b).epochMilliseconds - Temporal.Instant.from(a).epochMilliseconds) /
    60_000
  return m >= 0 ? m : null
}

const median = (xs: number[]): number | null => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2
}

/**
 * Counts and durations from the events actually recorded in this prototype (V2 §6.1). Every figure
 * carries how many orders it rests on. None of it is physical waiting, and none of it predicts the
 * real café.
 */
export function operationsView(orders: readonly ChillOrder[]): OperationsView {
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length
  const perState = Object.fromEntries(ORDER_STATUSES.map((s) => [s, count(s)])) as Record<
    OrderStatus,
    number
  >
  const digital = orders.filter((o) => o.channel === 'digital')
  const stat = (label: string, pick: (o: ChillOrder) => number | null): DurationStat => {
    const xs = orders.map(pick).filter((x): x is number => x !== null)
    return { label, n: xs.length, medianMinutes: median(xs) }
  }
  return {
    digitalAccepted: digital.filter((o) => o.acceptedAt).length,
    walkInRecorded: orders.filter((o) => o.channel === 'walkInRecorded').length,
    perState,
    digitalSubmitted: digital.length,
    rejected: count('rejected'),
    cancelled: count('cancelled'),
    rejectionRate: { n: digital.filter((o) => o.status === 'rejected').length, of: digital.length },
    cancellationRate: {
      n: digital.filter((o) => o.status === 'cancelled').length,
      of: digital.length,
    },
    durations: [
      stat('Request turnaround: submitted to ready (digital)', (o) =>
        o.channel === 'digital' ? minutesBetween(o.submittedAt, o.readyAt) : null,
      ),
      stat('Submission to acceptance (digital)', (o) =>
        o.channel === 'digital' ? minutesBetween(o.submittedAt, o.acceptedAt) : null,
      ),
      stat('Recorded queue delay: accepted to preparation start', (o) =>
        minutesBetween(o.acceptedAt, o.startedPreparingAt),
      ),
      stat('Preparation start to ready', (o) => minutesBetween(o.startedPreparingAt, o.readyAt)),
      stat('Ready to recorded collection', (o) => minutesBetween(o.readyAt, o.collectedAt)),
    ],
    outOfSequence: orders.filter((o) => o.history.some((h) => h.handlingNote)).length,
    flagged: orders.filter((o) => o.exceptionFlag).length,
    arrivalsReported: orders.filter((o) => o.studentReportedArrivalAt).length,
  }
}
