import { Link } from 'react-router'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Button } from '@/components/ui/button'
import type { ProfileData } from '@/domain/records'
import { formatDateLong, formatTimeRange, type DateOnly, type LocalTime } from '@/lib/time'
import type { FreePockets } from '@/selectors/free-pockets'
import type { CalendarItem } from '@/selectors/items'
import { mealLabel, messForDate } from '@/selectors/mess'
import { DayItemList } from './views/agenda-view'

interface Props {
  data: ProfileData
  date: DateOnly
  items: CalendarItem[]
  hiddenCount: number
  selectedKey?: string
  conflictKeys: ReadonlySet<string>
  diningOverlay: boolean
  pockets: FreePockets
  onCreateInGap: (kind: 'event' | 'focus', start: LocalTime, end: LocalTime) => void
  onToggleDining: (on: boolean) => void
  onSelectItem: (i: CalendarItem) => void
}

/**
 * Contextual information for the selected date: everything on it, meals (information only), and
 * permissioned birthdays. Selecting an empty date shows this without inventing an event.
 */
export function DayContextPanel({
  data,
  date,
  items,
  hiddenCount,
  selectedKey,
  conflictKeys,
  diningOverlay,
  pockets,
  onCreateInGap,
  onToggleDining,
  onSelectItem,
}: Props) {
  const meals = messForDate(data, date)
  const announcements = data.announcements.filter((a) => a.publishedOn === date)
  const birthdays = items.filter((i) => i.recordKind === 'birthday')
  const hasWindows = meals.some((m) => m.start && m.end)

  return (
    <div className="flex flex-col gap-5">
      <DayItemList
        date={date}
        items={items}
        selectedKey={selectedKey}
        conflictKeys={conflictKeys}
        onSelectItem={onSelectItem}
        emptyMessage="Nothing is scheduled in the available records for this date."
      />
      {hiddenCount > 0 ? (
        <p className="-mt-3 text-xs text-ink-muted">
          {hiddenCount} more {hiddenCount === 1 ? 'item is' : 'items are'} hidden by your current
          filters, so this day may have more than shown.
        </p>
      ) : null}

      {birthdays.length > 0 ? (
        <section aria-label="Birthdays">
          <h4 className="mb-1 text-sm font-semibold text-ink">Birthdays</h4>
          <p className="text-sm text-ink-muted">
            Shown only because they are private to you or shared with you.
          </p>
        </section>
      ) : null}

      <section aria-label="Open in your recorded schedule">
        <h4 className="mb-1 text-sm font-semibold text-ink">Open in your recorded schedule</h4>
        {pockets.kind === 'noData' ? (
          <p className="text-sm text-ink-muted">
            No timed commitments recorded for this period, so no gaps can be shown. This is not a
            claim that you are free.
          </p>
        ) : pockets.kind === 'none' ? (
          <p className="text-sm text-ink-muted">
            No qualifying gaps between scheduled commitments.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pockets.pockets.map((g) => (
              <li
                key={g.start}
                className="rounded-md border border-border bg-surface p-2.5 text-sm"
              >
                <p className="font-medium text-ink">
                  {formatTimeRange(g.start, g.end)}{' '}
                  <span className="font-normal text-ink-muted">({g.minutes} min)</span>
                </p>
                {g.cautions.length > 0 ? (
                  <p className="text-xs text-ink-muted">
                    May be shorter: tentative {g.cautions.map((c) => c.title).join(', ')}.
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => onCreateInGap('event', g.start, g.end)}
                  >
                    Add personal event
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => onCreateInGap('focus', g.start, g.end)}
                  >
                    Add focus block
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          Based only on known timed commitments inside your working window. Dining times, birthdays
          and date-only deadlines are not busy time.
        </p>
      </section>

      <section aria-label="Mess">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-ink">Mess</h4>
          {meals.length > 0 ? (
            <DataModeBadge
              mode={
                meals[0]!.provenance.dataMode === 'connected'
                  ? 'provided'
                  : meals[0]!.provenance.dataMode
              }
            />
          ) : null}
        </div>
        {meals.length === 0 ? (
          <p className="text-sm text-ink-muted">Mess menu not supplied for this day.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {meals.map((m) => (
              <li key={m.id} className="rounded-md border border-border bg-surface p-2.5 text-sm">
                <p className="font-medium text-ink">
                  {mealLabel[m.meal]}
                  <span className="ml-2 font-normal text-ink-muted">
                    {m.start && m.end
                      ? formatTimeRange(m.start, m.end)
                      : 'Serving time not provided'}
                  </span>
                </p>
                {m.items?.length ? (
                  <p className="mt-0.5 text-ink-muted">{m.items.join(', ')}</p>
                ) : (
                  <p className="mt-0.5 text-ink-muted">Menu not supplied</p>
                )}
              </li>
            ))}
          </ul>
        )}
        {meals.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent-teal)]"
                checked={diningOverlay}
                disabled={!hasWindows && !diningOverlay}
                onChange={(e) => onToggleDining(e.target.checked)}
              />
              Show dining times on the grid
            </label>
            {!hasWindows ? (
              <p className="text-xs text-ink-muted">
                No serving windows are recorded for this day, so there is nothing to show on the
                grid.
              </p>
            ) : null}
            <Button asChild variant="outline" className="min-h-11 self-start">
              <Link to="/services/mess">View menu (coming later)</Link>
            </Button>
          </div>
        ) : null}
      </section>

      {announcements.length > 0 ? (
        <section aria-label="Notices">
          <h4 className="mb-1 text-sm font-semibold text-ink">
            Notices published {formatDateLong(date)}
          </h4>
          <ul className="flex flex-col gap-1.5">
            {announcements.map((a) => (
              <li key={a.id} className="rounded-md border border-border bg-surface p-2.5 text-sm">
                <span className="font-medium text-ink">{a.title}</span>
                {a.summary ? <span className="block text-ink-muted">{a.summary}</span> : null}
                <span className="mt-1 block">
                  <DataModeBadge
                    mode={
                      a.provenance.dataMode === 'connected' ? 'provided' : a.provenance.dataMode
                    }
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
