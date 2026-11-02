import type { Provenance } from './provenance'
import {
  isTerminal,
  type ChillOrder,
  type HandlingNote,
  type ChillStore,
  type OrderLineSnapshot,
  type OrderStatus,
  type OrderTransition,
} from './chill'

/**
 * Pure order state machine and queue bookkeeping (COS-CHILL-001 §5–§6). No clock, storage or React:
 * callers pass timestamps and ids in. Nothing here advances an order on its own.
 */

export type Actor = 'student' | 'demoOperator'
export type Failure = { ok: false; reason: string }

/** The only permitted transitions and who may perform them. */
const ALLOWED: ReadonlyArray<{ from: OrderStatus; to: OrderStatus; actor: Actor }> = [
  { from: 'pending', to: 'queued', actor: 'demoOperator' },
  { from: 'pending', to: 'rejected', actor: 'demoOperator' },
  { from: 'pending', to: 'cancelled', actor: 'student' },
  { from: 'queued', to: 'preparing', actor: 'demoOperator' },
  { from: 'preparing', to: 'ready', actor: 'demoOperator' },
  { from: 'ready', to: 'collected', actor: 'demoOperator' },
]

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: Actor,
): { ok: true } | Failure {
  if (isTerminal(from))
    return { ok: false, reason: 'This order is finished and can no longer change.' }
  if (to === 'cancelled' && actor === 'student' && from !== 'pending') {
    return { ok: false, reason: "Cancellation isn't available for accepted orders in this demo." }
  }
  if (ALLOWED.some((t) => t.from === from && t.to === to && t.actor === actor)) return { ok: true }
  if (ALLOWED.some((t) => t.from === from && t.to === to)) {
    return {
      ok: false,
      reason: `Only ${actor === 'student' ? 'the demo café' : 'the student'} can do that.`,
    }
  }
  return { ok: false, reason: `An order cannot go from “${from}” to “${to}”.` }
}

export interface Clock {
  nowIso: string
  newId: (prefix: string) => string
}

export const userProvenance = (nowIso: string): Provenance => ({
  dataMode: 'userCreated',
  verification: 'notApplicable',
  authority: 'personal',
  sourceLabel: 'Created by you on this device',
  updatedAt: nowIso,
})

export const simulatedProvenance = (
  nowIso: string,
  label = 'Simulated by the local demo operator',
): Provenance => ({
  dataMode: 'simulated',
  verification: 'notApplicable',
  authority: 'demoIllustration',
  sourceLabel: label,
  updatedAt: nowIso,
})

const displayNumber = (n: number) => `CS-${String(n).padStart(4, '0')}`

/** A short, non-identifying demo pickup code derived from the order number. Not a QR and not scannable. */
export function pickupCodeFor(order: Pick<ChillOrder, 'displayNumber'>): string {
  const n = Number(order.displayNumber.replace(/\D/g, '')) || 0
  const code = ((n * 7919 + 1301) % 9000) + 1000
  return String(code)
}

export const subtotalOf = (lines: readonly OrderLineSnapshot[]) =>
  lines.reduce((sum, l) => sum + l.lineSubtotalMinor, 0)

export type Created = { ok: true; store: ChillStore; order: ChillOrder; created: boolean }

/**
 * Draft → pending. Idempotent on `idempotencyKey` for the same owner: a repeat returns the existing
 * order and changes nothing (CH-AT-07). The submitted item/price snapshot is stored as given.
 */
