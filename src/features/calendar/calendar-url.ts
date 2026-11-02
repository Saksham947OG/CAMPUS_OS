import { CALENDAR_VIEWS, type CalendarView } from '@/data/prefs/prefs'
import { isDateOnly, type DateOnly } from '@/lib/time'

export type InspectorPanel = 'details' | 'tasks' | 'context'
export const PANELS: readonly InspectorPanel[] = ['details', 'tasks', 'context']

/**
 * Calendar location state lives in the URL so Back/Forward, reload and deep links all work
 * (DEC-021): `/calendar?view=week&date=2026-11-09&event=<key>&panel=details`.
 */
export interface CalendarUrlState {
  view?: CalendarView
  date?: DateOnly
  event?: string
  panel?: InspectorPanel
}

export function readUrlState(params: URLSearchParams): CalendarUrlState {
  const view = params.get('view')
  const date = params.get('date')
  const event = params.get('event')
  const panel = params.get('panel')
  return {
    view: (CALENDAR_VIEWS as readonly string[]).includes(view ?? '')
      ? (view as CalendarView)
      : undefined,
    date: date && isDateOnly(date) ? date : undefined,
    event: event && event.length < 200 ? event : undefined,
    panel: (PANELS as readonly string[]).includes(panel ?? '')
      ? (panel as InspectorPanel)
      : undefined,
  }
}

export function writeUrlState(state: CalendarUrlState): URLSearchParams {
  const p = new URLSearchParams()
  if (state.view) p.set('view', state.view)
  if (state.date) p.set('date', state.date)
  if (state.event) p.set('event', state.event)
  if (state.panel) p.set('panel', state.panel)
  return p
}

/** Deep link into the Calendar, e.g. from Home. */
export function calendarLink(state: CalendarUrlState): string {
  const search = writeUrlState(state).toString()
  return search ? `/calendar?${search}` : '/calendar'
}
