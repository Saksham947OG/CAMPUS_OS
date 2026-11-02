import type { ZodType } from 'zod'
import type { NotificationRecord, NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { RepositoryError, Result } from '@/data/repositories/types'
import type { StorageAdapter } from '@/data/storage/storage-adapter'
import type { Change, Ctx, Notice } from '@/domain/service-core'
import { isoFromMs } from '@/lib/time'

const fail = (
  code: RepositoryError['code'],
  message: string,
): { ok: false; error: RepositoryError } => ({ ok: false, error: { code, message } })

export interface StoreRunnerOptions<S> {
  storage: StorageAdapter
  key: string
  schema: ZodType<S>
  /** Builds the labelled starting scenario. Called once and held in memory. */
  starting: () => S
  notifications: PreferencesRepository<NotificationsState>
  nowMs: () => number
  newId: (prefix: string) => string
  /** Optional top-up applied to a saved store after it is read (never written by a read). */
  normalize?: (stored: S) => S
  /** Called after a change has been persisted. */
  onChange: () => void
}

/**
 * The persist-then-announce loop shared by every global service store (Essentials, Sports):
 * re-read the freshest state, apply one pure rule, write it, restore on a failed write, then add
 * each in-app notice once. Reading never writes, and the starting scenario's "as of" times do not
 * drift on every read.
 */
export function createStoreRunner<S>(o: StoreRunnerOptions<S>) {
  let seeded: S | null = null
  const startingStore = () => (seeded ??= o.starting())

  const read = (): S => {
    const r = o.storage.read(o.key, o.schema)
    return r.status === 'ok' ? (o.normalize ? o.normalize(r.value) : r.value) : startingStore()
  }

  const announce = async (n: Notice) => {
    const current = await o.notifications.load(n.recipientProfileId)
    if (current.value.items.some((i) => i.key === n.key)) return
    const record: NotificationRecord = {
      key: n.key,
      kind: 'service',
      title: n.title,
      body: n.body,
      href: n.href,
      significance: n.significance,
      surfacedAt: isoFromMs(o.nowMs()),
      readState: 'unread',
    }
    await o.notifications.save(n.recipientProfileId, {
      ...current.value,
      items: [record, ...current.value.items].slice(0, 200),
    })
  }

  const ctx = (): Ctx => ({ nowIso: isoFromMs(o.nowMs()), newId: o.newId })

  const run = async <T>(fn: (store: S, c: Ctx) => Change<S, T>): Promise<Result<T>> => {
    const previous = read()
    const r = fn(previous, ctx())
    if (!r.ok) return fail('validation', r.reason)
    if (r.store !== previous) {
      const written = o.storage.write(o.key, r.store)
      if (!written.ok) {
        o.storage.write(o.key, previous)
        return fail(
          'storage',
          'This device could not save that change, so nothing was changed. Check that browser storage is available.',
        )
      }
      o.onChange()
    }
    for (const n of r.notices) await announce(n)
    return { ok: true, value: r.value }
  }

  /** Forget the held scenario and the saved copy; the next read rebuilds the starting scenario. */
  const reset = () => {
    seeded = null
    o.storage.remove(o.key)
    o.onChange()
  }

  return { read, run, reset, ctx }
}
