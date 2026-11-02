import { reconcileLeases } from '@/domain/sports-logic'
import type { Provenance } from '@/domain/provenance'
import {
  defaultSpacePolicies,
  type Activity,
  type Book,
  type Equipment,
  type Policy,
  type Resource,
  type SportsConfig,
  type SportsReservation,
  type SportsStore,
  defaultSnookerPolicy,
} from '@/domain/sports'
import { addDays, fixedClock, isoFromMs, todayIn } from '@/lib/time'
import type { LocalTime } from '@/lib/time'

const t = (v: string) => v as LocalTime

const demo = (nowIso: string, label: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: label,
  updatedAt: nowIso,
})

const base: Policy = {
  bookable: true,
  slotMinutes: 60,
  horizonDays: 7,
  maxActive: 1,
  graceMinutes: 10,
  bufferMinutes: 0,
  allowPartner: false,
  allowWaitlist: false,
}

/**
 * `demoSportsConfig` (COS-SPORTS-001 §10): illustrative values for a reproducible presentation.
 * They are NOT campus policy. Each activity has its own row; pool is information-only.
 * Gym hours and 30-minute intervals were supplied by the owner; participant limits remain unknown.
 */
export const demoSportsConfig = (): SportsConfig => ({
  policies: {
    gym: { ...base, slotMinutes: 30 },
    badminton: { ...base, maxActive: 2, allowPartner: true, allowWaitlist: true },
    tableTennis: { ...base, slotMinutes: 30, allowPartner: true },
    pool: { ...base, bookable: false },
    snooker: defaultSnookerPolicy(),
    basketball: { ...base, horizonDays: 3, graceMinutes: 15 },
    ...defaultSpacePolicies(),
  },
  offerLifetimeMinutes: 15,
  reminderMinutes: 30,
  occupancyStaleMinutes: 60,
  gymSessionStaleMinutes: 120,
  checkInMaxMinutes: 60,
})

const SPACE_LABEL = 'Illustrative sample space (not a real campus space)'

/**
 * The fictional space resources for COS-SPACES-001. IDs are stable so a store saved before they
 * existed can be topped up with exactly these and nothing else. The library facility is described,
 * never booked; its two group rooms are the bookable resources. Chill Zone spots are demo
 * coordination records: their evening hours run past midnight on purpose.
 */
const SNOOKER_LABEL = 'Supplied table count (two); slot rules are demo values'

/**
 * Two distinguishable snooker tables under one facility. The count of two is supplied by the owner; it does
 * not establish live availability or official slot rules. Each table is its own bookable resource.
 */
export function snookerResources(nowIso: string): Resource[] {
  return [1, 2].map((n) => ({
    id: `DEMO-SNOOKER-${n}`,
    activity: 'snooker' as const,
    label: `Snooker table ${n}`,
    bookable: true,
    location: 'Sample location (fictional)',
    hours: { open: t('10:00'), close: t('21:00') },
    status: 'open' as const,
    sourceLabel: SNOOKER_LABEL,
    asOf: nowIso,
    provenance: demo(nowIso, SNOOKER_LABEL),
  }))
}

export function spaceResources(nowIso: string): Resource[] {
  const r = (
    id: string,
    activity: Activity,
    label: string,
    hours: { open: string; close: string } | null,
    bookable = true,
    location = 'Sample location (fictional)',
  ): Resource => ({
    id,
    activity,
    label,
    bookable,
    location,
    hours: hours ? { open: t(hours.open), close: t(hours.close) } : null,
    status: 'open',
    sourceLabel: SPACE_LABEL,
    asOf: nowIso,
    provenance: demo(nowIso, SPACE_LABEL),
  })
  return [
    r('DEMO-LIBRARY', 'library', 'Demo library', { open: '08:00', close: '20:00' }, false),
    r('DEMO-LIB-ROOM-1', 'library', 'Demo group study room 1', { open: '08:00', close: '20:00' }),
    r('DEMO-LIB-ROOM-2', 'library', 'Demo group study room 2', { open: '08:00', close: '20:00' }),
    r('DEMO-MUSIC-1', 'musicRoom', 'Demo music room', { open: '10:00', close: '22:00' }),
    r('DEMO-CHILL-1', 'chillZone', 'Demo Spot 1', { open: '19:45', close: '01:45' }),
    r('DEMO-CHILL-2', 'chillZone', 'Demo Spot 2', { open: '19:45', close: '01:45' }),
    r('DEMO-CHILL-3', 'chillZone', 'Demo Spot 3', { open: '19:45', close: '01:45' }),
  ]
}

