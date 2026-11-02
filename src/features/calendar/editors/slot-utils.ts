import { useMemo, useState } from 'react'
import {
  minutesToTime,
  timeToMinutes,
  isLocalTime,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { conflictsForSlot } from '@/selectors/conflicts'
import { computeFreePockets, type PlanningPrefs } from '@/selectors/free-pockets'
import type { CalendarItem } from '@/selectors/items'

export const addMinutes = (start: LocalTime, minutes: number): LocalTime | undefined => {
  const total = timeToMinutes(start) + minutes
  return total < 24 * 60 ? minutesToTime(total) : undefined
}

export const durationOf = (start: string, end: string): number | undefined =>
  isLocalTime(start) && isLocalTime(end) && timeToMinutes(end) > timeToMinutes(start)
    ? timeToMinutes(end) - timeToMinutes(start)
    : undefined

/**
 * Overlap warning + candidate-gap finder for a prospective timed slot. It only reports and suggests:
 * it never moves, hides or reschedules anything (C-D12). "Save anyway" is always the user's choice.
 */
export function useSlotTools(args: {
  date: string
  start: string
  end: string
  getItemsOn: (date: DateOnly) => CalendarItem[]
  planning: PlanningPrefs
  ignoreRecordId?: string
  busy: boolean
}) {
  const { date, start, end, getItemsOn, planning, ignoreRecordId, busy } = args
  const [acknowledged, setAcknowledged] = useState(false)
  const [showGaps, setShowGaps] = useState(false)

  const valid = isLocalTime(start) && isLocalTime(end) && timeToMinutes(end) > timeToMinutes(start)
  const dayItems = useMemo(() => (date ? getItemsOn(date as DateOnly) : []), [date, getItemsOn])
  const conflicts = useMemo(
    () => (busy && valid ? conflictsForSlot(dayItems, { date, start, end }, ignoreRecordId) : []),
    [busy, valid, dayItems, date, start, end, ignoreRecordId],
  )
  const duration = durationOf(start, end) ?? 60
  const gaps = useMemo(() => {
    const result = computeFreePockets(dayItems, {
      ...planning,
      minimumMinutes: Math.max(15, Math.min(180, duration)),
    })
    return result.kind === 'gaps' ? result.pockets : []
  }, [dayItems, planning, duration])

  return { conflicts, gaps, duration, acknowledged, setAcknowledged, showGaps, setShowGaps }
}
