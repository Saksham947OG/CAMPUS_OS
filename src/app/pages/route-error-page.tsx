import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'

function describe(error: unknown): string {
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`.trim()
  if (error instanceof Error) return error.message
  return 'An unexpected error occurred.'
}

/** Shown inside the app shell when a page throws, so navigation stays available. */
export function RouteErrorPage() {
  const error = useRouteError()
  return (
    <article role="alert">
      <PageHeader
        title="Something went wrong on this page"
        description="The rest of CampusOS is unaffected and nothing you saved was changed."
      />
      <p className="mb-6 max-w-2xl rounded-md border border-border bg-mist p-3 font-mono text-sm text-ink">
        {describe(error)}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11" onClick={() => window.location.reload()}>
          Reload page
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    </article>
  )
}

/** Last-resort boundary for failures outside the shell itself. */
export function RootErrorPage() {
  const error = useRouteError()
  return (
    <main className="mx-auto max-w-xl p-6" role="alert">
      <h1 className="font-display text-3xl font-semibold text-ink">CampusOS hit a problem</h1>
      <p className="mt-2 text-ink-muted">
        Reload the page to try again. Saved data on this device was not changed.
      </p>
      <p className="mt-4 rounded-md border border-border bg-mist p-3 font-mono text-sm text-ink">
        {describe(error)}
      </p>
    </main>
  )
}
