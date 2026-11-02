export interface ProcessEvidence {
  id: string
  service: string
  label: string
  baseline: [number, number] | null
  target: [number, number] | null
  basis: 'reported' | 'estimated' | 'illustrative' | 'missing'
  sourceIds: string[]
  note: string
  includeInComposite?: boolean
}
const process = (
  id: string,
  service: string,
  label: string,
  baseline: ProcessEvidence['baseline'],
  target: ProcessEvidence['target'],
  basis: ProcessEvidence['basis'],
  sourceIds: string[],
  note: string,
  includeInComposite = false,
): ProcessEvidence => ({
  id,
  service,
  label,
  baseline,
  target,
  basis,
  sourceIds,
  note,
  includeInComposite,
})
export function personaEvidence(profileId: string): ProcessEvidence[] {
  const a = profileId === 'demo-student-a',
    b = profileId === 'demo-student-b'
  return [
    process(
      'breakfast',
      'mess',
      'Breakfast queue',
      a ? [5, 10] : null,
      a ? [2, 2] : null,
      a ? 'reported' : 'missing',
      [a ? 'persona-1' : 'persona-3', 'mess-menu'],
      a
        ? 'Reported across notebook logs; no dated matched before/after sample.'
        : 'Persona includes breakfast; timed queue baseline not supplied.',
      a,
    ),
    process(
      'lunch',
      'mess',
      'Lunch queue',
      a ? [20, 30] : b ? [15, 15] : [10, 20],
      a ? [5, 5] : b ? [0, 5] : [5, 5],
      a ? 'estimated' : b ? 'reported' : 'illustrative',
      [a ? 'persona-1' : b ? 'persona-2' : 'persona-3', 'mess-menu'],
      a
        ? '20–30 minutes is an estimate inferred from shifted meal start times; verify by timing the line.'
        : b
          ? '15 minutes of waiting is explicitly reported, separate from 20 minutes eating. The 0–5 minute target is hypothetical.'
          : '10–20 minute queue and 5-minute target are planning assumptions; persona supplied no timed wait.',
      a,
    ),
    process(
      'dinner',
      'mess',
      'Dinner queue',
      a ? [7, 8] : null,
      a ? [2, 2] : null,
      a ? 'reported' : 'missing',
      [a ? 'persona-1' : b ? 'persona-2' : 'persona-3', 'mess-menu'],
      a
        ? 'Reported wait from a different day than the lunch observation.'
        : 'Dinner is scheduled; waiting duration is not recorded.',
      a,
    ),
    process(
      'machines',
      'machines',
      'Waiting for a washer',
      a ? [30, 30] : [15, 30],
      a ? [0, 0] : [5, 5],
      a ? 'reported' : 'illustrative',
      ['persona-1', 'persona-1-chart'],
      a
        ? 'v2 document reports 30 minutes; the newer chart says 45–60 minutes. Keep the document’s composite separately and flag this disagreement.'
        : 'Illustrative washer wait; no personal observation supplied.',
      a,
    ),
    process(
      'chill-spot',
      'chill-spot',
      'Chill Spot ordering',
      a ? [0, 30] : [10, 20],
      [5, 5],
      a ? 'reported' : 'illustrative',
      ['cafe-food', 'cafe-drinks', a ? 'persona-1' : b ? 'persona-2' : 'persona-3'],
      a
        ? 'Source says “up to 30 minutes”; no lower bound, service decomposition or measured pickup target.'
        : 'Order wait is illustrative. Menu prices are supplied; queue length and preparation times are not.',
    ),
    process(
      'sports',
      'sports',
      'Court and table availability',
      null,
      null,
      'missing',
      ['research', 'club-calendar'],
      'Facilities are listed in research, but failed-trip and queue durations were not measured. Reservations record local schedule use only.',
    ),
    process(
      'gym',
      'gym',
      'Gym crowding',
      null,
      null,
      'missing',
      ['persona-2', 'persona-2-chart'],
      b
        ? 'Two-hour visit is reported, but baseline workout length is unknown. The proposed one-hour plan does not prove a 60-minute saving.'
        : 'No personal waiting baseline or reliable current occupancy feed. Capacity ~20 comes from a persona chart.',
    ),
    process(
      'library',
      'library',
      'Library seat search',
      a ? [5, 15] : null,
      a ? [2, 2] : null,
      a ? 'illustrative' : 'missing',
      ['persona-3-chart'],
      a
        ? '5–15 minute search is an illustrative planning assumption.'
        : 'Library capacity 130 is supplied; seat-search duration and current occupancy are missing.',
    ),
    process(
      'classrooms',
      'classrooms',
      'Room and group coordination',
      b ? [15, 30] : [10, 20],
      [5, 5],
      'illustrative',
      [a ? 'persona-1' : b ? 'persona-2' : 'persona-3', 'timetable'],
      'Illustrative coordination duration. Timetabled classes block rooms; a confirmed app booking is not an institutional access right.',
    ),
    process(
      'ss-laundry',
      'ss-laundry',
      'Laundry collection trips',
      null,
      null,
      'missing',
      ['persona-3'],
      'Collection task is in the persona. Provider hours, turnaround, failed-trip duration and collection confirmation are missing.',
    ),
    process(
      'parcels',
      'parcels',
      'Parcel collection',
      null,
      null,
      'missing',
      ['persona-3'],
      'Guard room is supplied as a collection point. Arrival timestamps and parcel rows are illustrative; desk hours and failed-trip time are missing.',
    ),
    process(
      'academics',
      'academics',
      'Finding assessment information',
      a ? [5, 10] : null,
      a ? [1, 2] : null,
      a ? 'illustrative' : 'missing',
      ['quizzes', 'exams', 'manual'],
      a
        ? 'Illustrative information-search time. Historical quiz dates are adapted; current syllabus and individual seats are missing.'
        : 'No measured information-search baseline. Assessment rules and original schedules are supplied.',
    ),
    process(
      'administration',
      'administration',
      'Administrative follow-ups',
      null,
      null,
      'missing',
      ['research', 'manual'],
      'Office contact research and rules are supplied. Office hours, service turnaround and observed follow-up durations are missing.',
    ),
    process(
      'community',
      'community',
      'Club follow-ups',
      b ? [15, 30] : null,
      b ? [5, 10] : null,
      b ? 'estimated' : 'missing',
      ['club-calendar', 'research', b ? 'persona-2' : 'persona-3'],
      'Club events are proposals. Fragmentation is described, but no matched time study establishes savings.',
    ),
  ]
}
export function potentialRange(row: ProcessEvidence): [number, number] | null {
  if (!row.baseline || !row.target) return null
  return [
    Math.max(0, row.baseline[0] - row.target[1]),
    Math.max(0, row.baseline[1] - row.target[0]),
  ]
}
export function compositeRange(rows: ProcessEvidence[]): [number, number] | null {
  const selected = rows
    .filter((r) => r.includeInComposite)
    .map(potentialRange)
    .filter((r): r is [number, number] => r !== null)
  return selected.length
    ? selected.reduce<[number, number]>((sum, r) => [sum[0] + r[0], sum[1] + r[1]], [0, 0])
    : null
}
export const sourceGaps = [
  {
    id: 'seat-allocation',
    service: 'academics',
    title: 'Individual exam seats and quiz syllabus',
    detail:
      'The exam and quiz PDFs list halls, but no authenticated persona-to-seat assignment or current syllabus. No seat number has been invented.',
  },
  {
    id: 'live-occupancy',
    service: 'gym',
    title: 'Live occupancy and equipment state',
    detail:
      'No sensors or operator feed for gym, mess, library or washing machines. Counts in persona charts are reference capacities, not live occupancy.',
  },
  {
    id: 'office-hours',
    service: 'administration',
    title: 'BMS office hours and appointment rules',
    detail:
      'Supplied research explicitly flags bmsvlm emails as potentially belonging to another programme. Current on-campus email, office room and hours need confirmation.',
  },
  {
    id: 'faculty-hours',
    service: 'academics',
    title: 'Faculty office hours',
    detail:
      'Faculty associations come from schedules; no actual meeting availability was supplied. Requests remain proposals.',
  },
  {
    id: 'curriculum-conflict',
    service: 'academics',
    title: 'Curriculum versions disagree',
    detail:
      'Screenshots list Dance and Drama and Sports and Yoga where the newer manual lists Programming-II, Data Visualization and Yoga and Meditation. The newer manual is the curriculum baseline; timetable faculty mappings remain source-specific.',
  },
  {
    id: 'laundry-conflict',
    service: 'machines',
    title: 'Ananya laundry wait: 30 vs 45–60 minutes',
    detail:
      'v2 persona document and schedule chart disagree. The original 53–69-minute composite uses the document’s 30-minute baseline. The chart is retained separately, never added again.',
  },
  {
    id: 'evening-overlap',
    service: 'gym',
    title: 'Profile 2 evening overlap',
    detail:
      'Original gym 18:45–20:45 overlaps dinner before 20:20. The app uses the supplied proposed one-hour workout, adjusts dinner to 20:00 opening, and labels the changed intervals as plans.',
  },
  {
    id: 'room-coverage',
    service: 'classrooms',
    title: 'Room availability is incomplete',
    detail:
      'CR-04 and CR-05 current-week classes are imported as blockers. Blank rows are not official room availability; bookable windows are illustrative.',
  },
  {
    id: 'service-operations',
    service: 'ss-laundry',
    title: 'Provider, parcel, payment and maintenance integrations',
    detail:
      'No operator connection, payment gateway, courier API or maintenance dispatch is supplied. Local actions work on this device and do not submit requests externally.',
  },
  {
    id: 'club-verification',
    service: 'community',
    title: 'Club applicability and contacts',
    detail:
      'Research says institute club pages predate BMS and may describe MBA clubs. Event dates are proposed. BMS memberships, rosters, contacts, venues and recruitment links are not supplied.',
  },
  {
    id: 'time-tax-method',
    service: 'time-tax',
    title: 'Dated before/after field samples',
    detail:
      'Narrative reports and estimates are available, but a dated matched before/after study is missing. Record observations in Time Tax; app actions alone do not establish minutes saved.',
  },
  {
    id: 'identity-access',
    service: 'identity',
    title: 'Protected student records',
    detail:
      'ID cards and identifiable attendance rows were reviewed and inventoried. Publishing raw scans in a public bundle would expose them to every visitor. A private authenticated data store is needed for individual records.',
  },
  {
    id: 'source-dates',
    service: 'calendar',
    title: 'Reference week and holidays',
    detail:
      'Historical assessments were adapted to Nov 2–7 at the owner’s request. The manual lists Diwali break Nov 6–12. These adapted activities are planning references, not updated official exam notices.',
  },
]
