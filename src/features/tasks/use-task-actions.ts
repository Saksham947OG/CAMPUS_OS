import { useCallback, useRef, useState } from 'react'
import type { TaskDraft } from '@/data/domain/campus-repository'
import { useConfirm } from '@/components/confirm-context'
import { useToast } from '@/components/toast-context'
import { useCampusCommands, useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import type { PersonalTask, TaskState } from '@/domain/records'

/** All editable fields of a task as a draft (id kept, so saves upsert instead of duplicating). */
export function taskToDraft(task: PersonalTask, patch: Partial<TaskDraft> = {}): TaskDraft {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    courseId: task.courseId,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
    relatedDeadlineId: task.relatedDeadlineId,
    state: task.state,
    priority: task.priority,
    subtasks: task.subtasks,
    ...patch,
  }
}

/**
 * Task write operations shared by Home (Deadline Focus, My Tasks) and the Calendar Task Panel, so
 * both screens change the same canonical record. A personal checkmark is never an official
 * submission (C-T12). Rapid repeat clicks on the same task are ignored while a save is in flight.
 */
export function useTaskActions() {
  const commands = useCampusCommands()
  const toast = useToast()
  const confirm = useConfirm()
  const { data } = useCampusData()
  const now = useNow()
  const inFlight = useRef(new Set<string>())
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())

  const guard = useCallback(async <T>(id: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (inFlight.current.has(id)) return undefined
    inFlight.current.add(id)
    setPending(new Set(inFlight.current))
    try {
      return await fn()
    } finally {
      inFlight.current.delete(id)
      setPending(new Set(inFlight.current))
    }
  }, [])

  const save = useCallback(
    (draft: TaskDraft, label = 'Task') =>
      guard(draft.id ?? 'new-task', async () => {
        const result = await commands.saveTask(draft)
        if (result.ok) toast.saved(result.value.persisted, label)
        else toast.notify('error', result.error.message)
        return result
      }),
    [commands, guard, toast],
  )

  const setState = useCallback(
    async (task: PersonalTask, state: TaskState) => {
      if (state === 'personallyCompleted') {
        // Completing a task never silently deletes planned sessions: the student chooses (COS-CAL-001 §6.3.7).
        const planned = data.focusBlocks.filter((f) => f.taskId === task.id && f.date >= now.today)
        if (planned.length > 0) {
          const choice = await confirm({
            title: 'Keep your planned work sessions?',
            description: `${planned.length} planned focus ${planned.length === 1 ? 'block is' : 'blocks are'} linked to “${task.title}”. Completing the task does not remove them unless you choose to.`,
            confirmLabel: 'Keep sessions',
            extraLabel: 'Remove sessions',
          })
          if (choice === 'cancel') return undefined
          if (choice === 'extra') for (const f of planned) await commands.deleteFocusBlock(f.id)
        }
      }
      return save(
        taskToDraft(task, { state }),
        state === 'personallyCompleted' ? 'Marked personally completed;' : 'Task',
      )
    },
    [save, data.focusBlocks, now.today, confirm, commands],
  )

  const toggleComplete = useCallback(
    (task: PersonalTask) =>
      setState(task, task.state === 'personallyCompleted' ? 'notStarted' : 'personallyCompleted'),
    [setState],
  )

  const toggleSubtask = useCallback(
    (task: PersonalTask, subtaskId: string) =>
      save(
        taskToDraft(task, {
          subtasks: task.subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
        }),
        'Checklist',
      ),
    [save],
  )

  const remove = useCallback(
    (task: PersonalTask) =>
      guard(task.id, async () => {
        const result = await commands.deleteTask(task.id)
        if (result.ok) toast.saved(result.value.persisted, 'Task deleted;')
        else toast.notify('error', result.error.message)
        return result
      }),
    [commands, guard, toast],
  )

  return { pending, save, setState, toggleComplete, toggleSubtask, remove }
}