export function createPendingOrder(
  store: ChillStore,
  input: { profileId: string; lines: OrderLineSnapshot[]; idempotencyKey: string },
  clock: Clock,
): Created | Failure {
  if (input.lines.length === 0) return { ok: false, reason: 'The order has no items.' }
  const existing = store.orders.find(
    (o) => o.idempotencyKey === input.idempotencyKey && o.ownerProfileId === input.profileId,
  )
  if (existing) return { ok: true, store, order: existing, created: false }
  const transition: OrderTransition = {
    transitionId: clock.newId('tr'),
    from: 'cart',
    to: 'pending',
    actor: 'student',
    occurredAt: clock.nowIso,
    version: 1,
    dataMode: 'userCreated',
  }
  const order: ChillOrder = {
    id: clock.newId('order'),
    displayNumber: displayNumber(store.nextOrderNumber),
    ownerProfileId: input.profileId,
    channel: 'digital',
    status: 'pending',
    items: input.lines.map((l) => ({ ...l })),
    currency: 'INR',
    listedSubtotalMinor: subtotalOf(input.lines),
    paymentMethod: 'payAtPickup',
    paymentVerification: 'notHandledInApp',
    submittedAt: clock.nowIso,
    idempotencyKey: input.idempotencyKey,
    provenance: userProvenance(clock.nowIso),
    version: 1,
    history: [transition],
  }
  return {
    ok: true,
    store: {
      ...store,
      orders: [...store.orders, order],
      nextOrderNumber: store.nextOrderNumber + 1,
    },
    order,
    created: true,
  }
}

/** A demo walk-in accepted at the counter: joins the recorded queue immediately, with a stable sequence. */
export function recordWalkIn(store: ChillStore, lines: OrderLineSnapshot[], clock: Clock): Created {
  const transition: OrderTransition = {
    transitionId: clock.newId('tr'),
    from: 'cart',
    to: 'queued',
    actor: 'demoOperator',
    occurredAt: clock.nowIso,
    version: 1,
    dataMode: 'simulated',
    reason: 'Walk-in recorded at the counter (simulated)',
  }
  const order: ChillOrder = {
    id: clock.newId('order'),
    displayNumber: displayNumber(store.nextOrderNumber),
    ownerProfileId: null,
    channel: 'walkInRecorded',
    status: 'queued',
    items: lines.map((l) => ({ ...l })),
    currency: 'INR',
    listedSubtotalMinor: subtotalOf(lines),
    paymentMethod: 'payAtPickup',
    paymentVerification: 'notHandledInApp',
    acceptedAt: clock.nowIso,
    queueSequence: store.nextQueueSequence,
    provenance: simulatedProvenance(clock.nowIso, 'Simulated walk-in (demonstration)'),
    version: 1,
    history: [transition],
  }
  return {
    ok: true,
    created: true,
    order,
    store: {
      ...store,
      orders: [...store.orders, order],
      nextOrderNumber: store.nextOrderNumber + 1,
      nextQueueSequence: store.nextQueueSequence + 1,
    },
  }
}

export type Transitioned = {
  ok: true
  store: ChillStore
  order: ChillOrder
  transition: OrderTransition
}

/**
 * Apply one valid transition. Appends to the history, bumps the version, stamps the matching
 * timestamp, and assigns the queue sequence at acceptance. Terminal states are immutable.
 */
export function transitionOrder(
  store: ChillStore,
  orderId: string,
  to: OrderStatus,
  actor: Actor,
  clock: Clock,
  reason?: string,
  handlingNote?: HandlingNote,
): Transitioned | Failure {
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, reason: 'That order could not be found.' }
  const allowed = canTransition(order.status, to, actor)
  if (!allowed.ok) return allowed
  // Starting an order while an earlier-accepted one is still waiting needs a logged reason (V2 §3.4).
  let note: HandlingNote | undefined
  if (to === 'preparing' && store.requireHandlingNote) {
    const skipped = startsOutOfSequence(store, order)
    if (skipped) {
      if (!handlingNote) {
        return {
          ok: false,
          reason: `An earlier-accepted order (${skipped.displayNumber}) is still waiting. Choose why this one starts first.`,
        }
      }
      if (handlingNote.kind === 'other' && !handlingNote.text?.trim())
        return { ok: false, reason: 'Describe the reason when you choose “Other reason”.' }
      note = {
        kind: handlingNote.kind,
        ...(handlingNote.text?.trim() ? { text: handlingNote.text.trim() } : {}),
      }
    }
  }
  if (to === 'rejected' && !reason?.trim()) {
    // A reason is optional in the spec; we record "No reason recorded" rather than inventing one.
    reason = undefined
  }
  const version = order.version + 1
  const transition: OrderTransition = {
    transitionId: clock.newId('tr'),
    from: order.status,
    to,
    actor,
    occurredAt: clock.nowIso,
    version,
    dataMode: actor === 'student' ? 'userCreated' : 'simulated',
    ...(reason?.trim() ? { reason: reason.trim() } : {}),
    ...(note ? { handlingNote: note } : {}),
  }
  let next: ChillOrder = { ...order, status: to, version, history: [...order.history, transition] }
  let nextSequence = store.nextQueueSequence
  if (to === 'queued') {
    next = { ...next, acceptedAt: clock.nowIso, queueSequence: nextSequence }
    nextSequence += 1
  }
  if (to === 'preparing') next = { ...next, startedPreparingAt: clock.nowIso }
  if (to === 'ready') next = { ...next, readyAt: clock.nowIso }
  if (to === 'collected') next = { ...next, collectedAt: clock.nowIso }
  if (to === 'rejected' && transition.reason) next = { ...next, rejectionReason: transition.reason }
  return {
    ok: true,
    order: next,
    transition,
    store: {
      ...store,
      orders: store.orders.map((o) => (o.id === orderId ? next : o)),
      nextQueueSequence: nextSequence,
    },
  }
}

