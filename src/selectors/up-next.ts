import { timeToMinutes } from '@/lib/time'
import { isCancelled, isTimed, type CalendarItem } from './items'
import type { Now } from './now'

export interface UpNextResult {
  item: CalendarItem
  /** `ongoing` only when both explicit start and end exist and now is inside them. */
  state: 'ongoing' | 'upcoming'
}

/**
 * Today's timed, non-cancelled items: ongoing first, then the earliest future start (stable-id tie
 * break). An item with no end is never assumed to still be running after its start (COS-HOME-001 §5.3).
 */
export function upNext(todayItems: readonly CalendarItem[], now: Now): UpNextResult[] {
  const entries: UpNextResult[] = []
  for (const item of todayItems) {
    if (!isTimed(item) || isCancelled(item) || item.date !== now.today) continue
    const start = timeToMinutes(item.time.start)
    const end = timeToMinutes(item.time.end)
    if (start <= now.minutes && now.minutes < end) entries.push({ item, state: 'ongoing' })
    else if (start > now.minutes) entries.push({ item, state: 'upcoming' })
  }
  return entries.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'ongoing' ? -1 : 1
    const at = a.item.time.kind === 'timed' ? a.item.time.start : ''
    const bt = b.item.time.kind === 'timed' ? b.item.time.start : ''
    if (at !== bt) return at < bt ? -1 : 1
    return a.item.recordId < b.item.recordId ? -1 : 1
  })
}
