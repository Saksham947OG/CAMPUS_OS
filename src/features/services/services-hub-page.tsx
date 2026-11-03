import { Coffee } from 'lucide-react'
import { Link } from 'react-router'
import { CapacityBoard } from './capacity-board'
import { PageHeader } from '@/components/page-header'
import { ServiceArt } from '@/components/service-art'
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
                className="lift flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card"
              >
                <ServiceArt id={r.id} />
                <span className="flex flex-1 flex-col gap-1 p-4">
                  <span className="flex items-center gap-2 text-base font-semibold text-ink">
                    <Icon className="size-5 text-coffee" aria-hidden="true" /> {r.label}
                  </span>
                  <span className="text-sm text-ink-muted">{r.summary}</span>
                  <span className="mt-1">
                    <RouteStatusBadge status={r.status} />
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
      <div className="mt-4">
        <CapacityBoard />
      </div>
      <p className="mt-4 max-w-3xl text-sm text-ink-muted">
        Services use supplied campus information and clearly labelled planning assumptions.
        Bookings, academics, administration and the rest are in their own sections.
      </p>
    </article>
  )
}
