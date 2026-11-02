import { ListChecks, Pencil, Plus, Timer, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { ConfirmationBadge } from '@/components/confirmation-badge'
import { useConfirm } from '@/components/confirm-context'
import { inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import type { PersonalTask, ProfileData, TaskState } from '@/domain/records'
import { formatDateShort, formatTime, formatTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { standingOf } from '@/selectors/deadlines'
import type { CalendarItem } from '@/selectors/items'
import type { Now } from '@/selectors/now'
import { groupTasks } from '@/selectors/tasks'
import { useTaskActions } from '../tasks/use-task-actions'
import type { EditorRequest } from './editors/editor-types'

const STATE_LABEL: Record<TaskState, string> = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  personallyCompleted: 'Personally completed',
}

interface Props {
  data: ProfileData
  now: Now
  /** The record selected in the calendar, when it is a supplied deadline (shows its checklist). */
  selected?: CalendarItem
  onEdit: (request: EditorRequest) => void
  onSelectItem: (item: CalendarItem) => void
}

function TaskCard({
  task,
  data,
  now,
  onEdit,
  onSelectItem,
}: { task: PersonalTask } & Omit<Props, 'selected'>) {
  const actions = useTaskActions()
  const confirm = useConfirm()
  const done = task.state === 'personallyCompleted'
  const standing = task.dueDate ? standingOf(task.dueDate, task.dueTime, now, done) : undefined
  const course = task.courseId ? data.courses.find((c) => c.id === task.courseId) : undefined
  const deadline = task.relatedDeadlineId
    ? data.deadlines.find((d) => d.id === task.relatedDeadlineId)
    : undefined
  const sessions = data.focusBlocks.filter((f) => f.taskId === task.id)
  const busy = actions.pending.has(task.id)
  const subDone = task.subtasks.filter((s) => s.done).length

  return (
    <li className="rounded-md border border-border bg-surface p-3 text-sm" data-state={task.state}>
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1 size-5 shrink-0 accent-[var(--accent-teal)]"
          aria-label={`${task.title}: personally completed`}
          checked={done}
          disabled={busy}
          onChange={() => void actions.toggleComplete(task)}
        />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            className={cn(
              'text-left font-medium text-ink hover:underline',
              done && 'text-ink-muted line-through',
            )}
            onClick={() =>
              task.dueDate &&
              onSelectItem({
                key: `${task.id}@${task.dueDate}`,
                date: task.dueDate,
              } as CalendarItem)
            }
            disabled={!task.dueDate}
          >
            {task.title}
          </button>
          <p className="mt-0.5 text-xs text-ink-muted">
            {task.dueDate
              ? `Due ${formatDateShort(task.dueDate)}${task.dueTime ? `, ${formatTime(task.dueTime)}` : ' (date only)'}`
              : 'No due date'}
            {standing === 'overdue' ? ' · Overdue' : standing === 'dueToday' ? ' · Due today' : ''}
            {course ? ` · ${course.code}` : ''}
            {task.priority === 'high' ? ' · High priority' : ''}
          </p>
          {deadline ? (
            <p className="text-xs text-ink-muted">
              Linked to “{deadline.title}” (supplied deadline stays unchanged)
            </p>
          ) : null}
          {deadline?.provenance.verification === 'tentative' ? (
            <ConfirmationBadge verification="tentative" className="mt-1" />
          ) : null}
        </div>
      </div>

      <label className="mt-2 flex items-center gap-2 text-xs text-ink-muted">
        Status
        <select
          className={cn(inputClass, 'max-w-48')}
          aria-label={`Status of ${task.title}`}
          value={task.state}
          disabled={busy}
          onChange={(e) => void actions.setState(task, e.target.value as TaskState)}
        >
          {(Object.keys(STATE_LABEL) as TaskState[]).map((s) => (
            <option key={s} value={s}>
              {STATE_LABEL[s]}
            </option>
          ))}
        </select>
      </label>

      {task.subtasks.length > 0 ? (
        <fieldset className="mt-2">
          <legend className="text-xs font-medium text-ink">
            Checklist ({subDone}/{task.subtasks.length})
          </legend>
          {task.subtasks.map((s) => (
            <label key={s.id} className="flex min-h-11 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent-teal)]"
                checked={s.done}
                disabled={busy}
                onChange={() => void actions.toggleSubtask(task, s.id)}
              />
              <span className={cn(s.done && 'line-through text-ink-muted')}>{s.title}</span>
            </label>
          ))}
          {subDone === task.subtasks.length && !done ? (
            <p className="text-xs text-ink-muted">
              Every item is ticked. You can mark the task personally completed. This never submits
              anything officially.
            </p>
          ) : null}
        </fieldset>
      ) : null}

      {sessions.length > 0 ? (
        <p className="mt-2 text-xs text-ink-muted">
          Planned sessions:{' '}
          {sessions
            .map((s) => `${formatDateShort(s.date)} ${formatTimeRange(s.start, s.end)}`)
            .join('; ')}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          onClick={() => onEdit({ kind: 'task', task })}
        >
          <Pencil aria-hidden="true" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          onClick={() =>
            onEdit({
              kind: 'focus',
              prefill: {
                taskId: task.id,
                title: `Work on: ${task.title}`,
                date: task.dueDate && task.dueDate >= now.today ? undefined : now.today,
              },
            })
          }
        >
          <Timer aria-hidden="true" /> Schedule time
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 gap-1.5"
          disabled={busy}
          onClick={async () => {
            const choice = await confirm({
              title: 'Delete this task?',
              description:
                'Only your task is deleted. A linked supplied deadline and your planned sessions are not deleted.',
              confirmLabel: 'Delete task',
              danger: true,
            })
            if (choice === 'confirm') await actions.remove(task)
          }}
        >
          <Trash2 aria-hidden="true" /> Delete
        </Button>
      </div>
    </li>
  )
}

/** Today / Upcoming / Unscheduled / Completed, with the assignment checklist when a deadline is selected. */
export function TasksPanel({ data, now, selected, onEdit, onSelectItem }: Props) {
  const [search, setSearch] = useState('')
  const groups = groupTasks(data, now, search)
  const deadline =
    selected?.recordKind === 'deadline'
      ? data.deadlines.find((d) => d.id === selected.recordId)
      : undefined
  const linked = deadline ? data.tasks.filter((t) => t.relatedDeadlineId === deadline.id) : []

  const sections: [string, PersonalTask[], boolean][] = [
    ['Today & overdue', groups.today, true],
    ['Upcoming', groups.upcoming, true],
    ['Unscheduled', groups.unscheduled, true],
    ['Completed', groups.completed, false],
  ]
  const total = sections.reduce((n, [, l]) => n + l.length, 0)

  return (
    <div className="flex flex-col gap-4">
      {deadline && selected ? (
        <section
          aria-label="Assignment"
          className="rounded-md border border-border bg-canvas p-3 text-sm"
        >
          <h4 className="font-semibold text-ink">{deadline.title}</h4>
          <p className="text-ink-muted">
            Due {formatDateShort(deadline.dueDate)}
            {deadline.dueTime ? `, ${formatTime(deadline.dueTime)}` : ' (date only)'} · supplied
            record, read-only
          </p>
          <h5 className="mt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            My preparation checklist
          </h5>
          {linked.length === 0 ? (
            <p className="text-ink-muted">No personal tasks linked yet.</p>
          ) : (
            <p className="text-ink-muted">
              {linked.length} linked task{linked.length === 1 ? '' : 's'} below.
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 gap-1.5"
              onClick={() =>
                onEdit({
                  kind: 'task',
                  prefill: { relatedDeadlineId: deadline.id, courseId: deadline.courseId },
                })
              }
            >
              <Plus aria-hidden="true" /> Add checklist item
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11 gap-1.5"
              onClick={() =>
                onEdit({ kind: 'focus', prefill: { title: `Work on: ${deadline.title}` } })
              }
            >
              <Timer aria-hidden="true" /> Schedule focus block
            </Button>
          </div>
        </section>
      ) : null}

      <div className="flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Search tasks</span>
          <input
            type="search"
            className={inputClass}
            placeholder="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <Button className="min-h-11 gap-1.5" onClick={() => onEdit({ kind: 'task' })}>
          <Plus aria-hidden="true" /> Add task
        </Button>
      </div>

      {total === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-surface p-3 text-sm text-ink-muted">
          {search
            ? 'No tasks match your search.'
            : 'No tasks yet. Add one to plan your own work. Tasks are personal and never change supplied deadlines.'}
        </p>
      ) : null}

      {sections.map(([title, list, open]) =>
        list.length === 0 ? null : (
          <details key={title} open={open} className="group">
            <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
              <ListChecks className="size-4 text-teal-strong" aria-hidden="true" /> {title}{' '}
              <span className="font-normal text-ink-muted">({list.length})</span>
            </summary>
            <ul className="mt-2 flex flex-col gap-2">
              {list.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  data={data}
                  now={now}
                  onEdit={onEdit}
                  onSelectItem={onSelectItem}
                />
              ))}
            </ul>
          </details>
        ),
      )}
    </div>
  )
}
