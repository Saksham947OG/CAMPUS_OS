import { createStoreRunner } from '@/data/service-runner'
import { initialEssStore } from '@/data/seeds/demo/ess-data'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  essStoreSchema,
  type Confidence,
  type DemoRules,
  type EssStore,
  type LaundryLoad,
  type LoadStage,
  type Machine,
  type Parcel,
  type Reservation,
} from '@/domain/ess'
import {
  actOnReservation,
  addMessFeedback,
  advanceLoad,
  announceVisit,
  cancelRegisteredLoad,
  clearFee,
  dueCycleNotices,
  dueParcelNotices,
  editRegisteredLoad,
  logParcel,
  markParcelException,
  messCheckIn,
  messCheckOut,
  recordParcelCollected,
  recordVisitArrival,
  registerLoad,
  reportFeeSubmitted,
  reserveMachine,
  scheduleLoadReturn,
  setBusyReport,
  setLoadDelay,
  setLoadDiscrepancy,
  setMachineStatus,
  setMessOptIn,
  studentReportCollected,
  studentReportParcelIssue,
  supplyFee,
  type LogParcelInput,
  type RegisterLoadInput,
  type ReservationAction,
  type VisitInput,
} from '@/domain/ess-logic'
import type { BookingRef } from '@/domain/records'
import { todayIn, type Clock, type DateOnly } from '@/lib/time'

/**
 * The single owner of Campus Essentials state (COS-ESSENTIALS-001 §7). One GLOBAL store holds loads,
 * machines, reservations, mess sessions, the fee and parcels because the simulator acts on other
 * profiles' records; students read only their own through the owner-filtered selectors (DEC-048).
 *
 * Every change runs through the pure rules, is persisted, and only then announced. Nothing here runs
 * on a timer, and nothing claims a provider, sensor, payment system or courier is connected. A
 * future backend replaces this adapter, not the UI.
 */

export const ESS_STORE_KEY = storageKey({ area: 'ess', version: 1 })

type Out<T> = Promise<Result<T>>

export interface EssRepository {
  load(): Promise<EssStore>
  /** Synchronous, read-only projection of a profile's machine reservations for Calendar and Home. */
  bookingRefs(profileId: string): BookingRef[]

  // SS Laundry — student
  registerLoad(input: RegisterLoadInput): Out<{ load: LaundryLoad; created: boolean }>
  editLoad(
    profileId: string,
    loadId: string,
    patch: Parameters<typeof editRegisteredLoad>[3],
  ): Out<LaundryLoad>
  withdrawLoad(profileId: string, loadId: string): Out<LaundryLoad>
  reportLoadCollected(profileId: string, loadId: string): Out<LaundryLoad>
  // SS Laundry — local simulator
  advanceLoad(loadId: string, to: LoadStage): Out<LaundryLoad>
  setLoadDelay(
    loadId: string,
    delayed: boolean,
    expected?: { date: DateOnly; confidence: Confidence },
  ): Out<LaundryLoad>
  scheduleLoadReturn(loadId: string, date: DateOnly, confidence: Confidence): Out<LaundryLoad>
  setLoadDiscrepancy(loadId: string, flagged: boolean, note?: string): Out<LaundryLoad>
  announceVisit(input: VisitInput): Out<void>
  recordVisitArrival(): Out<void>

  // Machines
  reserve(
    profileId: string,
    machineId: string,
    date: DateOnly,
    start: string,
    idempotencyKey: string,
  ): Out<{ reservation: Reservation; created: boolean }>
  reservationAction(
    profileId: string,
    reservationId: string,
    action: 'cancel' | 'checkIn' | 'startCycle' | 'finish',
  ): Out<Reservation>
  simulateReservation(
    reservationId: string,
    action: Extract<ReservationAction, 'noShow' | 'blockedByOutage'>,
  ): Out<Reservation>
  setMachineStatus(
    machineId: string,
    patch: Partial<Pick<Machine, 'operationalStatus' | 'physicalStatus'>>,
  ): Out<void>
  setRules(patch: Partial<DemoRules>): Out<void>

  // Mess
  setMessOptIn(profileId: string, on: boolean): Out<void>
  messCheckIn(profileId: string): Out<{ created: boolean }>
  messCheckOut(profileId: string): Out<void>
  addMessFeedback(profileId: string, mealId: string, rating: number, comment?: string): Out<void>
  setBusyReport(state: 'quiet' | 'moderate' | 'busy' | 'unknown'): Out<void>
  supplyFee(input: Parameters<typeof supplyFee>[1]): Out<void>
  clearFee(): Out<void>
  reportFeeSubmitted(profileId: string, on: boolean): Out<void>

  // Parcels
  logParcel(input: LogParcelInput): Out<Parcel>
  recordParcelCollected(parcelId: string): Out<Parcel>
  markParcelException(parcelId: string, note: string): Out<Parcel>
  reportParcelIssue(profileId: string, parcelId: string, text: string): Out<Parcel>

  /** Shows due in-app messages (overdue parcels, reached cycle estimates) once. Called when the app next looks. */
  checkDue(): Promise<number>
  /** Resets ONLY Campus Essentials demo records; Home, Calendar and Chill Spot are untouched. */
  resetScenario(): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface EssRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  /** Every demo profile, for announcements addressed to everyone (a provider visit). */
  profileIds: readonly string[]
}

