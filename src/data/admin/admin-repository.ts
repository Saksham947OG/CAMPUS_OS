import { initialAdminStore } from '@/data/seeds/demo/admin-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  adminStoreSchema,
  type ActorType,
  type AdminConfig,
  type AdminStore,
  type LeaveRequest,
  type Ticket,
} from '@/domain/admin'
import {
  leaveAct,
  reviseLeave,
  submitLeave,
  submitTicket,
  ticketAct,
  withdrawLeave,
  type LeaveAction,
  type LeaveInput,
  type TicketAction,
  type TicketInput,
} from '@/domain/admin-logic'
import type { Clock } from '@/lib/time'

/**
 * The single owner of Administration state (COS-ADMIN-001). One GLOBAL store holds every leave
 * request and ticket because the local simulator acts on other profiles' requests; students read
 * only their own through the selectors, and a deep link to someone else's request is "not found".
 * Nothing here contacts anyone: no approver, guard, maintenance team, email or push exists. A future
 * backend replaces this adapter, not the domain rules.
 */

export const ADMIN_STORE_KEY = storageKey({ area: 'admin', version: 1 })

type Out<T> = Promise<Result<T>>

export interface AdminRepository {
  load(): Promise<AdminStore>
  submitLeave(
    profileId: string,
    input: LeaveInput,
    idempotencyKey: string,
  ): Out<{ leave: LeaveRequest; created: boolean }>
  reviseLeave(profileId: string, id: string, input: LeaveInput): Out<LeaveRequest>
  withdrawLeave(profileId: string, id: string): Out<LeaveRequest>
  /** A simulator step. The caller names the role it plays and the revision and version it saw. */
  leaveAct(
    id: string,
    action: LeaveAction,
    actor: ActorType,
    opts?: { expectedRevision?: number; expectedVersion?: number; reason?: string },
  ): Out<LeaveRequest>
  submitTicket(
    profileId: string,
    input: TicketInput,
    idempotencyKey: string,
  ): Out<{ ticket: Ticket; created: boolean }>
  /** Student steps pass their own `profileId`; simulator steps pass the maintenance role. */
  ticketAct(
    id: string,
    action: TicketAction,
    actor: ActorType,
    opts?: {
      profileId?: string
      expectedVersion?: number
      reason?: string
      team?: string
      demoPriority?: 'normal' | 'high'
      demoTargetHours?: number
    },
  ): Out<Ticket>
  setPolicy(patch: Partial<AdminConfig>): Out<void>
  /** Resets ONLY Administration demo records. */
  resetScenario(): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface AdminRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
}

export function createAdminRepository(o: AdminRepositoryOptions): AdminRepository {
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<AdminStore>({
    storage: o.storage,
    key: ADMIN_STORE_KEY,
    schema: adminStoreSchema,
    starting: () => initialAdminStore(),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: notify,
  })
  const { read, run } = runner
  return {
    async load() {
      return read()
    },
    submitLeave: (profileId, input, key) =>
      run((s, c) => submitLeave(s, { ...input, profileId, idempotencyKey: key }, c)),
    reviseLeave: (profileId, id, input) => run((s, c) => reviseLeave(s, profileId, id, input, c)),
    withdrawLeave: (profileId, id) => run((s, c) => withdrawLeave(s, profileId, id, c)),
    leaveAct: (id, action, actor, opts) => run((s, c) => leaveAct(s, id, action, actor, c, opts)),
    submitTicket: (profileId, input, key) =>
      run((s, c) => submitTicket(s, { ...input, profileId, idempotencyKey: key }, c)),
    ticketAct: (id, action, actor, opts) => run((s, c) => ticketAct(s, id, action, actor, c, opts)),
    setPolicy: (patch) =>
      run((s) => ({
        ok: true as const,
        store: { ...s, config: { ...s.config, ...patch } },
        value: undefined,
        notices: [],
      })),
    async resetScenario() {
      runner.reset()
      return { ok: true, value: undefined }
    },
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
