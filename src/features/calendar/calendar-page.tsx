import { Plus, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { RouteStatusBadge } from '@/components/status-badge'
import { Tabs } from '@/components/tabs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { routeById } from '@/app/routes'
import { filtersFromPrefs, type CalendarView } from '@/data/prefs/prefs'
import { DataError } from '@/features/common/data-error'
import { useCampusData } from '@/hooks/use-campus-data'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { usePrefs } from '@/hooks/use-prefs'
import {
  addDays,
  addMonths,
  dateRange,
  formatDateLong,
  formatRangeLabel,
  formatMonthYear,
  monthGrid,
  weekDates,
  type DateOnly,
} from '@/lib/time'
import { findConflicts, type Conflict } from '@/selectors/conflicts'
import { computeFreePockets } from '@/selectors/free-pockets'
import { activeFilterCount, applyFilters, defaultFilters, hiddenReason } from '@/selectors/filters'
import type { CalendarItem } from '@/selectors/items'
import { diningWindows } from '@/selectors/mess'
import { findItemByKey, itemsInRange } from '@/selectors/occurrences'
import { workloadFor, workloadText } from '@/selectors/workload'
import {
  readUrlState,
  writeUrlState,
  type CalendarUrlState,
  type InspectorPanel,
} from './calendar-url'
import { DayContextPanel } from './day-context-panel'
import { EditorHost } from './editors/editor-host'
import type { EditorRequest } from './editors/editor-types'
import { ItemActions } from './item-actions'
import { TasksPanel } from './tasks-panel'
import { DetailsPanel } from './details-panel'
import { FiltersPanel } from './filters-panel'
import { CalendarToolbar } from './toolbar'
import { AgendaView, DayItemList } from './views/agenda-view'
import { DayStrip } from './views/day-strip'
import { MonthView } from './views/month-view'
import { TimeGridView, type DiningBand } from './views/time-grid-view'

function rangeFor(view: CalendarView, date: DateOnly): { from: DateOnly; to: DateOnly } {
  if (view === 'month') {
    const grid = monthGrid(date)
    return { from: grid[0]![0]!, to: grid[grid.length - 1]![6]! }
  }
  if (view === 'week') {
    const w = weekDates(date)
    return { from: w[0]!, to: w[6]! }
  }
  if (view === 'day') return { from: date, to: date }
  return { from: date, to: addDays(date, 6) }
}

function stepDate(view: CalendarView, date: DateOnly, dir: 1 | -1): DateOnly {
  if (view === 'month') return addMonths(date, dir)
  if (view === 'week' || view === 'agenda') return addDays(date, 7 * dir)
  return addDays(date, dir)
}

export function CalendarPage() {
  const route = routeById('calendar')!
  const [params, setParams] = useSearchParams()
  const url = readUrlState(params)
  const now = useNow()
  const { data, status, error } = useCampusData()
  const cal = usePrefs('calendar')
  const planning = usePrefs('planning')
  const isXl = useMediaQuery('(min-width: 1280px)')
  const is2xl = useMediaQuery('(min-width: 1536px)')
  const isMd = useMediaQuery('(min-width: 768px)')

  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState<ReadonlySet<string>>(new Set())
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [editor, setEditor] = useState<EditorRequest | null>(null)

  const prefs = cal.value
  const view: CalendarView = url.view ?? prefs.view
  const date: DateOnly = url.date ?? now.today
  const panel: InspectorPanel | undefined = url.panel

  /** Update the URL (history entry per navigation; `replace` for tab switches). */
  const go = useCallback(
    (patch: Partial<CalendarUrlState>, replace = false) => {
      const next: CalendarUrlState = { view, date, event: url.event, panel, ...patch }
      setParams(writeUrlState(next), { replace })
    },
    [view, date, url.event, panel, setParams],
  )

  const filters = useMemo(() => filtersFromPrefs(prefs, search), [prefs, search])
  const range = useMemo(() => rangeFor(view, date), [view, date])

  const allItems = useMemo(() => itemsInRange(data, range.from, range.to), [data, range])
  const visible = useMemo(
    () => applyFilters(allItems, filters, revealed),
    [allItems, filters, revealed],
  )
  const itemsByDate = useMemo(() => {
    const map = new Map<DateOnly, CalendarItem[]>()
    for (const i of visible) map.set(i.date, [...(map.get(i.date) ?? []), i])
    return map as ReadonlyMap<DateOnly, CalendarItem[]>
  }, [visible])

  const conflicts: Conflict[] = useMemo(() => findConflicts(visible), [visible])
  const conflictKeys = useMemo(
    () => new Set(conflicts.flatMap((c) => [c.a.key, c.b.key])),
    [conflicts],
  )

  const dining = useMemo(() => {
    if (!prefs.diningOverlay) return undefined
    const m = new Map<DateOnly, DiningBand[]>()
    for (const d of dateRange(range.from, range.to)) m.set(d, diningWindows(data, d))
    return m as ReadonlyMap<DateOnly, DiningBand[]>
  }, [prefs.diningOverlay, data, range])

  const selectedItem = useMemo(
    () => (url.event ? findItemByKey(data, url.event) : undefined),
    [data, url.event],
  )
  const selectedHidden = selectedItem ? hiddenReason(selectedItem, filters, revealed) : null
  const selectedConflicts = selectedItem
    ? conflicts.filter((c) => c.a.key === selectedItem.key || c.b.key === selectedItem.key)
    : []

  const dayAll = useMemo(() => itemsInRange(data, date, date), [data, date])
  const dayVisible =
    itemsByDate.get(date) ??
    (view === 'day' || view === 'week' || view === 'month'
      ? []
      : applyFilters(dayAll, filters, revealed))
  const dayVisibleFull = applyFilters(dayAll, filters, revealed)

  const wl = useMemo(() => {
    const w = weekDates(date)
    return workloadFor(data, w[0]!, w[6]!)
  }, [data, date])

  const rangeLabel =
    view === 'month'
      ? formatMonthYear(date)
      : view === 'day'
        ? formatDateLong(date)
        : formatRangeLabel(range.from, range.to)

  const onSelectItem = (item: CalendarItem) =>
    go({ date: item.date, event: item.key, panel: 'details' })
  const onSelectDate = (d: DateOnly) =>
    go({
      date: d,
      event: undefined,
      panel: isXl ? 'context' : panel === 'details' ? undefined : panel,
    })
  const clearFilters = () => {
    void cal.update((p) => ({
      ...p,
      ...{
        courseIds: [],
        verification: 'all' as const,
        origin: 'all' as const,
        showCompletedTasks: true,
      },
    }))
    setSearch('')
  }

  if (status === 'error') return <DataError message={error} />

  if (!cal.ready || !planning.ready || status === 'loading') {
    return <output className="block text-ink-muted">Loading calendar…</output>
  }

  const activePanel: InspectorPanel = panel ?? (selectedItem || url.event ? 'details' : 'context')
  const sheetOpen = !isXl && panel !== undefined

  const emptyMessage =
    allItems.length === 0
      ? 'Nothing is scheduled in the available records for this period.'
      : 'No events match these filters. The records still exist; adjust or clear the filters to see them.'

  const getItemsOn = (d: DateOnly) => itemsInRange(data, d, d)
  const pockets = computeFreePockets(dayAll, planning.value)
  const openEditor = (request: EditorRequest) => setEditor(request)

  const inspector = (
    <Tabs
      idPrefix="inspector"
      label="Calendar side panel"
      value={activePanel}
      onChange={(id) => go({ panel: id }, true)}
      tabs={[
        {
          id: 'details',
          label: 'Details',
          content: (
            <DetailsPanel
              data={data}
              item={selectedItem}
              missingKey={url.event && !selectedItem ? url.event : undefined}
              hiddenReason={selectedHidden}
              conflicts={selectedConflicts}
              onReveal={() => selectedItem && setRevealed((r) => new Set([...r, selectedItem.key]))}
              onSelectItem={onSelectItem}
              actions={
                selectedItem ? (
                  <ItemActions
                    item={selectedItem}
                    data={data}
                    now={now}
                    onEdit={openEditor}
                    onPanel={(p) => go({ panel: p }, true)}
                    onDeleted={() => go({ event: undefined }, true)}
                  />
                ) : undefined
              }
              empty={
                <>
                  Select an event, deadline or task to see its details here, or{' '}
                  <button
                    type="button"
                    className="font-medium text-teal-strong underline"
                    onClick={() => openEditor({ kind: 'event', prefill: { date } })}
                  >
                    add a personal event
                  </button>
                  .
                </>
              }
            />
          ),
        },
        {
          id: 'tasks',
          label: 'Tasks',
          content: (
            <TasksPanel
              data={data}
              now={now}
              selected={selectedItem}
              onEdit={openEditor}
              onSelectItem={onSelectItem}
            />
          ),
        },
        {
          id: 'context',
          label: 'Day Context',
          content: (
            <DayContextPanel
              data={data}
              date={date}
              items={dayVisibleFull}
              hiddenCount={dayAll.length - dayVisibleFull.length}
              selectedKey={selectedItem?.key}
              conflictKeys={conflictKeys}
              diningOverlay={prefs.diningOverlay}
              pockets={pockets}
              onCreateInGap={(kind, start, end) =>
                openEditor(
                  kind === 'event'
                    ? { kind: 'event', prefill: { date, start, end } }
                    : { kind: 'focus', prefill: { date, start, end } },
                )
              }
              onToggleDining={(on) => void cal.update((p) => ({ ...p, diningOverlay: on }))}
              onSelectItem={onSelectItem}
            />
          ),
        },
      ]}
    />
  )

  const filtersPanel = (
    <FiltersPanel
      prefs={prefs}
      courses={data.courses}
      workloadText={workloadText(wl, 'this week')}
      hasSearch={search.trim().length > 0}
      onChange={(fn) => void cal.update(fn)}
      onClearSearch={() => setSearch('')}
    />
  )

  const stageHours = { hourStart: prefs.hourStart, hourEnd: prefs.hourEnd }
  const weekCounts = new Map<DateOnly, number>(
    weekDates(date).map((d) => [d, itemsByDate.get(d)?.length ?? 0]),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 id="page-title" className="font-display text-3xl font-semibold tracking-tight text-ink">
          Calendar
        </h1>
        {route.status !== 'live' ? <RouteStatusBadge status={route.status} /> : null}
        {isXl ? (
          <div className="ml-auto flex gap-2">
            {is2xl ? (
              <Button
                variant="ghost"
                className="min-h-11 gap-2"
                onClick={() => void cal.update((p) => ({ ...p, railCollapsed: !p.railCollapsed }))}
                aria-pressed={!prefs.railCollapsed}
              >
                {prefs.railCollapsed ? (
                  <PanelLeftOpen aria-hidden="true" />
                ) : (
                  <PanelLeftClose aria-hidden="true" />
                )}
                {prefs.railCollapsed ? 'Show filters' : 'Hide filters'}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              className="min-h-11 gap-2"
              onClick={() =>
                void cal.update((p) => ({ ...p, inspectorCollapsed: !p.inspectorCollapsed }))
              }
              aria-pressed={!prefs.inspectorCollapsed}
            >
              {prefs.inspectorCollapsed ? (
                <PanelRightOpen aria-hidden="true" />
              ) : (
                <PanelRightClose aria-hidden="true" />
              )}
              {prefs.inspectorCollapsed ? 'Show panel' : 'Hide panel'}
            </Button>
          </div>
        ) : null}
      </div>

      {data.importWarnings.length > 0 ? (
        <output className="block rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm text-ink">
          <p className="font-semibold">Some records were not shown</p>
          <ul className="mt-1 list-disc pl-5">
            {data.importWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </output>
      ) : null}

      <div className="flex items-start gap-4">
        {is2xl && !prefs.railCollapsed ? (
          <aside
            aria-label="Layers and filters"
            className="sticky top-20 max-h-[calc(100dvh-6rem)] w-64 shrink-0 overflow-y-auto rounded-lg border border-border bg-surface p-4"
          >
            <h2 className="mb-3 text-sm font-semibold text-ink">Layers &amp; filters</h2>
            {filtersPanel}
          </aside>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <CalendarToolbar
            view={view}
            rangeLabel={rangeLabel}
            search={search}
            activeFilters={activeFilterCount(filters, defaultFilters())}
            showFiltersButton={!is2xl}
            showPanelButton={!isXl}
            onView={(v) => {
              void cal.update((p) => ({ ...p, view: v }))
              go({ view: v })
            }}
            onPrev={() => go({ date: stepDate(view, date, -1) })}
            onNext={() => go({ date: stepDate(view, date, 1) })}
            onToday={() => go({ date: now.today })}
            onSearch={setSearch}
            onOpenFilters={() => setFiltersOpen(true)}
            onOpenPanel={() => go({ panel: selectedItem ? 'details' : 'context' }, true)}
            addMenu={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="min-h-11 gap-1.5">
                    <Plus aria-hidden="true" /> Add
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-60">
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => openEditor({ kind: 'event', prefill: { date } })}
                  >
                    Personal event
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => openEditor({ kind: 'task' })}
                  >
                    Personal task
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => openEditor({ kind: 'focus', prefill: { date } })}
                  >
                    Study / focus block
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="min-h-11"
                    onSelect={() => openEditor({ kind: 'birthday' })}
                  >
                    Birthday reminder
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <output className="sr-only" aria-live="polite">
            {visible.length} {visible.length === 1 ? 'item' : 'items'} shown for {rangeLabel}
            {allItems.length !== visible.length
              ? `, ${allItems.length - visible.length} hidden by filters`
              : ''}
          </output>

          {view === 'month' ? (
            <>
              <MonthView
                anchor={date}
                today={now.today}
                selectedDate={date}
                selectedKey={selectedItem?.key}
                itemsByDate={itemsByDate}
                conflictKeys={conflictKeys}
                onSelectDate={onSelectDate}
                onSelectItem={onSelectItem}
                onShowDay={(d) => go({ date: d, event: undefined, panel: 'context' })}
              />
              {!isMd ? (
                <DayItemList
                  date={date}
                  items={dayVisible}
                  selectedKey={selectedItem?.key}
                  conflictKeys={conflictKeys}
                  onSelectItem={onSelectItem}
                  emptyMessage="Nothing is scheduled in the available records for this date."
                />
              ) : null}
            </>
          ) : null}

          {view === 'week' && isMd ? (
            <TimeGridView
              dates={weekDates(date)}
              today={now.today}
              nowMinutes={now.minutes}
              selectedDate={date}
              selectedKey={selectedItem?.key}
              itemsByDate={itemsByDate}
              conflictKeys={conflictKeys}
              {...stageHours}
              dining={dining}
              label={`Week of ${formatRangeLabel(range.from, range.to)}`}
              onSelectDate={onSelectDate}
              onSelectItem={onSelectItem}
              onCreateAt={(d, start) => openEditor({ kind: 'event', prefill: { date: d, start } })}
            />
          ) : null}

          {view === 'week' && !isMd ? (
            <>
              <DayStrip
                dates={weekDates(date)}
                today={now.today}
                selectedDate={date}
                counts={weekCounts}
                onSelectDate={onSelectDate}
              />
              <TimeGridView
                dates={[date]}
                today={now.today}
                nowMinutes={now.minutes}
                selectedDate={date}
                selectedKey={selectedItem?.key}
                itemsByDate={itemsByDate}
                conflictKeys={conflictKeys}
                {...stageHours}
                dining={dining}
                label={formatDateLong(date)}
                onSelectDate={onSelectDate}
                onSelectItem={onSelectItem}
                onCreateAt={(d, start) =>
                  openEditor({ kind: 'event', prefill: { date: d, start } })
                }
              />
            </>
          ) : null}

          {view === 'day' ? (
            <TimeGridView
              dates={[date]}
              today={now.today}
              nowMinutes={now.minutes}
              selectedDate={date}
              selectedKey={selectedItem?.key}
              itemsByDate={itemsByDate}
              conflictKeys={conflictKeys}
              {...stageHours}
              dining={dining}
              label={formatDateLong(date)}
              onSelectDate={onSelectDate}
              onSelectItem={onSelectItem}
              onCreateAt={(d, start) => openEditor({ kind: 'event', prefill: { date: d, start } })}
            />
          ) : null}

          {view === 'agenda' ? (
            <AgendaView
              from={range.from}
              to={range.to}
              today={now.today}
              selectedKey={selectedItem?.key}
              itemsByDate={itemsByDate}
              conflictKeys={conflictKeys}
              onSelectItem={onSelectItem}
              emptyMessage={emptyMessage}
              onClearFilters={allItems.length > 0 ? clearFilters : undefined}
            />
          ) : null}

          {view !== 'agenda' && visible.length === 0 ? (
            <output className="block rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
              {emptyMessage}
            </output>
          ) : null}
        </div>

        {isXl && !prefs.inspectorCollapsed ? (
          <aside
            aria-label="Calendar side panel"
            className="sticky top-20 max-h-[calc(100dvh-6rem)] w-[22rem] shrink-0 overflow-y-auto rounded-lg border border-border bg-surface p-4"
          >
            {inspector}
          </aside>
        ) : null}
      </div>

      {!isXl ? (
        <>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side="left" className="w-[min(22rem,100vw)] overflow-y-auto p-4">
              <SheetHeader className="p-0 pb-3">
                <SheetTitle>Layers &amp; filters</SheetTitle>
                <SheetDescription>
                  These only change what is visible. No records are changed or deleted.
                </SheetDescription>
              </SheetHeader>
              {filtersPanel}
            </SheetContent>
          </Sheet>
          <Sheet open={sheetOpen} onOpenChange={(o) => !o && go({ panel: undefined }, true)}>
            <SheetContent
              side={isMd ? 'right' : 'bottom'}
              className={
                isMd
                  ? 'w-[min(24rem,100vw)] overflow-y-auto p-4'
                  : 'max-h-[88dvh] overflow-y-auto rounded-t-lg p-4'
              }
            >
              <SheetHeader className="p-0 pb-3">
                <SheetTitle>Calendar panel</SheetTitle>
                <SheetDescription>
                  Details, tasks and day context for your selection.
                </SheetDescription>
              </SheetHeader>
              {inspector}
            </SheetContent>
          </Sheet>
        </>
      ) : null}
      <EditorHost
        request={editor}
        data={data}
        planning={planning.value}
        getItemsOn={getItemsOn}
        onClose={() => setEditor(null)}
      />
    </div>
  )
}
