import { useServices } from '@/app/services'
import { ProcessTimeTax } from '../sources/process-time-tax'
import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { operationsView } from '@/selectors/chill'
import { useChill } from './use-chill'
import {
  hypotheticalWeeklyHours,
  isValidOrderCount,
  pickupDelaySensitivity,
  compareWaiting,
  ILLUSTRATIVE_BASELINE,
  ILLUSTRATIVE_ORDER_AHEAD,
  isValidWait,
  type WaitComponents,
} from '@/selectors/chill-timetax'

const KEYS: { key: keyof WaitComponents; label: string }[] = [
  { key: 'counter', label: 'Counter-ordering wait (minutes)' },
  { key: 'onSite', label: 'On-site preparation wait (minutes)' },
  { key: 'pickup', label: 'Pickup / payment wait (minutes)' },
]

function PathInputs({
  title,
  values,
  onChange,
}: {
  title: string
  values: Record<keyof WaitComponents, string>
  onChange: (k: keyof WaitComponents, v: string) => void
}) {
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border border-border bg-surface p-3">
      <legend className="px-1 text-sm font-semibold text-ink">{title}</legend>
      {KEYS.map(({ key, label }) => {
        const n = Number(values[key])
        return (
          <Field
            key={key}
            label={label}
            error={
              values[key] !== '' && !isValidWait(n)
                ? 'Enter a whole number from 0 to 240'
                : undefined
            }
          >
            {(a) => (
              <input
                {...a}
                type="number"
                min={0}
                max={240}
                className={inputClass}
                value={values[key]}
                onChange={(e) => onChange(key, e.target.value)}
              />
            )}
          </Field>
        )
      })}
    </fieldset>
  )
}

const toStrings = (w: WaitComponents) => ({
  counter: String(w.counter),
  onSite: String(w.onSite),
  pickup: String(w.pickup),
})

type View = 'scenario' | 'operations' | 'field'
const VIEWS: { id: View; label: string }[] = [
  { id: 'scenario', label: 'Scenario Lab' },
  { id: 'operations', label: 'Operations view' },
  { id: 'field', label: 'Field observations' },
]

/** Three kinds of figure, kept apart: assumed, recorded in this prototype, and observed in the field. */
export function TimeTaxPanel() {
  const { sourceData } = useServices()
  return sourceData ? <ProcessTimeTax service="chill-spot" /> : <LegacyTimeTaxPanel />
}
function LegacyTimeTaxPanel() {
  const [view, setView] = useState<View>('scenario')
  return (
    <section aria-label="Time Tax views" className="flex flex-col gap-3">
      <div
        role="tablist"
        aria-label="Time Tax views"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            aria-selected={view === v.id}
            className={cn(
              'min-h-11 border-b-4 px-4 py-2 text-sm font-medium text-ink',
              view === v.id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist',
            )}
            onClick={() => setView(v.id)}
          >
            {v.label}
          </button>
        ))}
      </div>
      {view === 'scenario' ? <ScenarioLab /> : null}
      {view === 'operations' ? <OperationsView /> : null}
      {view === 'field' ? <FieldObservations /> : null}
    </section>
  )
}

const minutesText = (m: number | null) =>
  m === null ? 'Not enough recorded' : `${m < 1 ? '<1' : Math.round(m * 10) / 10} min (median)`

