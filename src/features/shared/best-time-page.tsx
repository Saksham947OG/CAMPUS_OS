import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  aggregate,
  hourLabel,
  illustrativeObservations,
  MIN_SAMPLES,
  recommend,
  serviceMetric,
  serviceName,
  servicePath,
  WEEKDAYS,
  type ServiceId,
} from '@/selectors/besttime'
import { Pill, SectionCard } from '../essentials/ess-common'

const SERVICES: ServiceId[] = ['mess', 'gym', 'laundry']

/**
 * Best Time to Go (COS-SHARED-001 §3). A pattern of PAST (here: simulated) observations, never a
 * forecast and never a statement that a place is open or free right now.
 */
export function BestTimePage() {
  const [service, setService] = useState<ServiceId>('mess')
  const [weekday, setWeekday] = useState(1)
  const obs = useMemo(() => illustrativeObservations(), [])
  const bins = useMemo(() => aggregate(obs, service, weekday), [obs, service, weekday])
  const rec = recommend(bins)
  const metric = serviceMetric[service]
  const max = Math.max(1, ...bins.map((b) => b.mean ?? 0))
  const total = obs.filter((o) => o.serviceId === service).length

  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Best time to go"
        description="Patterns in earlier observations, to help you choose a quieter hour. This is not a live view, not a forecast, and says nothing about whether a place is open."
        badge={<Pill tone="warn">Illustrative simulation — not actual crowd data</Pill>}
      />
      <p
        role="note"
        className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
      >
        <strong>Illustrative simulation — not actual crowd data.</strong> No real counts or waiting
        times have been collected yet, so every number here is synthetic and only shows how the
        chart will work. {MIN_SAMPLES} or more comparable samples are needed in an hour before it is
        used.
      </p>
      <SectionCard id="bt-pick-h" title="Choose a service and a day">
        <fieldset className="flex flex-wrap gap-1.5">
          <legend className="mb-1 text-sm font-medium">Service</legend>
          {SERVICES.map((s) => (
            <Button
              key={s}
              variant="outline"
              className="min-h-11"
              aria-pressed={service === s}
              onClick={() => setService(s)}
            >
              {serviceName[s]}
            </Button>
          ))}
        </fieldset>
        <label className="mt-3 flex items-center gap-2 text-sm">
          Day of the week
          <select
            className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-sm">
          <strong>Measure:</strong> {metric.label} ({metric.unit}). <strong>Source:</strong>{' '}
          simulated, {total} synthetic observations. Counts of people and waiting minutes are
          different measures and are never compared.
        </p>
      </SectionCard>
      <SectionCard id="bt-chart-h" title={`${serviceName[service]} on ${WEEKDAYS[weekday]}s`}>
        {bins.length === 0 ? (
          <p>
            No reliable pattern available: no observations exist for this day, which is not the same
            as the place being quiet.
          </p>
        ) : (
          <>
            <ul aria-hidden="true" className="flex items-end gap-1" style={{ height: '8rem' }}>
              {bins.map((b) => (
                <li key={b.hour} className="flex flex-1 flex-col items-center justify-end">
                  <div
                    className={`w-full rounded-t ${b.enough ? 'bg-coffee' : 'border border-dashed border-border-strong bg-mist'}`}
                    style={{
                      height: `${b.mean === null ? 0 : Math.max(4, (b.mean / max) * 100)}%`,
                    }}
                  />
                </li>
              ))}
            </ul>
            <table className="mt-2 w-full text-left text-sm">
              <caption className="sr-only">
                Average {metric.label.toLowerCase()} by hour, with sample counts
              </caption>
              <thead>
                <tr>
                  <th scope="col" className="py-1 pr-2">
                    Hour
                  </th>
                  <th scope="col" className="py-1 pr-2">
                    Average ({metric.unit})
                  </th>
                  <th scope="col" className="py-1">
                    Samples
                  </th>
                </tr>
              </thead>
              <tbody>
                {bins.map((b) => (
                  <tr key={b.hour} className="border-t border-border">
                    <th scope="row" className="py-1 pr-2 font-normal">
                      {hourLabel(b.hour)}
                    </th>
                    <td className="py-1 pr-2">{b.enough ? b.mean : 'Insufficient sample'}</td>
                    <td className="py-1">
                      {b.n}
                      {b.enough ? '' : ` (needs ${MIN_SAMPLES})`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="mt-3 rounded-md bg-coffee-tint p-3 text-sm font-medium" aria-live="polite">
          {rec.kind === 'withheld'
            ? rec.reason
            : rec.kind === 'tied'
              ? `Several hours look equally quiet in this sample (${rec.hours.map(hourLabel).join(', ')}, all about ${rec.mean} ${metric.unit}). No single best hour is claimed.`
              : `Historically quietest in this sample: ${hourLabel(rec.hour)} (about ${rec.mean} ${metric.unit}). That is a past pattern, not a promise of no wait.`}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Opening hours are not supplied here, so this is not a statement that{' '}
          {serviceName[service]} is open at that time.
        </p>
        {rec.kind !== 'withheld' ? (
          <Button asChild variant="outline" className="mt-2 min-h-11">
            <Link to={servicePath[service]}>Open {serviceName[service]}</Link>
          </Button>
        ) : null}
      </SectionCard>
    </article>
  )
}
