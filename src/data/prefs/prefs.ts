import { z } from 'zod'
import { EVENT_CATEGORIES, eventCategorySchema } from '@/domain/records'
import { defaultFilters, type ItemFilters } from '@/selectors/filters'
import { defaultPlanningPrefs, planningPrefsSchema } from '@/selectors/free-pockets'
import {
  defaultNotificationPrefs,
  notificationPrefsSchema,
  type NotificationPrefs,
} from '@/domain/shared'
import { defaultHomePrefs, homePrefsSchema, type HomePrefs } from './home-prefs'
import {
  defaultReminderPrefs,
  emptyNotifications,
  notificationsSchema,
  reminderPrefsSchema,
  type NotificationsState,
  type ReminderPrefs,
} from './reminder-prefs'
import {
  createLocalPreferencesRepository,
  type PreferencesRepository,
} from '../repositories/preferences-repository'
import type { StorageAdapter } from '../storage/storage-adapter'

export const CALENDAR_VIEWS = ['month', 'week', 'day', 'agenda'] as const
export type CalendarView = (typeof CALENDAR_VIEWS)[number]

/** Calendar display + filter preferences, per profile. Independent of Home's (COS-CAL-001 §5.3). */
export const calendarPrefsSchema = z
  .object({
    schemaVersion: z.literal(1),
    view: z.enum(CALENDAR_VIEWS),
    categories: z.array(eventCategorySchema),
    courseIds: z.array(z.string()),
    verification: z.enum(['all', 'confirmed', 'tentative']),
    origin: z.enum(['all', 'provided', 'demo', 'personal']),
    showCompletedTasks: z.boolean(),
    diningOverlay: z.boolean(),
    hourStart: z.number().int().min(0).max(22),
    hourEnd: z.number().int().min(2).max(24),
    railCollapsed: z.boolean(),
    inspectorCollapsed: z.boolean(),
  })
  .superRefine((p, ctx) => {
    if (p.hourEnd <= p.hourStart) {
      ctx.addIssue({
        code: 'custom',
        path: ['hourEnd'],
        message: 'Visible hours must end after they start',
      })
    }
  })
export type CalendarPrefs = z.infer<typeof calendarPrefsSchema>

export const defaultCalendarPrefs = (): CalendarPrefs => {
  const f = defaultFilters()
  return {
    schemaVersion: 1,
    view: 'week', // C-D08: the main Calendar opens in Week
    categories: [...f.categories],
    courseIds: [],
    verification: f.verification,
    origin: f.origin,
    showCompletedTasks: f.showCompletedTasks,
    diningOverlay: false,
    hourStart: 8,
    hourEnd: 22,
    railCollapsed: false,
    inspectorCollapsed: false,
  }
}

export const filtersFromPrefs = (p: CalendarPrefs, search = ''): ItemFilters => ({
  categories: p.categories.filter((c) => (EVENT_CATEGORIES as readonly string[]).includes(c)),
  courseIds: p.courseIds,
  verification: p.verification,
  origin: p.origin,
  showCompletedTasks: p.showCompletedTasks,
  search,
})

export interface PrefsRepositories {
  calendar: PreferencesRepository<CalendarPrefs>
  planning: PreferencesRepository<z.infer<typeof planningPrefsSchema>>
  home: PreferencesRepository<HomePrefs>
  reminders: PreferencesRepository<ReminderPrefs>
  notifications: PreferencesRepository<NotificationsState>
  notificationPrefs: PreferencesRepository<NotificationPrefs>
}

export function createPrefsRepositories(storage: StorageAdapter): PrefsRepositories {
  return {
    calendar: createLocalPreferencesRepository({
      storage,
      area: 'calendar',
      version: 1,
      schema: calendarPrefsSchema,
      defaults: defaultCalendarPrefs,
    }),
    reminders: createLocalPreferencesRepository({
      storage,
      area: 'reminders',
      version: 1,
      schema: reminderPrefsSchema,
      defaults: defaultReminderPrefs,
    }),
    notifications: createLocalPreferencesRepository({
      storage,
      area: 'notifications',
      version: 1,
      schema: notificationsSchema,
      defaults: emptyNotifications,
    }),
    notificationPrefs: createLocalPreferencesRepository({
      storage,
      area: 'notificationprefs',
      version: 1,
      schema: notificationPrefsSchema,
      defaults: defaultNotificationPrefs,
    }),
    home: createLocalPreferencesRepository({
      storage,
      area: 'home',
      version: 1,
      schema: homePrefsSchema,
      defaults: defaultHomePrefs,
    }),
    planning: createLocalPreferencesRepository({
      storage,
      area: 'planning',
      version: 1,
      schema: planningPrefsSchema,
      defaults: defaultPlanningPrefs,
    }),
  }
}
