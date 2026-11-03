/**
 * Academic calculators (COS-V3 §4.2, §4.6). Pure functions with full precision; callers round only for
 * display. The grade scale and attendance targets are DEMO configuration, not any college's rules.
 */
export interface GradeScale {
  label: string
  /** Letter → grade points. Missing letters are not guessed. */
  points: Record<string, number>
}

export const DEMO_SCALE: GradeScale = {
  label: '10-point scale (not a college rule)',
  points: { O: 10, 'A+': 9, A: 8, 'B+': 7, B: 6, C: 5, P: 4, F: 0 },
}
export const maxPoints = (s: GradeScale) => Math.max(...Object.values(s.points))
export const minPoints = (s: GradeScale) => Math.min(...Object.values(s.points))

export interface Course {
  code: string
  name: string
  credits: number
  /** A recorded grade letter. Undefined means pending, which is never a zero. */
  grade?: string
  /** Excluded courses (for example pass/fail or withdrawn) contribute to neither side. */
  included?: boolean
}

export type Result<T> = { ok: true; value: T } | { ok: false; reason: string }
const bad = (reason: string): { ok: false; reason: string } => ({ ok: false, reason })

/** Quality points and credits over graded, included courses only. Pending grades are skipped, not zeroed. */
export function quality(
  courses: readonly Course[],
  scale: GradeScale = DEMO_SCALE,
): Result<{ points: number; credits: number; pending: number }> {
  let points = 0
  let credits = 0
  let pending = 0
  for (const c of courses) {
    if (!Number.isFinite(c.credits) || c.credits < 0)
      return bad(`${c.code}: credits must be zero or more.`)
    if (c.included === false) continue
    if (c.grade === undefined || c.grade === '') {
      pending++
      continue
    }
    const gp = scale.points[c.grade]
    if (gp === undefined) return bad(`${c.code}: “${c.grade}” is not on this grade scale.`)
    points += gp * c.credits
    credits += c.credits
  }
  return { ok: true, value: { points, credits, pending } }
}

export function sgpa(courses: readonly Course[], scale?: GradeScale): Result<number> {
  const q = quality(courses, scale)
  if (!q.ok) return q
  if (q.value.credits === 0) return bad('No graded credits yet, so there is no SGPA.')
  return { ok: true, value: q.value.points / q.value.credits }
}

/**
 * Projected CGPA = (prior quality points + current quality points) / (prior + current credits).
 * `priorCgpa × priorCredits` is an estimate when the prior CGPA is a rounded figure.
 */
export function projectedCgpa(
  priorCgpa: number,
  priorCredits: number,
  current: readonly Course[],
  scale?: GradeScale,
): Result<{ cgpa: number; sgpa: number; credits: number }> {
  if (
    !Number.isFinite(priorCgpa) ||
    priorCgpa < 0 ||
    !Number.isFinite(priorCredits) ||
    priorCredits < 0
  )
    return bad('Prior CGPA and credits must be zero or more.')
  const q = quality(current, scale)
  if (!q.ok) return q
  if (q.value.credits === 0) return bad('Pick a grade for at least one course with credits.')
  const total = priorCredits + q.value.credits
  return {
    ok: true,
    value: {
      cgpa: (priorCgpa * priorCredits + q.value.points) / total,
      sgpa: q.value.points / q.value.credits,
      credits: q.value.credits,
    },
  }
}

export type Feasibility = 'achievable' | 'already' | 'notAchievable'
/** The SGPA a planned set of credits would need for a target CGPA, and whether the scale can reach it. */
export function requiredSgpa(
  targetCgpa: number,
  priorCgpa: number,
  priorCredits: number,
  plannedCredits: number,
  scale: GradeScale = DEMO_SCALE,
): Result<{ required: number; feasibility: Feasibility }> {
  if (![targetCgpa, priorCgpa, priorCredits, plannedCredits].every(Number.isFinite))
    return bad('Enter numbers in every box.')
  if (plannedCredits <= 0) return bad('Planned credits must be more than zero.')
  if (priorCgpa < 0 || priorCredits < 0 || targetCgpa < 0) return bad('Values cannot be negative.')
  const required =
    (targetCgpa * (priorCredits + plannedCredits) - priorCgpa * priorCredits) / plannedCredits
  const feasibility: Feasibility =
    required > maxPoints(scale)
      ? 'notAchievable'
      : required <= minPoints(scale)
        ? 'already'
        : 'achievable'
  return { ok: true, value: { required, feasibility } }
}

/* ───────────────────────────── Attendance ───────────────────────────── */

export interface Attendance {
  attended: number
  held: number
  /** The target as a fraction, for example 0.75. Demo configuration unless a source supplies it. */
  target: number
}

export function validateAttendance(a: Attendance): string | null {
  if (!Number.isInteger(a.attended) || !Number.isInteger(a.held))
    return 'Session counts must be whole numbers.'
  if (a.attended < 0 || a.held < 0 || a.attended > a.held)
    return 'Attended sessions cannot be more than held sessions, or negative.'
  if (!(a.target > 0 && a.target <= 1)) return 'The target must be above 0% and at most 100%.'
  return null
}

export const pct = (attended: number, held: number) => (held === 0 ? null : (100 * attended) / held)

export interface AttendancePlan {
  current: number | null
  meetsTarget: boolean
  /** Future sessions you could miss and still meet the target. Null when the target is not met now. */
  missable: number | null
  /** Consecutive sessions to attend to reach the target. Null when already met, or impossible at 100%. */
  needed: number | null
  impossible: boolean
}

/**
 * Exact integer comparisons (never rounded percentages). `missable = floor(A/p − T)` and
 * `needed = ceil((pT − A)/(1 − p))`; at p = 1 a past absence can never be recovered.
 */
export function plan(a: Attendance): Result<AttendancePlan> {
  const problem = validateAttendance(a)
  if (problem) return bad(problem)
  const { attended: A, held: T, target: p } = a
  if (T === 0)
    return {
      ok: true,
      value: { current: null, meetsTarget: false, missable: null, needed: null, impossible: false },
    }
  // A/T >= p  <=>  A >= p*T, compared without dividing.
  const meets = A >= p * T - 1e-12
  if (meets)
    return {
      ok: true,
      value: {
        current: pct(A, T),
        meetsTarget: true,
        missable: p === 1 ? 0 : Math.max(0, Math.floor(A / p - T + 1e-12)),
        needed: null,
        impossible: false,
      },
    }
  if (p === 1)
    return {
      ok: true,
      value: {
        current: pct(A, T),
        meetsTarget: false,
        missable: null,
        needed: null,
        impossible: true,
      },
    }
  return {
    ok: true,
    value: {
      current: pct(A, T),
      meetsTarget: false,
      missable: null,
      needed: Math.max(0, Math.ceil((p * T - A) / (1 - p) - 1e-12)),
      impossible: false,
    },
  }
}

/** What the percentage would be after the next k sessions. */
export const ifMissed = (A: number, T: number, k: number) => pct(A, T + k)
export const ifAttended = (A: number, T: number, k: number) => pct(A + k, T + k)
