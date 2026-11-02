import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { measureLabel } from '@/domain/shared'
import { activityLabel } from '@/domain/sports'
import { coordinationCounts } from '@/selectors/coordination'
import { computeScenario, presets, totalsByMeasure } from '@/selectors/timetax'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useMeetings } from '../meetings/meeting-hooks'
import { useSports } from '../sports/sports-hooks'
import { useShared } from './shared-hooks'

const tabs = [
  { id: 'overview', label: 'Overview', to: '/time-tax' },
  { id: 'scenarios', label: 'Scenarios', to: '/time-tax/scenarios' },
  { id: 'observations', label: 'Observations', to: '/time-tax/observations' },
]

const LEGEND = (
  <ul className="list-disc pl-5 text-sm">
    <li>
      <strong>Observed baseline:</strong> recorded waits or trips with a method, a date and a
      sample. None has been imported yet.
    </li>
    <li>
      <strong>Simulated scenario:</strong> what-ifs on assumptions you set. Always labelled
      illustrative.
    </li>
    <li>
      <strong>Observed pilot comparison:</strong> only if real before-and-after samples are ever
      collected.
    </li>
    <li>
      <strong>Causal effect:</strong> never claimed from a difference of averages alone.
    </li>
  </ul>
)

/** Event counts from this browser's demo records. Deliberately no minutes, savings or percentages. */
function CoordinationActivity() {
  const { meetings, profileId } = useMeetings()
  const { sports } = useSports()
  const c = coordinationCounts(meetings, sports, profileId)
  const units = Object.entries(c.unitReservations)
  return (
    <SectionCard id="tt-coord-h" title="Coordination activity in this demo">
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        <dt>Meetings you organised</dt>
        <dd>{c.meetingsOrganized}</dd>
        <dt>Meetings you were invited to</dt>
        <dd>{c.meetingsInvitedTo}</dd>
        <dt>Polls you created</dt>
        <dd>{c.pollsCreated}</dd>
        <dt>Polls that became a meeting</dt>
        <dd>{c.pollsFinalizedToMeeting}</dd>
        <dt>Meetings with a room held in the demo</dt>
        <dd>{c.meetingsWithRoom}</dd>
        <dt>Stale digital check-ins closed by the app</dt>
        <dd>{c.staleCheckInsClosed}</dd>
        {units.map(([activity, n]) => (
          <div key={activity} className="contents">
            <dt>{activityLabel[activity as keyof typeof activityLabel]} unit reservations</dt>
            <dd>{n}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-muted">
        These are counts of records saved in this browser by the active demo profile. They are not
        time saved, not measured outcomes and not campus results: a log of app events cannot show
        what would have happened without the app. A real comparison needs timed, comparable tasks
        with a recorded method and sample.
      </p>
    </SectionCard>
  )
}

export function TimeTaxPage() {
  const { shared, status, profileId } = useShared()
  if (status === 'loading' || !shared) return <Loading />
  const mine = shared.scenarios.filter((s) => s.ownerProfileId === profileId)
  const totals = totalsByMeasure(mine)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Time Tax"
        description="How much time students lose waiting, searching and following up, and what a change might do. Everything here is labelled by the kind of evidence behind it."
        badge={<Pill tone="warn">No measured savings yet</Pill>}
      />
      <SubNav label="Time Tax sections" items={tabs} current="overview" />
      <SectionCard id="tt-ev-h" title="Kinds of evidence">
        {LEGEND}
      </SectionCard>
      <CoordinationActivity />
      <SectionCard id="tt-sum-h" title="Your saved what-ifs">
        {mine.length === 0 ? (
          <Empty>
            You have not saved a scenario. Open Scenarios to try one. Nothing here is measured.
          </Empty>
        ) : (
          <>
            <ul className="flex flex-col gap-1 text-sm">
              {mine.map((s) => {
                const r = computeScenario(s)
                return (
                  <li key={s.id}>
                    <strong>
                      {presets.find((p) => p.serviceId === s.serviceId)?.label ?? s.serviceId}
                    </strong>
                    : {r.weeklyStudentHours.toFixed(1)} student-hours a week (illustrative,{' '}
                    {measureLabel[s.measure].toLowerCase()})
                  </li>
                )
              })}
            </ul>
            <div className="mt-3 rounded-md bg-mist p-3 text-sm">
              <p className="font-semibold">Totals by measure (never added across measures)</p>
              <ul>
                {totals.map((t) => (
                  <li key={t.measure}>
                    {measureLabel[t.measure]}: {t.hours.toFixed(1)} student-hours a week across{' '}
                    {t.count} {t.count === 1 ? 'service' : 'services'}
                  </li>
                ))}
              </ul>
              {totals.length > 1 ? (
                <p className="mt-1 text-xs text-ink-muted">
                  These measures describe different time and are not added into one total.
                </p>
              ) : null}
            </div>
          </>
        )}
      </SectionCard>
      <SectionCard id="tt-method-h" title="Method">
        <p>
          Per visit, avoided time is <code>max(0, baseline − scenario)</code>, while the signed
          change is always kept so a deterioration is visible. Weekly student-hours are{' '}
          <code>eligible students × adoption × visits per week × minutes avoided ÷ 60</code>. Each
          number is an editable assumption with its unit.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          One wait is counted once: a pre-order that moves a wait off-site and a separate queue
          metric for the same wait must not both be added.
        </p>
      </SectionCard>
    </article>
  )
}

export function TimeTaxScenariosPage() {
  const { shared, status, profileId, repo } = useShared()
  const { act, message } = useAction()
  const [serviceId, setServiceId] = useState(presets[0]!.serviceId)
  const [v, setV] = useState({
    baseline: '20',
    scenario: '4',
    students: '400',
    visits: '2',
    adoption: '50',
    weeks: '14',
  })
  if (status === 'loading' || !shared) return <Loading />
  const preset = presets.find((p) => p.serviceId === serviceId)!
  const nums = {
    baselineMinutes: Number(v.baseline),
    scenarioMinutes: Number(v.scenario),
    eligibleStudents: Number(v.students),
    visitsPerWeek: Number(v.visits),
    adoptionPercent: Number(v.adoption),
    weeks: Number(v.weeks),
  }
  const valid =
    Object.values(v).every((x) => x !== '' && Number.isFinite(Number(x)) && Number(x) >= 0) &&
    nums.adoptionPercent <= 100 &&
    Number.isInteger(nums.weeks) &&
    nums.weeks >= 1
  const r = valid ? computeScenario(nums) : null
  const field = (label: string, key: keyof typeof v, hint?: string) => (
    <Field label={label} hint={hint}>
      {(a) => (
        <input
          {...a}
          type="number"
          min={0}
          className={inputClass}
          value={v[key]}
          onChange={(e) => setV({ ...v, [key]: e.target.value })}
        />
      )}
    </Field>
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Time Tax scenarios"
        description="Change the assumptions and see what they would imply. These are what-ifs, not measurements."
        badge={<Pill tone="warn">Illustrative scenario — not observed</Pill>}
      />
      <SubNav label="Time Tax sections" items={tabs} current="scenarios" />
      <SectionCard id="sc-h" title="Assumptions">
        <Field label="Service">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} sm:w-80`}
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            >
              {presets.map((p) => (
                <option key={p.serviceId} value={p.serviceId}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="mt-1 text-sm text-ink-muted">
          Models: <strong>{measureLabel[preset.measure]}</strong>. {preset.note}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {field('Baseline minutes per visit', 'baseline', 'Assumed today.')}
          {field('Scenario minutes per visit', 'scenario', 'Assumed with the change.')}
          {field('Eligible students', 'students')}
          {field('Visits per student per week', 'visits')}
          {field('Adoption (%)', 'adoption', 'Share who would use it.')}
          {field('Weeks in the projection', 'weeks', 'Stated, not guessed.')}
        </div>
      </SectionCard>
      <SectionCard id="sc-out-h" title="What these assumptions imply">
        {r ? (
          <div aria-live="polite" className="flex flex-col gap-1">
            <p className="font-semibold">
              Per visit: {r.netPerVisit > 0 ? '−' : r.netPerVisit < 0 ? '+' : ''}
              {Math.abs(r.netPerVisit)} minutes{' '}
              {r.worsens
                ? '(MORE time, a deterioration)'
                : r.netPerVisit === 0
                  ? '(no change)'
                  : '(less time)'}
            </p>
            <p>
              Avoided per visit: {r.avoidedPerVisit} minutes
              {r.worsens
                ? ' (the avoided figure is never negative, but the +' +
                  Math.abs(r.netPerVisit) +
                  ' above is the real change)'
                : ''}
            </p>
            <p>Participants: {r.participants.toFixed(0)} students</p>
            <p>Weekly: {r.weeklyStudentHours.toFixed(2)} student-hours</p>
            <p>
              Over {nums.weeks} weeks: {r.termStudentHours.toFixed(1)} student-hours (a scenario
              projection, not a result)
            </p>
          </div>
        ) : (
          <p>
            Enter zero or positive numbers (adoption up to 100, whole weeks of at least 1) to see
            the projection.
          </p>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Assumes everyone who adopts visits equally often and saves the same time. A real figure
          needs observed baselines, a sample, a method and comparable follow-up.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            disabled={!valid}
            onClick={() =>
              void act(
                () => repo.saveScenario(profileId, { serviceId, measure: preset.measure, ...nums }),
                'Scenario saved on this device as an illustration.',
              )
            }
          >
            Save this scenario
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() =>
              void act(
                () => repo.resetScenario(profileId, serviceId),
                'Your saved scenario for this service was removed. Observations are untouched.',
              )
            }
          >
            Reset this scenario
          </Button>
        </div>
        <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
          {message}
        </output>
      </SectionCard>
    </article>
  )
}

export function TimeTaxObservationsPage() {
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Time Tax observations"
        description="Field measurements of waiting, with their method and sample."
        badge={<Pill tone="warn">None imported</Pill>}
      />
      <SubNav label="Time Tax sections" items={tabs} current="observations" />
      <SectionCard id="ob-h" title="Observed baselines">
        <Empty>
          No field observations imported. Nothing here is measured, so no observed chart is drawn.
          Resetting a scenario never removes observations.
        </Empty>
        <p className="mt-3 text-sm">
          To describe a result as field-observed, record the protocol, sample size, units,
          observation windows, missing-value treatment and date. A demo order’s timestamps are not a
          student-hour field study.
        </p>
      </SectionCard>
    </article>
  )
}
