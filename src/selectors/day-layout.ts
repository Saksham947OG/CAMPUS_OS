import { timeToMinutes } from '@/lib/time'
import { isTimed, type CalendarItem } from './items'

export interface Positioned {
  item: CalendarItem
  startMin: number
  endMin: number
  /** 0-based column within its overlap cluster and the cluster's column count. */
  column: number
  columns: number
}

/** Lane = everything that is not on the hourly grid; timed = everything that is. */
export function splitDay(items: readonly CalendarItem[]) {
  return { lane: items.filter((i) => !isTimed(i)), timed: items.filter(isTimed) }
}

/**
 * Places timed items side by side when they overlap (greedy column packing per cluster), using real
 * start/end minutes. Cancelled items stay in the layout so nothing "jumps" when status changes.
 */
export function layoutTimed(items: readonly CalendarItem[]): Positioned[] {
  const entries = items
    .filter(isTimed)
    .map((item) => ({
      item,
      startMin: timeToMinutes(item.time.start),
      endMin: timeToMinutes(item.time.end),
    }))
    .sort(
      (a, b) =>
        a.startMin - b.startMin || a.endMin - b.endMin || a.item.key.localeCompare(b.item.key),
    )

  const out: Positioned[] = []
  let cluster: Positioned[] = []
  let clusterEnd = -1
  let columnEnds: number[] = []

  const flush = () => {
    const columns = columnEnds.length || 1
    for (const p of cluster) p.columns = columns
    out.push(...cluster)
    cluster = []
    columnEnds = []
    clusterEnd = -1
  }

  for (const e of entries) {
    if (cluster.length && e.startMin >= clusterEnd) flush()
    let column = columnEnds.findIndex((end) => end <= e.startMin)
    if (column === -1) {
      column = columnEnds.length
      columnEnds.push(e.endMin)
    } else {
      columnEnds[column] = e.endMin
    }
    cluster.push({ ...e, column, columns: 1 })
    clusterEnd = Math.max(clusterEnd, e.endMin)
  }
  if (cluster.length) flush()
  return out
}
