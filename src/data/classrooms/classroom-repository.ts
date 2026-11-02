import { initialClassroomStore } from '@/data/seeds/demo/classroom-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  HOLDING,
  classroomStoreSchema,
  type ClassroomStore,
  type Reservation,
} from '@/domain/classrooms'
import {
  bookingPath,
  cancel,
  closeRoom,
  decide,
  injectOtherBooking,
  reschedule,
  submitReservation,
  type ReservationInput,
  type Span,
} from '@/domain/classrooms-logic'
import type { BookingRef } from '@/domain/records'
import type { Clock } from '@/lib/time'
import { makeNow } from '@/selectors/now'

/**
 * The owner of classroom reservations. One GLOBAL store because every student sees the others'
 * bookings, but only as bare busy intervals; owner-only fields are filtered by the selectors.
 */
export const CLASSROOM_STORE_KEY = storageKey({ area: 'classrooms', version: 1 })
type Out<T> = Promise<Result<T>>

export interface ClassroomRepository {
  load(): Promise<ClassroomStore>
  /** Confirmed reservations for Calendar and Home. A waiting request is not on the Calendar. */
  bookingRefs(profileId: string): BookingRef[]
  reserve(
    profileId: string,
    input: ReservationInput,
    idempotencyKey: string,
  ): Out<{ reservation: Reservation; created: boolean }>
  cancel(profileId: string, id: string): Out<Reservation>
  reschedule(profileId: string, id: string, to: Span & { roomId: string }): Out<Reservation>
  // Local simulator only
  decide(id: string, decision: 'approve' | 'reject', reason?: string): Out<Reservation>
  closeRoom(roomId: string, span: Span, label: string): Out<{ disrupted: number }>
  injectOtherBooking(roomId: string, span: Span): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface ClassroomRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
}

export function createClassroomRepository(o: ClassroomRepositoryOptions): ClassroomRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const today = () => makeNow(o.clock).today
  const runner = createStoreRunner<ClassroomStore>({
    storage: o.storage,
    key: CLASSROOM_STORE_KEY,
    schema: classroomStoreSchema,
    starting: () => initialClassroomStore(nowMs()),
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
    bookingRefs(profileId) {
      const s = read()
      return s.reservations
        .filter(
          (r) =>
            r.ownerProfileId === profileId &&
            !r.meetingId &&
            (HOLDING.includes(r.state) || r.state === 'cancelled'),
        )
        .map((r) => ({
          id: r.id,
          ownerProfileId: r.ownerProfileId,
          resource: `${s.rooms.find((x) => x.id === r.roomId)?.displayName ?? 'Classroom'} (local reservation${r.state === 'disrupted' ? ', may be affected' : ''})`,
          date: r.date,
          start: r.start,
          end: r.end,
          status: r.state === 'cancelled' ? ('cancelled' as const) : ('active' as const),
          manageRoute: bookingPath(r.id),
          updatedAt: r.updatedAt,
          provenance: r.provenance,
        }))
    },
    reserve: (profileId, input, key) =>
      run((s, c) =>
        submitReservation(s, profileId, { ...input, idempotencyKey: key }, c, nowMs(), today()),
      ),
    cancel: (profileId, id) => run((s, c) => cancel(s, profileId, id, c, nowMs())),
    reschedule: (profileId, id, to) =>
      run((s, c) => reschedule(s, profileId, id, to, c, nowMs(), today())),
    decide: (id, decision, reason) => run((s, c) => decide(s, id, decision, c, nowMs(), reason)),
    closeRoom: (roomId, span, label) => run((s, c) => closeRoom(s, roomId, span, label, c)),
    injectOtherBooking: (roomId, span) => run((s, c) => injectOtherBooking(s, roomId, span, c)),
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
