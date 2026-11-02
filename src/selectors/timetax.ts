import { MEASURES, type Measure, type Scenario } from '@/domain/shared'

/**
 * Time Tax arithmetic (COS-SHARED-001 §5.2). Everything here is a WHAT-IF on stated assumptions.
 * The signed per-visit change is always kept; only the explicitly named "avoided" figure is clamped.
 */
export interface ScenarioResult {
  /** baseline − scenario. Negative means the scenario makes things WORSE. */
  netPerVisit: number
  /** max(0, net): the avoided-time KPI. Never hides a deterioration, which stays in `netPerVisit`. */
  avoidedPerVisit: number
  worsens: boolean
  participants: number
  weeklyStudentHours: number
  termStudentHours: number
}

export function computeScenario(
  s: Pick<
    Scenario,
    | 'baselineMinutes'
    | 'scenarioMinutes'
    | 'eligibleStudents'
    | 'visitsPerWeek'
    | 'adoptionPercent'
    | 'weeks'
  >,
): ScenarioResult {
  const netPerVisit = s.baselineMinutes - s.scenarioMinutes
  const avoidedPerVisit = Math.max(0, netPerVisit)
  const participants = s.eligibleStudents * (s.adoptionPercent / 100)
  const weeklyStudentHours = (participants * s.visitsPerWeek * avoidedPerVisit) / 60
  return {
    netPerVisit,
    avoidedPerVisit,
    worsens: netPerVisit < 0,
    participants,
    weeklyStudentHours,
    termStudentHours: weeklyStudentHours * s.weeks,
  }
}

/** Student-hours may be added only within one measure: on-site waiting, failed trips and follow-ups are different things. */
export function totalsByMeasure(
  list: readonly Scenario[],
): { measure: Measure; hours: number; count: number }[] {
  return MEASURES.map((m) => {
    const mine = list.filter((x) => x.measure === m)
    return {
      measure: m,
      count: mine.length,
      hours: mine.reduce((sum, x) => sum + computeScenario(x).weeklyStudentHours, 0),
    }
  }).filter((r) => r.count > 0)
}

export interface Preset {
  serviceId: string
  label: string
  measure: Measure
  note: string
}

/** Each service names the ONE time component it models, so two services never double-count one wait. */
export const presets: Preset[] = [
  {
    serviceId: 'chill-spot',
    label: 'Chill Spot ordering ahead',
    measure: 'onSiteWaiting',
    note: 'Preparation waiting moves off-site; pickup and payment waiting remain. It does not make the food faster.',
  },
  {
    serviceId: 'ss-laundry',
    label: 'SS Laundry status tracking',
    measure: 'failedTrips',
    note: 'Avoids a trip to collect a bag that has not come back. Count walking and waiting only if measured.',
  },
  {
    serviceId: 'bookings',
    label: 'Facility bookings',
    measure: 'failedTrips',
    note: 'Avoids arriving to find a facility occupied. A reservation is not proof the facility was empty.',
  },
  {
    serviceId: 'administration',
    label: 'Tracked administrative requests',
    measure: 'followUps',
    note: 'Fewer office trips and status checks. The approval duration itself may be unchanged.',
  },
]
