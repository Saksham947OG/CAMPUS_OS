import type { HomePrefs } from '@/data/prefs/home-prefs'
import type { WriteResult } from '@/data/storage/storage-adapter'
import type { EditorRequest } from '../calendar/editors/editor-types'
import type { ProfileData } from '@/domain/records'
import type { PlanningPrefs } from '@/selectors/free-pockets'
import type { Now } from '@/selectors/now'
import { applyFilters, type ItemFilters } from '@/selectors/filters'
import type { CalendarItem } from '@/selectors/items'

/** Everything a Home widget needs. Widgets derive their view from `data`; none owns records. */
export interface HomeCtx {
  data: ProfileData
  now: Now
  prefs: HomePrefs
  planning: PlanningPrefs
  profileName: string
  updatePrefs: (fn: (p: HomePrefs) => HomePrefs) => Promise<WriteResult>
  updatePlanning: (fn: (p: PlanningPrefs) => PlanningPrefs) => Promise<WriteResult>
  /** Open the shared editor sheet (same one the Calendar uses). */
  openEditor: (request: EditorRequest) => void
}

/** Home schedule filters (apply to the schedule card only; other widgets are purpose-specific). */
export const homeFilters = (prefs: HomePrefs): ItemFilters => ({
  categories: prefs.filters.categories,
  courseIds: prefs.filters.courseIds,
  verification: prefs.filters.verification,
  origin: prefs.filters.origin,
  showCompletedTasks: prefs.filters.showCompleted,
  search: '',
})

export const filterHomeItems = (items: readonly CalendarItem[], prefs: HomePrefs) =>
  applyFilters(items, homeFilters(prefs))
