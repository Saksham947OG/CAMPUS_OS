import { Hourglass } from 'lucide-react'
import { Link } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { compositeRange, personaEvidence, potentialRange } from '@/data/campus/evidence'
import { addDays, monthName, type DateOnly } from '@/lib/time'
import { isoWeekday } from '@/lib/time/calendar'
import type { Now } from '@/selectors/now'

const hours = (minutes: number) => (Math.round(minutes / 6) / 10).toFixed(1)

/** Weekdays (Mon–Fri) of the month that `today` falls in, and how many of them are over. */
function weekdaysOf(today: DateOnly) {
  const first = `${today.slice(0, 8)}01` as DateOnly
  let all = 0
  let past = 0
  for (let d = first; d.slice(0, 7) === today.slice(0, 7); d = addDays(d, 1)) {
    if (isoWeekday(d) > 5) continue
    all++
    if (d <= today) past++
  }
  return { all, past }
}

/**
 * Time back this month, at a glance. It is a planning estimate: the persona's counted Time Tax processes
 * (reported baselines and stated assumptions) once on each weekday of the month. It is not a measurement, and
 * the card says how many timed observations actually exist.
 */
export function MonthGlance({ now }: { now: Now }) {
  const profileId = useAppStore((s) => s.activeProfileId)
  const { observations } = useServices()
  const rows = personaEvidence(profileId).filter((r) => r.includeInComposite)
  const perDay = compositeRange(rows)
  if (!perDay) return null
  const { all, past } = weekdaysOf(now.today)
  const month = monthName(Number(now.today.slice(5, 7)))
  const top = rows
    .map((r) => ({ r, p: potentialRange(r) }))
    .filter((x): x is { r: (typeof rows)[number]; p: [number, number] } => x.p !== null)
    .sort((a, b) => b.p[0] + b.p[1] - (a.p[0] + a.p[1]))
    .slice(0, 4)
  const widest = Math.max(...top.map((x) => x.p[1]), 1)
  const measured = observations.load(profileId).length
  return (
    <section
      aria-labelledby="month-h"
      className="grid gap-5 rounded-[var(--radius-lg)] border border-border bg-teal-tint p-5 shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]"
    >
      <div>
        <h2
          id="month-h"
          className="flex items-center gap-2 font-display text-xl font-semibold text-ink"
        >
          <Hourglass className="size-5 text-teal-strong" aria-hidden="true" />
          Time back in {month}
        </h2>
        <p className="mt-2 font-display text-4xl font-semibold text-ink">
          {hours(perDay[0] * all)}–{hours(perDay[1] * all)} hours
        </p>
        <p className="text-sm text-ink">
          could come back this month, about {perDay[0]}–{perDay[1]} minutes on each of {all}{' '}
          weekdays. So far, {past} of {all} weekdays are done: {hours(perDay[0] * past)}–
          {hours(perDay[1] * past)} hours of that.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          A planning estimate, not a measurement: it counts each of your {rows.length} Time Tax
          processes once on every weekday, using reported waits and stated assumptions.{' '}
          {measured
            ? `${measured} timed observation${measured === 1 ? '' : 's'} recorded so far.`
            : 'No timed observations are recorded yet, so none of this is measured.'}{' '}
          <Link to="/time-tax" className="font-medium text-coffee underline">
            See how it is built
          </Link>
        </p>
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink">Where it comes from, minutes a day</h3>
        <ul className="flex flex-col gap-2">
          {top.map(({ r, p }) => (
            <li key={r.id}>
              <div className="flex justify-between gap-2 text-sm text-ink">
                <span>{r.label}</span>
                <span className="tabular-nums">
                  {p[0]}–{p[1]} min
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-surface" aria-hidden="true">
                <div
                  className="tt-bar h-full rounded bg-teal-strong"
                  style={{ width: `${(p[1] / widest) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
