import { useSourceAudit } from './use-source-audit'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import {
  personaEvidence,
  potentialRange,
  compositeRange,
  sourceGaps,
  type ProcessEvidence,
} from '@/data/campus/evidence'
import { sourceLibrary } from '@/data/campus/source-library'
import { dateOnlySchema } from '@/domain/records'
import { todayIn } from '@/lib/time'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'

const rangeText = (r: [number, number] | null) =>
  r ? (r[0] === r[1] ? `${r[0]} min` : `${r[0]}–${r[1]} min`) : 'Not recorded'
const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null)

function ProcessRow({ row }: { row: ProcessEvidence }) {
  const result = potentialRange(row)
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{row.label}</h3>
        <span className="rounded-full bg-mist px-2 py-1 text-xs">
          {row.basis === 'reported'
            ? 'Source-reported wait'
            : row.basis === 'estimated'
              ? 'Source estimate'
              : row.basis === 'illustrative'
                ? 'Planning assumption'
                : 'Baseline missing'}
        </span>
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-ink-muted">Baseline</dt>
          <dd>{rangeText(row.baseline)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Proposed target</dt>
          <dd>{rangeText(row.target)}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Potential reduction</dt>
          <dd>{result ? rangeText(result) : 'Cannot calculate'}</dd>
        </div>
      </dl>
      <p className="mt-2 text-sm text-ink-muted">{row.note}</p>
      <p className="mt-2 text-xs">
        Sources:{' '}
        {row.sourceIds.map((id, i) => (
          <span key={id}>
            {i ? ', ' : ''}
            <Link className="text-coffee underline" to={`/sources#${id}`}>
              {sourceLibrary.find((s) => s.id === id)?.title ?? id}
            </Link>
          </span>
        ))}
      </p>
    </li>
  )
}

