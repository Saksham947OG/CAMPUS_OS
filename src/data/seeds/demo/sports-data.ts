import type { Provenance } from '@/domain/provenance'
import {
  defaultSpacePolicies,
  type Activity,
  type Book,
  type Equipment,
  type Policy,
  type Resource,
  type SportsConfig,
  type SportsStore,
} from '@/domain/sports'
import { isoFromMs } from '@/lib/time'
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
 * They are NOT campus policy. Each activity has its own row; pool is information-only and the gym is
 * not bookable because no capacity rule has been supplied. Participant limits are unknown.
 */
export const demoSportsConfig = (): SportsConfig => ({
  policies: {
    gym: { ...base, bookable: false },
    badminton: { ...base, maxActive: 2, allowPartner: true, allowWaitlist: true },
    tableTennis: { ...base, slotMinutes: 30, allowPartner: true },
    pool: { ...base, bookable: false },
    basketball: { ...base, horizonDays: 3, graceMinutes: 15 },
    ...defaultSpacePolicies(),
  },
  offerLifetimeMinutes: 15,
  reminderMinutes: 30,
  occupancyStaleMinutes: 60,
  gymSessionStaleMinutes: 120,
})

const SPACE_LABEL = 'Illustrative sample space (not a real campus space)'

/**
 * The fictional space resources for COS-SPACES-001. IDs are stable so a store saved before they
 * existed can be topped up with exactly these and nothing else. The library facility is described,
 * never booked; its two group rooms are the bookable resources. Chill Zone spots are demo
 * coordination records: their evening hours run past midnight on purpose.
 */
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
    sourceLabel: 'Fictional demo catalogue (not a real library)',
    provenance: demo(nowIso, 'Fictional demo catalogue'),
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
export function initialSportsStore(nowMs: number): SportsStore {
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
    config: demoSportsConfig(),
    resources: [
      resource('DEMO-GYM', 'gym', 'Demo gym', '06:00'),
      resource('DEMO-COURT-1', 'badminton', 'Demo badminton court 1', '07:00'),
      resource('DEMO-COURT-2', 'badminton', 'Demo badminton court 2', '07:00'),
      resource('DEMO-COURT-3', 'badminton', 'Demo badminton court 3', '07:00'),
      resource('DEMO-TT-1', 'tableTennis', 'Demo table tennis table 1', '07:00'),
      resource('DEMO-TT-2', 'tableTennis', 'Demo table tennis table 2', '07:00'),
      resource('DEMO-POOL-1', 'pool', 'Demo pool table', null),
      resource('DEMO-BBALL-1', 'basketball', 'Demo basketball court', '07:00'),
      ...spaceResources(nowIso),
    ],
    reservations: [],
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
export function normalizeSportsStore(stored: SportsStore, nowMs: number): SportsStore {
  const have = new Set(stored.resources.map((r) => r.id))
  const missing = spaceResources(isoFromMs(nowMs)).filter((r) => !have.has(r.id))
  if (missing.length === 0 && stored.catalogue.length > 0) return stored
  return {
    ...stored,
    resources: [...stored.resources, ...missing],
    catalogue: stored.catalogue.length > 0 ? stored.catalogue : demoCatalogue(isoFromMs(nowMs)),
  }
}
