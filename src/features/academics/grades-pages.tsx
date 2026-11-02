import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { academicRecords, attendanceRecords } from '@/data/seeds/demo/academic-records'
import {
  DEMO_SCALE,
  ifAttended,
  ifMissed,
  plan,
  projectedCgpa,
  quality,
  requiredSgpa,
  sgpa,
  type Course,
} from '@/domain/academic-tools'
import { Empty, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { academicsTabs } from './academics-nav'

const fmt = (n: number, d = 2) => n.toFixed(d)
const letters = Object.keys(DEMO_SCALE.points)

function priorOf(past: { courses: Course[] }[]) {
  const all = past.flatMap((s) => s.courses)
  const q = quality(all)
  return q.ok && q.value.credits > 0
    ? { cgpa: q.value.points / q.value.credits, credits: q.value.credits }
    : null
}

/** Grades, a what-if calculator and a target planner. Hypothetical grades never overwrite a recorded one. */
export function GradesPage() {
  const profileId = useAppStore((s) => s.activeProfileId)
  const rec = academicRecords[profileId]
  const [tab, setTab] = useState<'grades' | 'calc' | 'target'>('grades')
  const [sim, setSim] = useState<Record<string, string>>({})
  const [target, setTarget] = useState('8.0')
  const [planned, setPlanned] = useState('')
  const prior = useMemo(() => (rec ? priorOf(rec.past) : null), [rec])
  if (!rec)
    return (
      <article className="flex max-w-4xl flex-col gap-4">
        <PageHeader
          title="Grades and GPA"
          badge={<Pill tone="demo">Demo · fictional records</Pill>}
        />
        <SubNav label="Academics sections" items={academicsTabs} current="grades" />
        <Empty>
          No grades are recorded for this demo profile, so there is nothing to calculate.
        </Empty>
      </article>
    )
  const simulated: Course[] = rec.current.courses.map((x) => ({
    ...x,
    grade: x.grade ?? (sim[x.code] || undefined),
  }))
  const currentCredits = rec.current.courses.reduce((a, x) => a + x.credits, 0)
  const proj = prior ? projectedCgpa(prior.cgpa, prior.credits, simulated) : null
  const req = prior
    ? requiredSgpa(
        Number(target),
        prior.cgpa,
        prior.credits,
        Number(planned) > 0 ? Number(planned) : currentCredits,
      )
    : null
  const sem = (s: { id: string; label: string; courses: Course[] }) => {
    const g = sgpa(s.courses)
    return (
      <SectionCard key={s.id} id={`sem-${s.id}`} title={s.label}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs text-ink-muted">
              <th scope="col" className="py-1">
                Course
              </th>
              <th scope="col">Credits</th>
              <th scope="col">Grade</th>
            </tr>
          </thead>
          <tbody>
            {s.courses.map((x) => (
              <tr key={x.code} className="border-b border-border">
                <th scope="row" className="py-1.5 font-normal">
                  {x.code} · {x.name}
                </th>
                <td>{x.credits}</td>
                <td>{x.grade ?? 'Pending (not zero)'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-1 text-sm">
          SGPA so far: <strong>{g.ok ? fmt(g.value) : 'not available yet'}</strong> · source: demo
          fixture
        </p>
      </SectionCard>
    )
  }
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Grades and GPA"
        description="Recorded results, a what-if calculator and a target planner. Hypothetical grades are kept apart from recorded ones."
        badge={<Pill tone="demo">Demo · fictional records, demo grade scale</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="grades" />
      <div
        role="tablist"
        aria-label="Grade tools"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {(
          [
            ['grades', 'Grades'],
            ['calc', 'Calculator'],
            ['target', 'Target Goal'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`min-h-11 border-b-4 px-4 py-2 text-sm font-medium ${tab === id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-xs text-ink-muted">
        {DEMO_SCALE.label}. Failures, repeats, withdrawals and pass/fail rules are not configured,
        so none is applied. Prior CGPA is computed from the recorded grades above.
      </p>
      {tab === 'grades' ? (
        <>
          <SectionCard id="gr-sum-h" title="Summary">
            <p data-testid="prior">
              Finalized:{' '}
              {prior ? (
                <>
                  <strong>CGPA {fmt(prior.cgpa)}</strong> over {prior.credits} credits
                </>
              ) : (
                'no finalized credits'
              )}{' '}
              · Current semester enrolled: {currentCredits} credits (
              {rec.current.courses.filter((x) => !x.grade).length} grade(s) pending)
            </p>
          </SectionCard>
          {rec.past.map(sem)}
          {sem(rec.current)}
        </>
      ) : null}
      {tab === 'calc' ? (
        <SectionCard id="gr-calc-h" title="What if? (simulation only)">
          <ul className="flex flex-col gap-2">
            {rec.current.courses.map((x) => (
              <li key={x.code} className="flex flex-wrap items-center gap-3 text-sm">
                <span className="min-w-56">
                  {x.code} · {x.credits} credits
                </span>
                {x.grade ? (
                  <span>
                    Recorded: <strong>{x.grade}</strong> (cannot be changed here)
                  </span>
                ) : (
                  <label className="flex items-center gap-2">
                    Simulated grade
                    <select
                      className={`${inputClass} w-28`}
                      value={sim[x.code] ?? ''}
                      onChange={(e) => setSim({ ...sim, [x.code]: e.target.value })}
                    >
                      <option value="">Pending</option>
                      {letters.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </li>
            ))}
          </ul>
          <div
            className="mt-3 rounded-md bg-coffee-tint p-3 text-sm"
            aria-live="polite"
            data-testid="projection"
          >
            {!prior ? (
              <p>No finalized credits to project from.</p>
            ) : proj?.ok ? (
              <>
                <p>
                  Previous CGPA {fmt(prior.cgpa)} over {prior.credits} credits
                </p>
                <p>
                  Projected SGPA <strong>{fmt(proj.value.sgpa)}</strong> over {proj.value.credits}{' '}
                  graded credits · projected CGPA <strong>{fmt(proj.value.cgpa)}</strong> (
                  {proj.value.cgpa - prior.cgpa >= 0 ? '+' : ''}
                  {fmt(proj.value.cgpa - prior.cgpa)})
                </p>
                <p className="text-xs text-ink-muted">
                  Projection, not a result. Pending courses are left out, not counted as zero.
                </p>
              </>
            ) : (
              <p>{proj && !proj.ok ? proj.reason : ''}</p>
            )}
          </div>
          <Button variant="outline" className="mt-2 min-h-11" onClick={() => setSim({})}>
            Reset simulation
          </Button>
        </SectionCard>
      ) : null}
      {tab === 'target' ? (
        <SectionCard id="gr-target-h" title="Target Goal">
          <div className="flex flex-wrap gap-3">
            <Field label="Target CGPA">
              {(a) => (
                <input
                  {...a}
                  inputMode="decimal"
                  className={`${inputClass} w-28`}
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Planned current credits"
              hint={`Left blank, your ${currentCredits} enrolled credits are used.`}
            >
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={`${inputClass} w-32`}
                  value={planned}
                  onChange={(e) => setPlanned(e.target.value)}
                />
              )}
            </Field>
          </div>
          <div
            className="mt-3 rounded-md bg-coffee-tint p-3 text-sm"
            aria-live="polite"
            data-testid="required"
          >
            {!prior ? (
              <p>No finalized credits to plan from.</p>
            ) : req?.ok ? (
              req.value.feasibility === 'notAchievable' ? (
                <p>
                  Not achievable within these credits: it would need an SGPA of{' '}
                  {fmt(req.value.required)}, above the scale’s maximum of 10.
                </p>
              ) : req.value.feasibility === 'already' ? (
                <p>
                  The target needs an SGPA of {fmt(req.value.required)}, at or below the lowest
                  grade point, so it does not constrain this semester. That is not a promise about
                  eligibility.
                </p>
              ) : (
                <p>
                  You would need an SGPA of about <strong>{fmt(req.value.required)}</strong> this
                  semester to reach a CGPA of {target}.
                </p>
              )
            ) : (
              <p>{req && !req.ok ? req.reason : ''}</p>
            )}
            <p className="text-xs text-ink-muted">
              Arithmetic only. Real grading may be relative, and this does not predict results.
            </p>
          </div>
        </SectionCard>
      ) : null}
    </article>
  )
}

/** Attendance Planner: meets the configured target, or what it takes. Not "safe to skip". */
export function AttendancePage() {
  const profileId = useAppStore((s) => s.activeProfileId)
  const courses = attendanceRecords[profileId]
  const [k, setK] = useState<Record<string, string>>({})
  if (!courses)
    return (
      <article className="flex max-w-4xl flex-col gap-4">
        <PageHeader
          title="Attendance planner"
          badge={<Pill tone="demo">Demo · fictional counts</Pill>}
        />
        <SubNav label="Academics sections" items={academicsTabs} current="attendance" />
        <Empty>No attendance sessions are recorded for this demo profile.</Empty>
      </article>
    )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Attendance planner"
        description="See whether you meet a configured target, and what a few missed or attended sessions would change."
        badge={<Pill tone="demo">Demo · targets are not a college rule</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="attendance" />
      <p role="note" className="rounded-md border border-border-strong bg-mist p-3 text-sm">
        Attendance is one requirement, not a guarantee of exam eligibility. Approved leave counts
        only as your college’s policy says, which is not configured here.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => {
          const p = plan({ attended: c.attended, held: c.held, target: c.target })
          const n = Math.max(0, Math.floor(Number(k[c.code] ?? 1)) || 0)
          const over = c.remaining !== undefined && n > c.remaining
          return (
            <li
              key={c.code}
              className="rounded-lg border border-border bg-surface p-4"
              data-course={c.code}
            >
              <h2 className="font-semibold">
                {c.code} · {c.name}
              </h2>
              <p className="text-sm">
                {c.attended} of {c.held} sessions attended ·{' '}
                {p.ok && p.value.current !== null
                  ? `${p.value.current.toFixed(1)}%`
                  : 'no sessions recorded'}{' '}
                · target {Math.round(c.target * 100)}% (demo)
              </p>
              {p.ok ? (
                <p className="mt-1 text-sm font-medium" data-testid={`status-${c.code}`}>
                  {p.value.meetsTarget
                    ? `Meets the configured target. Up to ${p.value.missable} more session${p.value.missable === 1 ? '' : 's'} could be missed and it would still be met.`
                    : p.value.impossible
                      ? 'Below target, and a 100% target cannot be recovered after a missed session.'
                      : p.value.needed !== null
                        ? `Below target. Attend the next ${p.value.needed} session${p.value.needed === 1 ? '' : 's'} in a row to reach it.`
                        : 'No sessions recorded yet.'}
                </p>
              ) : (
                <p role="alert">{p.reason}</p>
              )}
              <label className="mt-2 flex items-center gap-2 text-sm">
                Next
                <input
                  className={`${inputClass} w-20`}
                  inputMode="numeric"
                  value={k[c.code] ?? '1'}
                  onChange={(e) => setK({ ...k, [c.code]: e.target.value.replace(/\D/g, '') })}
                  aria-label={`Sessions to compare for ${c.code}`}
                />
                sessions
              </label>
              {over ? (
                <p className="text-xs text-danger">
                  Only {c.remaining} sessions are known to remain.
                </p>
              ) : null}
              <p className="mt-1 text-sm">
                If you miss them:{' '}
                <strong>{ifMissed(c.attended, c.held, n)?.toFixed(1) ?? '—'}%</strong> · if you
                attend them:{' '}
                <strong>{ifAttended(c.attended, c.held, n)?.toFixed(1) ?? '—'}%</strong>
              </p>
            </li>
          )
        })}
      </ul>
      <p className="text-sm">
        <Link to="/academics" className="underline">
          Back to Academics
        </Link>
      </p>
    </article>
  )
}
