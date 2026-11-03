import { useState } from 'react'
import { Link } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useWorkspaceState } from '@/app/workspace-store'
import { personaEvidence, potentialRange, type ProcessEvidence } from '@/data/campus/evidence'
import { collaborationCounts } from '@/selectors/workspace'
import { inputClass } from '@/components/form-kit'
import { cn } from '@/lib/utils'
import { SectionCard } from '../essentials/ess-common'

const mid = (r: [number, number] | null) => (r ? Math.round(((r[0] + r[1]) / 2) * 10) / 10 : 0)

/**
 * Interactive baseline-versus-proposed comparison (design spec §13). Every number the student can change is a
 * labelled assumption; the result is a SCENARIO calculation, never a measured saving.
 */
export function TimeTaxCompare() {
  const profileId = useAppStore((s) => s.activeProfileId)
  const rows = personaEvidence(profileId).filter((r) => r.baseline && r.target)
  const [pick, setPick] = useState('')
  const row: ProcessEvidence | undefined =
    rows.find((r) => r.id === pick) ?? rows.find((r) => r.includeInComposite) ?? rows[0]
  if (!row) return null
  return <Compare key={`${profileId}-${row.id}`} rows={rows} row={row} onPick={setPick} />
}

function Compare({
  rows,
  row,
  onPick,
}: {
  rows: ProcessEvidence[]
  row: ProcessEvidence
  onPick: (id: string) => void
}) {
  const [base, setBase] = useState(mid(row.baseline))
  const [prop, setProp] = useState(mid(row.target))
  const [uses, setUses] = useState(5)
  const [weeks, setWeeks] = useState(0)
  const per = Math.max(0, base - prop)
  const perWeek = Math.round(per * uses * 10) / 10
  const scale = Math.max(base, prop, 1)
  const range = potentialRange(row)
  return (
    <SectionCard id="tt-compare-h" title="Compare a process before and after">
      <p className="mb-3 text-sm text-ink-muted">
        Pick a process, then change the labelled assumptions. The bars and the weekly figure update;
        nothing here is measured.
      </p>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_1fr]">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            Process to compare
            <select className={inputClass} value={row.id} onChange={(e) => onPick(e.target.value)}>
              {rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {(
            [
              ['Wait today, minutes per use', base, setBase, 0, 120],
              ['Proposed wait, minutes per use', prop, setProp, 0, 120],
              ['Uses per week', uses, setUses, 0, 21],
              ['Weeks it applies (optional)', weeks, setWeeks, 0, 40],
            ] as const
          ).map(([label, value, set, min, max]) => (
            <label key={label} className="flex flex-col gap-1 text-sm font-medium text-ink">
              {label}
              <input
                type="number"
                inputMode="decimal"
                min={min}
                max={max}
                step={0.5}
                value={value}
                onChange={(e) => set(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
                className={inputClass}
              />
            </label>
          ))}
          <p className="text-xs text-ink-muted">
            Starting values are the midpoints of this persona’s{' '}
            {row.basis === 'reported'
              ? 'reported'
              : row.basis === 'estimated'
                ? 'estimated'
                : 'planning-assumption'}{' '}
            range
            {range ? ` (potential ${range[0]}–${range[1]} min per use)` : ''}. Frequency is yours to
            set; the sources do not supply it.
          </p>
        </div>
        <div>
          <div className="flex flex-col gap-3" aria-hidden="true">
            {(
              [
                ['Today', base, 'bg-terracotta'],
                ['Proposed', prop, 'bg-teal'],
              ] as const
            ).map(([label, v, color]) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs text-ink-muted">
                  <span>{label}</span>
                  <span>{v} min per use</span>
                </div>
                <div className="h-5 overflow-hidden rounded-md bg-mist">
                  <div
                    className={cn('tt-bar h-full rounded-md', color)}
                    style={{ width: `${(v / scale) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            <div>
              <div className="mb-1 text-xs text-ink-muted">Time given back</div>
              <div className="flex h-5 overflow-hidden rounded-md bg-mist">
                <div
                  className="tt-bar h-full rounded-md bg-teal-strong"
                  style={{ width: `${(per / scale) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <output className="mt-3 block text-lg font-semibold text-ink" aria-live="off">
            {per} min per use · {perWeek} min per week
            {weeks ? ` · ${Math.round(perWeek * weeks)} min over ${weeks} weeks` : ''}
          </output>
          <p className="text-sm text-ink-muted">
            Formula: (today − proposed) × uses per week{weeks ? ' × weeks' : ''}.{' '}
            {weeks
              ? 'A semester figure assumes the change applies in every one of those weeks.'
              : 'Add the number of weeks to see a longer period; it is never assumed.'}
          </p>
          <table className="mt-3 w-full text-left text-sm">
            <caption className="sr-only">Comparison as a table</caption>
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th scope="col" className="py-1">
                  Measure
                </th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className="py-1 font-normal">
                  Today (per use)
                </th>
                <td>{base} min</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-normal">
                  Proposed (per use)
                </th>
                <td>{prop} min</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-normal">
                  Uses per week
                </th>
                <td>{uses}</td>
              </tr>
              <tr>
                <th scope="row" className="py-1 font-normal">
                  Potential reduction per week
                </th>
                <td>{perWeek} min</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-ink-muted">
            Scenario calculation on assumptions you set. Source: {row.note}
          </p>
        </div>
      </div>
    </SectionCard>
  )
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

const JOBS: {
  job: string
  before: string
  here: string
  count: (c: ReturnType<typeof collaborationCounts>) => string
  to: string
}[] = [
  {
    job: 'Agree a time',
    before: 'A chat thread, then a poll tool, then a calendar invite',
    here: 'Find a team time, a poll, and the booked meeting',
    count: (c) => `${plural(c.polls, 'poll')} · ${plural(c.meetings, 'meeting')}`,
    to: '/workspace',
  },
  {
    job: 'Hold a room',
    before: 'Walk over to see if a room is free',
    here: 'A campus room held with the meeting',
    count: (c) => `${plural(c.roomsHeld, 'meeting')} with a room held`,
    to: '/workspace',
  },
  {
    job: 'Assign work',
    before: 'A message, copied into a spreadsheet',
    here: 'A task with one owner and a date',
    count: (c) =>
      `${plural(c.tasksAssignedToMe, 'task')} mine of ${c.tasksInProjects} in my projects`,
    to: '/workspace',
  },
  {
    job: 'Keep a decision',
    before: 'Buried in a thread',
    here: 'A decision record with who and when',
    count: (c) => `${plural(c.decisionsRecorded, 'decision')} recorded`,
    to: '/workspace',
  },
  {
    job: 'Share evidence',
    before: 'A sheet, a document and email attachments',
    here: 'One evidence register and files on the project',
    count: (c) => `${plural(c.evidenceRows, 'evidence row')} · ${plural(c.files, 'file')}`,
    to: '/workspace',
  },
  {
    job: 'Know what changed',
    before: 'Re-reading messages to find the latest',
    here: 'Page history, comments and an activity feed',
    count: (c) => `${plural(c.comments, 'comment')} on pages I can open`,
    to: '/workspace',
  },
]

/**
 * Cross-collaboration section: which separate-platform jobs Workspace folds into one place, with counts of the
 * records that exist for this persona. The minutes live in the planning scenario above; this table only counts.
 */
export function CollaborationFriction() {
  const profileId = useAppStore((s) => s.activeProfileId)
  const ws = useWorkspaceState((s) => s.workspace)
  const c = collaborationCounts(ws, profileId)
  const row = personaEvidence(profileId).find((r) => r.id === 'collaboration')
  const range = row ? potentialRange(row) : null
  return (
    <SectionCard id="tt-collab-h" title="Cross-collaboration: one place instead of five platforms">
      <p className="mb-3 text-sm text-ink-muted">
        A group task usually spreads over a chat, a spreadsheet, a calendar, a document and email.
        Workspace keeps each job in one record. You work with {c.teammates} teammate
        {c.teammates === 1 ? '' : 's'} across {c.sharedSpaces} shared{' '}
        {c.sharedSpaces === 1 ? 'space' : 'spaces'} here.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-176 text-left text-sm">
          <caption className="sr-only">
            Coordination jobs, how they are done on separate platforms, and the records held in
            CampusOS
          </caption>
          <thead>
            <tr className="border-b border-border text-ink-muted">
              <th scope="col" className="py-2 pr-3">
                Job
              </th>
              <th scope="col" className="pr-3">
                On separate platforms
              </th>
              <th scope="col" className="pr-3">
                In CampusOS
              </th>
              <th scope="col">Records for you</th>
            </tr>
          </thead>
          <tbody>
            {JOBS.map((j) => (
              <tr key={j.job} className="border-b border-border align-top">
                <th scope="row" className="py-2 pr-3 font-medium">
                  {j.job}
                </th>
                <td className="pr-3 text-ink-muted">{j.before}</td>
                <td className="pr-3">{j.here}</td>
                <td>
                  <Link to={j.to} className="underline">
                    {j.count(c)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 rounded-md bg-teal-tint p-3 text-sm text-ink">
        <strong>Planning scenario:</strong> re-finding the latest decision, owner, time slot and
        file is assumed to cost 10–15 minutes a day on separate platforms and 3–4 in one place
        {range ? `, a potential reduction of ${range[0]}–${range[1]} minutes` : ''}. This is counted
        in your total above. It is an assumption of this build, not a measurement.
      </p>
      <p className="mt-2 text-xs text-ink-muted">
        Record counts come from this browser’s Workspace, including sample content labelled as such.
        Counts show the jobs exist; they do not establish time saved.
      </p>
    </SectionCard>
  )
}
