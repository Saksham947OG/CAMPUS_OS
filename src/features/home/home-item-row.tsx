import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import { categoryLabel } from '@/domain/categories'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/selectors/items'
import { calendarLink } from '../calendar/calendar-url'
import { describeItem, itemFlags, itemTimeText } from '../calendar/describe'

/** One schedule item as a link to its canonical Calendar details (H-A05). */
export function HomeItemRow({ item, view = 'day' }: { item: CalendarItem; view?: 'day' | 'week' }) {
  const flags = itemFlags(item)
  const cancelled = item.status === 'cancelled'
  return (
    <Link
      to={calendarLink({ view, date: item.date, event: item.key, panel: 'details' })}
      aria-label={describeItem(item)}
      className={cn(
        'grid grid-cols-[5.5rem_1fr] gap-3 rounded-md border border-border bg-surface px-3 py-2 hover:bg-mist sm:grid-cols-[7rem_1fr]',
        cancelled && 'text-ink-muted',
      )}
    >
      <span className="text-sm font-medium text-ink">{itemTimeText(item)}</span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <CategoryIcon category={item.category} />
          <span
            className={cn('truncate text-sm font-medium text-ink', cancelled && 'line-through')}
          >
            {item.title}
          </span>
        </span>
        <span className="mt-0.5 block text-xs text-ink-muted">
          {categoryLabel[item.category]}
          {item.location ? ` · ${item.location}` : ''}
          {flags.length ? ` · ${flags.join(', ')}` : ''}
        </span>
      </span>
    </Link>
  )
}
