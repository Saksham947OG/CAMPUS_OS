import { Bell } from 'lucide-react'
import { CheckField, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { usePrefs } from '@/hooks/use-prefs'
import { formatInstant, isoFromMs } from '@/lib/time'
import type { CalendarItem } from '@/selectors/items'
import type { Now } from '@/selectors/now'
import { reminderPlan } from '@/selectors/reminders'

const OFFSETS = [5, 15, 30, 60, 120, 1440]
const label = (m: number) =>
  m >= 1440
    ? '1 day before'
    : m >= 60
      ? `${m / 60} hour${m === 60 ? '' : 's'} before`
      : `${m} minutes before`

/**
 * Per-occurrence "Remind me" (in-app only). It overrides the category default, and the status line
 * says what will actually happen — including that nothing is delivered while the app is closed.
 */
export function ReminderControl({ item, now }: { item: CalendarItem; now: Now }) {
  const prefs = usePrefs('reminders')
  const toast = useToast()
  if (!prefs.ready || item.status === 'cancelled') return null
  const p = prefs.value
  const past = item.date < now.today
  const plan = reminderPlan(item, p)
  const overridden = !!p.overrides[item.key]
  const timed = item.time.kind === 'timed' || (item.time.kind === 'deadline' && !!item.time.dueTime)

  const save = async (next: { enabled: boolean; offsetMinutes?: number } | null) => {
    const result = await prefs.update((prev) => {
      const overrides = { ...prev.overrides }
      if (next) overrides[item.key] = next
      else delete overrides[item.key]
      return { ...prev, overrides }
    })
    toast.savedResult(result, 'Reminder')
  }

  const status = !p.enabled
    ? 'In-app reminders are turned off in Settings.'
    : past
      ? 'This has already passed, so no reminder can fire.'
      : plan?.enabled
        ? `You will see an in-app reminder ${timed && plan.offsetMinutes !== undefined ? label(plan.offsetMinutes) : `on ${formatInstant(isoFromMs(plan.triggerMs))}`} while CampusOS is open.`
        : 'No reminder is set for this one.'

  return (
    <section
      aria-label="Reminder"
      className="mt-4 rounded-md border border-border bg-canvas p-3 text-sm"
    >
      <h4 className="flex items-center gap-1.5 font-semibold text-ink">
        <Bell className="size-4" aria-hidden="true" /> Reminder
      </h4>
      <CheckField
        label="Remind me"
        checked={!!plan?.enabled}
        disabled={!p.enabled || past}
        onChange={(v) =>
          void save({
            enabled: v,
            ...(v && timed ? { offsetMinutes: plan?.offsetMinutes ?? 15 } : {}),
          })
        }
      />
      {plan?.enabled && timed && !past ? (
        <label className="mb-1 flex flex-col gap-1 text-xs text-ink-muted">
          How early
          <select
            className={inputClass}
            value={plan.offsetMinutes ?? 15}
            onChange={(e) => void save({ enabled: true, offsetMinutes: Number(e.target.value) })}
          >
            {[...new Set([...OFFSETS, plan.offsetMinutes ?? 15])]
              .sort((a, b) => a - b)
              .map((m) => (
                <option key={m} value={m}>
                  {label(m)}
                </option>
              ))}
          </select>
        </label>
      ) : null}
      <p className="text-xs text-ink-muted">
        {status} Nothing is sent when the app is closed, and never by push, email or SMS.
      </p>
      {overridden ? (
        <Button variant="ghost" size="sm" className="mt-1 min-h-11" onClick={() => void save(null)}>
          Use the default for this kind
        </Button>
      ) : null}
    </section>
  )
}
