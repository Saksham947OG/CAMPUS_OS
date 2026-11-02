import { quickActionRoutes, routeById, type RouteDef } from '@/app/routes'

/**
 * Resolve saved quick-action ids to real, unique destinations (COS-HOME-001 §5.5). If a saved id no
 * longer exists (or repeats), the first unused permitted route replaces it and `replaced` is true so
 * the UI can say so, without blocking.
 */
export function resolveQuickActions(ids: readonly string[]): {
  routes: RouteDef[]
  replaced: boolean
} {
  const used = new Set<string>()
  const routes: RouteDef[] = []
  let replaced = false
  for (const id of ids) {
    const route = routeById(id)
    if (route?.quickAction && !used.has(route.id)) {
      used.add(route.id)
      routes.push(route)
      continue
    }
    replaced = true
    const fallback = quickActionRoutes.find((r) => !used.has(r.id))
    if (fallback) {
      used.add(fallback.id)
      routes.push(fallback)
    }
  }
  return { routes, replaced }
}
