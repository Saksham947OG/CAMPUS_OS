import { z } from 'zod'
import {
  birthdaySchema,
  eventSchema,
  exceptionSchema,
  focusBlockSchema,
  seriesSchema,
  taskMutableSchema,
  taskSchema,
  type BirthdayReminder,
  type CalendarEvent,
  type FocusBlock,
  type OccurrenceException,
  type PersonalTask,
  type RecurrenceSeries,
  type TaskMutable,
} from '@/domain/records'

/**
 * Everything a profile has created or changed. Seed records are never written here; the only
 * change to a seeded record is an override of a student-owned task's mutable fields or a
 * tombstone for a deleted seeded task/birthday.
 */
export interface UserData {
  events: CalendarEvent[]
  series: RecurrenceSeries[]
  exceptions: OccurrenceException[]
  tasks: PersonalTask[]
  taskOverrides: Record<string, TaskMutable>
  deletedSeedIds: string[]
  focusBlocks: FocusBlock[]
  birthdays: BirthdayReminder[]
}

export const emptyUserData = (): UserData => ({
  events: [],
  series: [],
  exceptions: [],
  tasks: [],
  taskOverrides: {},
  deletedSeedIds: [],
  focusBlocks: [],
  birthdays: [],
})

/** Loose envelope so one bad record never takes the rest of a profile's data with it. */
export const userDataEnvelopeSchema = z.record(z.string(), z.unknown())

function parseList<T>(raw: unknown, schema: z.ZodType<T>, label: string, warnings: string[]): T[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) {
    warnings.push(`Saved ${label} could not be read and were skipped.`)
    return []
  }
  const out: T[] = []
  let skipped = 0
  for (const item of raw) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
    else skipped++
  }
  if (skipped > 0)
    warnings.push(
      `${skipped} saved ${label} could not be read and ${skipped === 1 ? 'was' : 'were'} skipped.`,
    )
  return out
}

export function parseUserData(raw: Record<string, unknown>): {
  data: UserData
  warnings: string[]
} {
  const warnings: string[] = []
  const overrides: Record<string, TaskMutable> = {}
  const rawOverrides = raw.taskOverrides
  if (rawOverrides && typeof rawOverrides === 'object' && !Array.isArray(rawOverrides)) {
    for (const [id, value] of Object.entries(rawOverrides)) {
      const parsed = taskMutableSchema.safeParse(value)
      if (parsed.success) overrides[id] = parsed.data
      else warnings.push('A saved task edit could not be read and was skipped.')
    }
  }
  const deleted = Array.isArray(raw.deletedSeedIds)
    ? raw.deletedSeedIds.filter((v): v is string => typeof v === 'string')
    : []
  return {
    data: {
      events: parseList(raw.events, eventSchema, 'events', warnings),
      series: parseList(raw.series, seriesSchema, 'recurring events', warnings),
      exceptions: parseList(raw.exceptions, exceptionSchema, 'occurrence changes', warnings),
      tasks: parseList(raw.tasks, taskSchema, 'tasks', warnings),
      taskOverrides: overrides,
      deletedSeedIds: deleted,
      focusBlocks: parseList(raw.focusBlocks, focusBlockSchema, 'focus blocks', warnings),
      birthdays: parseList(raw.birthdays, birthdaySchema, 'birthday reminders', warnings),
    },
    warnings,
  }
}
