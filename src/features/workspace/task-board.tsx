import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import {
  createTask,
  isBlocked,
  moveTask,
  openPrerequisites,
  updateTask,
} from '@/domain/workspace-logic'
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type Project,
  type TaskStatus,
  type WorkTask,
} from '@/domain/workspace'
import { addDays, formatDayMonth, type DateOnly } from '@/lib/time'
import { taskCounts, workload } from '@/selectors/workspace'
import type { WorkspaceApi } from './use-workspace'
import { Empty, Pill, StatusPill, WsCard, fieldClass } from './ws-ui'

const COLUMNS: TaskStatus[] = ['backlog', 'ready', 'inProgress', 'inReview', 'done']
type Filter = 'all' | 'mine' | 'week' | 'blocked' | 'unassigned' | 'review' | 'done'
const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['mine', 'Mine'],
  ['week', 'Due this week'],
  ['blocked', 'Blocked'],
  ['unassigned', 'Unassigned'],
  ['review', 'Needs review'],
  ['done', 'Completed'],
]

export function TasksTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, act, name } = w
  const [filter, setFilter] = useState<Filter>('all')
  const [view, setView] = useState<'board' | 'table'>('board')
  const [editing, setEditing] = useState<string | null>(null)
  const role = roleOf(ws, project.spaceId, actor)
  const edit = can(role, 'edit')
  const all = ws.tasks.filter((t) => t.projectId === project.id && t.status !== 'canceled')
  const weekEnd = addDays(w.now.today, 7)

  const keep = (t: WorkTask) =>
    filter === 'all'
      ? true
      : filter === 'mine'
        ? t.assigneeId === actor
        : filter === 'week'
          ? !!t.dueDate && t.dueDate >= w.now.today && t.dueDate <= weekEnd && t.status !== 'done'
          : filter === 'blocked'
            ? isBlocked(ws, t)
            : filter === 'unassigned'
              ? !t.assigneeId && t.status !== 'done'
              : filter === 'review'
                ? t.status === 'inReview'
                : t.status === 'done'
  const shown = all.filter(keep)
  const counts = taskCounts(ws, project.id)
  const load = workload(ws, project.id)

  const move = (t: WorkTask, s: TaskStatus) => void act((st, c) => moveTask(st, c, actor, t.id, s))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Filter tasks</legend>
          {FILTERS.map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
              className={`min-h-9 rounded-md px-3 text-sm text-ink ${filter === id ? 'bg-teal-tint font-semibold' : 'hover:bg-mist'}`}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <fieldset className="ml-auto flex gap-1">
          <legend className="sr-only">Layout</legend>
          {(['board', 'table'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 rounded-md px-3 text-sm text-ink ${view === v ? 'bg-teal-tint font-semibold' : 'hover:bg-mist'}`}
            >
              {v === 'board' ? 'Board' : 'Table'}
            </button>
          ))}
        </fieldset>
      </div>
      <p className="text-sm text-ink-muted">
        {counts.done} of {counts.total} tasks done
        {counts.canceled ? ` (${counts.canceled} canceled, not counted)` : ''}
        {counts.blocked ? ` · ${counts.blocked} blocked` : ''}. Filter:{' '}
        {FILTERS.find((f) => f[0] === filter)![1]}, showing {shown.length}.
      </p>

      {!all.length ? (
        <Empty>
          No tasks yet. Add the first one below, or turn a checklist item in a note into a task.
        </Empty>
      ) : !shown.length ? (
        <div className="rounded-md bg-mist p-3 text-sm">
          Nothing matches this filter, but the project still has {all.length} tasks.{' '}
          <button type="button" className="font-medium underline" onClick={() => setFilter('all')}>
            Clear filter
          </button>
        </div>
      ) : view === 'board' ? (
        <div className="grid gap-3 md:grid-cols-5">
          {COLUMNS.map((col) => (
            // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- HTML5 drop target; the Move select on every card is the keyboard alternative
            <section
              key={col}
              aria-label={TASK_STATUS_LABEL[col]}
              className="flex min-h-24 flex-col gap-2 rounded-lg bg-mist/60 p-2"
              onDragOver={(e) => edit && e.preventDefault()}
              onDrop={(e) => {
                const id = e.dataTransfer.getData('text/plain')
                const t = all.find((x) => x.id === id)
                if (edit && t && t.status !== col) move(t, col)
              }}
            >
              <h3 className="px-1 text-sm font-semibold text-ink">
                {TASK_STATUS_LABEL[col]}{' '}
                <span className="font-normal text-ink-muted">
                  ({shown.filter((t) => t.status === col).length})
                </span>
              </h3>
              {shown
                .filter((t) => t.status === col)
                .map((t) => (
                  <TaskCard
                    key={t.id}
                    w={w}
                    t={t}
                    edit={edit}
                    open={editing === t.id}
                    toggle={() => setEditing(editing === t.id ? null : t.id)}
                    onMove={move}
                    project={project}
                  />
                ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-176 text-left text-sm">
            <caption className="sr-only">Tasks</caption>
            <thead>
              <tr className="border-b border-border text-ink-muted">
                <th scope="col" className="py-2 pr-2">
                  Task
                </th>
                <th scope="col" className="pr-2">
                  Status
                </th>
                <th scope="col" className="pr-2">
                  Assignee
                </th>
                <th scope="col" className="pr-2">
                  Due
                </th>
                <th scope="col" className="pr-2">
                  Effort
                </th>
                <th scope="col">Move to</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-2 font-medium text-ink">
                    {t.title}
                    {isBlocked(ws, t) ? <Pill tone="danger">Blocked</Pill> : null}
                  </th>
                  <td className="pr-2">
                    <StatusPill status={t.status} />
                  </td>
                  <td className="pr-2">{t.assigneeId ? name(t.assigneeId) : 'Unassigned'}</td>
                  <td className="pr-2">{t.dueDate ? formatDayMonth(t.dueDate) : 'No date'}</td>
                  <td className="pr-2">
                    {t.estimateMin ? `${t.estimateMin} min` : 'not estimated'}
                  </td>
                  <td>
                    <MoveSelect t={t} edit={edit} onMove={move} />
                    {edit ? (
                      <button
                        type="button"
                        className="ml-2 min-h-9 text-coffee underline"
                        onClick={() => setEditing(editing === t.id ? null : t.id)}
                      >
                        Edit<span className="sr-only"> {t.title}</span>
                      </button>
                    ) : null}
                    {editing === t.id ? (
                      <TaskEditor w={w} t={t} project={project} done={() => setEditing(null)} />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {edit ? (
        <NewTask w={w} project={project} />
      ) : (
        <p className="text-sm text-ink-muted">
          Your role ({role}) can read the board and comment on pages, but not change tasks.
        </p>
      )}

      <WsCard title="Workload" id="tb-load">
        {load.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {load.map((l) => (
              <li key={l.userId}>
                <strong>{name(l.userId)}</strong>: {l.open} open {l.open === 1 ? 'task' : 'tasks'}
                {l.estimatedMin
                  ? `, about ${Math.round((l.estimatedMin / 60) * 10) / 10} h estimated`
                  : ''}
                {l.unestimated ? `, ${l.unestimated} with no estimate (not counted as zero)` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No open tasks are assigned.</Empty>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Planning support only. It counts assigned open tasks and the estimates people entered; it
          is not a measure of anyone’s effort.
        </p>
      </WsCard>
    </div>
  )
}

function MoveSelect({
  t,
  edit,
  onMove,
}: {
  t: WorkTask
  edit: boolean
  onMove: (t: WorkTask, s: TaskStatus) => void
}) {
  return (
    <>
      <label className="sr-only" htmlFor={`mv-${t.id}`}>
        Move “{t.title}” to
      </label>
      <select
        id={`mv-${t.id}`}
        disabled={!edit}
        className="min-h-9 rounded-md border border-border-strong bg-surface px-2 text-xs text-ink"
        value={t.status}
        onChange={(e) => onMove(t, e.target.value as TaskStatus)}
      >
        {TASK_STATUSES.map((s) => (
          <option key={s} value={s}>
            {TASK_STATUS_LABEL[s]}
          </option>
        ))}
      </select>
    </>
  )
}

function TaskCard({
  w,
  t,
  edit,
  open,
  toggle,
  onMove,
  project,
}: {
  w: WorkspaceApi
  t: WorkTask
  edit: boolean
  open: boolean
  toggle: () => void
  onMove: (t: WorkTask, s: TaskStatus) => void
  project: Project
}) {
  const waiting = openPrerequisites(w.ws, t)
  const blocked = isBlocked(w.ws, t)
  return (
    <div
      draggable={edit}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
      className="flex flex-col gap-1 rounded-md border border-border bg-surface p-2 text-sm shadow-card"
    >
      <p className="font-medium text-ink">{t.title}</p>
      <p className="text-xs text-ink-muted">
        {t.assigneeId ? w.name(t.assigneeId) : 'Unassigned'} ·{' '}
        {t.dueDate ? `due ${formatDayMonth(t.dueDate)}` : 'no date'}
        {t.priority === 'high' ? ' · high priority' : ''}
      </p>
      {blocked ? (
        <p className="text-xs font-medium text-danger">
          Blocked: {t.blockedReason ?? `waiting on ${waiting.map((x) => x.title).join(', ')}`}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <MoveSelect t={t} edit={edit} onMove={onMove} />
        {edit ? (
          <button
            type="button"
            className="min-h-9 text-xs text-coffee underline"
            aria-expanded={open}
            onClick={toggle}
          >
            Edit<span className="sr-only"> {t.title}</span>
          </button>
        ) : null}
        {t.pageId ? (
          <Link
            className="min-h-9 py-2 text-xs text-coffee underline"
            to={`/workspace/pages/${t.pageId}`}
          >
            Note
          </Link>
        ) : null}
      </div>
      {open ? <TaskEditor w={w} t={t} project={project} done={toggle} /> : null}
    </div>
  )
}

function TaskEditor({
  w,
  t,
  project,
  done,
}: {
  w: WorkspaceApi
  t: WorkTask
  project: Project
  done: () => void
}) {
  const { ws, actor, act } = w
  const members = ws.members.filter((m) => m.spaceId === project.spaceId)
  const others = ws.tasks.filter(
    (x) => x.projectId === project.id && x.id !== t.id && x.status !== 'canceled',
  )
  const [f, setF] = useState({
    title: t.title,
    assignee: t.assigneeId ?? '',
    due: t.dueDate ?? '',
    est: t.estimateMin ? String(t.estimateMin) : '',
    priority: t.priority,
    blocked: t.blockedReason ?? '',
    deps: t.dependsOn,
  })
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act(
      (s, c) =>
        updateTask(
          s,
          c,
          actor,
          t.id,
          {
            title: f.title,
            assigneeId: f.assignee || null,
            dueDate: (f.due || null) as DateOnly | null,
            estimateMin: f.est ? Number(f.est) : null,
            priority: f.priority,
            blockedReason: f.blocked || null,
            dependsOn: f.deps,
          },
          t.revision,
        ),
      'Task updated.',
    )
    if (r.ok) done()
  }
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="mt-2 flex flex-col gap-2 rounded-md border border-border-strong bg-canvas p-2"
      aria-label={`Edit ${t.title}`}
    >
      <label className="flex flex-col gap-1 text-xs text-ink">
        Title
        <input
          className={fieldClass}
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink">
        Assignee
        <select
          className={fieldClass}
          value={f.assignee}
          onChange={(e) => setF({ ...f, assignee: e.target.value })}
        >
          <option value="">Unassigned</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {w.name(m.userId)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink">
        Due date
        <input
          type="date"
          className={fieldClass}
          value={f.due}
          onChange={(e) => setF({ ...f, due: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink">
        Estimate (minutes, optional)
        <input
          type="number"
          min={5}
          step={5}
          className={fieldClass}
          value={f.est}
          onChange={(e) => setF({ ...f, est: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink">
        Priority
        <select
          className={fieldClass}
          value={f.priority}
          onChange={(e) => setF({ ...f, priority: e.target.value as WorkTask['priority'] })}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-ink">
        Blocked by something outside the team (optional)
        <input
          className={fieldClass}
          value={f.blocked}
          onChange={(e) => setF({ ...f, blocked: e.target.value })}
          placeholder="e.g. waiting on external confirmation"
        />
      </label>
      {others.length ? (
        <fieldset>
          <legend className="text-xs font-medium text-ink">Waits for</legend>
          {others.map((o) => (
            <label key={o.id} className="flex min-h-9 items-center gap-2 text-xs text-ink">
              <input
                type="checkbox"
                className="size-4"
                checked={f.deps.includes(o.id)}
                onChange={(e) =>
                  setF({
                    ...f,
                    deps: e.target.checked ? [...f.deps, o.id] : f.deps.filter((d) => d !== o.id),
                  })
                }
              />
              {o.title}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" className="min-h-9">
          Save
        </Button>
        <Button type="button" size="sm" variant="outline" className="min-h-9" onClick={done}>
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="min-h-9"
          onClick={() =>
            void act((s, c) => moveTask(s, c, actor, t.id, 'canceled'), 'Task canceled.').then(
              (r) => r.ok && done(),
            )
          }
        >
          Cancel task
        </Button>
      </div>
    </form>
  )
}

function NewTask({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, act } = w
  const members = ws.members.filter((m) => m.spaceId === project.spaceId && can(m.role, 'edit'))
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState('')
  const [due, setDue] = useState('')
  const [op, setOp] = useState(() => w.services.newId('op'))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act(
      (s, c) =>
        createTask(s, c, actor, {
          projectId: project.id,
          title,
          ...(assignee ? { assigneeId: assignee } : {}),
          ...(due ? { dueDate: due as DateOnly } : {}),
          opId: op,
        }),
      'Task added.',
    )
    if (r.ok) {
      setTitle('')
      setDue('')
      setOp(w.services.newId('op'))
    }
  }
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-surface p-3"
      aria-label="Add a task"
    >
      <label className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-ink">
        New task
        <input
          className={fieldClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Assign to
        <select
          className={fieldClass}
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
        >
          <option value="">Nobody yet</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {w.name(m.userId)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Due (optional)
        <input
          type="date"
          className={fieldClass}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <Button type="submit" className="min-h-11">
        Add task
      </Button>
    </form>
  )
}
