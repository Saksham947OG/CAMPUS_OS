import { initialSharedStore } from '@/data/seeds/demo/shared-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  sharedStoreSchema,
  type Exam,
  type Scenario,
  type SeatAllocation,
  type SharedStore,
} from '@/domain/shared'
import {
  applyMailSeat,
  changeSeat,
  injectSeatConflict,
  rescheduleExam,
  resetScenario,
  resolveSeatConflict,
  saveScenario,
  type ScenarioInput,
  type SeatInput,
} from '@/domain/shared-logic'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'

/**
 * The owner of exam seating and Time Tax scenarios (COS-SHARED-001). One GLOBAL store because the
 * simulator changes other profiles' seats; a student reads only their own through the selectors.
 */
export const SHARED_STORE_KEY = storageKey({ area: 'shared', version: 1 })
type Out<T> = Promise<Result<T>>

export interface SharedRepository {
  load(): Promise<SharedStore>
  changeSeat(examId: string, ownerProfileId: string, input: SeatInput): Out<SeatAllocation>
  applyMailSeat(
    examId: string,
    ownerProfileId: string,
    input: SeatInput,
    meta: { sourceNoticeId: string; sourceEmailId: string; revision: number },
  ): Out<SeatAllocation>
  injectSeatConflict(examId: string, ownerProfileId: string): Out<void>
  resolveSeatConflict(seatId: string): Out<void>
  rescheduleExam(examId: string, patch: { date: DateOnly; startTime?: LocalTime }): Out<Exam>
  saveScenario(profileId: string, input: ScenarioInput): Out<Scenario>
  resetScenario(profileId: string, serviceId: string): Out<void>
  resetScenarioAll(): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface SharedRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  profileIds: readonly string[]
}

export function createSharedRepository(o: SharedRepositoryOptions): SharedRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<SharedStore>({
    storage: o.storage,
    key: SHARED_STORE_KEY,
    schema: sharedStoreSchema,
    starting: () => initialSharedStore(nowMs()),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: () => listeners.forEach((l) => l()),
  })
  const { read, run } = runner
  return {
    async load() {
      return read()
    },
    changeSeat: (examId, owner, input) => run((s, c) => changeSeat(s, examId, owner, input, c)),
    applyMailSeat: (examId, owner, input, meta) =>
      run((s, c) => applyMailSeat(s, examId, owner, input, meta, c)),
    injectSeatConflict: (examId, owner) => run((s, c) => injectSeatConflict(s, examId, owner, c)),
    resolveSeatConflict: (id) => run((s) => resolveSeatConflict(s, id)),
    rescheduleExam: (id, patch) => run((s) => rescheduleExam(s, id, patch, o.profileIds)),
    saveScenario: (profileId, input) => run((s, c) => saveScenario(s, profileId, input, c)),
    resetScenario: (profileId, serviceId) => run((s) => resetScenario(s, profileId, serviceId)),
    async resetScenarioAll() {
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
