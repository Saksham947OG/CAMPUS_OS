import { minutesToTime, timeToMinutes, type LocalTime } from '@/lib/time'
import { z } from 'zod'
import { localTimeSchema } from '@/domain/records'
import { isCancelled, isTimed, type CalendarItem } from './items'

/** Shared per-profile planning preference (DEC-018): one definition for Home and Calendar. */
export const planningPrefsSchema = z
  .object({
    schemaVersion: z.literal(1),
    windowStart: localTimeSchema,
    windowEnd: localTimeSchema,
    minimumMinutes: z.number().int().min(15).max(180),
  })
  .superRefine((p, ctx) => {
    if (timeToMinutes(p.windowEnd) <= timeToMinutes(p.windowStart)) {
      ctx.addIssue({
        code: 'custom',
        path: ['windowEnd'],
        message: 'The working window must end after it starts',
      })
    }
  })
export type PlanningPrefs = z.infer<typeof planningPrefsSchema>

export const defaultPlanningPrefs = (): PlanningPrefs => ({
  schemaVersion: 1,
  windowStart: '08:00' as LocalTime,
  windowEnd: '22:00' as LocalTime,
  minimumMinutes: 45,
})

export interface Pocket {
  start: LocalTime
  end: LocalTime
  minutes: number
  /** Tentative commitments inside this gap: it may be smaller than it looks (DEC-018). */
  cautions: CalendarItem[]
}

export type FreePockets =
  /** No known timed commitment on this date: we cannot say anything about free time. */
  | { kind: 'noData' }
  /** Commitments exist, but nothing qualifying remains. */
  | { kind: 'none' }
  | { kind: 'gaps'; pockets: Pocket[] }

/**
 * Gaps between *known timed* commitments inside the planning window. Confirmed/unknown-verification
 * blocking items (classes, bookings, focus blocks, user events marked as busy) occupy time;
 * tentative ones add a caution instead. Date-only deadlines, birthdays, holidays, tasks and the
 * dining overlay never occupy time (C-T14). Absence of data is not "free": callers must say
 * "Open in your recorded schedule", never "You are free".
 */
export function computeFreePockets(
  dayItems: readonly CalendarItem[],
  prefs: PlanningPrefs = defaultPlanningPrefs(),
): FreePockets {
  const commitments = dayItems.filter(isTimed).filter((i) => i.blocksTime && !isCancelled(i))
  if (commitments.length === 0) return { kind: 'noData' }

  const winStart = timeToMinutes(prefs.windowStart)
  const winEnd = timeToMinutes(prefs.windowEnd)
  const range = (
    i: CalendarItem & { time: { kind: 'timed'; start: LocalTime; end: LocalTime } },
  ) => ({
    start: Math.max(winStart, timeToMinutes(i.time.start)),
    end: Math.min(winEnd, timeToMinutes(i.time.end)),
  })

  const tentative = commitments.filter((i) => i.verification === 'tentative')
  const busy = commitments
    .filter((i) => i.verification !== 'tentative')
    .map(range)
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start)

  // Merge intersecting AND adjacent intervals.
  const merged: { start: number; end: number }[] = []
  for (const r of busy) {
    const last = merged[merged.length - 1]
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end)
    else merged.push({ ...r })
  }

  const gaps: { start: number; end: number }[] = []
  let cursor = winStart
  for (const m of merged) {
    if (m.start > cursor) gaps.push({ start: cursor, end: m.start })
    cursor = Math.max(cursor, m.end)
  }
  if (cursor < winEnd) gaps.push({ start: cursor, end: winEnd })

  const pockets: Pocket[] = gaps
    .filter((g) => g.end - g.start >= prefs.minimumMinutes)
    .map((g) => ({
      start: minutesToTime(g.start),
      end: minutesToTime(g.end),
      minutes: g.end - g.start,
      cautions: tentative.filter((t) => {
        const r = range(t as never)
        return r.end > r.start && Math.max(g.start, r.start) < Math.min(g.end, r.end)
      }),
    }))

  return pockets.length ? { kind: 'gaps', pockets } : { kind: 'none' }
}