/**
 * An earlier-accepted order that is still `queued` (not yet started) when this one is about to start.
 * Parallel preparation is allowed; it just has to be explained in the log.
 */
export function startsOutOfSequence(store: ChillStore, order: ChillOrder): ChillOrder | undefined {
  if (order.queueSequence === undefined) return undefined
  return store.orders
    .filter(
      (o) =>
        o.id !== order.id &&
        o.status === 'queued' &&
        o.queueSequence !== undefined &&
        o.queueSequence < order.queueSequence!,
    )
    .sort((a, b) => a.queueSequence! - b.queueSequence!)[0]
}

/** An annotation on an unfinished order. It never moves the order and never removes it from the backlog. */
export function flagException(
  store: ChillStore,
  orderId: string,
  note: string,
  clock: Clock,
): { ok: true; store: ChillStore; order: ChillOrder } | Failure {
  const order = store.orders.find((o) => o.id === orderId)
  if (!order) return { ok: false, reason: 'That order could not be found.' }
  if (isTerminal(order.status)) return { ok: false, reason: 'This order is finished.' }
  if (!order.queueSequence) return { ok: false, reason: 'Only an accepted order can be flagged.' }
  if (!note.trim()) return { ok: false, reason: 'Say what needs attention.' }
  const next: ChillOrder = {
    ...order,
    exceptionFlag: {
      kind: 'needsAttention',
      recordedAt: clock.nowIso,
      note: note.trim().slice(0, 200),
      source: 'simulated',
    },
  }
  return {
    ok: true,
    order: next,
    store: { ...store, orders: store.orders.map((o) => (o.id === orderId ? next : o)) },
  }
}

export function clearException(
  store: ChillStore,
  orderId: string,
): { ok: true; store: ChillStore; order: ChillOrder } | Failure {
  const order = store.orders.find((o) => o.id === orderId)
  if (!order?.exceptionFlag) return { ok: false, reason: 'That order has no flag.' }
  const { exceptionFlag: _f, ...rest } = order
  return {
    ok: true,
    order: rest,
    store: { ...store, orders: store.orders.map((o) => (o.id === orderId ? rest : o)) },
  }
}

/** A self-report only. It changes no status and no queue count, and it is not field evidence. */
export function recordArrival(
  store: ChillStore,
  profileId: string,
  orderId: string,
  clock: Clock,
): { ok: true; store: ChillStore; order: ChillOrder } | Failure {
  const order = store.orders.find((o) => o.id === orderId && o.ownerProfileId === profileId)
  if (!order) return { ok: false, reason: 'That order could not be found.' }
  if (isTerminal(order.status)) return { ok: false, reason: 'This order is finished.' }
  if (order.studentReportedArrivalAt)
    return { ok: false, reason: 'You already marked your arrival for this order.' }
  const next: ChillOrder = {
    ...order,
    studentReportedArrivalAt: clock.nowIso,
    arrivalSource: 'selfReportedDemo',
  }
  return {
    ok: true,
    order: next,
    store: { ...store, orders: store.orders.map((o) => (o.id === orderId ? next : o)) },
  }
}
