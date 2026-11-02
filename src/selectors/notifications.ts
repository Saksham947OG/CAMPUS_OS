import type { NotificationRecord } from '@/data/prefs/reminder-prefs'
import type { NotificationCategory, NotificationPrefs, Priority } from '@/domain/shared'

/** Where a message came from, read off its own link. Reminders always belong to the Calendar. */
export function categoryOf(n: Pick<NotificationRecord, 'kind' | 'href'>): NotificationCategory {
  if (n.kind === 'reminder') return 'calendar'
  const h = n.href ?? ''
  if (h.startsWith('/services/chill-spot')) return 'orders'
  if (h.startsWith('/services/laundry')) return 'laundry'
  if (h.startsWith('/services/parcels')) return 'parcels'
  if (h.startsWith('/services/mess')) return 'mess'
  if (h.startsWith('/bookings')) return 'bookings'
  if (h.startsWith('/administration')) return 'administration'
  if (h.startsWith('/academics/exams')) return 'exams'
  if (h.startsWith('/academics')) return 'academics'
  if (h.startsWith('/community')) return 'community'
  return 'other'
}

export const priorityOf = (n: Pick<NotificationRecord, 'significance'>): Priority =>
  n.significance ?? 'standard'

export const isImportant = (n: Pick<NotificationRecord, 'significance'>) =>
  priorityOf(n) === 'critical' || priorityOf(n) === 'important'

/**
 * A mute hides standard and optional messages of that category. Important and critical ones always
 * stay, and the underlying record is never deleted: unmuting brings everything back.
 */
export const isHiddenByMute = (n: NotificationRecord, prefs: NotificationPrefs) =>
  prefs.muted.includes(categoryOf(n)) && !isImportant(n)

export const visibleNotifications = (
  items: readonly NotificationRecord[],
  prefs: NotificationPrefs,
) => items.filter((n) => !isHiddenByMute(n, prefs))

export interface InboxFilter {
  show: 'all' | 'unread' | 'important'
  category: NotificationCategory | ''
}

export function filterInbox(
  items: readonly NotificationRecord[],
  prefs: NotificationPrefs,
  f: InboxFilter,
) {
  return visibleNotifications(items, prefs)
    .filter((n) => (f.category ? categoryOf(n) === f.category : true))
    .filter((n) =>
      f.show === 'unread'
        ? n.readState === 'unread'
        : f.show === 'important'
          ? isImportant(n)
          : true,
    )
    .sort((a, b) =>
      a.surfacedAt < b.surfacedAt ? 1 : a.surfacedAt > b.surfacedAt ? -1 : a.key < b.key ? -1 : 1,
    )
}

export const unreadCount = (items: readonly NotificationRecord[], prefs: NotificationPrefs) =>
  visibleNotifications(items, prefs).filter((n) => n.readState === 'unread').length
