import { categoriesInLayer, categoryLabel, LAYERS, type Layer } from '@/domain/categories'
import { EVENT_CATEGORIES, type EventCategory } from '@/domain/records'
import type { CalendarItem } from './items'

export type VerificationFilter = 'all' | 'confirmed' | 'tentative'
export type OriginFilter = 'all' | 'provided' | 'demo' | 'personal'

/** Visibility-only state. It never edits, hides-by-deleting or re-owns a record (C-T15). */
export interface ItemFilters {
  /** Categories currently visible. */
  categories: readonly EventCategory[]
  /** Empty = every course. */
  courseIds: readonly string[]
  verification: VerificationFilter
  origin: OriginFilter
  showCompletedTasks: boolean
  search: string
}

export interface CalendarPreset {
  id: 'balanced' | 'academic' | 'campusLife' | 'examPrep'
  label: string
  description: string
  categories: readonly EventCategory[]
}

/** COS-CAL-001 §5.2. Dining overlay is a separate toggle and is Off in every preset. */
export const CALENDAR_PRESETS: readonly CalendarPreset[] = [
  {
    id: 'balanced',
    label: 'Balanced Campus',
    description:
      'Academic, personal, bookings, administrative dates, birthday dots and campus events.',
    categories: [
      'class',
      'exam',
      'assignment',
      'project',
      'meeting',
      'personal',
      'task',
      'focus',
      'booking',
      'administration',
      'holiday',
      'birthday',
      'campusEvent',
    ],
  },
  {
    id: 'academic',
    label: 'Academic Focus',
    description:
      'Classes, exams, deadlines and your own study plans. Other campus items are hidden.',
    categories: ['class', 'exam', 'assignment', 'project', 'meeting', 'personal', 'task', 'focus'],
  },
  {
    id: 'campusLife',
    label: 'Campus Life',
    description: 'Birthdays, clubs, sports, campus events, personal plans and bookings.',
    categories: [
      'birthday',
      'club',
      'campusEvent',
      'sports',
      'personal',
      'task',
      'focus',
      'booking',
    ],
  },
  {
    id: 'examPrep',
    label: 'Exam Preparation',
    description: 'Exams, deadlines, related classes and your tasks and focus blocks.',
    categories: ['exam', 'assignment', 'project', 'class', 'personal', 'task', 'focus'],
  },
]

export const DEFAULT_PRESET_ID: CalendarPreset['id'] = 'balanced'

export const presetById = (id: string) => CALENDAR_PRESETS.find((p) => p.id === id)

export const defaultFilters = (): ItemFilters => ({
  categories: [...(presetById(DEFAULT_PRESET_ID)?.categories ?? EVENT_CATEGORIES)],
  courseIds: [],
  verification: 'all',
  origin: 'all',
  showCompletedTasks: true,
  search: '',
})

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x))

/** Which preset (if any) the current category set equals; otherwise the UI shows "Custom". */
export function matchPreset(categories: readonly EventCategory[]): CalendarPreset['id'] | 'custom' {
  return CALENDAR_PRESETS.find((p) => sameSet(p.categories, categories))?.id ?? 'custom'
}

export function layerState(
  categories: readonly EventCategory[],
  layer: Layer,
): 'all' | 'some' | 'none' {
  const inLayer = categoriesInLayer(layer)
  const on = inLayer.filter((c) => categories.includes(c)).length
  return on === 0 ? 'none' : on === inLayer.length ? 'all' : 'some'
}

export function toggleLayer(categories: readonly EventCategory[], layer: Layer): EventCategory[] {
  const inLayer = categoriesInLayer(layer)
  return layerState(categories, layer) === 'all'
    ? categories.filter((c) => !inLayer.includes(c))
    : [...new Set([...categories, ...inLayer])]
}

export const ALL_LAYERS = LAYERS

export function activeFilterCount(
  f: ItemFilters,
  baseline: ItemFilters = defaultFilters(),
): number {
  let n = 0
  if (!sameSet(f.categories, baseline.categories)) n++
  if (f.courseIds.length) n++
  if (f.verification !== 'all') n++
  if (f.origin !== 'all') n++
  if (f.showCompletedTasks !== baseline.showCompletedTasks) n++
  if (f.search.trim()) n++
  return n
}

const originOf = (item: CalendarItem): OriginFilter => {
  switch (item.provenance.dataMode) {
    case 'provided':
      return 'provided'
    case 'demoSeed':
    case 'simulated':
      return 'demo'
    default:
      return 'personal'
  }
}

/** Why an item is hidden, or null if it is visible. Used for the "Hidden by filters" explanation. */
export function hiddenReason(
  item: CalendarItem,
  f: ItemFilters,
  revealed?: ReadonlySet<string>,
): string | null {
  if (revealed?.has(item.key)) return null
  if (!f.categories.includes(item.category))
    return `${categoryLabel[item.category]} items are hidden by the current layers or preset.`
  if (
    item.category === 'task' &&
    item.taskState === 'personallyCompleted' &&
    !f.showCompletedTasks
  ) {
    return 'Completed tasks are hidden.'
  }
  if (f.verification !== 'all' && item.verification !== f.verification) {
    return `Only ${f.verification} items are shown.`
  }
  if (f.origin !== 'all' && originOf(item) !== f.origin)
    return 'This record origin is filtered out.'
  if (f.courseIds.length) {
    const keep = item.courseId ? f.courseIds.includes(item.courseId) : item.layer !== 'academic'
    if (!keep) return 'Its course is filtered out.'
  }
  const q = f.search.trim().toLowerCase()
  if (q) {
    const hay = [
      item.title,
      item.location,
      item.instructor,
      item.description,
      categoryLabel[item.category],
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return 'It does not match the search.'
  }
  return null
}

export const passesFilters = (item: CalendarItem, f: ItemFilters, revealed?: ReadonlySet<string>) =>
  hiddenReason(item, f, revealed) === null

export const applyFilters = (
  items: readonly CalendarItem[],
  f: ItemFilters,
  revealed?: ReadonlySet<string>,
) => items.filter((i) => passesFilters(i, f, revealed))
