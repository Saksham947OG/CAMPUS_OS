import { Coffee } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { RouteStatusBadge } from '@/components/status-badge'
import { routeById, routes } from '@/app/routes'

/**
 * Minimal Services hub (DEC-050): lists what exists and what does not, honestly. Only services that
 * have an approved specification and are built are marked live.
 */
export function ServicesHubPage() {
  const hub = routeById('services')!
  const services = routes.filter((r) => r.hub)
  return (
    <article>
      <PageHeader title="Campus Services" description={hub.summary} />
      <ul className="grid max-w-3xl gap-3 sm:grid-cols-2">
        {services.map((r) => {
          const Icon = r.icon ?? Coffee
          return (
            <li key={r.id}>
              <Link
                to={r.path}
                className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
              >
                <span className="flex items-center gap-2 text-base font-semibold text-ink">
                  <Icon className="size-5 text-coffee" aria-hidden="true" /> {r.label}
                </span>
                <span className="text-sm text-ink-muted">{r.summary}</span>
                <span className="mt-1">
                  <RouteStatusBadge status={r.status} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 max-w-3xl text-sm text-ink-muted">
        Every service above is a demonstration with sample data. Other campus services (bookings,
        academics, administration and the rest) are not part of this prototype yet.
      </p>
    </article>
  )
}
