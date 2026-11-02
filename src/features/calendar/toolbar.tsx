import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Filter, PanelRight, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { CALENDAR_VIEWS, type CalendarView } from '@/data/prefs/prefs'
import { cn } from '@/lib/utils'

const viewLabel: Record<CalendarView, string> = {
  month: 'Month',
  week: 'Week',
  day: 'Day',
  agenda: 'Agenda',
}
const unitLabel: Record<CalendarView, string> = {
  month: 'month',
  week: 'week',
  day: 'day',
  agenda: '7 days',
}

interface Props {
  view: CalendarView
  rangeLabel: string
  search: string
  activeFilters: number
  /** Filters / inspector open as sheets when they are not shown inline. */
  showFiltersButton: boolean
  showPanelButton: boolean
  onView: (v: CalendarView) => void
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onSearch: (q: string) => void
  onOpenFilters: () => void
  onOpenPanel: () => void
  addMenu?: ReactNode
}

export function CalendarToolbar({
  view,
  rangeLabel,
  search,
  activeFilters,
  showFiltersButton,
  showPanelButton,
  onView,
  onPrev,
  onNext,
  onToday,
  onSearch,
  onOpenFilters,
  onOpenPanel,
  addMenu,
}: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={onPrev}
            aria-label={`Previous ${unitLabel[view]}`}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button variant="outline" className="min-h-11" onClick={onToday}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            onClick={onNext}
            aria-label={`Next ${unitLabel[view]}`}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
        <h2 className="min-w-0 flex-1 text-lg font-semibold text-ink md:text-xl" aria-live="polite">
          {rangeLabel}
        </h2>
        {addMenu}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="inline-flex rounded-md border border-border-strong bg-surface p-0.5">
          <legend className="sr-only">Calendar view</legend>
          {CALENDAR_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => onView(v)}
              className={cn(
                'min-h-10 rounded-sm px-3 text-sm font-medium text-ink',
                view === v ? 'bg-teal text-surface' : 'hover:bg-mist',
              )}
            >
              {viewLabel[v]}
            </button>
          ))}
        </fieldset>

        <label className="relative min-w-40 flex-1 md:max-w-xs">
          <span className="sr-only">Search the calendar</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search events, tasks, places"
            className="min-h-11 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-ink-muted"
          />
        </label>

        <Button asChild variant="outline" className="min-h-11">
          <Link to="/calendar/find-a-time">Find a time</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/academics/exams">Exam Schedule</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/academics/exams" aria-label="My Seating (opens the exam list with your seats)">
            My Seating
          </Link>
        </Button>
        {showFiltersButton ? (
          <Button variant="outline" className="min-h-11 gap-2" onClick={onOpenFilters}>
            <Filter aria-hidden="true" />
            Layers &amp; filters{activeFilters > 0 ? ` (${activeFilters})` : ''}
          </Button>
        ) : null}
        {showPanelButton ? (
          <Button variant="outline" className="min-h-11 gap-2" onClick={onOpenPanel}>
            <PanelRight aria-hidden="true" />
            Details &amp; tasks
          </Button>
        ) : null}
      </div>
    </div>
  )
}
