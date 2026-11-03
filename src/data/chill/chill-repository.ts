import { demoMenu, emptyChillStore, initialChillStore } from '@/data/seeds/demo/chill-data'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationRecord, NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { RepositoryError, Result, Unsubscribe } from '@/data/repositories/types'
import { z } from 'zod'
import {
  cartSchema,
  chillStoreSchema,
  emptyCart,
  type Cart,
  type ChillOrder,
  type HandlingNote,
  type ChillStore,
  type OrderStatus,
  type OrderTransition,
  type QueueCoverage,
  type ReportedState,
} from '@/domain/chill'
import {
  clearException,
  createPendingOrder,
  flagException,
  recordArrival,
  recordWalkIn,
  simulatedProvenance,
  transitionOrder,
  type Actor,
} from '@/domain/chill-logic'
import type { Profile } from '@/domain/profile'
import { isoFromMs, type Clock } from '@/lib/time'
import { orderBlock, toSnapshot, validateCart, type MenuData } from '@/selectors/chill'

/**
 * The single owner of Chill Spot state (COS-CHILL-001 §11). One GLOBAL café store holds every order,
 * the queue observations and the pause flag, because the queue is shared across personas;
 * students only ever read their own orders through `ownOrders`, and other profiles' orders reach
 * them only as anonymous counts (DEC-048). Carts are profile-scoped.
 *
 * Every change goes through the pure state machine, is validated, and is persisted before it is
 * reported. A failed write leaves the previous state in place and says so (never "persisted" falsely).
 * Nothing in this module runs on a timer. A future backend replaces this adapter, not the UI.
 */

export const CHILL_STORE_KEY = storageKey({ area: 'chill', version: 1 })
export const favoritesKey = (profileId: string) =>
  storageKey({ area: 'chill-favs', version: 1, profileId })
const favoritesSchema = z.array(z.string().min(1).max(120)).max(200)
export const cartKey = (profileId: string) =>
  storageKey({ area: 'chill-cart', version: 1, profileId })

export interface ChillRepository {
  getMenu(): MenuData
  /** Loads the shared café state, creating the labelled starting scenario on first use. */
  load(): Promise<ChillStore>
  loadCart(profileId: string): Promise<Cart>
  saveCart(profileId: string, cart: Cart): Promise<Result<{ persisted: boolean }>>
  /**
   * `expectedSubtotalMinor` is the total the student reviewed; if prices moved since, the submit is
   * refused so they review the new total instead of being charged a different one (§12).
   */
  submitOrder(
    profileId: string,
    idempotencyKey: string,
    expectedSubtotalMinor?: number,
  ): Promise<Result<{ order: ChillOrder; created: boolean }>>
  cancelPending(profileId: string, orderId: string): Promise<Result<{ order: ChillOrder }>>
  /** Local simulator only (DEC-046): every call is one explicit, labelled, logged step. */
  operatorTransition(
    orderId: string,
    to: OrderStatus,
    reason?: string,
    handlingNote?: HandlingNote,
  ): Promise<Result<{ order: ChillOrder }>>
  /** V2 option: when on, starting an order ahead of an older queued one needs a logged reason. */
  setRequireHandlingNote(on: boolean): Promise<Result<void>>
  /** An annotation only (V2 §4.2): the order stays where it is and stays in the backlog. */
  flagException(orderId: string, note: string): Promise<Result<{ order: ChillOrder }>>
  clearException(orderId: string): Promise<Result<{ order: ChillOrder }>>
  /** The student's own self-report. Changes no status and counts nowhere. */
  recordArrival(profileId: string, orderId: string): Promise<Result<{ order: ChillOrder }>>
  /** Per-profile favourites: item ids only. A favourite that left the menu stays listed but cannot be ordered. */
  loadFavorites(profileId: string): Promise<string[]>
  toggleFavorite(profileId: string, menuItemId: string): Promise<Result<{ favorites: string[] }>>
  recordSampleWalkIn(menuItemIds: readonly string[]): Promise<Result<{ order: ChillOrder }>>
  setCounterObservation(numericValue: number | null, coverage: QueueCoverage): Promise<Result<void>>
  setReportedState(state: ReportedState): Promise<Result<void>>
  setPause(reason: string | null): Promise<Result<void>>
  /** Resets ONLY the café scenario (all café orders and observations); never Home/Calendar data. */
  resetScenario(): Promise<Result<void>>
  /** For "Reset reference data": café scenario plus every profile's cart. */
  resetAll(profiles: readonly Profile[]): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface ChillRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  /** The current menu; a function so tests can change prices between calls. */
  menu?: () => MenuData
  notifications: PreferencesRepository<NotificationsState>
}

