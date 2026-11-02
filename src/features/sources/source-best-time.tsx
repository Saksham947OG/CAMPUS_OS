import { useEffect, useState } from 'react'
import { isoWeekday } from '@/lib/time'
import { Link } from 'react-router'
import { useServices } from '@/app/services'
import { useAppStore } from '@/app/app-store'
import { PageHeader } from '@/components/page-header'
import { personaEvidence } from '@/data/campus/evidence'

export function SourceBestTimePage() {
  const { observations } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const [version, setVersion] = useState(0)
  const [processId, setProcessId] = useState('lunch')
  const [phase, setPhase] = useState<'baseline' | 'withCampusOS'>('withCampusOS')
  useEffect(() => observations.subscribe(() => setVersion((v) => v + 1)), [observations])
  const rows = observations
    .load(profileId)
    .filter((r) => r.processId === processId && r.phase === phase && r.time)
  const bins = new Map<string, number[]>()
  for (const row of rows) {
    const hour = row.time!.slice(0, 2) + ':00'
    const weekday = isoWeekday(row.date) % 7
    const key = `${weekday}:${hour}`
    bins.set(key, [...(bins.get(key) ?? []), row.minutes])
  }
  const means = [...bins]
    .map(([key, values]) => ({
      key,
      weekday: Number(key.split(':')[0]),
      hour: key.slice(2),
      count: values.length,
      mean: values.reduce((a, b) => a + b, 0) / values.length,
    }))
    .sort((a, b) => a.mean - b.mean)
  const eligible = means.filter((b) => b.count >= 3)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return (
    <article className="flex max-w-4xl flex-col gap-4" data-observation-version={version}>
      <PageHeader
        title="Best time to go"
        description="Patterns from your timed observations. Compare the same process and phase; a pattern is not a forecast or a live occupancy reading."
      />
      <div className="grid gap-3 rounded-lg border border-border bg-surface p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          Process
          <select
            className="min-h-11 rounded-md border border-border bg-surface px-3"
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
          >
            {personaEvidence(profileId).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Observation phase
          <select
            className="min-h-11 rounded-md border border-border bg-surface px-3"
            value={phase}
            onChange={(e) => setPhase(e.target.value as typeof phase)}
          >
            <option value="baseline">Before using CampusOS</option>
            <option value="withCampusOS">With CampusOS</option>
          </select>
        </label>
      </div>
      {eligible.length ? (
        <p className="rounded-lg bg-teal-tint p-4">
          Lowest recorded comparable mean: {days[eligible[0]!.weekday]}, {eligible[0]!.hour} ·{' '}
          {eligible[0]!.mean.toFixed(1)} minutes (n={eligible[0]!.count}). Check the current service
          schedule before travelling.
        </p>
      ) : (
        <p className="rounded-lg border border-border bg-mist p-4">
          Not enough timed observations to suggest an hour. Record at least three comparable
          observations for the same process, phase, weekday and hour. Supplied persona narratives
          lack dated hourly samples, so they are not turned into a crowd forecast.
        </p>
      )}
      <ul className="grid gap-3">
        {means.map((b) => (
          <li key={b.key} className="rounded-lg border border-border bg-surface p-3">
            {days[b.weekday]} · {b.hour}: {b.mean.toFixed(1)} min average, n={b.count}
            {b.count < 3 ? ' · insufficient samples' : ''}
          </li>
        ))}
      </ul>
      <Link to="/time-tax/observations" className="text-coffee underline">
        Record or inspect observations
      </Link>
      <Link to="/sources" className="text-coffee underline">
        Inspect source coverage and gaps
      </Link>
    </article>
  )
}
