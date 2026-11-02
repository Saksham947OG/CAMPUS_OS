import { overlapsMinutes, timeToMinutes } from '@/lib/time'
import { isCancelled, isTimed, type CalendarItem } from './items'

export interface Conflict {
  a: CalendarItem
  b: CalendarItem
  /**
   * `definite`: two known, non-tentative timed intervals overlap.
   * `possible`: they overlap but at least one is tentative, so the overlap itself is uncertain (C-T09).
   */
  certainty: 'definite' | 'possible'
}

const interval = (i: CalendarItem & { time: { kind: 'timed'; start: string; end: string } }) => ({
  start: timeToMinutes(i.time.start as never),
  end: timeToMinutes(i.time.end as never),
})

/**
 * Timed overlap warnings (COS-CAL-001 §11). Half-open intervals: end-at-start is not a conflict.
 * Cancelled items, untimed records and anything that does not block time are ignored. Nothing here
 * ever reschedules or hides anything — it only reports.
 */
export function findConflicts(items: readonly CalendarItem[]): Conflict[] {
  const timed = items.filter(isTimed).filter((i) => i.blocksTime && !isCancelled(i))
  const out: Conflict[] = []
  for (let x = 0; x < timed.length; x++) {
    for (let y = x + 1; y < timed.length; y++) {
      const a = timed[x]!
      const b = timed[y]!
      if (a.date !== b.date) continue
      if (!overlapsMinutes(interval(a), interval(b))) continue
      const tentative = a.verification === 'tentative' || b.verification === 'tentative'
      out.push({ a, b, certainty: tentative ? 'possible' : 'definite' })
    }
  }
  return out
}

/** Conflicts involving one specific item. */
export function conflictsFor(item: CalendarItem, dayItems: readonly CalendarItem[]): Conflict[] {
  return findConflicts(dayItems.filter((i) => i.date === item.date)).filter(
    (c) => c.a.key === item.key || c.b.key === item.key,
  )
}

/** Would a prospective personal timed slot overlap anything on that day? Used by the editor warning. */
export function conflictsForSlot(
  dayItems: readonly CalendarItem[],
  slot: { date: string; start: string; end: string },
  ignoreRecordId?: string,
): CalendarItem[] {
  const probe = { start: timeToMinutes(slot.start as never), end: timeToMinutes(slot.end as never) }
  return dayItems
    .filter(isTimed)
    .filter(
      (i) =>
        i.date === slot.date && i.blocksTime && !isCancelled(i) && i.recordId !== ignoreRecordId,
    )
    .filter((i) => overlapsMinutes(probe, interval(i)))
}
