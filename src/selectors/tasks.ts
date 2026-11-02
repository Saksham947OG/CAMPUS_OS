import type { PersonalTask, ProfileData } from '@/domain/records'
import type { Now } from './now'

export interface TaskGroups {
  /** Overdue and due today, oldest first. */
  today: PersonalTask[]
  upcoming: PersonalTask[]
  unscheduled: PersonalTask[]
  completed: PersonalTask[]
}

const byDue = (a: PersonalTask, b: PersonalTask) => {
  const ad = `${a.dueDate ?? '9999'}${a.dueTime ?? '99:99'}`
  const bd = `${b.dueDate ?? '9999'}${b.dueTime ?? '99:99'}`
  return ad < bd ? -1 : ad > bd ? 1 : a.id < b.id ? -1 : 1
}

/**
 * Task Panel sections (COS-CAL-001 §6.1). Undated tasks are never given an invented due date and sit
 * apart from dated ones.
 */
export function groupTasks(data: ProfileData, now: Now, search = ''): TaskGroups {
  const q = search.trim().toLowerCase()
  const tasks = data.tasks.filter(
    (t) => !q || `${t.title} ${t.description ?? ''}`.toLowerCase().includes(q),
  )
  const open = tasks.filter((t) => t.state !== 'personallyCompleted')
  return {
    today: open.filter((t) => t.dueDate && t.dueDate <= now.today).sort(byDue),
    upcoming: open.filter((t) => t.dueDate && t.dueDate > now.today).sort(byDue),
    unscheduled: open.filter((t) => !t.dueDate).sort(byDue),
    completed: tasks.filter((t) => t.state === 'personallyCompleted').sort(byDue),
  }
}