const fail = (
  code: RepositoryError['code'],
  message: string,
  extra: Partial<RepositoryError> = {},
): Result<never> => ({
  ok: false,
  error: { code, message, ...extra },
})

/** The in-app message for a transition (§9). Returns null when the spec lists no alert for it. */
export function notificationFor(
  order: ChillOrder,
  t: OrderTransition,
): Pick<NotificationRecord, 'title' | 'body' | 'significance'> | null {
  const n = order.displayNumber
  switch (t.to) {
    case 'pending':
      return {
        title: 'Local order request submitted',
        body: `${n}: awaiting café acceptance.`,
        significance: 'standard',
      }
    case 'queued':
      return {
        title: 'Café accepted your order',
        body: `${n} is in the preparation queue.`,
        significance: 'standard',
      }
    case 'rejected':
      return {
        title: 'Local order declined',
        body: t.reason ? `${n}: ${t.reason}` : `${n} was not accepted. No reason was recorded.`,
        significance: 'important',
      }
    case 'preparing':
      return {
        title: 'Local order is being prepared',
        body: `${n} is being prepared.`,
        significance: 'optional',
      }
    case 'ready':
      return {
        title: 'Local order ready for pickup',
        body: `${n}: pay at the café counter.`,
        significance: 'important',
      }
    case 'collected':
      return {
        title: 'Local order collection recorded',
        body: `${n}: payment is handled outside CampusOS and is not verified here.`,
        significance: 'standard',
      }
    case 'cancelled':
      return {
        title: 'Local order request cancelled',
        body: `${n} was cancelled before acceptance.`,
        significance: 'standard',
      }
  }
}