function ObservationForm({ rows }: { rows: ProcessEvidence[] }) {
  const services = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const [processId, setProcess] = useState(rows[0]?.id ?? 'lunch')
  const [date, setDate] = useState(String(todayIn(services.clock)))
  const [time, setTime] = useState('12:30')
  const [phase, setPhase] = useState<'baseline' | 'withCampusOS'>('baseline')
  const [minutes, setMinutes] = useState('')
  const [method, setMethod] = useState('')
  const [message, setMessage] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => services.observations.subscribe(() => setVersion((v) => v + 1)), [services])
  const saved = services.observations
    .load(profileId)
    .filter((r) => rows.some((x) => x.id === r.processId))
  const selected = rows.some((x) => x.id === processId) ? processId : (rows[0]?.id ?? 'lunch')
  const pairs = rows
    .map((row) => {
      const own = saved.filter((x) => x.processId === row.id)
      return {
        label: row.label,
        before: own.filter((x) => x.phase === 'baseline'),
        after: own.filter((x) => x.phase === 'withCampusOS'),
      }
    })
    .filter((x) => x.before.length || x.after.length)
  return (
    <details
      className="mt-3 rounded-lg border border-border p-3"
      data-observation-version={version}
    >
      <summary className="min-h-11 cursor-pointer font-medium">
        Record a timed observation · {saved.length} saved
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (minutes === '' || !dateOnlySchema.safeParse(date).success) {
            setMessage('Enter a valid date and waiting duration.')
            return
          }
          const result = services.observations.save({
            id: services.newId('wait'),
            profileId,
            processId: selected,
            date: date as Parameters<typeof services.observations.save>[0]['date'],
            phase,
            time: time as Parameters<typeof services.observations.save>[0]['time'],
            minutes: Number(minutes),
            method,
            recordedAt: services.clock.now().toString(),
          })
          setMessage(result.message)
          if (result.ok) {
            setMinutes('')
            setMethod('')
          }
        }}
      >
        <Field label="Process">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={selected}
              onChange={(e) => setProcess(e.target.value)}
            >
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Observation date">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Observation start time">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="Observation phase">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={phase}
              onChange={(e) => setPhase(e.target.value as typeof phase)}
            >
              <option value="baseline">Before using CampusOS</option>
              <option value="withCampusOS">With CampusOS</option>
            </select>
          )}
        </Field>
        <Field label="Minutes actually waiting">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              type="number"
              min="0"
              max="1440"
              step="0.1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
            />
          )}
        </Field>
        <Field label="How was this timed?">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={method}
              minLength={3}
              maxLength={300}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="e.g. stopwatch from joining queue to service"
              required
            />
          )}
        </Field>
        <Button type="submit" className="self-end">
          Save observation
        </Button>
        <output aria-live="polite" className="text-sm sm:col-span-2">
          {message}
        </output>
      </form>
      {pairs.map((p) => {
        const before = avg(p.before.map((x) => x.minutes)),
          after = avg(p.after.map((x) => x.minutes))
        return (
          <p className="mt-2 text-sm" key={p.label}>
            <strong>{p.label}</strong>: before{' '}
            {before === null ? 'not recorded' : `${before.toFixed(1)} min (n=${p.before.length})`};
            with CampusOS{' '}
            {after === null ? 'not recorded' : `${after.toFixed(1)} min (n=${p.after.length})`}.
            {before !== null && after !== null
              ? ` Difference of means: ${(before - after).toFixed(1)} min; this is not proof of a causal effect.`
              : ''}
          </p>
        )
      })}
      {saved.length > 0 ? (
        <details className="mt-3">
          <summary className="cursor-pointer py-2 text-sm">Observation log</summary>
          <ul className="list-disc pl-5 text-sm">
            {saved.map((r) => (
              <li key={r.id}>
                {r.date} {r.time ?? ''} · {rows.find((p) => p.id === r.processId)?.label} ·{' '}
                {r.phase === 'baseline' ? 'Before' : 'With CampusOS'} · {r.minutes} min · {r.method}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </details>
  )
}

export function ProcessTimeTax({
  service,
  compact = false,
}: {
  service?: string
  compact?: boolean
}) {
  const profileId = useAppStore((s) => s.activeProfileId)
  const profile = useAppStore((s) => s.profiles.find((p) => p.id === s.activeProfileId))
  const audit = useSourceAudit()
  const all = personaEvidence(profileId)
  const rows = service ? all.filter((r) => r.service === service) : all
  const composite = !service ? compositeRange(all) : null
  const relevant = sourceGaps.filter((g) => !service || g.service === service)
  if (!rows.length) return null
  return (
    <section
      aria-label="Source-based Time Tax"
      className="rounded-lg border border-border bg-surface p-4"
    >
      <h2 className="font-display text-lg font-semibold">
        {compact ? 'Your Time Tax' : 'Time Tax · ' + (profile?.displayName ?? 'your profile')}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {audit.checked
          ? `${audit.checked - audit.failures.length}/${audit.checked} app data sources checked`
          : 'Checking app data sources…'}{' '}
        · {sourceLibrary.length} supplied files inventoried. Reference week: Nov 2–8, 2026.
      </p>
      {audit.failures.length ? (
        <p role="alert" className="mt-2 text-sm">
          Could not read: {audit.failures.join(', ')}. These sources are excluded from activity
          counts.
        </p>
      ) : null}
      {composite ? (
        <p className="mt-3 rounded-md bg-teal-tint p-3">
          <strong>{rangeText(composite)} potential reduction</strong> across this persona’s four
          selected processes. Reported baselines and planning assumptions; potential reduction, not
          measured savings.
        </p>
      ) : null}
      {!compact ? (
        <>
          <ul className="mt-3 grid gap-3">
            {rows.map((r) => (
              <ProcessRow key={r.id} row={r} />
            ))}
          </ul>
          {service && audit.activity[service] !== undefined ? (
            <p className="mt-3 text-sm">
              {audit.activity[service]} relevant activity records for this profile. Activity counts
              do not establish time saved.
            </p>
          ) : null}
          {relevant.length ? (
            <details className="mt-3">
              <summary className="cursor-pointer py-2 font-medium">
                Data gaps and conflicts · {relevant.length}
              </summary>
              <ul className="list-disc space-y-2 pl-5 text-sm">
                {relevant.map((g) => (
                  <li key={g.id}>
                    <strong>{g.title}:</strong> {g.detail}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <ObservationForm key={`${profileId}-${service ?? 'all'}`} rows={rows} />
        </>
      ) : (
        <p className="mt-2 text-sm">
          {all.filter((r) => r.baseline).length} processes have a reported or illustrative baseline;{' '}
          {all.filter((r) => !r.baseline).length} lack a baseline estimate. Estimates still need
          field validation.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        Potential = max(0, baseline − proposed target). Wait, exercise, eating and travel are kept
        separate. Supplied, estimated and illustrative values are not interchangeable.{' '}
        <Link to="/sources" className="text-coffee underline">
          Inspect sources and gaps
        </Link>
      </p>
    </section>
  )
}