const BOOKING_PATH = '/services/laundry/machines'

export function createEssRepository(options: EssRepositoryOptions): EssRepository {
  const { storage, clock, newId, notifications, profileIds } = options
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const nowMs = () => clock.now().epochMilliseconds

  const runner = createStoreRunner<EssStore>({
    storage,
    key: ESS_STORE_KEY,
    schema: essStoreSchema,
    starting: () => initialEssStore(nowMs()),
    notifications,
    nowMs,
    newId,
    onChange: notify,
  })
  const { read: readStore, run } = runner

  const bookingRefs = (profileId: string): BookingRef[] => {
    const store = readStore()
    return store.reservations
      .filter((r) => r.ownerProfileId === profileId)
      .map((r) => {
        const m = store.machines.find((x) => x.id === r.machineId)
        return {
          id: r.id,
          ownerProfileId: r.ownerProfileId,
          resource: `${m?.label ?? 'Machine'} (demo reservation)`,
          date: r.date,
          start: r.start,
          end: r.end,
          status:
            r.state === 'cancelled' || r.state === 'noShow'
              ? ('cancelled' as const)
              : ('active' as const),
          ...(m?.location ? { location: m.location } : {}),
          manageRoute: BOOKING_PATH,
          updatedAt: r.updatedAt,
          provenance: r.provenance,
        }
      })
  }

  return {
    async load() {
      return readStore()
    },
    bookingRefs,

    registerLoad: (input) => run((s, c) => registerLoad(s, input, c)),
    editLoad: (profileId, loadId, patch) =>
      run((s, c) => editRegisteredLoad(s, profileId, loadId, patch, c)),
    withdrawLoad: (profileId, loadId) =>
      run((s, c) => cancelRegisteredLoad(s, profileId, loadId, c)),
    reportLoadCollected: (profileId, loadId) =>
      run((s, c) => studentReportCollected(s, profileId, loadId, c)),
    advanceLoad: (loadId, to) => run((s, c) => advanceLoad(s, loadId, to, c)),
    setLoadDelay: (loadId, delayed, expected) =>
      run((s, c) => setLoadDelay(s, loadId, delayed, c, expected)),
    scheduleLoadReturn: (loadId, date, conf) =>
      run((s, c) => scheduleLoadReturn(s, loadId, date, conf, c)),
    setLoadDiscrepancy: (loadId, flagged, note) =>
      run((s, c) => setLoadDiscrepancy(s, loadId, flagged, c, note)),
    announceVisit: (input) => run((s, c) => announceVisit(s, input, profileIds, c)),
    recordVisitArrival: () => run((s, c) => recordVisitArrival(s, c)),

    reserve: (profileId, machineId, date, start, idempotencyKey) =>
      run((s, c) =>
        reserveMachine(
          s,
          {
            profileId,
            machineId,
            date,
            start: start as never,
            idempotencyKey,
            today: todayIn(clock),
            nowMs: nowMs(),
          },
          c,
        ),
      ),
    reservationAction: (profileId, reservationId, action) =>
      run((s, c) =>
        actOnReservation(s, reservationId, action, 'student', c, { profileId, nowMs: nowMs() }),
      ),
    simulateReservation: (reservationId, action) =>
      run((s, c) =>
        actOnReservation(s, reservationId, action, 'demoSimulator', c, { nowMs: nowMs() }),
      ),
    setMachineStatus: (machineId, patch) =>
      run((s, c) => setMachineStatus(s, machineId, patch, (r) => r.ownerProfileId, c)),
    setRules: (patch) =>
      run((s) => {
        const next = { ...s.rules, ...patch }
        return { ok: true as const, store: { ...s, rules: next }, value: undefined, notices: [] }
      }),

    setMessOptIn: (profileId, on) => run((s) => setMessOptIn(s, profileId, on)),
    messCheckIn: (profileId) => run((s, c) => messCheckIn(s, profileId, c)),
    messCheckOut: (profileId) => run((s, c) => messCheckOut(s, profileId, c)),
    addMessFeedback: (profileId, mealId, rating, comment) =>
      run((s, c) => addMessFeedback(s, { profileId, mealId, rating, comment }, c)),
    setBusyReport: (state) => run((s, c) => setBusyReport(s, state, c)),
    supplyFee: (input) => run((s, c) => supplyFee(s, input, c)),
    clearFee: () => run((s) => clearFee(s)),
    reportFeeSubmitted: (profileId, on) => run((s) => reportFeeSubmitted(s, profileId, on)),

    logParcel: (input) => run((s, c) => logParcel(s, input, c)),
    recordParcelCollected: (id) => run((s, c) => recordParcelCollected(s, id, c)),
    markParcelException: (id, note) => run((s, c) => markParcelException(s, id, note, c)),
    reportParcelIssue: (profileId, id, text) =>
      run((s, c) => studentReportParcelIssue(s, profileId, id, text, c)),

    async checkDue() {
      const a = await run((s, c) => dueParcelNotices(s, nowMs(), c))
      const b = await run((s, c) => dueCycleNotices(s, nowMs(), c))
      return (a.ok ? a.value : 0) + (b.ok ? b.value : 0)
    },

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
