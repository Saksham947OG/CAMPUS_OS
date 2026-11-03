import { routeById, routes, sidebarRoutes, type RouteDef } from '../routes'

/** The sidebar's groups (design spec §6.1). Every sidebar route appears exactly once; a new one lands in "More". */
const GROUPS: { label: string; ids: string[] }[] = [
  { label: 'Your day', ids: ['home', 'calendar', 'bookings'] },
  { label: 'Study & collaborate', ids: ['academics', 'workspace'] },
  { label: 'Campus life', ids: ['services', 'community', 'administration'] },
]
/** Lives in the sidebar footer, not in a group. */
export const FOOTER_IDS = ['time-tax']

export function navGroups(): { label: string; routes: RouteDef[] }[] {
  const placed = new Set([...GROUPS.flatMap((g) => g.ids), ...FOOTER_IDS])
  const out = GROUPS.map((g) => ({
    label: g.label,
    routes: g.ids
      .map((id) => routeById(id))
      .filter((r): r is RouteDef => !!r && r.slot === 'sidebar'),
  }))
  const rest = sidebarRoutes.filter((r) => !placed.has(r.id))
  return rest.length ? [...out, { label: 'More', routes: rest }] : out
}

/** Live, parameter-free destinations a person can pin. Ones already in the sidebar are left out. */
export const pinCandidates = (): RouteDef[] =>
  routes.filter(
    (r) =>
      r.status === 'live' &&
      r.slot === 'hidden' &&
      !r.path.includes(':') &&
      (r.quickAction || r.hub),
  )
