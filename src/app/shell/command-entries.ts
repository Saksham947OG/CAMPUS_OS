import { searchWorkspace } from '@/selectors/workspace'
import type { WorkspaceStore } from '@/domain/workspace'
import { routes } from '../routes'

export interface Entry {
  key: string
  label: string
  detail: string
  to: string
  group: 'Actions' | 'Go to' | 'Workspace'
}

const ACTIONS: Entry[] = [
  {
    key: 'a-capture',
    label: 'Capture a quick note',
    detail: 'Open the capture inbox',
    to: '/workspace/capture',
    group: 'Actions',
  },
  {
    key: 'a-time',
    label: 'Find a time for a group',
    detail: 'Compare schedules and book a meeting',
    to: '/calendar/find-a-time',
    group: 'Actions',
  },
  {
    key: 'a-bookings',
    label: 'Find my next booking',
    detail: 'Your reservations as tickets',
    to: '/bookings/my',
    group: 'Actions',
  },
  {
    key: 'a-project',
    label: 'Open a shared project',
    detail: 'Tasks, notes and meetings with your group',
    to: '/workspace',
    group: 'Actions',
  },
]

/** Results for one query: actions, then Workspace records the person can open, then destinations. A name match outranks a description. */
export function commandEntries(q: string, ws: WorkspaceStore, actor: string): Entry[] {
  const term = q.trim().toLowerCase()
  const destinations: Entry[] = routes
    .filter(
      (r) =>
        r.status === 'live' &&
        !r.path.includes(':') &&
        (r.slot !== 'hidden' || r.quickAction || r.hub),
    )
    .map((r) => ({
      key: `r-${r.id}`,
      label: r.label,
      detail: r.summary,
      to: r.path,
      group: 'Go to' as const,
    }))
  const match = (e: Entry) => !term || `${e.label} ${e.detail}`.toLowerCase().includes(term)
  const records: Entry[] =
    term.length >= 2
      ? searchWorkspace(ws, actor, term, 6).map((h) => ({
          key: `w-${h.kind}-${h.id}`,
          label: h.title,
          detail: h.detail,
          to: h.href,
          group: 'Workspace' as const,
        }))
      : []
  const rank = (e: Entry) =>
    !term
      ? 0
      : e.label.toLowerCase().startsWith(term)
        ? 0
        : e.label.toLowerCase().includes(term)
          ? 1
          : 2
  const byRank = (a: Entry, b: Entry) => rank(a) - rank(b)
  return [
    ...ACTIONS.filter(match).sort(byRank),
    ...records,
    ...destinations.filter(match).sort(byRank).slice(0, 10),
  ]
}
