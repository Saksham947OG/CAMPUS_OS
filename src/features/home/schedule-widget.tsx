import { CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Filter } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import { Button } from '@/components/ui/button'
import { EVENT_CATEGORIES } from '@/domain/records'
import {
  addDays,
  dayOfMonth,
  formatDateLong,
  formatRangeLabel,
  formatWeekday,
  weekDates,
  type DateOnly,
} from '@/lib/time'
import { cn } from '@/lib/utils'
import { splitDay } from '@/selectors/day-layout'
import { itemsInRange } from '@/selectors/occurrences'
import { calendarLink } from '../calendar/calendar-url'
import { EmptyNote, HomeCard } from './home-card'
import { filterHomeItems, type HomeCtx } from './home-context'
import { HomeItemRow } from './home-item-row'
import { ScheduleFilterSheet } from './schedule-filter-sheet'

const AGENDA_LIMIT = 5

/**
 * H-W01: Agenda / Week in one card. Both modes read the same canonical items and the same filters;
 * switching preserves the selected date and filters. The full timetable lives at /calendar.
 */
export function ScheduleWidget({ ctx }: { ctx: HomeCtx }) {
  const { data, now, prefs, updatePrefs } = ctx
  const mode = prefs.scheduleView
  const [selected, setSelected] = useState<DateOnly | null>(null) // null = follow "today"
  const [expanded, setExpanded] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const date = selected ?? now.today
  const week = useMemo(() => weekDates(date), [date])
  const from = mode === 'week' ? week[0]! : date
  const to = mode === 'week' ? week[6]! : date

  const all = useMemo(() => itemsInRange(data, from, to), [data, from, to])
  const visible = useMemo(() => filterHomeItems(all, prefs), [all, prefs])
  const dayItems = visible.filter((i) => i.date === date)
  const dayAllCount = all.filter((i) => i.date === date).length

  const filtersActive =
    prefs.filters.categories.length !== EVENT_CATEGORIES.length ||
    prefs.filters.courseIds.length > 0 ||
    prefs.filters.verification !== 'all' ||
    prefs.filters.origin !== 'all' ||
    !prefs.filters.showCompleted

  const step = (dir: 1 | -1) => {
    setSelected(addDays(date, (mode === 'week' ? 7 : 1) * dir))
    setExpanded(false)
  }

  const { lane, timed } = splitDay(dayItems)
  const ordered = [...lane, ...timed]
  const shown = mode === 'agenda' && !expanded ? ordered.slice(0, AGENDA_LIMIT) : ordered
  const label = mode === 'week' ? formatRangeLabel(week[0]!, week[6]!) : formatDateLong(date)

  return (
    <HomeCard
      id="schedule"
      title="Your schedule"
      icon={<CalendarDays className="size-4 text-teal-strong" aria-hidden="true" />}
      action={
        <Button asChild variant="ghost" size="sm" className="min-h-11 gap-1.5">
          <Link to={calendarLink({ view: mode === 'week' ? 'week' : 'day', date })}>
            Open Calendar
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="inline-flex rounded-md border border-border-strong bg-surface p-0.5">
          <legend className="sr-only">Schedule mode</legend>
          {(['agenda', 'week'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => updatePrefs((p) => ({ ...p, scheduleView: m }))}
              className={cn(
                'min-h-10 rounded-sm px-3 text-sm font-medium',
                mode === m ? 'bg-teal text-surface' : 'text-ink hover:bg-mist',
              )}
            >
              {m === 'agenda' ? 'Agenda' : 'Week'}
            </button>
          ))}
        </fieldset>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => step(-1)}
            aria-label={mode === 'week' ? 'Previous week' : 'Previous day'}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setSelected(null)
              setExpanded(false)
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={() => step(1)}
            aria-label={mode === 'week' ? 'Next week' : 'Next day'}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <Button
          variant="outline"
          className="ml-auto min-h-11 gap-2"
          onClick={() => setFiltersOpen(true)}
        >
          <Filter aria-hidden="true" />
          Filter{filtersActive ? ' (active)' : ''}
        </Button>
      </div>

      <p className="mt-3 text-sm font-semibold text-ink" aria-live="polite">
        {label}
        {date === now.today && mode === 'agenda' ? (
          <span className="ml-2 rounded-full bg-teal px-2 py-0.5 text-xs text-surface">Today</span>
        ) : null}
      </p>

      {mode === 'week' ? (
        <fieldset className="mt-2 grid grid-cols-7 gap-1">
          <legend className="sr-only">Days of the week</legend>
          {week.map((d) => {
            const items = visible.filter((i) => i.date === d)
            const categories = [...new Set(items.map((i) => i.category))]
            return (
              <button
                key={d}
                type="button"
                onClick={() => {
                  setSelected(d)
                  setExpanded(false)
                }}
                aria-pressed={d === date}
                aria-label={`${formatDateLong(d)}. ${items.length} ${items.length === 1 ? 'item' : 'items'}${d === now.today ? '. Today' : ''}`}
                className={cn(
                  'flex min-h-20 flex-col items-center gap-0.5 rounded-md border border-border bg-surface p-1 text-xs',
                  d === date && 'border-teal bg-teal-tint ring-2 ring-teal',
                )}
              >
                <span className="text-ink-muted">{formatWeekday(d)}</span>
                <span
                  className={cn(
                    'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold text-ink',
                    d === now.today && 'bg-teal text-surface',
                  )}
                >
                  {dayOfMonth(d)}
                </span>
                <span className="text-[10px] text-ink-muted">
                  {items.length ? items.length : '—'}
                </span>
                <span className="flex flex-wrap justify-center gap-0.5" aria-hidden="true">
                  {categories.slice(0, 3).map((c) => (
                    <CategoryIcon key={c} category={c} className="size-3" />
                  ))}
                </span>
              </button>
            )
          })}
        </fieldset>
      ) : null}

      <div className="mt-3">
        {ordered.length === 0 ? (
          <EmptyNote>
            {dayAllCount === 0
              ? 'Nothing scheduled in the available records for this date.'
              : 'No events match these filters. The records still exist.'}
          </EmptyNote>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {shown.map((item) => (
              <li key={item.key}>
                <HomeItemRow item={item} />
              </li>
            ))}
          </ul>
        )}
        {mode === 'agenda' && ordered.length > AGENDA_LIMIT ? (
          <Button
            variant="ghost"
            className="mt-2 min-h-11"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
          >
            {expanded ? 'Show fewer' : `Show all ${ordered.length}`}
          </Button>
        ) : null}
        {all.length > visible.length ? (
          <p className="mt-2 text-xs text-ink-muted">
            {all.length - visible.length} item(s) hidden by your schedule filters.
          </p>
        ) : null}
      </div>

      <ScheduleFilterSheet
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        prefs={prefs}
        courses={data.courses}
        resultCount={visible.length}
        onChange={updatePrefs}
      />
    </HomeCard>
  )
}
