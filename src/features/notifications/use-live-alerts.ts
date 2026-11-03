import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '@/app/app-store'
import { useWorkspaceState } from '@/app/workspace-store'
import type { NotificationRecord } from '@/data/prefs/reminder-prefs'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { usePrefs } from '@/hooks/use-prefs'
import { isoFromMs } from '@/lib/time'
import { liveAlerts, type LiveAlert } from '@/selectors/live-alerts'

/** An alert stays on screen for this long after its time, then lives in the inbox. */
const SHOW_MS = 90_000

/**
 * Live alerts from 4:00 to 5:30 pm. Each tick checks the clock: an alert whose time has come is filed in the
 * inbox (so the bell count and the Notifications page show it, even if the app was opened later in the window)
 * and, for the first 90 seconds, appears on screen. Alerts come from the person's own calendar and from
 * recorded project activity addressed to them; none claims anyone is online. In-app only: no email or push.
 */
export function useLiveAlerts(): { visible: LiveAlert[]; dismiss: (key: string) => void } {
  const now = useNow(15_000)
  const profileId = useAppStore((s) => s.activeProfileId)
  const profiles = useAppStore((s) => s.profiles)
  const { data, status } = useCampusData()
  const ws = useWorkspaceState((s) => s.workspace)
  const notifications = usePrefs('notifications')
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set())
  const filed = useRef(new Set<string>())
  const ready = status === 'ready' && data.profileId === profileId && notifications.ready

  const alerts = useMemo(
    () =>
      ready ? liveAlerts({ data, ws, profiles, profileId, today: now.today, nowMs: now.ms }) : [],
    [ready, data, ws, profiles, profileId, now.today, now.ms],
  )

  useEffect(() => {
    if (!ready) return
    const have = new Set(notifications.value.items.map((n) => n.key))
    const fresh = alerts.filter((a) => !have.has(a.key) && !filed.current.has(a.key))
    if (!fresh.length) return
    fresh.forEach((a) => filed.current.add(a.key))
    const records: NotificationRecord[] = fresh.map((a) => ({
      key: a.key,
      kind: 'service',
      title: a.title,
      body: a.body,
      href: a.href,
      significance: 'important',
      surfacedAt: isoFromMs(a.atMs),
      readState: 'unread',
    }))
    void notifications.update((prev) => ({
      ...prev,
      items: [...records, ...prev.items].slice(0, 200),
    }))
  }, [ready, alerts, notifications])

  const visible = alerts.filter((a) => now.ms - a.atMs < SHOW_MS && !dismissed.has(a.key)).slice(-2)
  return { visible, dismiss: (key) => setDismissed((d) => new Set(d).add(key)) }
}
