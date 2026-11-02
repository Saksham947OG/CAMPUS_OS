import {
  DEMO_SCALE,
  ifAttended,
  ifMissed,
  plan,
  projectedCgpa,
  quality,
  requiredSgpa,
  sgpa,
  validateAttendance,
} from './academic-tools'

const c = (code: string, credits: number, grade?: string) => ({ code, name: code, credits, grade })

describe('SGPA, CGPA and target', () => {
  it('weights by credits and reproduces the documented fixture exactly', () => {
    // Prior CGPA 6.84 over 41 credits, a simulated SGPA of 8.00 over 27 credits.
    const r = projectedCgpa(6.84, 41, [c('X', 27, 'A')])
    expect(r.ok && r.value.cgpa).toBeCloseTo(7.300588235, 8)
    expect(r.ok && r.value.sgpa).toBe(8)
    const t = requiredSgpa(7.2, 6.84, 41, 27)
    expect(t.ok && t.value.required).toBeCloseTo(7.746666667, 8)
    expect(t.ok && t.value.feasibility).toBe('achievable')
    // Unequal credits are weighted, not averaged: (10×4 + 6×1) / 5 = 9.2, not 8.
    const s = sgpa([c('A', 4, 'O'), c('B', 1, 'B')])
    expect(s.ok && s.value).toBeCloseTo(9.2, 12)
  })

  it('never turns a pending grade into zero and never combines an unknown letter', () => {
    const q = quality([c('A', 4, 'A'), c('B', 3)])
    expect(q.ok && q.value).toEqual({ points: 32, credits: 4, pending: 1 })
    expect(sgpa([c('B', 3)]).ok).toBe(false)
    const bad = sgpa([c('A', 4, 'Z')])
    expect(!bad.ok && bad.reason).toMatch(/not on this grade scale/)
    expect(quality([c('A', -1, 'A')]).ok).toBe(false)
    expect(
      quality([{ ...c('P', 2, 'F'), included: false }, c('A', 2, 'A')]).ok &&
        (
          quality([{ ...c('P', 2, 'F'), included: false }, c('A', 2, 'A')]) as {
            value: { credits: number }
          }
        ).value.credits,
    ).toBe(2)
  })

  it('says a target above the scale is not achievable, and one already secured is explained', () => {
    const hi = requiredSgpa(9.9, 7, 40, 10)
    expect(hi.ok && hi.value.feasibility).toBe('notAchievable')
    const lo = requiredSgpa(5, 8, 40, 10)
    expect(lo.ok && lo.value.feasibility).toBe('already')
    expect(requiredSgpa(8, 7, 40, 0).ok).toBe(false)
    expect(requiredSgpa(8, 7, Number.NaN, 5).ok).toBe(false)
    expect(DEMO_SCALE.label).toMatch(/not a college rule/)
  })
})

describe('attendance planner', () => {
  it('handles the exact target boundary without rounding', () => {
    // 15 of 20 is exactly 75%: meets the target, and 0 further misses are allowed.
    const r = plan({ attended: 15, held: 20, target: 0.75 })
    expect(r.ok && r.value).toMatchObject({ meetsTarget: true, missable: 0 })
    // 16 of 20: floor(16/0.75 − 20) = 1 session can be missed.
    expect(
      (plan({ attended: 16, held: 20, target: 0.75 }) as { value: { missable: number } }).value
        .missable,
    ).toBe(1)
    // 74.9% displayed as 75% must still be below.
    const below = plan({ attended: 749, held: 1000, target: 0.75 })
    expect(below.ok && below.value.meetsTarget).toBe(false)
  })

  it('gives recovery requirements below target, and treats 100% as unrecoverable after an absence', () => {
    // 12 of 20 (60%) needs ceil((15 − 12)/(0.25)) = 12 consecutive sessions to reach 75%.
    const r = plan({ attended: 12, held: 20, target: 0.75 })
    expect(r.ok && r.value).toMatchObject({ meetsTarget: false, needed: 12, missable: null })
    expect(ifAttended(12, 20, 12)).toBe(75)
    const full = plan({ attended: 19, held: 20, target: 1 })
    expect(full.ok && full.value).toMatchObject({ impossible: true, needed: null })
    expect(
      (plan({ attended: 20, held: 20, target: 1 }) as { value: { meetsTarget: boolean } }).value
        .meetsTarget,
    ).toBe(true)
  })

  it('shows nothing for no records and rejects impossible counts', () => {
    const none = plan({ attended: 0, held: 0, target: 0.75 })
    expect(none.ok && none.value.current).toBeNull()
    expect(validateAttendance({ attended: 5, held: 4, target: 0.75 })).toMatch(/cannot be more/)
    expect(validateAttendance({ attended: 1.5, held: 4, target: 0.75 })).toMatch(/whole numbers/)
    expect(validateAttendance({ attended: 1, held: 4, target: 0 })).toMatch(/above 0%/)
    expect(ifMissed(15, 20, 2)).toBeCloseTo((100 * 15) / 22, 12)
  })
})
