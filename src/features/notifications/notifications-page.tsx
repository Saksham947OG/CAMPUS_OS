import { AlertCircle, BellRing, CheckCheck, Clock } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { RouteStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { routeById } from '@/app/routes'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { usePrefs } from '@/hooks/use-prefs'
import { formatDateShort, formatInstant, formatTime } from '@/lib/time'
import { deadlineFocus } from '@/selectors/deadlines'
import { calendarLink } from '../calendar/calendar-url'
import { categoryName, NOTIFICATION_CATEGORIES, type NotificationCategory } from '@/domain/shared'
import {
  categoryOf,
  filterInbox,
  isImportant,
  unreadCount,
  visibleNotifications,
  type InboxFilter,
} from '@/selectors/notifications'
import { useState } from 'react'

export function NotificationsPage() {
  const route = routeById('notifications')!
  const notifications = usePrefs('notifications')
  const nprefs = usePrefs('notificationPrefs')
  const [filter, setFilter] = useState<InboxFilter>({ show: 'all', category: '' })
  const { data } = useCampusData()
  const now = useNow()

  if (!notifications.ready)
    return <output className="block text-ink-muted">Loading notifications…</output>

  const all = notifications.value.items
  const shown = visibleNotifications(all, nprefs.value)
  const hiddenByMute = all.length - shown.length
  const items = filterInbox(all, nprefs.value, filter)
  const unread = unreadCount(all, nprefs.value)
  const attention = deadlineFocus(data, now, { hideCompleted: true }).filter(
    (e) => e.standing === 'overdue' || e.standing === 'dueToday',
  )

  const setRead = (key: string, readState: 'read' | 'unread') =>
    void notifications.update((p) => ({
      ...p,
      items: p.items.map((i) => (i.key === key ? { ...i, readState } : i)),
    }))

  return (
    <article>
      <PageHeader
        title="Notifications"
        description="In-app reminders and demo café order updates. They appear only while CampusOS is open; nothing is sent by push, email, SMS or WhatsApp."
        badge={route.status !== 'live' ? <RouteStatusBadge status={route.status} /> : undefined}
      />

      <div className="grid max-w-3xl gap-6">
        <section
          aria-labelledby="attention-h"
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <h2 id="attention-h" className="flex items-center gap-2 text-base font-semibold text-ink">
            <AlertCircle className="size-4 text-teal-strong" aria-hidden="true" /> Needs attention
            now
          </h2>
          {attention.length === 0 ? (
            <p className="mt-2 text-sm text-ink-muted">
              No overdue or due-today items in your records.
            </p>
          ) : (
            <>
              <p className="mt-1 text-sm text-ink-muted">
                Shown because these records are due. No alert was delivered for them while CampusOS
                was closed.
              </p>
              <ul className="mt-3 flex flex-col gap-2">
                {attention.map((e) => (
                  <li key={e.key} className="rounded-md border border-border bg-canvas p-3 text-sm">
                    <Link
                      to={calendarLink({
                        view: 'day',
                        date: e.dueDate,
                        event: e.calendarKey,
                        panel: 'details',
                      })}
                      className="font-medium text-ink hover:underline"
                    >
                      {e.title}
                    </Link>
                    <p className="text-ink-muted">
                      {e.standing === 'overdue' ? 'Overdue' : 'Due today'} ·{' '}
                      {formatDateShort(e.dueDate)}
                      {e.dueTime ? `, ${formatTime(e.dueTime)}` : ' (date only)'}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section
          aria-labelledby="inbox-h"
          className="rounded-lg border border-border bg-surface p-5 shadow-card"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="inbox-h" className="flex items-center gap-2 text-base font-semibold text-ink">
              <BellRing className="size-4 text-teal-strong" aria-hidden="true" /> Reminder inbox
              <span className="text-sm font-normal text-ink-muted">({unread} unread)</span>
            </h2>
            <Button
              variant="outline"
              className="min-h-11 gap-2"
              disabled={unread === 0}
              onClick={() =>
                void notifications.update((p) => ({
                  ...p,
                  // Only what is currently shown: a muted or filtered-out message is not marked read behind your back.
                  items: p.items.map((i) =>
                    items.some((x) => x.key === i.key) ? { ...i, readState: 'read' as const } : i,
                  ),
                }))
              }
            >
              <CheckCheck aria-hidden="true" /> Mark all shown read
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <fieldset className="flex flex-wrap gap-1.5">
              <legend className="sr-only">Show</legend>
              {(['all', 'unread', 'important'] as const).map((v) => (
                <Button
                  key={v}
                  variant="outline"
                  size="sm"
                  className="min-h-11"
                  aria-pressed={filter.show === v}
                  onClick={() => setFilter({ ...filter, show: v })}
                >
                  {v === 'all' ? 'All' : v === 'unread' ? 'Unread' : 'Important'}
                </Button>
              ))}
            </fieldset>
            <label className="flex items-center gap-2 text-sm">
              Category
              <select
                className="min-h-11 rounded-md border border-border-strong bg-surface px-2 text-sm"
                value={filter.category}
                onChange={(e) =>
                  setFilter({ ...filter, category: e.target.value as NotificationCategory | '' })
                }
              >
                <option value="">All categories</option>
                {NOTIFICATION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryName[c]}
                  </option>
                ))}
              </select>
            </label>
            <Link
              to="/notifications/mail"
              className="min-h-11 py-2.5 text-sm font-medium text-teal-strong underline"
            >
              Campus Mail
            </Link>
            <Link
              to="/notifications/preferences"
              className="min-h-11 py-2.5 text-sm font-medium text-teal-strong underline"
            >
              Notification preferences
            </Link>
          </div>
          {hiddenByMute > 0 ? (
            <p className="mt-2 text-xs text-ink-muted">
              {hiddenByMute} standard or optional{' '}
              {hiddenByMute === 1 ? 'message is' : 'messages are'} hidden by your muted categories.
              Nothing was deleted.
            </p>
          ) : null}
          {items.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-border-strong bg-canvas p-3 text-sm text-ink-muted">
              {all.length === 0
                ? 'No reminders have appeared yet.'
                : 'Nothing matches this filter.'}{' '}
              A reminder is added here only when one comes due while CampusOS is open. Adjust what
              you are reminded about in{' '}
              <Link to="/settings#reminders" className="font-medium text-teal-strong underline">
                Settings
              </Link>
              .
            </p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {items.map((n) => (
                <li
                  key={n.key}
                  className="rounded-md border border-border bg-canvas p-3 text-sm"
                  data-read={n.readState}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={n.readState === 'unread' ? 'font-semibold text-ink' : 'text-ink'}
                      >
                        {n.readState === 'unread' ? (
                          <span className="mr-1.5 rounded-full bg-teal px-1.5 py-0.5 text-[10px] font-semibold uppercase text-surface">
                            New
                          </span>
                        ) : null}
                        {n.title}
                      </p>
                      <p className="text-ink-muted">{n.body}</p>
                      <p className="text-xs text-ink-muted">
                        {categoryName[categoryOf(n)]} ·{' '}
                        {n.significance === 'critical'
                          ? 'Critical'
                          : isImportant(n)
                            ? 'Important'
                            : n.significance === 'optional'
                              ? 'Optional'
                              : 'Standard'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                        <Clock className="size-3" aria-hidden="true" />
                        Triggered in-app at{' '}
                        <time dateTime={n.surfacedAt}>{formatInstant(n.surfacedAt)}</time>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => setRead(n.key, 'read')}
                      >
                        <Link
                          aria-label={`Open: ${n.title}`}
                          to={
                            n.href ??
                            calendarLink({
                              view: 'day',
                              date: n.date as never,
                              event: n.itemKey,
                              panel: 'details',
                            })
                          }
                        >
                          Open
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-11"
                        onClick={() => setRead(n.key, n.readState === 'read' ? 'unread' : 'read')}
                      >
                        Mark {n.readState === 'read' ? 'unread' : 'read'}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </article>
  )
}
