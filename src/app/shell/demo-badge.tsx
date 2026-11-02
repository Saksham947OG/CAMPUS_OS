import { FlaskConical } from 'lucide-react'
import { Link } from 'react-router'

/**
 * Always-visible demo marker. It is a real link to the page that explains what every data label
 * means, so it is never decorative.
 */
export function DemoBadge() {
  return (
    <Link
      to="/settings#data-labels"
      aria-label="Demo prototype. All data is sample or created on this device. Open data labels."
      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong bg-terracotta-tint px-3 text-xs font-semibold text-ink"
    >
      <FlaskConical className="size-4" aria-hidden="true" />
      <span>
        Demo<span className="hidden sm:inline"> prototype</span>
      </span>
    </Link>
  )
}