/** A fictional catalogue. It is demo content only: no real library system is connected. */
export function demoCatalogue(nowIso: string): Book[] {
  const book = (id: string, title: string, author: string, status: Book['status']): Book => ({
    id,
    title,
    author,
    status,
    asOf: nowIso,
    sourceLabel: 'Fictional illustrative catalogue (not a real library)',
    provenance: demo(nowIso, 'Fictional illustrative catalogue'),
  })
  return [
    book(
      'DEMO-BOOK-1',
      'Demo Book One: An Invented Title',
      'A. Sample Author',
      'availableSnapshot',
    ),
    book(
      'DEMO-BOOK-2',
      'Demo Book Two: Another Invented Title',
      'B. Sample Author',
      'onLoanSnapshot',
    ),
    book('DEMO-BOOK-3', 'Demo Book Three: Sample Methods', 'C. Sample Author', 'availableSnapshot'),
    book('DEMO-BOOK-4', 'Demo Book Four: Notes on Nothing Real', 'D. Sample Author', 'unknown'),
    book(
      'DEMO-BOOK-5',
      'Demo Book Five: Illustrative Operations',
      'E. Sample Author',
      'availableSnapshot',
    ),
  ]
}

/** The starting Sports scenario: fictional, labelled resources and nothing booked. */
const EXAMPLE_LABEL = 'Illustrative example booking (not a real campus booking)'

/**
 * Two persistent examples so "My bookings" shows real history from the first visit: an upcoming confirmed
 * badminton court and a cancelled study room. They are demo seeds for the first persona only, dated
 * relative to when the store is created, and the "Book again" link on each goes to the live booking page.
 */
export function exampleReservations(nowMs: number): SportsReservation[] {
  const nowIso = isoFromMs(nowMs)
  const today = todayIn(fixedClock(nowIso))
  const make = (
    id: string,
    resourceId: string,
    date: ReturnType<typeof addDays>,
    start: string,
    end: string,
    state: SportsReservation['state'],
  ): SportsReservation => ({
    id,
    ownerProfileId: 'demo-student-a',
    resourceId,
    date,
    start: t(start),
    end: t(end),
    state,
    disrupted: false,
    createdAt: nowIso,
    updatedAt: nowIso,
    version: state === 'cancelled' ? 2 : 1,
    provenance: demo(nowIso, EXAMPLE_LABEL),
    history: [
      {
        id: `${id}-h1`,
        entityId: id,
        actorKind: 'student',
        action: 'created',
        at: nowIso,
        dataMode: 'demoSeed',
        note: 'Example booking',
      },
      ...(state === 'cancelled'
        ? [
            {
              id: `${id}-h2`,
              entityId: id,
              actorKind: 'student' as const,
              action: 'cancelled',
              at: nowIso,
              dataMode: 'demoSeed' as const,
              note: 'Example cancellation',
            },
          ]
        : []),
    ],
  })
  return [
    make('DEMO-EX-BADMINTON', 'DEMO-COURT-2', addDays(today, 2), '18:00', '19:00', 'confirmedDemo'),
    make('DEMO-EX-STUDY-ROOM', 'DEMO-LIB-ROOM-1', addDays(today, 1), '15:00', '16:00', 'cancelled'),
  ]
}

