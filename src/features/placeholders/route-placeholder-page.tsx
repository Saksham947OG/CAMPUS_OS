import { ArrowRight, Info } from 'lucide-react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { RouteStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { RouteDef } from '@/app/routes'

const specFiles: Record<string, string> = {
  'COS-HOME-001': 'docs/features/CampusOS_Home_Dashboard_Spec_v1.0.md',
  'COS-CAL-001': 'docs/features/CampusOS_Unified_Calendar_Spec_v1.0.md',
}

/**
 * Honest stand-in for a destination that is not operational. It never shows sample content that
 * could be mistaken for a working feature, and it says exactly why the page is empty.
 */
export function RoutePlaceholderPage({ route }: { route: RouteDef }) {
  const specs = route.registryRefs.filter((ref) => ref in specFiles)
  const isDevStub = route.status === 'devStub'
  const cta =
    route.id === 'home'
      ? { to: '/calendar', label: 'Open Calendar' }
      : { to: '/', label: 'Back to Home' }

  return (
    <article aria-labelledby="page-title">
      <PageHeader
        title={route.label}
        description={route.summary}
        badge={<RouteStatusBadge status={route.status} />}
      />

      <section
        aria-labelledby="status-heading"
        className="max-w-2xl rounded-lg border border-border bg-surface p-5 shadow-card md:p-6"
      >
        <h2
          id="status-heading"
          className="flex items-center gap-2 text-base font-semibold text-ink"
        >
          <Info className="size-4 text-teal-strong" aria-hidden="true" />
          {isDevStub ? 'This page is not built yet' : 'Not part of the current build'}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {isDevStub
            ? 'This is an approved feature that is still being built. Nothing on this page is live: no schedule, deadline, task or campus information is shown yet, and no controls are missing for lack of data.'
            : 'This module is only a brainstormed idea in the feature registry. It has no approved specification yet, so there are no working controls or sample data here.'}
        </p>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[auto_1fr] sm:gap-x-6">
          {route.plannedPhase ? (
            <>
              <dt className="font-medium text-ink">Planned</dt>
              <dd className="text-ink-muted">{route.plannedPhase}</dd>
            </>
          ) : null}
          <dt className="font-medium text-ink">Registry</dt>
          <dd className="text-ink-muted">{route.registryRefs.join(' · ')}</dd>
          {specs.map((ref) => (
            <div key={ref} className="contents">
              <dt className="font-medium text-ink">Specification</dt>
              <dd className="min-w-0 text-ink-muted">
                <code className="break-all rounded bg-mist px-1.5 py-0.5 text-xs text-ink">
                  {specFiles[ref]}
                </code>
              </dd>
            </div>
          ))}
        </dl>

        <Button asChild className="mt-6 min-h-11">
          <Link to={cta.to}>
            {cta.label}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      </section>
    </article>
  )
}
