/* The progress bar is styled with design tokens, which the native meter element cannot take. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import {
  createDecision,
  createPage,
  createSource,
  deleteSource,
  finalizeDecision,
  reopenDecision,
  updateSource,
} from '@/domain/workspace-logic'
import type { EvidenceSource, Project } from '@/domain/workspace'
import { formatDayMonth, formatInstant } from '@/lib/time'
import {
  decisionsFor,
  readablePages,
  sourcesFor,
  taskCounts,
  upcomingMeetings,
  workload,
} from '@/selectors/workspace'
import type { WorkspaceApi } from './use-workspace'
import { AssistPanel } from './assist-panel'
import { FilesPanel } from './files-panel'
import { ImportEvidence } from './import-cards'
import { AudiencePill, Empty, LifecyclePill, Pill, WsCard, fieldClass } from './ws-ui'

export function OverviewTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor } = w
  const n = taskCounts(ws, project.id)
  const meetings = upcomingMeetings(ws, actor, w.now.today)
    .filter((m) => m.projectId === project.id)
    .slice(0, 3)
  const open = decisionsFor(ws, project.id).filter((d) => !d.outcome)
  const load = workload(ws, project.id)
  const home = project.homePageId ? ws.pages.find((p) => p.id === project.homePageId) : undefined
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <WsCard title="Purpose" id="ov-purpose">
        <p className="text-sm">{project.purpose ?? 'No purpose written yet.'}</p>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-ink-muted">Owner</dt>
          <dd>{w.name(project.ownerId)}</dd>
          <dt className="text-ink-muted">Team target</dt>
          <dd>
            {project.targetDate
              ? `${formatDayMonth(project.targetDate)} (the team’s own date)`
              : 'Not set'}
          </dd>
          <dt className="text-ink-muted">Official deadline</dt>
          <dd>
            {project.deadline
              ? `${formatDayMonth(project.deadline.date)} · source: ${project.deadline.source}`
              : 'Not entered. Add it only if your professor gave one.'}
          </dd>
        </dl>
        {home ? (
          <p className="mt-3 text-sm">
            Project home:{' '}
            <Link to={`/workspace/pages/${home.id}`} className="font-medium underline">
              {home.title || 'Untitled'}
            </Link>
          </p>
        ) : null}
      </WsCard>
      <WsCard title="Progress" id="ov-progress">
        <p className="text-2xl font-semibold text-ink">
          {n.done} of {n.total} tasks done
        </p>
        <div
          className="mt-2 h-3 overflow-hidden rounded bg-mist"
          role="meter"
          aria-label="Tasks done"
          aria-valuemin={0}
          aria-valuemax={Math.max(n.total, 1)}
          aria-valuenow={n.done}
        >
          <div
            className="h-full rounded bg-teal-strong"
            style={{ width: `${n.total ? (n.done / n.total) * 100 : 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Counts tasks only, from their status. Canceled tasks ({n.canceled}) are left out. Edits or
          word counts are never used as progress.
          {n.blocked ? ` ${n.blocked} task${n.blocked === 1 ? ' is' : 's are'} blocked.` : ''}
        </p>
      </WsCard>
      <WsCard title="Next meetings" id="ov-meet">
        {meetings.length ? (
          <ul className="text-sm">
            {meetings.map((m) => (
              <li key={m.id}>
                {m.title} · {formatDayMonth(m.date)}, {m.start}–{m.end}
                {m.roomLabel ? ` · ${m.roomLabel}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No meeting booked. Open the Calendar tab to find a team time.</Empty>
        )}
      </WsCard>
      <WsCard title="Open decisions and load" id="ov-open">
        <p className="text-sm">
          {open.length
            ? `${open.length} open: ${open.map((d) => d.question).join('; ')}`
            : 'No open decisions.'}
        </p>
        {load.length ? (
          <p className="mt-2 text-sm text-ink-muted">
            Most open tasks: {w.name(load[0]!.userId)} ({load[0]!.open}).
          </p>
        ) : null}
      </WsCard>
    </div>
  )
}

export function DocsTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, act } = w
  const navigate = useNavigate()
  const pages = readablePages(ws, actor, { spaceId: project.spaceId }).filter(
    (p) => p.projectId === project.id || p.id === project.homePageId,
  )
  const edit = can(roleOf(ws, project.spaceId, actor), 'edit')
  return (
    <div className="flex flex-col gap-4">
      <WsCard
        title="Notes in this project"
        id="dc-notes"
        action={
          edit ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void act((s, c) =>
                  createPage(s, c, actor, {
                    spaceId: project.spaceId,
                    title: '',
                    projectId: project.id,
                  }),
                ).then((r) => r.ok && navigate(`/workspace/pages/${r.value.id}`))
              }
            >
              New note
            </Button>
          ) : null
        }
      >
        {pages.length ? (
          <ul className="flex flex-col gap-1">
            {pages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <Link
                  to={`/workspace/pages/${p.id}`}
                  className="inline-flex min-h-11 items-center font-medium text-ink underline"
                >
                  {p.title || 'Untitled'}
                </Link>
                <Pill>{p.noteType}</Pill>
                <AudiencePill audience={p.audience} />
                {p.lifecycle !== 'draft' ? <LifecyclePill lifecycle={p.lifecycle} /> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No notes yet.</Empty>
        )}
      </WsCard>
      <EvidenceTable w={w} project={project} />
      {edit ? <ImportEvidence w={w} projectId={project.id} /> : null}
      <AssistPanel w={w} projectId={project.id} />
    </div>
  )
}

export function FilesTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  return (
    <WsCard title="Project files" id="fl-files">
      <FilesPanel w={w} spaceId={project.spaceId} projectId={project.id} audience="space" />
    </WsCard>
  )
}

type SortKey = 'claim' | 'source' | 'method' | 'observedOn'

function EvidenceTable({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, act } = w
  const confirm = useConfirm()
  const edit = can(roleOf(ws, project.spaceId, actor), 'edit')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<SortKey>('claim')
  const [claim, setClaim] = useState('')
  const rows = sourcesFor(ws, project.id)
    .filter(
      (r) =>
        !q.trim() ||
        [r.claim, r.source, r.method, r.finding, r.limitations]
          .join(' ')
          .toLowerCase()
          .includes(q.trim().toLowerCase()),
    )
    .sort((a, b) => String(a[sort] ?? '').localeCompare(String(b[sort] ?? '')))
  const cell = (
    r: EvidenceSource,
    key: 'claim' | 'source' | 'method' | 'finding' | 'limitations',
    label: string,
  ) => (
    <>
      <label className="sr-only" htmlFor={`ev-${r.id}-${key}`}>
        {label} for {r.claim}
      </label>
      <textarea
        id={`ev-${r.id}-${key}`}
        rows={2}
        className="field-sizing-content min-h-9 w-full min-w-36 rounded border border-transparent bg-transparent p-1 text-sm text-ink hover:border-border focus-visible:border-border-strong"
        defaultValue={r[key] ?? ''}
        readOnly={!edit}
        onBlur={(e) => {
          if (e.target.value !== (r[key] ?? ''))
            void act(
              (s, c) => updateSource(s, c, actor, r.id, { [key]: e.target.value }),
              'Evidence row saved.',
            )
        }}
      />
    </>
  )
  const add = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act(
      (s, c) => createSource(s, c, actor, { projectId: project.id, claim }),
      'Evidence row added.',
    )
    if (r.ok) setClaim('')
  }
  return (
    <WsCard title="Evidence register" id="dc-evidence">
      <p className="mb-2 text-sm text-ink-muted">
        One row per claim, with where it came from and what limits it. Edit a cell and leave it to
        save. Empty means not recorded, not zero.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink">
          Filter
          <input
            type="search"
            className={fieldClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          Sort by
          <select
            className={fieldClass}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
          >
            <option value="claim">Claim</option>
            <option value="source">Source</option>
            <option value="method">Method</option>
            <option value="observedOn">Date observed</option>
          </select>
        </label>
      </div>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-208 text-left text-sm">
            <caption className="sr-only">Evidence register</caption>
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th scope="col">Claim</th>
                <th scope="col">Source</th>
                <th scope="col">Method</th>
                <th scope="col">Finding</th>
                <th scope="col">Limitations</th>
                <th scope="col">Note</th>
                <th scope="col">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border align-top">
                  <td>{cell(r, 'claim', 'Claim')}</td>
                  <td>{cell(r, 'source', 'Source')}</td>
                  <td>{cell(r, 'method', 'Method')}</td>
                  <td>{cell(r, 'finding', 'Finding')}</td>
                  <td>{cell(r, 'limitations', 'Limitations')}</td>
                  <td className="py-2">
                    {r.pageId && ws.pages.some((p) => p.id === r.pageId) ? (
                      <Link to={`/workspace/pages/${r.pageId}`} className="underline">
                        Open
                      </Link>
                    ) : (
                      '–'
                    )}
                  </td>
                  <td>
                    {edit ? (
                      <button
                        type="button"
                        className="min-h-9 text-xs text-coffee underline"
                        onClick={() => {
                          void (async () => {
                            const c = await confirm({
                              title: 'Remove this evidence row?',
                              description:
                                'Decisions that cite it keep their text but lose the link.',
                              confirmLabel: 'Remove',
                              danger: true,
                            })
                            if (c === 'confirm')
                              await act((s, cx) => deleteSource(s, cx, actor, r.id), 'Row removed.')
                          })()
                        }}
                      >
                        Remove<span className="sr-only"> {r.claim}</span>
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-md bg-mist p-3 text-sm">
          {q ? (
            <>
              No rows match “{q}”.{' '}
              <button type="button" className="font-medium underline" onClick={() => setQ('')}>
                Clear filter
              </button>
            </>
          ) : (
            'No evidence recorded yet.'
          )}
        </div>
      )}
      {edit ? (
        <form
          onSubmit={(e) => void add(e)}
          className="mt-3 flex flex-wrap items-end gap-2"
          aria-label="Add an evidence row"
        >
          <label className="flex min-w-56 flex-1 flex-col gap-1 text-sm text-ink">
            New claim
            <input
              className={fieldClass}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="What does this evidence support?"
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11">
            Add row
          </Button>
        </form>
      ) : null}
    </WsCard>
  )
}

export function DecisionsTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, act } = w
  const edit = can(roleOf(ws, project.spaceId, actor), 'edit')
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState('')
  const [final, setFinal] = useState<{ id: string; outcome: string; rationale: string } | null>(
    null,
  )
  const list = decisionsFor(ws, project.id)
  const create = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act(
      (s, c) =>
        createDecision(s, c, actor, {
          projectId: project.id,
          question,
          options: options.split('\n'),
        }),
      'Decision opened.',
    )
    if (r.ok) {
      setQuestion('')
      setOptions('')
    }
  }
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        A decision is final only when someone states the outcome and is named. Comments and votes
        are discussion, not decisions.
      </p>
      {list.length ? (
        <ul className="flex flex-col gap-3">
          {list.map((d) => (
            <li key={d.id} className="rounded-lg border border-border bg-surface p-3 shadow-card">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-ink">{d.question}</h3>
                <Pill tone={d.outcome ? 'teal' : 'warn'}>{d.outcome ? 'Decided' : 'Open'}</Pill>
              </div>
              {d.options.length ? (
                <p className="text-sm text-ink-muted">Options: {d.options.join(' · ')}</p>
              ) : null}
              {d.outcome ? (
                <>
                  <p className="mt-1 text-sm">
                    <strong>Decision:</strong> {d.outcome}
                  </p>
                  {d.rationale ? (
                    <p className="text-sm text-ink-muted">Why: {d.rationale}</p>
                  ) : null}
                  <p className="text-xs text-ink-muted">
                    {d.decidedBy ? w.name(d.decidedBy) : 'Someone'},{' '}
                    {d.decidedOn ? formatDayMonth(d.decidedOn) : ''}
                    {d.revisitWhen ? ` · revisit: ${d.revisitWhen}` : ''}
                  </p>
                </>
              ) : d.revisitWhen ? (
                <p className="text-xs text-ink-muted">Revisit when: {d.revisitWhen}</p>
              ) : null}
              {d.evidenceIds.length ? (
                <p className="text-xs text-ink-muted">
                  Evidence:{' '}
                  {d.evidenceIds
                    .map((id) => ws.sources.find((s) => s.id === id)?.claim)
                    .filter(Boolean)
                    .join('; ')}
                </p>
              ) : null}
              {edit ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {d.outcome ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() =>
                        void act((s, c) => reopenDecision(s, c, actor, d.id), 'Decision reopened.')
                      }
                    >
                      Reopen
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() => setFinal({ id: d.id, outcome: '', rationale: '' })}
                    >
                      Record the decision
                    </Button>
                  )}
                </div>
              ) : null}
              {final?.id === d.id ? (
                <form
                  className="mt-2 flex flex-col gap-2"
                  aria-label="Record the decision"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void act(
                      (s, c) => finalizeDecision(s, c, actor, d.id, final),
                      'Decision recorded.',
                    ).then((r) => r.ok && setFinal(null))
                  }}
                >
                  <label className="flex flex-col gap-1 text-sm text-ink">
                    What was decided
                    <input
                      className={fieldClass}
                      value={final.outcome}
                      onChange={(e) => setFinal({ ...final, outcome: e.target.value })}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-ink">
                    Why (optional)
                    <input
                      className={fieldClass}
                      value={final.rationale}
                      onChange={(e) => setFinal({ ...final, rationale: e.target.value })}
                    />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" className="min-h-9">
                      Save decision as {w.name(actor)}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() => setFinal(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No decisions yet.</Empty>
      )}
      {edit ? (
        <form
          onSubmit={(e) => void create(e)}
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3"
          aria-label="Open a decision"
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Question to decide
            <input
              className={fieldClass}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Options, one per line (optional)
            <textarea
              rows={3}
              className={`${fieldClass} py-2`}
              value={options}
              onChange={(e) => setOptions(e.target.value)}
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11 self-start">
            Open decision
          </Button>
        </form>
      ) : null}
    </div>
  )
}

export function ActivityTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const items = w.ws.activity.filter((a) => a.spaceId === project.spaceId)
  return items.length ? (
    <ul className="flex flex-col gap-2 text-sm">
      {items.map((a) => (
        <li key={a.id}>
          <strong>{w.name(a.actorId)}</strong> {a.text.charAt(0).toLowerCase() + a.text.slice(1)}{' '}
          <span className="text-xs text-ink-muted">{formatInstant(a.at)}</span>
          {a.href ? (
            <>
              {' '}
              <Link to={a.href} className="text-xs underline">
                Open
              </Link>
            </>
          ) : null}
        </li>
      ))}
    </ul>
  ) : (
    <Empty>Nothing has happened yet.</Empty>
  )
}
