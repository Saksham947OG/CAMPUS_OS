import { Gauge, Hourglass } from 'lucide-react'
import { Link } from 'react-router'
import { formatDateLong, formatTimeRange, type DateOnly } from '@/lib/time'
import { cn } from '@/lib/utils'
import type { CalendarItem } from '@/selectors/items'
import { dayBottleneck } from '@/selectors/process-bottleneck'
import { useFlags } from './bottleneck-flags'
import { FlagBadge } from './flag-badge'

const timeOf = (i: CalendarItem) =>
  i.time.kind === 'timed' ? formatTimeRange(i.time.start, i.time.end) : ''

/**
 * The selected day's biggest process bottleneck: the thing most likely to cost waiting time, how long the
 * wait usually is, how full it is, and how little room it has. The same items are flagged in the grid.
 */
export function DayBottleneck({
  date,
  today,
  items,
  onSelectItem,
}: {
  date: DateOnly
  today: DateOnly
  items: readonly CalendarItem[]
  onSelectItem: (i: CalendarItem) => void
}) {
  const flags = useFlags()
  const b = dayBottleneck(items, flags)
  const top = b.top
  return (
    <section
      aria-label="Biggest bottleneck of the day"
      className={cn(
        'rounded-lg border border-l-4 border-border bg-surface p-3',
        top?.flag.level === 'high' ? 'border-l-danger' : top ? 'border-l-warning' : 'border-l-teal',
      )}
    >
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink">
        <Gauge className="size-4 text-coffee" aria-hidden="true" />
        {date === today ? 'Today’s bottleneck' : `Bottleneck · ${formatDateLong(date)}`}
      </h2>
      {top ? (
        <>
          <p className="mt-1.5 text-sm text-ink">
            <strong>{top.flag.process}</strong> · {top.item.title}
            {timeOf(top.item) ? ` · ${timeOf(top.item)}` : ''}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5 text-xs" aria-label="Why this one">
            {top.flag.waitText ? (
              <li className="rounded-full bg-mist px-2 py-0.5">
                Typical wait <strong>{top.flag.waitText}</strong>
                {top.flag.basis === 'reported' ? ' (reported)' : ' (planning figure)'}
              </li>
            ) : null}
            {top.flag.fillText ? (
              <li className="rounded-full bg-mist px-2 py-0.5">{top.flag.fillText}</li>
            ) : null}
            {top.flag.capacityText ? (
              <li className="rounded-full bg-mist px-2 py-0.5">Holds {top.flag.capacityText}</li>
            ) : null}
          </ul>
          <p className="mt-1.5 flex items-start gap-1.5 text-sm text-ink">
            <Hourglass className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>{top.flag.advice}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectItem(top.item)}
              className="min-h-9 rounded-md border border-border-strong px-2.5 text-xs font-medium text-ink hover:bg-mist"
            >
              Show in calendar
            </button>
            <Link to={top.flag.link.to} className="text-xs font-medium text-coffee underline">
              {top.flag.link.label}
            </Link>
            <Link to="/time-tax" className="text-xs font-medium text-coffee underline">
              Open Time Tax
            </Link>
          </div>
          {b.others.length > 0 ? (
            <ul
              className="mt-2 flex flex-col gap-1 border-t border-border pt-2"
              aria-label="Also on this day"
            >
              {b.others.map(({ item, flag }) => (
                <li key={item.key} className="flex flex-wrap items-center gap-x-2 text-xs text-ink">
                  <FlagBadge flag={flag} withText />
                  <button
                    type="button"
                    onClick={() => onSelectItem(item)}
                    className="font-medium underline"
                  >
                    {item.title}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <p className="mt-1.5 text-sm text-ink">
          No queue-prone process is on the schedule for this day, or no wait baseline is recorded
          for it.
        </p>
      )}
      {b.tightest ? (
        <p className="mt-1.5 text-xs text-ink-muted">
          Least room today: <strong>{b.tightest.label}</strong> ({b.tightest.capacityText}) for{' '}
          {b.tightest.item.title}.
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">
        Waits come from your Time Tax baselines, not a live queue. “Full now” is a simulated
        headcount and appears only for something happening now or within the hour.
      </p>
    </section>
  )
}
