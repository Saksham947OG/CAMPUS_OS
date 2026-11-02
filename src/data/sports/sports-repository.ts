import { createStoreRunner } from '@/data/service-runner'
import { initialSportsStore, normalizeSportsStore } from '@/data/seeds/demo/sports-data'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import type { BookingRef } from '@/domain/records'
import {
  sportsStoreSchema,
  type Equipment,
  type FaultReport,
  type Loan,
  type Occupancy,
  type Policy,
  type SportsReservation,
  type SportsStore,
  type Activity,
  type WaitlistEntry,
} from '@/domain/sports'
import {
  closeResource,
  expireOffer,
  addDemoLoan,
  addEquipment,
  dueLoanNotices,
  gymCheckIn,
  recordLoanReturn,
  setLoanNote,
  updateLoanDue,
  gymCheckOut,
  gymRenew,
  gymCorrectCheckIn,
  issueOffer,
  joinWaitlist,
  leaveWaitlist,
  processNoShow,
  reopenResource,
  reportFault,
  reserveSlot,
  resolveDisruption,
  respondToOffer,
  setEquipmentStatus,
  setOccupancy,
  studentAct,
  type StudentAction,
} from '@/domain/sports-logic'
import { todayIn, type Clock, type DateOnly, type LocalTime } from '@/lib/time'

/**
 * The single owner of Sports & Fitness state (COS-SPORTS-001). One GLOBAL store holds resources,
 * reservations, the waitlist, gym self-reports, equipment and the simulator's operation log, because
 * the simulator acts on other profiles' records; students read their own through the selectors.
 * Collisions are prevented only inside this one local data source: two browsers can still book the
 * same slot until the final backend phase. A future backend replaces this adapter, not the UI.
 */

export const SPORTS_STORE_KEY = storageKey({ area: 'sports', version: 1 })

type Out<T> = Promise<Result<T>>

export interface BookInput {
  resourceId: string
  date: DateOnly
  start: LocalTime
  idempotencyKey: string
  partnerNote?: string
  participants?: number
}

export interface SportsRepository {
  load(): Promise<SportsStore>
  /** Read-only projection of a profile's reservations for Calendar and Home (one record, shown once). */
  bookingRefs(profileId: string): BookingRef[]

  reserve(
    profileId: string,
    input: BookInput,
  ): Out<{ reservation: SportsReservation; created: boolean }>
  act(profileId: string, id: string, action: StudentAction): Out<SportsReservation>
  joinWaitlist(
    profileId: string,
    resourceId: string,
    date: DateOnly,
    start: LocalTime,
  ): Out<{ entry: WaitlistEntry; created: boolean }>
  leaveWaitlist(profileId: string, entryId: string): Out<void>
  respondToOffer(
    profileId: string,
    entryId: string,
    accept: boolean,
  ): Out<{ reservation?: SportsReservation }>

  gymCheckIn(profileId: string, facilityId?: string): Out<{ created: boolean }>
  gymCheckOut(profileId: string, facilityId?: string): Out<void>
  /** "Still here": renews an open check-in for one more lease. */
  gymRenew(profileId: string, facilityId?: string): Out<void>
  gymCorrect(profileId: string, facilityId?: string): Out<void>
  setLoanNote(profileId: string, loanId: string, note: string): Out<Loan>
  reportFault(
    profileId: string,
    equipmentId: string,
    text: string,
    evidence?: FaultReport['evidence'],
  ): Out<void>

  // Local simulator only
  processNoShow(id: string): Out<SportsReservation>
  closeResource(resourceId: string, note: string): Out<number>
  reopenResource(resourceId: string): Out<void>
  resolveDisruption(id: string, how: 'resolve' | 'cancel'): Out<SportsReservation>
  issueOffer(resourceId: string, date: DateOnly, start: LocalTime): Out<WaitlistEntry>
  expireOffer(entryId: string): Out<WaitlistEntry>
  setOccupancy(
    input: { count: number | null; level?: Occupancy['level'] },
    facilityId?: string,
  ): Out<void>
  addEquipment(facilityId: string, label: string): Out<void>
  addDemoLoan(input: {
    profileId: string
    bookId: string
    dueDate: DateOnly
    issuedOn?: DateOnly
  }): Out<Loan>
  updateLoanDue(loanId: string, dueDate: DateOnly): Out<Loan>
  recordLoanReturn(loanId: string): Out<Loan>
  /** Shows due in-app messages (a loan reminder) once, the next time the app looks. */
  checkDue(): Promise<number>
  setEquipmentStatus(equipmentId: string, status: Equipment['status']): Out<void>
  setPolicy(activity: Activity, patch: Partial<Policy>): Out<void>
  setOfferLifetime(minutes: number): Out<void>

