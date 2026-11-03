import { CircleHelp, FlaskConical, MoveRight, TriangleAlert } from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { categoryColorVar } from '@/domain/categories'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/selectors/items'
import { describeItem, itemShortTime } from './describe'
import { useFlag } from './bottleneck-flags'
import { FlagBadge } from './flag-badge'

interface ChipProps {
  item: CalendarItem
  selected?: boolean
  conflict?: boolean
  onSelect: (item: CalendarItem) => void
  /** Show the time next to the title (omit in very dense cells). */
  showTime?: boolean
  className?: string
}

/** Compact, keyboard-operable item button used in the month grid, all-day lane and lists. */
export function ItemChip({
  item,
  selected,
  conflict,
  onSelect,
  showTime = true,
  className,
}: ChipProps) {
  const flag = useFlag(item.key)
  const time = showTime ? itemShortTime(item) : null
  const cancelled = item.status === 'cancelled'
  const done = item.taskState === 'personallyCompleted'
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item)
      }}
      aria-label={describeItem(
        item,
        [conflict ? 'overlaps another commitment' : '', flag?.summary ?? '']
          .filter(Boolean)
          .join('. ') || undefined,
      )}
      aria-pressed={selected}
      style={{ borderLeftColor: `var(${categoryColorVar[item.category]})` }}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-sm border border-l-4 border-border bg-surface px-1.5 py-1 text-left text-xs text-ink',
        'hover:bg-mist focus-visible:z-10',
        selected && 'bg-teal-tint ring-2 ring-teal',
        (cancelled || done) && 'text-ink-muted',
        className,
      )}
    >
      <CategoryIcon category={item.category} className="size-3.5" />
      <span className={cn('min-w-0 flex-1 truncate', (cancelled || done) && 'line-through')}>
        {time ? <span className="mr-1 font-medium">{time}</span> : null}
        {item.title}
      </span>
      {cancelled ? (
        <span className="shrink-0 text-[10px] font-semibold uppercase">Cancelled</span>
      ) : null}
      {flag ? <FlagBadge flag={flag} /> : null}
      {item.status === 'rescheduled' ? (
        <MoveRight className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      {item.verification === 'tentative' ? (
        <CircleHelp className="size-3 shrink-0" aria-hidden="true" />
      ) : null}
      {conflict ? (
        <TriangleAlert className="size-3 shrink-0 text-warning" aria-hidden="true" />
      ) : null}
      {item.provenance.dataMode === 'demoSeed' ? (
        <FlaskConical className="size-3 shrink-0 text-ink-muted" aria-hidden="true" />
      ) : null}
    </button>
  )
}
