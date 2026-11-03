import type { Activity } from './sports'

/**
 * Owner-supplied reference capacities (chat, 2026-11-03). One table, so a number is never typed twice.
 *
 * These are how many people a place is meant to hold at once. They are not a live headcount, not a
 * measured occupancy and not a fire-safety figure. Only where the table says so do they also limit
 * one demo reservation (people per court, table or room, and places per gym slot).
 */
export const CAPACITY_AS_OF = '2026-11-03'
export const CAPACITY_SOURCE = 'Owner-supplied capacity table (3 Nov 2026)'

export interface FacilityCapacity {
  key: string
  label: string
  /** The sentence shown to people, exactly as supplied. */
  text: string
  /** The headline number (the upper figure of a range). Undefined when it is not people. */
  people?: number
  /** The supplied figure is a range or marked "about". */
  approximate?: boolean
  /** For a place counted in machines rather than people (the laundry). */
  units?: number
  /** What `people` is counted per. */
  per: 'facility' | 'unit' | 'room'
}

export const FACILITY_CAPACITY: readonly FacilityCapacity[] = [
  { key: 'mess', label: 'Mess', text: '100 people at a time', people: 100, per: 'facility' },
  { key: 'library', label: 'Library', text: '130 people at a time', people: 130, per: 'facility' },
  {
    key: 'gym',
    label: 'Gym',
    text: 'about 20 people at a time',
    people: 20,
    approximate: true,
    per: 'facility',
  },
  {
    key: 'laundry',
    label: 'Laundry',
    text: '2 machines for about 60 students',
    units: 2,
    approximate: true,
    per: 'facility',
  },
  {
    key: 'cabin',
    label: 'Library cabin',
    text: '8 people at a time',
    people: 8,
    per: 'room',
  },
  {
    key: 'classroom',
    label: 'Classroom',
    text: '70 people at a time',
    people: 70,
    per: 'room',
  },
  {
    key: 'chillSpot',
    label: 'Chill Spot',
    text: '30–40 people at a time',
    people: 40,
    approximate: true,
    per: 'facility',
  },
  {
    key: 'musicRoom',
    label: 'Music room',
    text: '40 people at a time',
    people: 40,
    per: 'room',
  },
  {
    key: 'basketball',
    label: 'Basketball court',
    text: '10 people at a time',
    people: 10,
    per: 'unit',
  },
  {
    key: 'badminton',
    label: 'Badminton court',
    text: '4 people at a time',
    people: 4,
    per: 'unit',
  },
  {
    key: 'tableTennis',
    label: 'Table tennis',
    text: '2 people at a time',
    people: 2,
    per: 'unit',
  },
  { key: 'pool', label: 'Pool', text: '2 people at a time', people: 2, per: 'unit' },
  { key: 'snooker', label: 'Snooker', text: '2 people at a time', people: 2, per: 'unit' },
]

export const capacityOf = (key: string): FacilityCapacity | undefined =>
  FACILITY_CAPACITY.find((c) => c.key === key)

/** "100 people at a time" for a facility key, or an honest fallback. */
export const capacitySentence = (key: string): string =>
  capacityOf(key)?.text ?? 'Capacity not provided'

/** Resource activities that map one-to-one onto a row of the table. */
const ACTIVITY_KEY: Partial<Record<Activity, string>> = {
  gym: 'gym',
  library: 'library',
  musicRoom: 'musicRoom',
  basketball: 'basketball',
  badminton: 'badminton',
  tableTennis: 'tableTennis',
  pool: 'pool',
  snooker: 'snooker',
}

/** The library facility is the one resource the 130 describes; its bookable group rooms are the study cabins (8). */
const LIBRARY_FACILITY_ID = 'DEMO-LIBRARY'

export interface ResourceCapacity {
  people: number
  approximate: boolean
}

export function resourceCapacity(r: {
  id: string
  activity: Activity
}): ResourceCapacity | undefined {
  const key =
    r.activity === 'library' && r.id !== LIBRARY_FACILITY_ID ? 'cabin' : ACTIVITY_KEY[r.activity]
  const row = key ? capacityOf(key) : undefined
  return row?.people ? { people: row.people, approximate: row.approximate ?? false } : undefined
}

/**
 * Most people one reservation may list. Counted per court, table or room, so it applies to units and
 * rooms, never to the library as a whole or to the gym (where people book their own place).
 */
export function participantLimit(activity: Activity): number | undefined {
  // The only bookable library resources are the study cabins, so the library's limit is the cabin's.
  const key = activity === 'library' ? 'cabin' : ACTIVITY_KEY[activity]
  const row = key ? capacityOf(key) : undefined
  return row && (row.per === 'unit' || row.per === 'room') ? row.people : undefined
}

/** Places a single gym slot can hold: each person reserves their own. */
export const GYM_SLOT_PLACES = 20
