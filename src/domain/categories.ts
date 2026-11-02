import type { EventCategory } from './records'

/**
 * Layer ↔ category mapping (DEC-017, COS-CAL-001 §5.1). Layers only group categories for
 * visibility; presets and filters change visibility, never records.
 */
export type Layer = 'academic' | 'personal' | 'campusLife' | 'campusServices' | 'administration'

export const LAYERS: readonly Layer[] = [
  'academic',
  'personal',
  'campusLife',
  'campusServices',
  'administration',
]

export const layerLabel: Record<Layer, string> = {
  academic: 'Academic',
  personal: 'Personal',
  campusLife: 'Campus Life',
  campusServices: 'Campus Services',
  administration: 'Administration',
}

export const categoryLayer: Record<EventCategory, Layer> = {
  class: 'academic',
  exam: 'academic',
  assignment: 'academic',
  project: 'academic',
  meeting: 'academic',
  personal: 'personal',
  task: 'personal',
  focus: 'personal',
  birthday: 'campusLife',
  club: 'campusLife',
  campusEvent: 'campusLife',
  sports: 'campusLife',
  booking: 'campusServices',
  administration: 'administration',
  holiday: 'administration',
}

export const categoryLabel: Record<EventCategory, string> = {
  class: 'Class',
  exam: 'Exam',
  assignment: 'Assignment',
  project: 'Project',
  meeting: 'Meeting',
  personal: 'Personal event',
  task: 'Task',
  focus: 'Focus block',
  booking: 'Booking',
  administration: 'Administration',
  holiday: 'Holiday',
  birthday: 'Birthday',
  club: 'Club',
  campusEvent: 'Campus event',
  sports: 'Sports',
}

/** CSS variable carrying the category's mark colour (always shown with an icon + label). */
export const categoryColorVar: Record<EventCategory, string> = {
  class: '--cat-class',
  exam: '--cat-exam',
  assignment: '--cat-assignment',
  project: '--cat-project',
  meeting: '--cat-class',
  personal: '--cat-personal',
  task: '--cat-personal',
  focus: '--cat-project',
  booking: '--cat-booking',
  administration: '--cat-admin',
  holiday: '--cat-admin',
  birthday: '--cat-birthday',
  club: '--cat-campus',
  campusEvent: '--cat-campus',
  sports: '--cat-sports',
}

export const categoriesInLayer = (layer: Layer): EventCategory[] =>
  (Object.keys(categoryLayer) as EventCategory[]).filter((c) => categoryLayer[c] === layer)

/**
 * Home's schedule filter groups (COS-HOME-001 §7.1) mapped onto categories. "Mess" is not offered:
 * meals are contextual information, never schedule items (COS-CAL-001 §12; DEC-017).
 */
export const homeFilterGroups: { id: string; label: string; categories: EventCategory[] }[] = [
  { id: 'classes', label: 'Classes & meetings', categories: ['class', 'meeting'] },
  { id: 'exams', label: 'Exams', categories: ['exam'] },
  { id: 'assignments', label: 'Homework / Assignments', categories: ['assignment'] },
  { id: 'projects', label: 'Project deadlines', categories: ['project'] },
  { id: 'birthdays', label: 'Birthdays', categories: ['birthday'] },
  { id: 'events', label: 'Clubs / Events', categories: ['club', 'campusEvent'] },
  { id: 'sports', label: 'Sports', categories: ['sports'] },
  { id: 'personal', label: 'Personal', categories: ['personal', 'task', 'focus'] },
  { id: 'bookings', label: 'Bookings', categories: ['booking'] },
  { id: 'administration', label: 'Administration', categories: ['administration', 'holiday'] },
]
