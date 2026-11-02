import { categoryLabel } from '@/domain/categories'
import type { RecurrenceRule } from '@/domain/records'
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatTime,
  formatTimeRange,
  formatWeekday,
  isoWeekday,
  type DateOnly,
} from '@/lib/time'
import type { CalendarItem } from '@/selectors/items'

/** Human wording for how an item occupies time. Unknown stays unknown; date-only never shows a clock time. */
export function itemTimeText(item: CalendarItem): string {
  switch (item.time.kind) {
    case 'timed':
      return formatTimeRange(item.time.start, item.time.end)
    case 'allDay':
      return 'All day'
    case 'unknownTime':
      return 'Time not provided'
    case 'deadline':
      return item.time.dueTime
        ? `Due ${formatTime(item.time.dueTime)}`
        : 'Due date only (no time given)'
  }
}

/** Short time for dense layouts. */
export function itemShortTime(item: CalendarItem): string | null {
  if (item.time.kind === 'timed') return formatTime(item.time.start)
  if (item.time.kind === 'deadline' && item.time.dueTime)
    return `Due ${formatTime(item.time.dueTime)}`
  return null
}

export function itemFlags(item: CalendarItem): string[] {
  const flags: string[] = []
  if (item.status === 'cancelled') flags.push('cancelled')
  if (item.status === 'rescheduled') flags.push('rescheduled')
  if (item.verification === 'tentative') flags.push('tentative')
  if (item.taskState === 'personallyCompleted') flags.push('personally completed')
  if (item.provenance.dataMode === 'demoSeed') flags.push('sample data')
  return flags
}

/** Full screen-reader description of an item (category, title, time, date, state). */
export function describeItem(item: CalendarItem, extra?: string): string {
  const flags = itemFlags(item)
  return [
    `${categoryLabel[item.category]}: ${item.title}`,
    itemTimeText(item),
    formatDateLong(item.date),
    flags.length ? flags.join(', ') : null,
    extra ?? null,
  ]
    .filter(Boolean)
    .join('. ')
}

const WEEKDAY_REF = '2024-01-01' as DateOnly // a Monday

export function describeRule(rule: RecurrenceRule): string {
  const every = rule.interval === 1 ? '' : `every ${rule.interval} `
  const until = `until ${formatDateShort(rule.endDate)}`
  switch (rule.freq) {
    case 'daily':
      return `Repeats ${rule.interval === 1 ? 'daily' : `every ${rule.interval} days`} ${until}`
    case 'weekly': {
      const days = (rule.weekdays ?? [isoWeekday(rule.startDate)])
        .slice()
        .sort()
        .map((n) => formatWeekday(addDays(WEEKDAY_REF, n - 1)))
        .join(', ')
      return `Repeats ${rule.interval === 1 ? 'weekly' : `every ${rule.interval} weeks`} on ${days} ${until}`
    }
    case 'monthly':
      return `Repeats ${every}${rule.interval === 1 ? 'monthly' : 'months'} ${until}`
    case 'yearly':
      return `Repeats ${rule.interval === 1 ? 'yearly' : `every ${rule.interval} years`} ${until}`
  }
}