export function createChillRepository(options: ChillRepositoryOptions): ChillRepository {
  const { storage, clock, newId, notifications } = options
  const menu = options.menu ?? demoMenu
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const nowIso = () => isoFromMs(clock.now().epochMilliseconds)
  const ctx = () => ({ nowIso: nowIso(), newId })

  // The starting scenario is built once and held in memory: merely opening a page must not write to
  // storage, and its "as of" times must not drift forward on every read.
  let starting: ChillStore | null = null
  const startingStore = (): ChillStore =>
    (starting ??= initialChillStore(clock.now().epochMilliseconds))

  const readStore = (): ChillStore => {
    const r = storage.read(CHILL_STORE_KEY, chillStoreSchema)
    if (r.status === 'ok') return r.value
    // Missing or unreadable: unreadable data is never overwritten silently by a read.
    return startingStore()
  }

  /** Write-then-confirm: on failure the previous state is restored and the caller is told. */
  const commit = (next: ChillStore, previous: ChillStore | null): Result<void> => {
    const written = storage.write(CHILL_STORE_KEY, next)
    if (written.ok) {
      notify()
      return { ok: true, value: undefined }
    }
    if (previous)
      storage.write(CHILL_STORE_KEY, previous) // restore the in-memory copy too
    else storage.remove(CHILL_STORE_KEY)
    return fail(
      'storage',
      'This device could not save that change, so nothing was changed. Check that browser storage is available.',
    )
  }

  const ensureStore = (): void => {
    if (storage.read(CHILL_STORE_KEY, chillStoreSchema).status === 'missing') {
      storage.write(CHILL_STORE_KEY, startingStore())
    }
  }

  /** Adds exactly one in-app notification per (order, transition), to the owner only. */
  const announce = async (order: ChillOrder, transition: OrderTransition) => {
    if (!order.ownerProfileId) return
    const content = notificationFor(order, transition)
    if (!content) return
    const key = `chill|${order.id}|${transition.transitionId}`
    const current = await notifications.load(order.ownerProfileId)
    if (current.value.items.some((i) => i.key === key)) return
    const record: NotificationRecord = {
      key,
      kind: 'order',
      ...content,
      href: `/services/chill-spot/orders/${order.id}`,
      surfacedAt: nowIso(),
      readState: 'unread',
    }
    await notifications.save(order.ownerProfileId, {
      ...current.value,
      items: [record, ...current.value.items].slice(0, 200),
    })
  }

  /** Runs one validated change against the freshest stored state (optimistic: re-read, then write). */
  const mutate = async <T>(
    fn: (store: ChillStore) =>
      | {
          ok: true
          store: ChillStore
          value: T
          events?: { order: ChillOrder; transition: OrderTransition }[]
        }
      | { ok: false; reason: string },
  ): Promise<Result<T>> => {
    ensureStore()
    const previous = readStore()
    const r = fn(previous)
    if (!r.ok) return fail('validation', r.reason)
    const committed = commit(r.store, previous)
    if (!committed.ok) return committed
    for (const e of r.events ?? []) await announce(e.order, e.transition)
    return { ok: true, value: r.value }
  }

  return {
    getMenu: menu,

    async load() {
      return readStore()
    },

    async loadCart(profileId) {
      const r = storage.read(cartKey(profileId), cartSchema)
      return r.status === 'ok' ? r.value : emptyCart()
    },

    async saveCart(profileId, cart) {
      const parsed = cartSchema.safeParse(cart)
      if (!parsed.success) return fail('validation', 'That cart is not valid.')
      const w = storage.write(cartKey(profileId), parsed.data)
      notify()
      return { ok: true, value: { persisted: w.ok } }
    },

    async submitOrder(profileId, idempotencyKey, expectedSubtotalMinor) {
      ensureStore()
      const cartRead = storage.read(cartKey(profileId), cartSchema)
      const cart = cartRead.status === 'ok' ? cartRead.value : emptyCart()
      const store = readStore()
      // A repeat of an already-accepted request returns that order and changes nothing (CH-AT-07).
      const existing = store.orders.find(
        (o) => o.idempotencyKey === idempotencyKey && o.ownerProfileId === profileId,
      )
      if (existing) return { ok: true, value: { order: existing, created: false } }

      const validation = validateCart(menu(), cart, { paused: store.pause !== null })
      if (!validation.canSubmit) {
        return fail(
          'validation',
          validation.issues[0]?.message ?? 'The cart cannot be submitted.',
          { issues: validation.issues.map((i) => i.message) },
        )
      }
      if (
        expectedSubtotalMinor !== undefined &&
        validation.subtotalMinor !== expectedSubtotalMinor
      ) {
        return fail(
          'conflict',
          'Prices changed since you opened checkout. Please review the updated total and submit again.',
        )
      }
      const created = await mutate((s) => {
        const r = createPendingOrder(
          s,
          { profileId, lines: toSnapshot(validation), idempotencyKey },
          ctx(),
        )
        return r.ok
          ? {
              ok: true,
              store: r.store,
              value: r,
              events: r.created ? [{ order: r.order, transition: r.order.history[0]! }] : [],
            }
          : r
      })
      if (!created.ok) return created // cart is preserved: it is only cleared after persistence succeeds
      storage.write(cartKey(profileId), emptyCart())
      notify()
      return { ok: true, value: { order: created.value.order, created: created.value.created } }
    },

    async cancelPending(profileId, orderId) {
      return mutate((s) => {
        const order = s.orders.find((o) => o.id === orderId)
        if (!order || order.ownerProfileId !== profileId)
          return { ok: false, reason: 'That order could not be found.' }
        const r = transitionOrder(s, orderId, 'cancelled', 'student', ctx())
        return r.ok
          ? {
              ok: true,
              store: r.store,
              value: { order: r.order },
              events: [{ order: r.order, transition: r.transition }],
            }
          : r
      })
    },

    async operatorTransition(orderId, to, reason, handlingNote) {
      return mutate((s) => {
        const r = transitionOrder(
          s,
          orderId,
          to,
          'demoOperator' as Actor,
          ctx(),
          reason,
          handlingNote,
        )
        return r.ok
          ? {
              ok: true,
              store: r.store,
              value: { order: r.order },
              events: [{ order: r.order, transition: r.transition }],
            }
          : r
      })
    },

    async setRequireHandlingNote(on) {
      return mutate((s) => ({
        ok: true,
        value: undefined,
        store: { ...s, requireHandlingNote: on },
      }))
    },

    async flagException(orderId, note) {
      return mutate((s) => {
        const r = flagException(s, orderId, note, ctx())
        return r.ok ? { ok: true, store: r.store, value: { order: r.order } } : r
      })
    },

    async clearException(orderId) {
      return mutate((s) => {
        const r = clearException(s, orderId)
        return r.ok ? { ok: true, store: r.store, value: { order: r.order } } : r
      })
    },

    async recordArrival(profileId, orderId) {
      return mutate((s) => {
        const r = recordArrival(s, profileId, orderId, ctx())
        return r.ok ? { ok: true, store: r.store, value: { order: r.order } } : r
      })
    },

    async loadFavorites(profileId) {
      const r = storage.read(favoritesKey(profileId), favoritesSchema)
      return r.status === 'ok' ? r.value : []
    },

    async toggleFavorite(profileId, menuItemId) {
      const r = storage.read(favoritesKey(profileId), favoritesSchema)
      const have = r.status === 'ok' ? r.value : []
      const next = have.includes(menuItemId)
        ? have.filter((x) => x !== menuItemId)
        : [...have, menuItemId]
      const w = storage.write(favoritesKey(profileId), next)
      if (!w.ok) return fail('storage', 'This device could not save that favourite.')
      notify()
      return { ok: true, value: { favorites: next } }
    },

    async recordSampleWalkIn(menuItemIds) {
      const items = menu().items
      const lines = menuItemIds.flatMap((id) => {
        const it = items.find((i) => i.id === id && i.visible && orderBlock(i) === null)
        return it
          ? [
              {
                menuItemId: it.id,
                nameAtOrder: it.name,
                selectedOptionIds: [],
                optionLabelsAtOrder: [],
                unitPriceMinorAtOrder: it.priceMinor!,
                quantity: 1,
                lineSubtotalMinor: it.priceMinor!,
              },
            ]
          : []
      })
      if (lines.length === 0)
        return fail('validation', 'Choose at least one orderable item for the sample walk-in.')
      return mutate((s) => {
        const r = recordWalkIn(s, lines, ctx())
        return { ok: true, store: r.store, value: { order: r.order } }
      })
    },

    async setCounterObservation(numericValue, coverage) {
      return mutate((s) => ({
        ok: true,
        value: undefined,
        store: {
          ...s,
          counter: {
            metric: 'counterPeople',
            numericValue,
            asOf: nowIso(),
            sourceLabel: 'Reported on this device (not a live count)',
            coverage: numericValue === null ? 'unknown' : coverage,
            provenance: simulatedProvenance(nowIso(), 'Reported on this device (not a live count)'),
          },
        },
      }))
    },

    async setReportedState(state) {
      return mutate((s) => ({
        ok: true,
        value: undefined,
        store: {
          ...s,
          busy: {
            metric: 'busyState',
            numericValue: null,
            reportedState: state,
            asOf: nowIso(),
            sourceLabel: 'Reported on this device (not a live report)',
            coverage: state === 'unknown' ? 'unknown' : 'reportedComplete',
            provenance: simulatedProvenance(
              nowIso(),
              'Reported on this device (not a live report)',
            ),
          },
        },
      }))
    },

    async setPause(reason) {
      if (reason !== null && !reason.trim())
        return fail('validation', 'Pausing new requests needs a reason that students can see.')
      return mutate((s) => ({
        ok: true,
        value: undefined,
        store: { ...s, pause: reason === null ? null : { reason: reason.trim(), at: nowIso() } },
      }))
    },

    async resetScenario() {
      const next = initialChillStore(clock.now().epochMilliseconds)
      const previous = storage.read(CHILL_STORE_KEY, chillStoreSchema)
      return commit(next, previous.status === 'ok' ? previous.value : null)
    },

    async resetAll(profiles) {
      starting = null // the next read rebuilds the starting scenario at the current time
      storage.remove(CHILL_STORE_KEY)
      for (const p of profiles) {
        storage.remove(cartKey(p.id))
        storage.remove(favoritesKey(p.id))
      }
      notify()
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export { emptyChillStore }
