import { useMediaQuery } from '@/hooks/use-media-query'
import {
  dayOfMonth,
  formatDateLong,
  formatWeekday,
  isSameMonth,
  monthGrid,
  weekDates,
  type DateOnly,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/selectors/items'
import { ItemChip } from '../item-chip'

interface Props {
  anchor: DateOnly
  today: DateOnly
  selectedDate: DateOnly
  selectedKey?: string
  itemsByDate: ReadonlyMap<DateOnly, CalendarItem[]>
  conflictKeys: ReadonlySet<string>
  onSelectDate: (d: DateOnly) => void
  onSelectItem: (i: CalendarItem) => void
  /** "+N more": select the day and open its full list (Day Context). */
  onShowDay: (d: DateOnly) => void
}

/**
 * Month grid, Monday–Sunday. Chips are shown on wide screens (max 3, then "+N more"); on narrow
 * screens a cell shows only the day number and a count, and the selected day's full list sits
 * below the grid, so no information is dropped and nothing forces horizontal page scroll.
 */
export function MonthView({
  anchor,
  today,
  selectedDate,
  selectedKey,
  itemsByDate,
  conflictKeys,
  onSelectDate,
  onSelectItem,
  onShowDay,
}: Props) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const limit = wide ? 3 : 2
  const weeks = monthGrid(anchor)
  const header = weekDates(weeks[0]![0]!)

  return (
    <table
      className="w-full table-fixed border-collapse overflow-hidden rounded-lg border border-border bg-surface"
      aria-label={`Month of ${anchor.slice(0, 7)}`}
    >
      <thead>
        <tr>
          {header.map((d) => (
            <th
              key={d}
              scope="col"
              className="border-b border-border bg-mist px-1 py-2 text-center text-xs font-semibold text-ink"
            >
              {formatWeekday(d, 'short')}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week) => (
          <tr key={week[0]}>
            {week.map((date) => {
              const items = itemsByDate.get(date) ?? []
              const inMonth = isSameMonth(date, anchor)
              const isToday = date === today
              const isSelected = date === selectedDate
              const shown =
                wide || items.length <= limit ? items.slice(0, limit) : items.slice(0, limit)
              const extra = items.length - shown.length
              return (
                <td
                  key={date}
                  className={cn(
                    'h-14 border-b border-r border-border align-top last:border-r-0 md:h-auto md:min-h-28',
                    !inMonth && 'bg-canvas',
                    isSelected && 'bg-teal-tint',
                  )}
                >
                  <div className="flex flex-col gap-1 p-1">
                    <button
                      type="button"
                      onClick={() => onSelectDate(date)}
                      aria-label={`${formatDateLong(date)}. ${items.length} ${items.length === 1 ? 'item' : 'items'}${isToday ? '. Today' : ''}`}
                      aria-pressed={isSelected}
                      className={cn(
                        'inline-flex min-h-8 min-w-8 items-center justify-center self-start rounded-full px-1 text-sm font-medium',
                        inMonth ? 'text-ink' : 'text-ink-muted',
                        isToday && 'bg-teal text-surface',
                        !isToday && 'hover:bg-mist',
                      )}
                    >
                      {dayOfMonth(date)}
                    </button>
                    {/* Narrow screens: a count instead of chips. */}
                    {items.length > 0 ? (
                      <span
                        className="text-center text-[11px] font-medium text-ink-muted md:hidden"
                        aria-hidden="true"
                      >
                        {items.length}
                      </span>
                    ) : null}
                    <ul className="hidden flex-col gap-0.5 md:flex">
                      {shown.map((item) => (
                        <li key={item.key}>
                          <ItemChip
                            item={item}
                            selected={item.key === selectedKey}
                            conflict={conflictKeys.has(item.key)}
                            onSelect={onSelectItem}
                            showTime={false}
                          />
                        </li>
                      ))}
                      {extra > 0 ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => onShowDay(date)}
                            className="w-full rounded-sm px-1.5 py-0.5 text-left text-xs font-medium text-teal-strong hover:bg-mist"
                          >
                            +{extra} more
                            <span className="sr-only"> on {formatDateLong(date)}</span>
                          </button>
                        </li>
                      ) : null}
                    </ul>
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
