import { z } from 'zod'
import { localTimeSchema } from '@/domain/records'
import type { LocalTime } from '@/lib/time'

const timedRule = z.object({
  enabled: z.boolean(),
  offsetMinutes: z.number().int().min(0).max(10080),
})
const dayRule = z.object({ enabled: z.boolean(), daysBefore: z.number().int().min(0).max(14) })

/**
 * In-app reminder preferences (COS-CAL-001 §9). Defaults are design defaults, not campus policy.
 * Reminders are shown only while CampusOS is open; push, email, SMS and WhatsApp do not exist.
 */
export const reminderPrefsSchema = z.object({
  schemaVersion: z.literal(1),
  enabled: z.boolean(),
  /** Clock time for reminders about date-only records. It is NOT the record's due time. */
  dateOnlyClock: localTimeSchema,
  rules: z.object({
    deadline: timedRule,
    deadlineDateOnly: dayRule,
    exam: timedRule,
    class: timedRule,
    personal: timedRule,
    booking: timedRule,
    birthday: dayRule,
    task: dayRule,
  }),
  /** Per-occurrence "Remind me" overrides, keyed by occurrence key. They win over category rules. */
  overrides: z.record(
    z.string(),
    z.object({
      enabled: z.boolean(),
      offsetMinutes: z.number().int().min(0).max(10080).optional(),
    }),
  ),
})
export type ReminderPrefs = z.infer<typeof reminderPrefsSchema>
export type ReminderRuleId = keyof ReminderPrefs['rules']

export const defaultReminderPrefs = (): ReminderPrefs => ({
  schemaVersion: 1,
  enabled: true,
  dateOnlyClock: '09:00' as LocalTime,
  rules: {
    deadline: { enabled: true, offsetMinutes: 1440 }, // 24 h before a provided due instant
    deadlineDateOnly: { enabled: true, daysBefore: 1 }, // previous day at the reminder clock (DEC-024)
    exam: { enabled: true, offsetMinutes: 1440 },
    class: { enabled: false, offsetMinutes: 15 },
    personal: { enabled: true, offsetMinutes: 15 },
    booking: { enabled: true, offsetMinutes: 30 },
    birthday: { enabled: false, daysBefore: 0 },
    task: { enabled: false, daysBefore: 1 },
  },
  overrides: {},
})

export const notificationRecordSchema = z.object({
  /** The deduplication key: `profile|record|occurrence|rule|triggerAt` for reminders, `chill|order|transition` for orders, `ess|entity|transition|recipient` for Campus Essentials. */
  key: z.string().min(1),
  kind: z.enum(['reminder', 'order', 'service']),
  title: z.string().min(1).max(200),
  body: z.string().max(300),
  /** Occurrence key of the underlying Calendar record (reminders only). */
  itemKey: z.string().min(1).optional(),
  date: z.string().optional(),
  /** When a reminder was scheduled to trigger. */
  scheduledFor: z.iso.datetime({ offset: true }).optional(),
  /** Where "Open" goes (orders). Reminders deep-link to the Calendar from `itemKey`/`date`. */
  href: z.string().startsWith('/').optional(),
  /** Metadata only: no preference toggles consume it until a notification-preferences feature is approved. */
  significance: z.enum(['critical', 'important', 'standard', 'optional']).optional(),
  /** When CampusOS actually surfaced it (only ever set by the running app). */
  surfacedAt: z.iso.datetime({ offset: true }),
  readState: z.enum(['unread', 'read']),
})
export type NotificationRecord = z.infer<typeof notificationRecordSchema>

export const notificationsSchema = z.object({
  schemaVersion: z.literal(1),
  items: z.array(notificationRecordSchema).max(200),
})
export type NotificationsState = z.infer<typeof notificationsSchema>
export const emptyNotifications = (): NotificationsState => ({ schemaVersion: 1, items: [] })
