import type { ReminderPrefs, ReminderRuleId } from '@/data/prefs/reminder-prefs'
import type { ProfileData } from '@/domain/records'
import {
  addDays,
  formatDateShort,
  formatTime,
  isoFromMs,
  parseLocalTime,
  type DateOnly,
} from '@/lib/time'
import { isCancelled, type CalendarItem } from './items'
import { instantMs } from './now'
import { itemsInRange } from './occurrences'

export interface ReminderPlan {
  ruleId: ReminderRuleId
  enabled: boolean
  /** Why this reminder exists: a per-occurrence choice or the category default. */
  source: 'override' | 'category'
  triggerMs: number
  /** Minutes before a timed record; undefined for date-based rules. */
  offsetMinutes?: number
  daysBefore?: number
}

export interface ReminderCandidate {
  /** `profile|record|occurrence|rule|triggerAt` — deduplicates refreshes and session resumes (§9.4). */
  key: string
  ruleId: ReminderRuleId
  item: CalendarItem
  triggerMs: number
  title: string
  body: string
}

const clockMs = (prefs: ReminderPrefs, date: DateOnly, daysBefore: number) =>
  instantMs(addDays(date, -daysBefore), parseLocalTime(prefs.dateOnlyClock))

/**
 * The reminder (if any) that applies to one item and when it would trigger. Date-only records are
 * reminded at the reminder clock on an earlier day — never at an invented due time (C-D14).
 * Cancelled items have no plan, so a cancelled or moved occurrence can never leave a stale reminder.
 */
export function reminderPlan(item: CalendarItem, prefs: ReminderPrefs): ReminderPlan | null {
  if (isCancelled(item) || !prefs.enabled) return null
  const override = prefs.overrides[item.key]
  const choose = <R extends { enabled: boolean }>(rule: R): boolean =>
    override?.enabled ?? rule.enabled
  const t = item.time

  const dayPlan = (ruleId: 'deadlineDateOnly' | 'birthday' | 'task'): ReminderPlan => {
    const r = prefs.rules[ruleId]
    const daysBefore =
      ruleId === 'birthday' || ruleId === 'task'
        ? r.daysBefore
        : prefs.rules.deadlineDateOnly.daysBefore
    return {
      ruleId,
      enabled: choose(r),
      source: override ? 'override' : 'category',
      triggerMs: clockMs(prefs, item.date, daysBefore),
      daysBefore,
    }
  }
  const timedPlan = (
    ruleId: 'deadline' | 'exam' | 'class' | 'personal' | 'booking',
    anchorMs: number,
  ): ReminderPlan => {
    const r = prefs.rules[ruleId]
    const offset = override?.offsetMinutes ?? r.offsetMinutes
    return {
      ruleId,
      enabled: choose(r),
      source: override ? 'override' : 'category',
      triggerMs: anchorMs - offset * 60_000,
      offsetMinutes: offset,
    }
  }

  if (item.recordKind === 'task')
    return item.taskState === 'personallyCompleted' ? null : dayPlan('task')
  if (item.recordKind === 'birthday') return dayPlan('birthday')
  if (item.recordKind === 'deadline') {
    return t.kind === 'deadline' && t.dueTime
      ? timedPlan('deadline', instantMs(item.date, t.dueTime))
      : dayPlan('deadlineDateOnly')
  }
  if (t.kind === 'timed') {
    const anchor = instantMs(item.date, t.start)
    if (item.category === 'class') return timedPlan('class', anchor)
    if (item.category === 'exam') return timedPlan('exam', anchor)
    if (item.category === 'booking') return timedPlan('booking', anchor)
    if (item.category === 'personal' || item.category === 'focus' || item.category === 'meeting')
      return timedPlan('personal', anchor)
    // Clubs, sports and campus events have no category default; only an explicit "Remind me" applies.
    return override?.enabled ? { ...timedPlan('personal', anchor), enabled: true } : null
  }
  if (item.category === 'exam') return dayPlan('deadlineDateOnly') // date-only exam → previous-day reminder
  return override?.enabled ? { ...dayPlan('deadlineDateOnly'), enabled: true } : null
}

function bodyFor(item: CalendarItem): string {
  const day = formatDateShort(item.date)
  if (item.time.kind === 'timed') return `Starts at ${formatTime(item.time.start)} on ${day}`
  if (item.time.kind === 'deadline') {
    return item.time.dueTime
      ? `Due ${day} at ${formatTime(item.time.dueTime)}`
      : `Due ${day} (date only)`
  }
  return `On ${day}`
}

export function reminderCandidates(
  data: ProfileData,
  prefs: ReminderPrefs,
  from: DateOnly,
  to: DateOnly,
): ReminderCandidate[] {
  const out: ReminderCandidate[] = []
  for (const item of itemsInRange(data, from, to)) {
    const plan = reminderPlan(item, prefs)
    if (!plan?.enabled) continue
    out.push({
      key: [data.profileId, item.recordId, item.key, plan.ruleId, isoFromMs(plan.triggerMs)].join(
        '|',
      ),
      ruleId: plan.ruleId,
      item,
      triggerMs: plan.triggerMs,
      title: `Reminder: ${item.title}`,
      body: bodyFor(item),
    })
  }
  return out
}

/**
 * Reminders whose trigger falls in (fromMs, toMs] and that have not already fired. The caller passes
 * the span since its last tick while the app was running, so reminders that came due while the app was
 * closed are never replayed as if they had been delivered (C-A22, C-T20).
 */
export function dueReminders(
  candidates: readonly ReminderCandidate[],
  fired: ReadonlySet<string>,
  fromMs: number,
  toMs: number,
): ReminderCandidate[] {
  return candidates
    .filter((c) => c.triggerMs > fromMs && c.triggerMs <= toMs && !fired.has(c.key))
    .sort((a, b) => a.triggerMs - b.triggerMs || (a.key < b.key ? -1 : 1))
}