  /** Resets ONLY Sports demo records; Home, Calendar, Chill Spot and Essentials are untouched. */
  resetScenario(): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface SportsRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  /** Adds the labelled example bookings (a confirmed court and a cancelled study room) for the first demo profile. */
  examples?: boolean
}

export function createSportsRepository(o: SportsRepositoryOptions): SportsRepository {
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((l) => l())
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<SportsStore>({
    storage: o.storage,
    key: SPORTS_STORE_KEY,
    schema: sportsStoreSchema,
    starting: () => initialSportsStore(nowMs(), o.examples),
    normalize: (s) => normalizeSportsStore(s, nowMs(), o.examples),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: notify,
  })
  const { read, run } = runner
  const today = () => todayIn(o.clock)

  return {
    async load() {
      return read()
    },
    bookingRefs(profileId) {
      const s = read()
      return s.reservations
        .filter((r) => r.ownerProfileId === profileId)
        .map((r) => {
          const res = s.resources.find((x) => x.id === r.resourceId)
          return {
            id: r.id,
            ownerProfileId: r.ownerProfileId,
            resource: `${res?.label ?? 'Resource'} (demo reservation${r.disrupted ? ', may be affected' : ''})`,
            date: r.date,
            start: r.start,
            end: r.end,
            ...(r.endDate ? { endDate: r.endDate } : {}),
            status:
              r.state === 'cancelled' || r.state === 'noShow'
                ? ('cancelled' as const)
                : ('active' as const),
            ...(res?.location ? { location: res.location } : {}),
            manageRoute: `/bookings/my/${r.id}`,
            updatedAt: r.updatedAt,
            provenance: r.provenance,
          }
        })
    },

    reserve: (profileId, input) =>
      run((s, c) => reserveSlot(s, { ...input, profileId, today: today(), nowMs: nowMs() }, c)),
    act: (profileId, id, action) => run((s, c) => studentAct(s, profileId, id, action, c, nowMs())),
    joinWaitlist: (profileId, resourceId, date, start) =>
      run((s, c) =>
        joinWaitlist(s, { profileId, resourceId, date, start, nowMs: nowMs(), today: today() }, c),
      ),
    leaveWaitlist: (profileId, entryId) => run((s, c) => leaveWaitlist(s, profileId, entryId, c)),
    respondToOffer: (profileId, entryId, accept) =>
      run((s, c) =>
        respondToOffer(s, profileId, entryId, accept, c, { today: today(), nowMs: nowMs() }),
      ),

    gymCheckIn: (p, f) => run((s, c) => gymCheckIn(s, p, c, f)),
    gymCheckOut: (p, f) => run((s, c) => gymCheckOut(s, p, c, f)),
    gymRenew: (p, f) => run((s, c) => gymRenew(s, p, c, nowMs(), f)),
    gymCorrect: (p, f) => run((s) => gymCorrectCheckIn(s, p, f)),
    setLoanNote: (p, id, note) => run((s, c) => setLoanNote(s, p, id, note, c)),
    reportFault: (p, id, text, evidence) => run((s, c) => reportFault(s, p, id, text, c, evidence)),

    processNoShow: (id) => run((s, c) => processNoShow(s, id, c, nowMs())),
    closeResource: (id, note) => run((s, c) => closeResource(s, id, note, c, nowMs())),
    reopenResource: (id) => run((s, c) => reopenResource(s, id, c)),
    resolveDisruption: (id, how) => run((s, c) => resolveDisruption(s, id, how, c)),
    issueOffer: (resourceId, date, start) =>
      run((s, c) => issueOffer(s, resourceId, date, start, c, nowMs())),
    expireOffer: (id) => run((s, c) => expireOffer(s, id, c, nowMs())),
    setOccupancy: (input, f) => run((s, c) => setOccupancy(s, input, c, f)),
    addEquipment: (f, label) => run((s, c) => addEquipment(s, f, label, c)),
    addDemoLoan: (input) => run((s, c) => addDemoLoan(s, input, c)),
    updateLoanDue: (id, due) => run((s, c) => updateLoanDue(s, id, due, c)),
    recordLoanReturn: (id) => run((s, c) => recordLoanReturn(s, id, today(), c)),
    async checkDue() {
      const r = await run((s, c) => dueLoanNotices(s, nowMs(), c))
      return r.ok ? r.value : 0
    },
    setEquipmentStatus: (id, status) => run((s, c) => setEquipmentStatus(s, id, status, c)),
    setPolicy: (activity, patch) =>
      run((s) => ({
        ok: true as const,
        store: {
          ...s,
          config: {
            ...s.config,
            policies: {
              ...s.config.policies,
              [activity]: { ...s.config.policies[activity], ...patch },
            },
          },
        },
        value: undefined,
        notices: [],
      })),
    setOfferLifetime: (minutes) =>
      run((s) => ({
        ok: true as const,
        store: { ...s, config: { ...s.config, offerLifetimeMinutes: minutes } },
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
