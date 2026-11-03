import { CategoryIcon } from '@/components/category-icon'
import { categoryLabel } from '@/domain/categories'
import { dateRange, formatDateLong, type DateOnly } from '@/lib/time'
import { cn } from '@/lib/utils'
import { splitDay } from '@/selectors/day-layout'
import type { CalendarItem } from '@/selectors/items'
import { describeItem, itemFlags, itemTimeText } from '../describe'
import { useFlag } from '../bottleneck-flags'
import { FlagBadge } from '../flag-badge'

interface RowProps {
  item: CalendarItem
  selected: boolean
  conflict: boolean
  onSelect: (i: CalendarItem) => void
}

function AgendaRow({ item, selected, conflict, onSelect }: RowProps) {
  const flags = itemFlags(item)
  const queue = useFlag(item.key)
  const cancelled = item.status === 'cancelled'
  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-label={describeItem(
        item,
        [conflict ? 'overlaps another commitment' : '', queue?.summary ?? '']
          .filter(Boolean)
          .join('. ') || undefined,
      )}
      aria-pressed={selected}
      className={cn(
        'grid w-full grid-cols-[6.5rem_1fr] gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left hover:bg-mist',
        selected && 'bg-teal-tint ring-2 ring-teal',
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
          {conflict ? ' · overlaps another commitment' : ''}
        </span>
        {queue ? <FlagBadge flag={queue} withText className="mt-0.5" /> : null}
      </span>
    </button>
  )
}

interface Props {
  from: DateOnly
  to: DateOnly
  today: DateOnly
  selectedKey?: string
  itemsByDate: ReadonlyMap<DateOnly, CalendarItem[]>
  conflictKeys: ReadonlySet<string>
  onSelectItem: (i: CalendarItem) => void
  /** Why there is nothing to show, when known (drives the right empty-state wording). */
  emptyMessage: string
  onClearFilters?: () => void
}

/** Chronological list grouped by date; each date lists all-day/due items first, then timed items by start. */
export function AgendaView({
  from,
  to,
  today,
  selectedKey,
  itemsByDate,
  conflictKeys,
  onSelectItem,
  emptyMessage,
  onClearFilters,
}: Props) {
  const days = dateRange(from, to).filter((d) => (itemsByDate.get(d)?.length ?? 0) > 0)
  if (days.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-strong bg-surface p-8 text-center">
        <p className="text-sm text-ink">{emptyMessage}</p>
        {onClearFilters ? (
          <button
            type="button"
            onClick={onClearFilters}
            className="mt-3 min-h-11 rounded-md border border-border-strong px-4 text-sm font-medium text-ink hover:bg-mist"
          >
            Clear all filters
          </button>
        ) : null}
      </div>
    )
  }
  return (
    <ol className="flex flex-col gap-5">
      {days.map((d) => {
        const { lane, timed } = splitDay(itemsByDate.get(d) ?? [])
        return (
          <li key={d}>
            <h3 className="sticky top-16 z-10 mb-2 border-b border-border bg-canvas py-1.5 text-sm font-semibold text-ink">
              {formatDateLong(d)}
              {d === today ? (
                <span className="ml-2 rounded-full bg-teal px-2 py-0.5 text-xs font-semibold text-surface">
                  Today
                </span>
              ) : null}
            </h3>
            <ul className="flex flex-col gap-1.5">
              {[...lane, ...timed].map((item) => (
                <li key={item.key}>
                  <AgendaRow
                    item={item}
                    selected={item.key === selectedKey}
                    conflict={conflictKeys.has(item.key)}
                    onSelect={onSelectItem}
                  />
                </li>
              ))}
            </ul>
          </li>
        )
      })}
    </ol>
  )
}

/** The selected day's items as a simple list (mobile Month / Week fallback and Day Context). */
export function DayItemList({
  date,
  items,
  selectedKey,
  conflictKeys,
  onSelectItem,
  emptyMessage,
}: {
  date: DateOnly
  items: CalendarItem[]
  selectedKey?: string
  conflictKeys: ReadonlySet<string>
  onSelectItem: (i: CalendarItem) => void
  emptyMessage: string
}) {
  const { lane, timed } = splitDay(items)
  return (
    <section aria-label={`Items on ${formatDateLong(date)}`}>
      <h3 className="mb-2 text-sm font-semibold text-ink">{formatDateLong(date)}</h3>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {[...lane, ...timed].map((item) => (
            <li key={item.key}>
              <AgendaRow
                item={item}
                selected={item.key === selectedKey}
                conflict={conflictKeys.has(item.key)}
                onSelect={onSelectItem}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
