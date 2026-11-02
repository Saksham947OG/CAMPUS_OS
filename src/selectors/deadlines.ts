import type { Provenance, Verification } from '@/domain/provenance'
import type { ProfileData } from '@/domain/records'
import { addDays, type DateOnly, type LocalTime } from '@/lib/time'
import { instantMs, type Now } from './now'

export type DeadlineStanding = 'overdue' | 'dueToday' | 'upcoming' | 'completed'

export interface DeadlineEntry {
  key: string
  source: 'deadline' | 'task'
  recordId: string
  title: string
  dueDate: DateOnly
  /** Absent = date-only. Never defaulted to 23:59. */
  dueTime?: LocalTime
  courseId?: string
  verification: Verification
  provenance: Provenance
  standing: DeadlineStanding
  /** True only for a student's own task. An official deadline is never "submitted" by us (C-T12). */
  personallyCompleted: boolean
  calendarKey: string
}

/**
 * Standing of a due date. Date-only items are not overdue until the *next* calendar day; timed items
 * use their real instant (COS-HOME-001 §5.4).
 */
export function standingOf(
  dueDate: DateOnly,
  dueTime: LocalTime | undefined,
  now: Now,
  completed: boolean,
): DeadlineStanding {
  if (completed) return 'completed'
  if (dueTime) {
    if (instantMs(dueDate, dueTime) < now.ms) return 'overdue'
    return dueDate === now.today ? 'dueToday' : 'upcoming'
  }
  if (dueDate < now.today) return 'overdue'
  return dueDate === now.today ? 'dueToday' : 'upcoming'
}

const rank: Record<DeadlineStanding, number> = {
  overdue: 0,
  dueToday: 1,
  upcoming: 2,
  completed: 3,
}

export function allDeadlineEntries(data: ProfileData, now: Now): DeadlineEntry[] {
  const fromDeadlines: DeadlineEntry[] = data.deadlines
    .filter((d) => d.status !== 'cancelled')
    .map((d) => ({
      key: `deadline:${d.id}`,
      source: 'deadline',
      recordId: d.id,
      title: d.title,
      dueDate: d.dueDate,
      dueTime: d.dueTime,
      courseId: d.courseId,
      verification: d.provenance.verification,
      provenance: d.provenance,
      standing: standingOf(d.dueDate, d.dueTime, now, false),
      personallyCompleted: false,
      calendarKey: `${d.id}@${d.dueDate}`,
    }))
  const fromTasks: DeadlineEntry[] = data.tasks.flatMap((t) =>
    t.dueDate
      ? [
          {
            key: `task:${t.id}`,
            source: 'task' as const,
            recordId: t.id,
            title: t.title,
            dueDate: t.dueDate,
            dueTime: t.dueTime,
            courseId: t.courseId,
            verification: 'notApplicable' as const,
            provenance: t.provenance,
            standing: standingOf(t.dueDate, t.dueTime, now, t.state === 'personallyCompleted'),
            personallyCompleted: t.state === 'personallyCompleted',
            calendarKey: `${t.id}@${t.dueDate}`,
          },
        ]
      : [],
  )
  return [...fromDeadlines, ...fromTasks]
}

/** Overdue first, then due today, then nearest upcoming; ties broken by stable key. */
export function deadlineFocus(
  data: ProfileData,
  now: Now,
  options: { hideCompleted?: boolean; limit?: number } = {},
): DeadlineEntry[] {
  const { hideCompleted = true, limit } = options
  const entries = allDeadlineEntries(data, now)
    .filter((e) => !(hideCompleted && e.standing === 'completed'))
    .sort((a, b) => {
      if (rank[a.standing] !== rank[b.standing]) return rank[a.standing] - rank[b.standing]
      if (a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1
      const at = a.dueTime ?? '99:99'
      const bt = b.dueTime ?? '99:99'
      if (at !== bt) return at < bt ? -1 : 1
      return a.key < b.key ? -1 : 1
    })
  return limit ? entries.slice(0, limit) : entries
}

export const nextDay = addDays
