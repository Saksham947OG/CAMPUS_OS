import { CircleHelp, TriangleAlert } from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { categoryColorVar } from '@/domain/categories'
import { mealLabel } from '@/selectors/mess'
import {
  dayOfMonth,
  formatDateLong,
  formatTime,
  formatWeekday,
  minutesToTime,
  timeToMinutes,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import { layoutTimed, splitDay } from '@/selectors/day-layout'
import type { CalendarItem } from '@/selectors/items'
import { describeItem, itemTimeText } from '../describe'
import { ItemChip } from '../item-chip'
import type { Meal } from '@/domain/records'

export const HOUR_PX = 56

export interface DiningBand {
  meal: Meal
  start: LocalTime
  end: LocalTime
}

interface Props {
  dates: readonly DateOnly[]
  today: DateOnly
  nowMinutes: number
  selectedDate: DateOnly
  selectedKey?: string
  itemsByDate: ReadonlyMap<DateOnly, CalendarItem[]>
  conflictKeys: ReadonlySet<string>
  hourStart: number
  hourEnd: number
  dining?: ReadonlyMap<DateOnly, DiningBand[]>
  label: string
  onSelectDate: (d: DateOnly) => void
  onSelectItem: (i: CalendarItem) => void
  /** Click/tap on empty grid space: date + start time only; end stays unconfirmed (COS-CAL-001 §3.3). */
  onCreateAt?: (date: DateOnly, start: LocalTime) => void
}

/**
 * Hourly timeline for Week (7 columns) and Day (1). Items are positioned by their real start/end,
 * overlapping commitments sit side by side, and the deadline / all-day lane above the grid keeps
 * date-only records off the busy timeline. Dining bands are informational and aria-hidden: the same
 * facts live in Day Context.
 */
export function TimeGridView({
  dates,
  today,
  nowMinutes,
  selectedDate,
  selectedKey,
  itemsByDate,
  conflictKeys,
  hourStart,
  hourEnd,
  dining,
  label,
  onSelectDate,
  onSelectItem,
  onCreateAt,
}: Props) {
  const hours = Array.from({ length: hourEnd - hourStart }, (_, i) => hourStart + i)
  const height = hours.length * HOUR_PX
  const cols = `3.5rem repeat(${dates.length}, minmax(${dates.length > 1 ? '5rem' : '12rem'}, 1fr))`
  const topOf = (min: number) => ((min - hourStart * 60) / 60) * HOUR_PX

  const outside = dates.reduce((n, d) => {
    const { timed } = splitDay(itemsByDate.get(d) ?? [])
    return (
      n +
      timed.filter((i) => {
        if (i.time.kind !== 'timed') return false
        return (
          timeToMinutes(i.time.end) <= hourStart * 60 || timeToMinutes(i.time.start) >= hourEnd * 60
        )
      }).length
    )
  }, 0)

  return (
    <section className="rounded-lg border border-border bg-surface" aria-label={label}>
      <div className="overflow-x-auto">
        <div style={{ minWidth: dates.length > 1 ? '38rem' : '18rem' }}>
          {/* Day headers */}
          <div
            className="grid border-b border-border bg-mist"
            style={{ gridTemplateColumns: cols }}
          >
            <div />
            {dates.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDate(d)}
                aria-label={`${formatDateLong(d)}${d === today ? '. Today' : ''}`}
                aria-pressed={d === selectedDate}
                className={cn(
                  'flex flex-col items-center gap-0.5 border-l border-border py-2 text-xs',
                  d === selectedDate && 'bg-teal-tint',
                )}
              >
                <span className="font-medium text-ink-muted">{formatWeekday(d)}</span>
                <span
                  className={cn(
                    'inline-flex size-8 items-center justify-center rounded-full text-base font-semibold text-ink',
                    d === today && 'bg-teal text-surface',
                  )}
                >
                  {dayOfMonth(d)}
                </span>
                {d === today ? (
                  <span className="text-[10px] font-semibold text-teal-strong">Today</span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Deadline / all-day lane: never occupies hourly free/busy space */}
          <div className="grid border-b border-border" style={{ gridTemplateColumns: cols }}>
            <div className="flex items-center justify-end px-1 py-2 text-[10px] font-medium leading-tight text-ink-muted">
              All day &amp; due
            </div>
            {dates.map((d) => {
              const { lane } = splitDay(itemsByDate.get(d) ?? [])
              return (
                <ul
                  key={d}
                  aria-label={`All-day and due items, ${formatDateLong(d)}`}
                  className="flex min-h-10 flex-col gap-0.5 border-l border-border p-1"
                >
                  {lane.map((item) => (
                    <li key={item.key}>
                      <ItemChip
                        item={item}
                        selected={item.key === selectedKey}
                        conflict={conflictKeys.has(item.key)}
                        onSelect={onSelectItem}
                      />
                    </li>
                  ))}
                </ul>
              )
            })}
          </div>

          {/* Hourly grid */}
          <div className="max-h-[65vh] overflow-y-auto">
            <div className="relative grid" style={{ gridTemplateColumns: cols, height }}>
              <div className="relative">
                {hours.map((h) => (
                  <span
                    key={h}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-ink-muted"
                    style={{ top: (h - hourStart) * HOUR_PX + (h === hourStart ? 8 : 0) }}
                  >
                    {formatTime(minutesToTime(h * 60))}
                  </span>
                ))}
              </div>

              {dates.map((d) => {
                const { timed } = splitDay(itemsByDate.get(d) ?? [])
                const positioned = layoutTimed(timed).filter(
                  (p) => p.endMin > hourStart * 60 && p.startMin < hourEnd * 60,
                )
                const bands = dining?.get(d) ?? []
                return (
                  // Pointer convenience only; the keyboard/touch route to create is the + Add button.
                  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
                  <div
                    key={d}
                    className="relative border-l border-border"
                    style={{
                      backgroundImage:
                        'repeating-linear-gradient(to bottom, transparent 0, transparent 55px, var(--border) 55px, var(--border) 56px)',
                    }}
                    onClick={(e) => {
                      if (!onCreateAt || e.target !== e.currentTarget) return
                      const rect = e.currentTarget.getBoundingClientRect()
                      const minutes =
                        hourStart * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 2) * 30
                      onCreateAt(d, minutesToTime(minutes))
                    }}
                  >
                    {bands.map((b) => (
                      <div
                        key={b.meal}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 border-y border-dashed border-border-strong bg-mist/70"
                        style={{
                          top: Math.max(0, topOf(timeToMinutes(b.start))),
                          height: Math.max(
                            0,
                            topOf(timeToMinutes(b.end)) -
                              Math.max(0, topOf(timeToMinutes(b.start))),
                          ),
                        }}
                      >
                        <span className="px-1 text-[10px] text-ink-muted">
                          {mealLabel[b.meal]} (sample serving window)
                        </span>
                      </div>
                    ))}

                    {d === today && nowMinutes >= hourStart * 60 && nowMinutes <= hourEnd * 60 ? (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-danger"
                        style={{ top: topOf(nowMinutes) }}
                      >
                        <span className="absolute -top-2.5 left-0 rounded-r bg-danger px-1 text-[10px] font-semibold text-surface">
                          Now
                        </span>
                      </div>
                    ) : null}

                    {positioned.map((p) => {
                      const { item } = p
                      const top = Math.max(0, topOf(p.startMin))
                      const bottom = Math.min(height, topOf(p.endMin))
                      const h = Math.max(22, bottom - top - 1)
                      const cancelled = item.status === 'cancelled'
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectItem(item)
                          }}
                          aria-label={describeItem(
                            item,
                            conflictKeys.has(item.key) ? 'overlaps another commitment' : undefined,
                          )}
                          aria-pressed={item.key === selectedKey}
                          style={{
                            top,
                            height: h,
                            left: `calc(${(p.column / p.columns) * 100}% + 1px)`,
                            width: `calc(${100 / p.columns}% - 3px)`,
                            borderLeftColor: `var(${categoryColorVar[item.category]})`,
                          }}
                          className={cn(
                            'absolute z-[1] flex flex-col overflow-hidden rounded-sm border border-l-4 border-border bg-surface px-1.5 py-0.5 text-left text-xs text-ink shadow-card hover:bg-mist',
                            item.key === selectedKey && 'bg-teal-tint ring-2 ring-teal',
                            cancelled && 'bg-canvas text-ink-muted opacity-80',
                          )}
                        >
                          <span className="flex items-center gap-1">
                            <CategoryIcon category={item.category} className="size-3.5" />
                            <span
                              className={cn('truncate font-medium', cancelled && 'line-through')}
                            >
                              {item.title}
                            </span>
                            {item.verification === 'tentative' ? (
                              <CircleHelp className="size-3 shrink-0" aria-hidden="true" />
                            ) : null}
                            {conflictKeys.has(item.key) ? (
                              <TriangleAlert
                                className="size-3 shrink-0 text-warning"
                                aria-hidden="true"
                              />
                            ) : null}
                          </span>
                          {h > 36 ? (
                            <span className="truncate text-[11px] text-ink-muted">
                              {cancelled
                                ? 'Cancelled · '
                                : item.status === 'rescheduled'
                                  ? 'Moved · '
                                  : ''}
                              {itemTimeText(item)}
                            </span>
                          ) : null}
                          {h > 56 && item.location ? (
                            <span className="truncate text-[11px] text-ink-muted">
                              {item.location}
                            </span>
                          ) : null}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {outside > 0 ? (
        <p className="border-t border-border px-3 py-2 text-xs text-ink-muted">
          {outside} timed {outside === 1 ? 'item is' : 'items are'} outside the visible hours (
          {formatTime(minutesToTime(hourStart * 60))}–
          {formatTime(minutesToTime(Math.min(hourEnd, 24) * 60 - (hourEnd === 24 ? 1 : 0)))}).
          Change the visible hours in Layers &amp; filters.
        </p>
      ) : null}
    </section>
  )
}
