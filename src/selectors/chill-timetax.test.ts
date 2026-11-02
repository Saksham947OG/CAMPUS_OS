import {
  compareWaiting,
  ILLUSTRATIVE_BASELINE,
  ILLUSTRATIVE_ORDER_AHEAD,
  isValidWait,
  totalWait,
} from './chill-timetax'

describe('CH-AT-29 Time Tax comparison', () => {
  it('the illustrative example is 30 → 4 minutes, a net 26 minutes less waiting', () => {
    expect(totalWait(ILLUSTRATIVE_BASELINE)).toBe(30)
    expect(totalWait(ILLUSTRATIVE_ORDER_AHEAD)).toBe(4)
    expect(compareWaiting(ILLUSTRATIVE_BASELINE, ILLUSTRATIVE_ORDER_AHEAD)).toEqual({
      baselineMinutes: 30,
      orderAheadMinutes: 4,
      netChangeMinutes: 26,
      potentialAvoidedMinutes: 26,
      direction: 'less',
    })
  })

  it('a negative difference stays negative and the potential is clamped to zero separately', () => {
    const r = compareWaiting(
      { counter: 0, onSite: 0, pickup: 5 },
      { counter: 0, onSite: 20, pickup: 5 },
    )
    expect(r.netChangeMinutes).toBe(-20)
    expect(r.potentialAvoidedMinutes).toBe(0)
    expect(r.direction).toBe('more')
  })

  it('equal totals are "same", and inputs are validated as whole minutes 0–240', () => {
    const w = { counter: 1, onSite: 2, pickup: 3 }
    expect(compareWaiting(w, w).direction).toBe('same')
    for (const bad of [-1, 241, 1.5, Number.NaN]) expect(isValidWait(bad)).toBe(false)
    for (const good of [0, 240, 17]) expect(isValidWait(good)).toBe(true)
  })
})