export function initialSportsStore(nowMs: number, examples = false): SportsStore {
  const nowIso = isoFromMs(nowMs)
  const label = 'Illustrative sample facility (not a real campus facility)'
  const resource = (
    id: string,
    activity: Activity,
    name: string,
    open: string | null,
    close = '21:00',
  ): Resource => ({
    id,
    activity,
    label: name,
    location: 'Sample location (fictional)',
    hours: open ? { open: t(open), close: t(close) } : null,
    status: 'open',
    sourceLabel: label,
    asOf: nowIso,
    provenance: demo(nowIso, label),
  })
  const item = (id: string, name: string, status: Equipment['status']): Equipment => ({
    id,
    label: name,
    status,
    sourceLabel: 'Demo sample report (not an inspection)',
    asOf: nowIso,
    provenance: demo(nowIso, 'Illustrative sample equipment'),
  })
  return {
    schemaVersion: 1,
    gymScheduleVersion: 1,
    config: demoSportsConfig(),
    resources: [
      resource('DEMO-GYM', 'gym', 'Demo gym', '06:00', '22:00'),
      resource('DEMO-COURT-1', 'badminton', 'Demo badminton court 1', '07:00'),
      resource('DEMO-COURT-2', 'badminton', 'Demo badminton court 2', '07:00'),
      resource('DEMO-COURT-3', 'badminton', 'Demo badminton court 3', '07:00'),
      resource('DEMO-TT-1', 'tableTennis', 'Demo table tennis table 1', '07:00'),
      resource('DEMO-TT-2', 'tableTennis', 'Demo table tennis table 2', '07:00'),
      resource('DEMO-POOL-1', 'pool', 'Demo pool table', null),
      ...snookerResources(nowIso),
      resource('DEMO-BBALL-1', 'basketball', 'Demo basketball court', '07:00'),
      ...spaceResources(nowIso),
    ],
    reservations: examples ? exampleReservations(nowMs) : [],
    waitlist: [],
    gymSessions: [],
    occupancy: null,
    libraryOccupancy: null,
    catalogue: demoCatalogue(nowIso),
    loans: [],
    equipment: [
      item('DEMO-EQ-1', 'Sample treadmill 1', 'reportedAvailable'),
      item('DEMO-EQ-2', 'Sample cable machine', 'reportedAvailable'),
      item('DEMO-EQ-3', 'Sample bench press', 'unknown'),
      item('DEMO-EQ-4', 'Sample rowing machine', 'underMaintenance'),
      item('DEMO-EQ-5', 'Sample dumbbell rack', 'reportedAvailable'),
    ],
    faultReports: [],
    operations: [],
    nextSequence: 1,
  }
}

/** Tops up a store saved before the space services existed with their fixtures. Existing records are untouched. */
export function normalizeSportsStore(
  stored: SportsStore,
  nowMs: number,
  examples = false,
): SportsStore {
  // Upgrade existing browsers without resetting their bookings, check-ins or other policies.
  const upgraded: SportsStore =
    stored.gymScheduleVersion === 1
      ? stored
      : {
          ...stored,
          gymScheduleVersion: 1,
          config: {
            ...stored.config,
            policies: {
              ...stored.config.policies,
              gym: { ...stored.config.policies.gym, bookable: true, slotMinutes: 30 },
            },
          },
          resources: stored.resources.map((r) =>
            r.id === 'DEMO-GYM'
              ? {
                  ...r,
                  bookable: true,
                  hours: { open: t('06:00'), close: t('22:00') },
                }
              : r,
          ),
        }
  return reconcileLeases(topUp(upgraded, nowMs, examples), nowMs)
}

function topUp(stored: SportsStore, nowMs: number, examples: boolean): SportsStore {
  const have = new Set(stored.resources.map((r) => r.id))
  const missing = [
    ...snookerResources(isoFromMs(nowMs)),
    ...spaceResources(isoFromMs(nowMs)),
  ].filter((r) => !have.has(r.id))
  const haveRes = new Set(stored.reservations.map((r) => r.id))
  const missingExamples = examples
    ? exampleReservations(nowMs).filter((r) => !haveRes.has(r.id))
    : []
  if (missing.length === 0 && missingExamples.length === 0 && stored.catalogue.length > 0)
    return stored
  return {
    ...stored,
    reservations: [...stored.reservations, ...missingExamples],
    resources: [...stored.resources, ...missing],
    catalogue: stored.catalogue.length > 0 ? stored.catalogue : demoCatalogue(isoFromMs(nowMs)),
  }
}