/** Counts and logged durations from this prototype's own events. Not physical waiting, not a forecast. */
function OperationsView() {
  const { café } = useChill()
  if (!café) return <output className="block text-ink-muted">Loading…</output>
  const v = operationsView(café.orders)
  const pct = (x: { n: number; of: number }) =>
    x.of === 0 ? 'No digital requests yet' : `${x.n} of ${x.of} digital requests`
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        Operations view
        <span className="rounded-full border border-border-strong bg-mist px-2 py-0.5 text-xs font-semibold">
          Recorded in prototype · reference data
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        Counts of <strong>orders</strong> and the time between events this app recorded. These are
        not minutes a student stood waiting, they do not show saved time, and they do not predict
        the real café.
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-2">
          <dt>Recorded walk-in orders</dt>
          <dd>{v.walkInRecorded}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Digital requests submitted</dt>
          <dd>{v.digitalSubmitted}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Digital requests accepted</dt>
          <dd>{v.digitalAccepted}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Awaiting acceptance</dt>
          <dd>{v.perState.pending}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Queued</dt>
          <dd>{v.perState.queued}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Preparing</dt>
          <dd>{v.perState.preparing}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Ready</dt>
          <dd>{v.perState.ready}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Collected</dt>
          <dd>{v.perState.collected}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Declined</dt>
          <dd>{pct(v.rejectionRate)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Cancelled before acceptance</dt>
          <dd>{pct(v.cancellationRate)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Started out of sequence (logged)</dt>
          <dd>{v.outOfSequence}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Flagged needs attention</dt>
          <dd>{v.flagged}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt>Self-reported arrivals (not verified)</dt>
          <dd>{v.arrivalsReported}</dd>
        </div>
      </dl>
      <h3 className="mt-3 text-sm font-semibold text-ink">Logged durations</h3>
      <table className="mt-1 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th scope="col" className="py-1 pr-2">
              Between
            </th>
            <th scope="col" className="py-1 pr-2">
              Orders with both times
            </th>
            <th scope="col" className="py-1">
              Result
            </th>
          </tr>
        </thead>
        <tbody>
          {v.durations.map((d) => (
            <tr key={d.label} className="border-b border-border">
              <th scope="row" className="py-1.5 pr-2 font-normal">
                {d.label}
              </th>
              <td className="py-1.5 pr-2">{d.n}</td>
              <td className="py-1.5">{minutesText(d.medianMinutes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-muted">
        Request turnaround, queue delay and ready-to-collection are different intervals. None of
        them is on-site waiting, which needs an observer or a validated check-in.
      </p>
    </div>
  )
}

/** No observation has been imported, so there is nothing to chart (V2 §6.4). */
function FieldObservations() {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        Field observations
        <span className="rounded-full border border-border-strong bg-mist px-2 py-0.5 text-xs font-semibold">
          None imported
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink-muted" data-testid="field-empty">
        Nothing has been measured, so there is no chart and no finding here. A real comparison needs
        observations with an anonymous sample id, the day and demand window, counter arrival, order
        placement, ready and handover times, the method, the sample size and what could not be
        observed. Staffing, food complexity, time of day and unrecorded walk-ins would also need to
        be reported. CampusOS does not generate missing fields, and digital timestamps alone cannot
        show how long a student stood waiting.
      </p>
    </div>
  )
}

/** What-if only. Observed results need real fieldwork, which has not been done (§10.2). */
function ScenarioLab() {
  const [weekly, setWeekly] = useState('200')
  const [base, setBase] = useState(toStrings(ILLUSTRATIVE_BASELINE))
  const [ahead, setAhead] = useState(toStrings(ILLUSTRATIVE_ORDER_AHEAD))
  const parse = (v: Record<keyof WaitComponents, string>) => ({
    counter: Number(v.counter),
    onSite: Number(v.onSite),
    pickup: Number(v.pickup),
  })
  const b = parse(base)
  const a = parse(ahead)
  const valid =
    [...Object.values(b), ...Object.values(a)].every(isValidWait) &&
    [...Object.values(base), ...Object.values(ahead)].every((s) => s !== '')
  const cmp = valid ? compareWaiting(b, a) : null

  return (
    <section aria-labelledby="tt-h" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="tt-h" className="flex items-center gap-2 text-base font-semibold text-ink">
        <FlaskConical className="size-4 text-coffee" aria-hidden="true" /> Time Tax scenario
        <span className="rounded-full border border-border-strong bg-terracotta-tint px-2 py-0.5 text-xs font-semibold">
          Illustrative scenario, not an observation
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        A what-if on assumptions you can change. It is <strong>not</strong> a measurement of the
        real Chill Spot, and the numbers below are examples. Waiting you stand through is different
        from total time between ordering and collecting, so the two are never mixed.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <PathInputs
          title="Traditional path (assumed)"
          values={base}
          onChange={(k, v) => setBase((s) => ({ ...s, [k]: v }))}
        />
        <PathInputs
          title="Order-ahead path (assumed)"
          values={ahead}
          onChange={(k, v) => setAhead((s) => ({ ...s, [k]: v }))}
        />
      </div>

      <div className="mt-3 rounded-md bg-coffee-tint p-3 text-sm text-ink" aria-live="polite">
        {cmp ? (
          <>
            <p className="font-semibold">
              Illustrative net waiting change:{' '}
              {cmp.netChangeMinutes > 0 ? '−' : cmp.netChangeMinutes < 0 ? '+' : ''}
              {Math.abs(cmp.netChangeMinutes)} minutes{' '}
              {cmp.direction === 'less'
                ? '(less physical waiting)'
                : cmp.direction === 'more'
                  ? '(MORE physical waiting)'
                  : '(no change)'}
            </p>
            <p>
              = baseline {cmp.baselineMinutes} min − order-ahead {cmp.orderAheadMinutes} min
            </p>
            <p className="mt-1">
              Hypothetical potential waiting avoided:{' '}
              <strong>{cmp.potentialAvoidedMinutes} minutes</strong> per visit (never below zero;
              the signed result above is the full picture).
            </p>
            {cmp.direction === 'more' ? (
              <p className="mt-1 font-medium">
                On these assumptions ordering ahead would increase waiting.
              </p>
            ) : null}
          </>
        ) : (
          <p>Enter whole numbers from 0 to 240 in every box to see the comparison.</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          This does not mean cooking is faster, or that anyone at the real Chill Spot saved this
          time.
        </p>
      </div>
      {cmp ? (
        <div className="mt-3 text-sm text-ink">
          <label className="flex flex-wrap items-center gap-2">
            Assumed eligible order-ahead orders per week
            <input
              type="number"
              min={0}
              className={cn(inputClass, 'w-28')}
              value={weekly}
              onChange={(e) => setWeekly(e.target.value)}
            />
          </label>
          {isValidOrderCount(Number(weekly)) && weekly !== '' ? (
            <p className="mt-1" data-testid="weekly-hours">
              Hypothetical weekly student hours avoided = {Number(weekly)} ×{' '}
              {cmp.potentialAvoidedMinutes} min ÷ 60 ={' '}
              <strong>
                {(
                  hypotheticalWeeklyHours(Number(weekly), cmp.potentialAvoidedMinutes) ?? 0
                ).toFixed(1)}{' '}
                h
              </strong>{' '}
              (assumption-driven, Scenario Mode only; never a measured result).
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">Enter a whole number from 0 to 100000.</p>
          )}
          <h3 className="mt-3 text-sm font-semibold text-ink">
            If the student arrives early and waits on site
          </h3>
          <table className="mt-1 text-left text-sm" data-testid="sensitivity">
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                <th scope="col" className="py-1 pr-4">
                  Extra on-site wait
                </th>
                <th scope="col" className="py-1">
                  Net change
                </th>
              </tr>
            </thead>
            <tbody>
              {pickupDelaySensitivity(b, a).map((r) => (
                <tr key={r.extra} className="border-b border-border">
                  <th scope="row" className="py-1 pr-4 font-normal">
                    +{r.extra} min
                  </th>
                  <td className="py-1">
                    {r.net > 0
                      ? `${r.net} min less waiting`
                      : r.net < 0
                        ? `${Math.abs(r.net)} min MORE waiting`
                        : 'no change'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <Button
        variant="ghost"
        className="mt-2 min-h-11"
        onClick={() => {
          setBase(toStrings(ILLUSTRATIVE_BASELINE))
          setAhead(toStrings(ILLUSTRATIVE_ORDER_AHEAD))
        }}
      >
        Reset to the example numbers
      </Button>

      <h3 className="mt-3 text-sm font-semibold text-ink">Observed results</h3>
      <p className="text-sm text-ink-muted">
        None recorded. A real comparison needs field observations: mode (walk-in or order-ahead),
        anonymous sample id, date and rush window, counter arrival, order placement, ready and
        handover times, method, sample size and known gaps. CampusOS does not generate missing
        fields, and digital timestamps alone cannot show how long a student stood waiting. Staffing,
        food complexity, time of day and unrecorded walk-ins would also need to be reported.
      </p>
    </section>
  )
}
