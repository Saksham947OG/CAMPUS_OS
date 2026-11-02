import { useState } from 'react'
import { CheckField, Field, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import type { ReminderPrefs, ReminderRuleId } from '@/data/prefs/reminder-prefs'
import { usePrefs } from '@/hooks/use-prefs'
import { isLocalTime } from '@/lib/time'

const TIMED_OFFSETS = [5, 15, 30, 60, 120, 1440, 2880]
const offsetLabel = (m: number) =>
  m >= 1440
    ? `${m / 1440} day${m === 1440 ? '' : 's'} before`
    : m >= 60
      ? `${m / 60} hour${m === 60 ? '' : 's'} before`
      : `${m} minutes before`

type Row = { id: ReminderRuleId; label: string; kind: 'timed' | 'day'; help?: string }
const ROWS: Row[] = [
  { id: 'deadline', label: 'Deadlines with a due time', kind: 'timed' },
  {
    id: 'deadlineDateOnly',
    label: 'Date-only deadlines and exams',
    kind: 'day',
    help: 'Sent at the reminder time below on an earlier day — not at an invented due time.',
  },
  { id: 'exam', label: 'Exams with a known start', kind: 'timed' },
  { id: 'class', label: 'Classes (opt-in)', kind: 'timed' },
  { id: 'personal', label: 'Your events and focus blocks', kind: 'timed' },
  { id: 'booking', label: 'Bookings', kind: 'timed' },
  { id: 'birthday', label: 'Birthdays (opt-in)', kind: 'day' },
  { id: 'task', label: 'Your tasks with a due date (opt-in)', kind: 'day' },
]

/** Reminder preferences. Auto-saves; says "saved on this device" only when it really persisted. */
export function ReminderSettings() {
  const prefs = usePrefs('reminders')
  const toast = useToast()
  const [clockError, setClockError] = useState<string>()

  if (!prefs.ready) return <p className="text-ink-muted">Loading…</p>
  const p = prefs.value

  const save = async (fn: (prev: ReminderPrefs) => ReminderPrefs) => {
    const result = await prefs.update(fn)
    toast.savedResult(result, 'Reminder settings')
  }

  return (
    <div className="flex flex-col gap-3">
      <CheckField
        label="Show in-app reminders"
        checked={p.enabled}
        onChange={(v) => void save((prev) => ({ ...prev, enabled: v }))}
        hint="Reminders appear only while CampusOS is open. Nothing is sent by push, email, SMS or WhatsApp."
      />
      <Field
        label="Reminder time for date-only records"
        error={clockError}
        hint="A preference for when to remind you. It is never shown as a due time."
      >
        {(a) => (
          <input
            {...a}
            type="time"
            className={`${inputClass} max-w-40`}
            value={p.dateOnlyClock}
            onChange={(e) => {
              const v = e.target.value
              if (!isLocalTime(v)) return setClockError('Enter a valid time')
              setClockError(undefined)
              void save((prev) => ({ ...prev, dateOnlyClock: v }))
            }}
          />
        )}
      </Field>

      <ul className="flex flex-col divide-y divide-border">
        {ROWS.map((row) => {
          const rule = p.rules[row.id]
          return (
            <li key={row.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_12rem] sm:items-center">
              <div>
                <CheckField
                  label={row.label}
                  checked={rule.enabled}
                  disabled={!p.enabled}
                  onChange={(v) =>
                    void save((prev) => ({
                      ...prev,
                      rules: { ...prev.rules, [row.id]: { ...prev.rules[row.id], enabled: v } },
                    }))
                  }
                  hint={row.help}
                />
              </div>
              {'offsetMinutes' in rule ? (
                <select
                  aria-label={`${row.label}: how early`}
                  className={inputClass}
                  disabled={!p.enabled || !rule.enabled}
                  value={rule.offsetMinutes}
                  onChange={(e) =>
                    void save((prev) => ({
                      ...prev,
                      rules: {
                        ...prev.rules,
                        [row.id]: { ...prev.rules[row.id], offsetMinutes: Number(e.target.value) },
                      },
                    }))
                  }
                >
                  {[...new Set([...TIMED_OFFSETS, rule.offsetMinutes])]
                    .sort((a, b) => a - b)
                    .map((m) => (
                      <option key={m} value={m}>
                        {offsetLabel(m)}
                      </option>
                    ))}
                </select>
              ) : (
                <select
                  aria-label={`${row.label}: how early`}
                  className={inputClass}
                  disabled={!p.enabled || !rule.enabled}
                  value={rule.daysBefore}
                  onChange={(e) =>
                    void save((prev) => ({
                      ...prev,
                      rules: {
                        ...prev.rules,
                        [row.id]: { ...prev.rules[row.id], daysBefore: Number(e.target.value) },
                      },
                    }))
                  }
                >
                  {[0, 1, 2, 3, 7].map((d) => (
                    <option key={d} value={d}>
                      {d === 0 ? 'On the day' : `${d} day${d === 1 ? '' : 's'} before`}
                    </option>
                  ))}
                </select>
              )}
            </li>
          )
        })}
      </ul>
      <p className="text-xs text-ink-muted">
        Quiet hours are not offered: a timing rule that is not built would be a dead control.
      </p>
    </div>
  )
}
