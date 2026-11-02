import type { TaskDraft } from '@/data/domain/campus-repository'
import type {
  BirthdayReminder,
  CalendarEvent,
  FocusBlock,
  PersonalTask,
  RecurrenceSeries,
} from '@/domain/records'
import type { DateOnly, LocalTime } from '@/lib/time'

/** What the editor sheet should open. `end` stays unset until the student chooses one (COS-CAL-001 §3.3). */
export type EditorRequest =
  | {
      kind: 'event'
      prefill?: { date?: DateOnly; start?: LocalTime; end?: LocalTime; title?: string }
      event?: CalendarEvent
      series?: RecurrenceSeries
    }
  | { kind: 'occurrence'; series: RecurrenceSeries; originalDate: DateOnly }
  | { kind: 'task'; task?: PersonalTask; prefill?: Partial<TaskDraft> }
  | {
      kind: 'focus'
      focus?: FocusBlock
      prefill?: {
        taskId?: string
        title?: string
        date?: DateOnly
        start?: LocalTime
        end?: LocalTime
      }
    }
  | { kind: 'birthday'; birthday?: BirthdayReminder }

export const editorTitle = (r: EditorRequest): string => {
  switch (r.kind) {
    case 'event':
      return r.event || r.series ? 'Edit personal event' : 'New personal event'
    case 'occurrence':
      return 'Change this occurrence'
    case 'task':
      return r.task ? 'Edit task' : 'New task'
    case 'focus':
      return r.focus ? 'Edit focus block' : 'New focus block'
    case 'birthday':
      return r.birthday ? 'Edit birthday reminder' : 'New birthday reminder'
  }
}
