import { Pencil, Plus, Timer, Trash2 } from 'lucide-react'
import { useConfirm } from '@/components/confirm-context'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { useCampusCommands } from '@/hooks/use-campus-data'
import type { ProfileData } from '@/domain/records'
import type { CalendarItem } from '@/selectors/items'
import type { Now } from '@/selectors/now'
import { useTaskActions } from '../tasks/use-task-actions'
import type { EditorRequest } from './editors/editor-types'
import type { InspectorPanel } from './calendar-url'
import { ReminderControl } from './reminder-control'

interface Props {
  item: CalendarItem
  data: ProfileData
  now: Now
  onEdit: (request: EditorRequest) => void
  onPanel: (panel: InspectorPanel) => void
  /** The selected record no longer exists: clear the selection. */
  onDeleted: () => void
}

const btn = 'min-h-11 gap-1.5'

/**
 * Contextual actions by record kind (COS-CAL-001 §8.2). Source records are read-only here; the only
 * things offered for them are personal additions (a reminder, a preparation task, a focus block).
 */
export function ItemActions({ item, data, now, onEdit, onPanel, onDeleted }: Props) {
  const confirm = useConfirm()
  const toast = useToast()
  const commands = useCampusCommands()
  const taskActions = useTaskActions()

  const done = (persisted: boolean, what: string) => {
    toast.saved(persisted, what)
    onDeleted()
  }

  const event =
    item.recordKind === 'event' ? data.events.find((e) => e.id === item.recordId) : undefined
  const series =
    item.recordKind === 'series' ? data.series.find((s) => s.id === item.recordId) : undefined
  const task =
    item.recordKind === 'task' ? data.tasks.find((t) => t.id === item.recordId) : undefined
  const focus =
    item.recordKind === 'focus' ? data.focusBlocks.find((f) => f.id === item.recordId) : undefined
  const birthday =
    item.recordKind === 'birthday' ? data.birthdays.find((b) => b.id === item.recordId) : undefined
  const ownedEvent = event?.provenance.dataMode === 'userCreated' ? event : undefined
  const ownedSeries = series?.provenance.dataMode === 'userCreated' ? series : undefined
  const ownedBirthday =
    birthday && birthday.provenance.dataMode === 'userCreated' ? birthday : undefined

  const chooseScope = async (verb: 'Edit' | 'Delete') =>
    confirm({
      title: `${verb} a repeating event`,
      description: `Choose what to ${verb.toLowerCase()}. “This and following” is not available.`,
      confirmLabel: 'This occurrence',
      extraLabel: 'Entire series',
    })

  return (
    <div className="flex w-full flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {ownedEvent ? (
          <>
            <Button
              variant="outline"
              className={btn}
              onClick={() => onEdit({ kind: 'event', event: ownedEvent })}
            >
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={async () => {
                const c = await confirm({
                  title: 'Delete this event?',
                  description: 'Only this event of yours is removed.',
                  confirmLabel: 'Delete event',
                  danger: true,
                })
                if (c !== 'confirm') return
                const r = await commands.deleteEvent(ownedEvent.id)
                if (r.ok) done(r.value.persisted, 'Event deleted;')
                else toast.notify('error', r.error.message)
              }}
            >
              <Trash2 aria-hidden="true" /> Delete
            </Button>
          </>
        ) : null}

        {ownedSeries ? (
          <>
            <Button
              variant="outline"
              className={btn}
              onClick={async () => {
                const c = await chooseScope('Edit')
                if (c === 'confirm')
                  onEdit({
                    kind: 'occurrence',
                    series: ownedSeries,
                    originalDate: item.key.slice(
                      item.key.indexOf('@') + 1,
                      item.key.indexOf('@') + 11,
                    ) as never,
                  })
                else if (c === 'extra') onEdit({ kind: 'event', series: ownedSeries })
              }}
            >
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={async () => {
                const c = await chooseScope('Delete')
                if (c === 'confirm') {
                  const r = await commands.saveException({
                    seriesId: ownedSeries.id,
                    originalDate: item.key.slice(
                      item.key.indexOf('@') + 1,
                      item.key.indexOf('@') + 11,
                    ) as never,
                    action: 'cancelled',
                  })
                  if (r.ok) toast.saved(r.value.persisted, 'Occurrence cancelled;')
                  else toast.notify('error', r.error.message)
                } else if (c === 'extra') {
                  const sure = await confirm({
                    title: 'Delete the entire series?',
                    description:
                      'Every occurrence of this repeating event is removed, including changes you made to single occurrences.',
                    confirmLabel: 'Delete series',
                    danger: true,
                  })
                  if (sure !== 'confirm') return
                  const r = await commands.deleteSeries(ownedSeries.id)
                  if (r.ok) done(r.value.persisted, 'Series deleted;')
                  else toast.notify('error', r.error.message)
                }
              }}
            >
              <Trash2 aria-hidden="true" /> Delete…
            </Button>
          </>
        ) : null}

        {task ? (
          <>
            <Button
              variant="outline"
              className={btn}
              onClick={() => onEdit({ kind: 'task', task })}
            >
              <Pencil aria-hidden="true" /> Edit task
            </Button>
            <Button
              variant="outline"
              className={btn}
              disabled={taskActions.pending.has(task.id)}
              onClick={() => void taskActions.toggleComplete(task)}
            >
              {task.state === 'personallyCompleted'
                ? 'Undo completion'
                : 'Mark personally completed'}
            </Button>
            <Button variant="outline" className={btn} onClick={() => onPanel('tasks')}>
              Open in Tasks
            </Button>
          </>
        ) : null}

        {focus ? (
          <>
            <Button
              variant="outline"
              className={btn}
              onClick={() => onEdit({ kind: 'focus', focus })}
            >
              <Pencil aria-hidden="true" /> Edit work session
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={async () => {
                const c = await confirm({
                  title: 'Delete this focus block?',
                  description: 'The linked task is not deleted or completed.',
                  confirmLabel: 'Delete block',
                  danger: true,
                })
                if (c !== 'confirm') return
                const r = await commands.deleteFocusBlock(focus.id)
                if (r.ok) done(r.value.persisted, 'Focus block deleted;')
                else toast.notify('error', r.error.message)
              }}
            >
              <Trash2 aria-hidden="true" /> Delete block
            </Button>
            {focus.taskId ? (
              <Button variant="outline" className={btn} onClick={() => onPanel('tasks')}>
                Open linked task
              </Button>
            ) : null}
          </>
        ) : null}

        {ownedBirthday ? (
          <>
            <Button
              variant="outline"
              className={btn}
              onClick={() => onEdit({ kind: 'birthday', birthday: ownedBirthday })}
            >
              <Pencil aria-hidden="true" /> Edit
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={async () => {
                const c = await confirm({
                  title: 'Delete this birthday reminder?',
                  confirmLabel: 'Delete',
                  danger: true,
                })
                if (c !== 'confirm') return
                const r = await commands.deleteBirthday(ownedBirthday.id)
                if (r.ok) done(r.value.persisted, 'Birthday reminder deleted;')
                else toast.notify('error', r.error.message)
              }}
            >
              <Trash2 aria-hidden="true" /> Delete
            </Button>
          </>
        ) : null}

        {item.recordKind === 'deadline' ? (
          <>
            <Button variant="outline" className={btn} onClick={() => onPanel('tasks')}>
              Open deadline &amp; tasks
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={() =>
                onEdit({
                  kind: 'task',
                  prefill: { relatedDeadlineId: item.recordId, courseId: item.courseId },
                })
              }
            >
              <Plus aria-hidden="true" /> Add checklist item
            </Button>
            <Button
              variant="outline"
              className={btn}
              onClick={() =>
                onEdit({ kind: 'focus', prefill: { title: `Work on: ${item.title}` } })
              }
            >
              <Timer aria-hidden="true" /> Schedule focus block
            </Button>
          </>
        ) : null}

        {(item.category === 'class' || item.category === 'exam') &&
        item.provenance.dataMode !== 'userCreated' ? (
          <Button
            variant="outline"
            className={btn}
            onClick={() =>
              onEdit({
                kind: 'task',
                prefill: { title: `Prepare: ${item.title}`, courseId: item.courseId },
              })
            }
          >
            <Plus aria-hidden="true" /> Add preparation task
          </Button>
        ) : null}
      </div>

      {!item.editable &&
      item.recordKind !== 'deadline' &&
      item.recordKind !== 'booking' &&
      item.provenance.dataMode !== 'userCreated' ? (
        <p className="text-xs text-ink-muted">
          This record comes from{' '}
          {item.provenance.dataMode === 'provided' ? 'supplied data' : 'the sample data'} and cannot
          be edited here.
        </p>
      ) : null}

      {item.recordKind !== 'task' ? <ReminderControl item={item} now={now} /> : null}
    </div>
  )
}
