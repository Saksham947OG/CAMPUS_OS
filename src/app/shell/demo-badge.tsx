import { Database } from 'lucide-react'
import { Link } from 'react-router'

/**
 * Always-visible demo marker. It is a real link to the page that explains what every data label
 * means, so it is never decorative.
 */
export function DemoBadge() {
  return (
    <Link
      to="/sources"
      aria-label="Campus data. Supplied sources, planning assumptions and missing data."
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-terracotta-tint px-3 text-xs font-semibold text-ink"
    >
      <Database className="size-4" aria-hidden="true" />
      <span>
        Campus<span className="hidden sm:inline"> data</span>
      </span>
    </Link>
  )
}
