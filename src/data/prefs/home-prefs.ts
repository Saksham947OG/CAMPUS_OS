import { z } from 'zod'
import { eventCategorySchema, EVENT_CATEGORIES } from '@/domain/records'

export const HOME_WIDGET_IDS = [
  'schedule',
  'upNext',
  'deadlines',
  'quickActions',
  'activity',
  'messPreview',
  'myTasks',
  'freePockets',
  'campusPulse',
  'timeTax',
  'workspace',
] as const
export type HomeWidgetId = (typeof HOME_WIDGET_IDS)[number]

export const widgetLayoutSchema = z.object({
  id: z.enum(HOME_WIDGET_IDS),
  visible: z.boolean(),
  zone: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  order: z.number().int().min(0).max(100),
  size: z.enum(['compact', 'standard', 'wide']),
})
export type WidgetLayout = z.infer<typeof widgetLayoutSchema>

export const HOME_PRESET_IDS = ['balanced', 'academic', 'campusLife'] as const
export type HomePresetId = (typeof HOME_PRESET_IDS)[number]

/** COS-HOME-001 §6.2. Schedule and header are always visible in every preset. */
export const HOME_PRESETS: Record<
  HomePresetId,
  { label: string; description: string; visible: readonly HomeWidgetId[] }
> = {
  balanced: {
    label: 'Balanced Campus',
    description: 'All ten optional widgets.',
    visible: [
      'upNext',
      'deadlines',
      'quickActions',
      'activity',
      'messPreview',
      'myTasks',
      'freePockets',
      'campusPulse',
      'timeTax',
      'workspace',
    ],
  },
  academic: {
    label: 'Academic Focus',
    description: 'Up Next, deadlines, quick actions, tasks, Free Pockets and activity.',
    visible: [
      'upNext',
      'deadlines',
      'quickActions',
      'myTasks',
      'freePockets',
      'activity',
      'workspace',
    ],
  },
  campusLife: {
    label: 'Campus Life',
    description: 'Up Next, quick actions, activity, mess, Campus Pulse, Free Pockets and Time Tax.',
    visible: [
      'upNext',
      'quickActions',
      'activity',
      'messPreview',
      'campusPulse',
      'freePockets',
      'timeTax',
    ],
  },
}

/** Default zone per widget (COS-HOME-001 §6.3). */
export const DEFAULT_ZONE: Record<HomeWidgetId, 1 | 2 | 3> = {
  schedule: 1,
  upNext: 1,
  deadlines: 1,
  quickActions: 2,
  activity: 2,
  messPreview: 2,
  myTasks: 2,
  freePockets: 2,
  campusPulse: 3,
  timeTax: 3,
  workspace: 2,
}

export const DEFAULT_ORDER: readonly HomeWidgetId[] = [
  'schedule',
  'upNext',
  'deadlines',
  'quickActions',
  'activity',
  'messPreview',
  'myTasks',
  'freePockets',
  'campusPulse',
  'timeTax',
  'workspace',
]

export const DEFAULT_QUICK_ACTIONS = ['chill-spot', 'laundry', 'bookings', 'mess'] as const

export const homePrefsSchema = z
  .object({
    schemaVersion: z.literal(1),
    preset: z.enum([...HOME_PRESET_IDS, 'custom']),
    scheduleView: z.enum(['agenda', 'week']),
    density: z.enum(['comfortable', 'compact']),
    quickActions: z.array(z.string().min(1)).length(4),
    widgets: z.array(widgetLayoutSchema),
    filters: z.object({
      categories: z.array(eventCategorySchema),
      courseIds: z.array(z.string()),
      verification: z.enum(['all', 'confirmed', 'tentative']),
      origin: z.enum(['all', 'provided', 'demo', 'personal']),
      showCompleted: z.boolean(),
    }),
  })
  .superRefine((p, ctx) => {
    if (new Set(p.quickActions).size !== p.quickActions.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['quickActions'],
        message: 'Quick actions must be unique',
      })
    }
    if (new Set(p.widgets.map((w) => w.id)).size !== p.widgets.length) {
      ctx.addIssue({ code: 'custom', path: ['widgets'], message: 'Duplicate widget ids' })
    }
    const schedule = p.widgets.find((w) => w.id === 'schedule')
    if (!schedule || !schedule.visible || schedule.zone !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['widgets'],
        message: 'The schedule is pinned and always visible',
      })
    }
  })
export type HomePrefs = z.infer<typeof homePrefsSchema>

export function layoutForPreset(preset: HomePresetId): WidgetLayout[] {
  const visible = new Set<HomeWidgetId>(['schedule', ...HOME_PRESETS[preset].visible])
  const widgetOrder = [...DEFAULT_ORDER]
  return widgetOrder.map((id, order) => ({
    id,
    visible: visible.has(id),
    zone: DEFAULT_ZONE[id],
    order,
    size: 'standard' as const,
  }))
}

/**
 * Layouts saved before a widget existed do not list it. It is added back hidden-by-default only when the
 * saved layout predates it, so an older saved layout keeps its own choices and the new card can be switched on.
 */
export function withMissingWidgets(widgets: readonly WidgetLayout[]): WidgetLayout[] {
  const have = new Set(widgets.map((w) => w.id))
  const missing = layoutForPreset('balanced').filter((w) => !have.has(w.id))
  return [...widgets, ...missing.map((w, i) => ({ ...w, visible: true, order: 50 + i }))]
}

export const defaultHomePrefs = (): HomePrefs => ({
  schemaVersion: 1,
  preset: 'balanced',
  scheduleView: 'agenda', // H-D08
  density: 'comfortable',
  quickActions: [...DEFAULT_QUICK_ACTIONS],
  widgets: layoutForPreset('balanced'),
  filters: {
    categories: [...EVENT_CATEGORIES], // all categories visible unless filtered explicitly
    courseIds: [],
    verification: 'all',
    origin: 'all',
    showCompleted: true,
  },
})
