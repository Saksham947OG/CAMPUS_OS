import { useEffect, useRef } from 'react'
import { useAppStore } from '@/app/app-store'
import { useToast } from '@/components/toast-context'
import type { NotificationRecord } from '@/data/prefs/reminder-prefs'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { usePrefs } from '@/hooks/use-prefs'
import { addDays, isoFromMs } from '@/lib/time'
import { dueReminders, reminderCandidates } from '@/selectors/reminders'

/**
 * Surfaces in-app reminders while CampusOS is open. Each tick looks only at the span since the
 * previous tick, so a reminder that came due while the app was closed is never replayed or backdated.
 * `surfacedAt` is the real time the app showed it. Keys deduplicate refreshes and profile switches.
 */
export function useReminderEngine() {
  const now = useNow(15_000)
  const profileId = useAppStore((s) => s.activeProfileId)
  const { data, status } = useCampusData()
  const reminders = usePrefs('reminders')
  const notifications = usePrefs('notifications')
  const toast = useToast()
  const last = useRef<{ profileId: string; ms: number } | null>(null)

  const ready =
    status === 'ready' && data.profileId === profileId && reminders.ready && notifications.ready

  useEffect(() => {
    if (!ready) {
      last.current = null
      return
    }
    // First tick for this profile only establishes the baseline: no back-fill.
    if (!last.current || last.current.profileId !== profileId) {
      last.current = { profileId, ms: now.ms }
      return
    }
    const fromMs = last.current.ms
    last.current = { profileId, ms: now.ms }
    if (now.ms <= fromMs) return

    const candidates = reminderCandidates(
      data,
      reminders.value,
      addDays(now.today, -1),
      addDays(now.today, 35),
    )
    const fired = new Set(notifications.value.items.map((n) => n.key))
    const due = dueReminders(candidates, fired, fromMs, now.ms)
    if (due.length === 0) return

    const surfacedAt = isoFromMs(now.ms)
    const records: NotificationRecord[] = due.map((c) => ({
      key: c.key,
      kind: 'reminder',
      title: c.title,
      body: c.body,
      itemKey: c.item.key,
      date: c.item.date,
      scheduledFor: isoFromMs(c.triggerMs),
      surfacedAt,
      readState: 'unread',
    }))
    void notifications.update((prev) => ({
      ...prev,
      items: [...records, ...prev.items].slice(0, 200),
    }))
    toast.notify(
      'info',
      due.length === 1
        ? `${due[0]!.title} — ${due[0]!.body}`
        : `${due.length} new reminders in your inbox`,
    )
  }, [ready, now.ms, now.today, profileId, data, reminders.value, notifications, toast])
}
