/**
 * Chill Spot Time Tax scenario (COS-CHILL-001 §10). Physical waiting is split into three components;
 * total order turnaround is a different thing and is never derived from these.
 */
export interface WaitComponents {
  /** Physical wait before an in-person order is placed. */
  counter: number
  /** Physical wait for preparation while the student is on site. */
  onSite: number
  /** Physical wait from arrival at the collection point to handover/payment. */
  pickup: number
}

/** The spec's illustration (30 → 4 minutes). It is an assumption, not an observation. */
export const ILLUSTRATIVE_BASELINE: WaitComponents = { counter: 6, onSite: 20, pickup: 4 }
export const ILLUSTRATIVE_ORDER_AHEAD: WaitComponents = { counter: 0, onSite: 0, pickup: 4 }

export const isValidWait = (n: number) => Number.isInteger(n) && n >= 0 && n <= 240

export const totalWait = (w: WaitComponents) => w.counter + w.onSite + w.pickup

export interface TimeTaxComparison {
  baselineMinutes: number
  orderAheadMinutes: number
  /** baseline − order-ahead. Positive = less waiting; NEGATIVE is shown honestly as more waiting. */
  netChangeMinutes: number
  /** max(0, net): hypothetical potential only. Never hides the signed value above. */
  potentialAvoidedMinutes: number
  direction: 'less' | 'more' | 'same'
}

export function compareWaiting(
  baseline: WaitComponents,
  orderAhead: WaitComponents,
): TimeTaxComparison {
  const baselineMinutes = totalWait(baseline)
  const orderAheadMinutes = totalWait(orderAhead)
  const netChangeMinutes = baselineMinutes - orderAheadMinutes
  return {
    baselineMinutes,
    orderAheadMinutes,
    netChangeMinutes,
    potentialAvoidedMinutes: Math.max(0, netChangeMinutes),
    direction: netChangeMinutes > 0 ? 'less' : netChangeMinutes < 0 ? 'more' : 'same',
  }
}

export const isValidOrderCount = (n: number) => Number.isInteger(n) && n >= 0 && n <= 100_000

/**
 * hypotheticalWeeklyStudentHoursAvoided = eligible orders × positive avoided minutes ÷ 60.
 * Scenario Mode only: the inputs are assumptions, so the result is never an observed saving.
 */
export function hypotheticalWeeklyHours(
  eligibleOrdersPerWeek: number,
  potentialAvoidedMinutes: number,
): number | null {
  if (!isValidOrderCount(eligibleOrdersPerWeek) || potentialAvoidedMinutes < 0) return null
  return (eligibleOrdersPerWeek * potentialAvoidedMinutes) / 60
}

/**
 * How the signed net change moves when the student arrives before the food is ready and waits
 * `extra` more minutes on site. A negative result is shown as MORE waiting, never zeroed.
 */
export function pickupDelaySensitivity(
  baseline: WaitComponents,
  orderAhead: WaitComponents,
  extras: readonly number[] = [0, 5, 10, 15, 20],
) {
  return extras.map((extra) => ({
    extra,
    net: totalWait(baseline) - (totalWait(orderAhead) + extra),
  }))
}
