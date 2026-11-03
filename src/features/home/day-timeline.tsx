import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import { ContextPreview } from '@/components/context-preview'
import { categoryLabel } from '@/domain/categories'
import type { ProfileData } from '@/domain/records'
import { formatTime, timeToMinutes, type LocalTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { isCancelled, isTimed, type CalendarItem } from '@/selectors/items'
import type { Now } from '@/selectors/now'
import { itemsOnDate } from '@/selectors/occurrences'
import { calendarLink } from '../calendar/calendar-url'
import { itemTimeText } from '../calendar/describe'
import { useState } from 'react'

type Timed = CalendarItem & { time: { kind: 'timed'; start: LocalTime; end: LocalTime } }

/**
 * Today as a connected timeline (design spec §7.3): a rail with a marker at the current time, what has finished
 * dimmed and tucked behind "Earlier today", and date-only deadlines kept in their own area with no invented time.
 */
export function DayTimeline({ data, now }: { data: ProfileData; now: Now }) {
  const [showPast, setShowPast] = useState(false)
  const all = itemsOnDate(data, now.today)
  const timed = all
    .filter((i): i is Timed => isTimed(i) && !isCancelled(i) && i.time.kind === 'timed')
    .sort((a, b) => a.time.start.localeCompare(b.time.start))
  const dateOnly = all.filter((i) => i.time.kind === 'deadline' && !isCancelled(i))
  const past = timed.filter((i) => timeToMinutes(i.time.end) <= now.minutes)
  const rest = timed.filter((i) => timeToMinutes(i.time.end) > now.minutes)
  const shown = showPast ? timed : rest
  const nowIndex = shown.findIndex((i) => timeToMinutes(i.time.start) > now.minutes)

  const row = (i: Timed) => {
    const done = timeToMinutes(i.time.end) <= now.minutes
    const live = timeToMinutes(i.time.start) <= now.minutes && !done
    const link = calendarLink({ date: i.date, event: i.key })
    return (
      <li key={i.key} className="relative pl-9">
        <span
          aria-hidden="true"
          className={cn(
            'absolute top-4 left-[7px] size-3 rounded-full border-2 border-surface',
            live ? 'bg-teal ring-4 ring-teal/20' : done ? 'bg-border-strong' : 'bg-teal-strong',
          )}
        />
        <ContextPreview
          title={i.title}
          lines={[itemTimeText(i), i.location ?? '', categoryLabel[i.category]]}
          source={i.provenance.sourceLabel}
          to={link}
          openLabel="Open in Calendar"
          trigger={
            <Link
              to={link}
              className={cn(
                'lift flex items-start gap-3 rounded-2xl border border-border bg-surface p-3 text-sm',
                done && 'opacity-60',
              )}
            >
              <CategoryIcon category={i.category} />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{i.title}</span>
                <span className="block text-xs text-ink-muted">
                  {formatTime(i.time.start)} to {formatTime(i.time.end)}
                  {i.location ? ` · ${i.location}` : ''}
                </span>
              </span>
              {live ? (
                <span className="rounded-full bg-teal-tint px-2 py-0.5 text-xs font-medium text-teal-strong">
                  Now
                </span>
              ) : done ? (
                <span className="text-xs text-ink-muted">Done</span>
              ) : null}
            </Link>
          }
        />
      </li>
    )
  }

  return (
    <section aria-labelledby="timeline-h" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="timeline-h" className="font-display text-xl font-semibold text-ink">
          Your day
        </h2>
        {past.length ? (
          <button
            type="button"
            aria-expanded={showPast}
            onClick={() => setShowPast((v) => !v)}
            className="min-h-9 text-sm font-medium text-coffee underline"
          >
            {showPast ? 'Hide earlier today' : `Earlier today (${past.length})`}
          </button>
        ) : null}
      </div>
      {timed.length === 0 ? (
        <p className="rounded-2xl bg-mist p-4 text-sm text-ink-muted">
          No timed commitments are recorded for today.
        </p>
      ) : (
        <ol className="relative flex flex-col gap-2">
          <span
            aria-hidden="true"
            className="absolute top-3 bottom-3 left-[12px] w-px bg-border-strong"
          />
          {shown.map((i, idx) => (
            <div key={i.key} className="contents">
              {idx === (nowIndex === -1 ? shown.length : nowIndex) && !showPast ? (
                <NowMarker now={now} />
              ) : null}
              {row(i)}
            </div>
          ))}
          {(nowIndex === -1 && shown.length === 0) || (showPast && nowIndex === -1) ? (
            <NowMarker now={now} />
          ) : null}
        </ol>
      )}
      {dateOnly.length ? (
        <div className="rounded-2xl bg-yellow-wash/60 p-3 text-sm text-ink">
          <h3 className="font-semibold">Due today, date only</h3>
          <ul className="mt-1 list-disc pl-5">
            {dateOnly.map((d) => (
              <li key={d.key}>{d.title}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-ink-muted">
            These have a due date but no time, so they are not placed on the rail.
          </p>
        </div>
      ) : null}
    </section>
  )
}

function NowMarker({ now }: { now: Now }) {
  return (
    <li className="relative pl-9" aria-label={`Now, ${formatTime(now.time)}`}>
      <span
        aria-hidden="true"
        className="absolute top-1/2 left-0 flex w-full -translate-y-1/2 items-center gap-2"
      >
        <span className="ml-[3px] size-5 rounded-full bg-terracotta-text/90 ring-4 ring-terracotta-text/20" />
        <span className="h-px flex-1 bg-terracotta-text/60" />
        <span className="rounded-full bg-terracotta-tint px-2 py-0.5 text-[11px] font-semibold text-terracotta-text">
          {formatTime(now.time)}
        </span>
      </span>
      <span className="block h-7" />
    </li>
  )
}
