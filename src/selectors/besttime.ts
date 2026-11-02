/**
 * Best Time to Go (COS-SHARED-001 §3). Deterministic aggregation of OBSERVATIONS. The shipped data is
 * an explicitly illustrative simulation: it shows how the chart works, not how busy the campus is.
 */
export type ServiceId = 'mess' | 'gym' | 'laundry'
export type Mode = 'simulated' | 'manual_count' | 'self_report' | 'device_verified'

export interface CongestionObservation {
  id: string
  serviceId: ServiceId
  metric: 'selfReportedCount' | 'avgWaitMinutes'
  unit: 'people' | 'minutes'
  value: number
  /** 0 = Sunday … 6 = Saturday, in campus local time. */
  weekday: number
  hour: number
  mode: Mode
}

export const serviceName: Record<ServiceId, string> = {
  mess: 'Mess',
  gym: 'Gym',
  laundry: 'Laundry machines',
}
export const serviceMetric: Record<ServiceId, { label: string; unit: 'people' | 'minutes' }> = {
  mess: { label: 'Self-reported people present', unit: 'people' },
  gym: { label: 'Self-reported people present', unit: 'people' },
  laundry: { label: 'Average wait for a machine', unit: 'minutes' },
}
export const servicePath: Record<ServiceId, string> = {
  mess: '/services/mess',
  gym: '/bookings/gym',
  laundry: '/services/laundry/machines',
}

/** A bin needs at least this many samples before a recommendation is made. A V2 decision, not a campus fact. */
export const MIN_SAMPLES = 3

const curve = (hour: number, peaks: [number, number][], base: number) =>
  Math.round(
    base + peaks.reduce((sum, [at, height]) => sum + height * Math.exp(-((hour - at) ** 2) / 2), 0),
  )

/** Fully synthetic, deterministic, and labelled. Laundry deliberately has too few samples to recommend anything. */
export function illustrativeObservations(): CongestionObservation[] {
  const out: CongestionObservation[] = []
  let n = 0
  const add = (serviceId: ServiceId, weekday: number, hour: number, value: number) =>
    out.push({
      id: `obs-${++n}`,
      serviceId,
      metric: serviceId === 'laundry' ? 'avgWaitMinutes' : 'selfReportedCount',
      unit: serviceId === 'laundry' ? 'minutes' : 'people',
      value,
      weekday,
      hour,
      mode: 'simulated',
    })
  for (let weekday = 1; weekday <= 5; weekday++)
    for (let hour = 7; hour <= 21; hour++)
      for (let week = 0; week < 4; week++) {
        const wobble = ((weekday * 7 + hour * 3 + week * 5) % 5) - 2
        add(
          'mess',
          weekday,
          hour,
          Math.max(
            0,
            curve(
              hour,
              [
                [8, 30],
                [13, 45],
                [20, 35],
              ],
              4,
            ) + wobble,
          ),
        )
        add(
          'gym',
          weekday,
          hour,
          Math.max(
            0,
            curve(
              hour,
              [
                [7, 12],
                [18, 22],
              ],
              2,
            ) + wobble,
          ),
        )
      }
  for (const hour of [9, 10, 11]) add('laundry', 1, hour, 8 + hour) // two weekday hours of three samples would still be thin
  add('laundry', 1, 9, 12)
  return out
}

export interface Bin {
  hour: number
  mean: number | null
  n: number
  enough: boolean
}

export function aggregate(
  obs: readonly CongestionObservation[],
  serviceId: ServiceId,
  weekday: number,
): Bin[] {
  const mine = obs.filter((o) => o.serviceId === serviceId && o.weekday === weekday)
  const hours = [...new Set(mine.map((o) => o.hour))].sort((a, b) => a - b)
  return hours.map((hour) => {
    const v = mine.filter((o) => o.hour === hour).map((o) => o.value)
    return {
      hour,
      n: v.length,
      enough: v.length >= MIN_SAMPLES,
      mean: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null,
    }
  })
}

export type Recommendation =
  | { kind: 'withheld'; reason: string }
  | { kind: 'tied'; hours: number[]; mean: number }
  | { kind: 'best'; hour: number; mean: number }

/** Picks the lowest-mean hour among bins that have enough samples. Equal means are reported as tied, never ranked. */
export function recommend(bins: readonly Bin[]): Recommendation {
  const ok = bins.filter((b) => b.enough && b.mean !== null)
  if (ok.length === 0)
    return {
      kind: 'withheld',
      reason: 'No reliable pattern available: too few comparable samples in every hour.',
    }
  const lowest = Math.min(...ok.map((b) => b.mean as number))
  const hours = ok.filter((b) => b.mean === lowest).map((b) => b.hour)
  return hours.length > 1
    ? { kind: 'tied', hours, mean: lowest }
    : { kind: 'best', hour: hours[0]!, mean: lowest }
}

export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
]
export const hourLabel = (h: number) => `${((h + 11) % 12) + 1}:00 ${h < 12 ? 'am' : 'pm'}`
