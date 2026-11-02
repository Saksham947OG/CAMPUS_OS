import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function Wordmark({
  compact = false,
  responsive = false,
  className,
}: {
  compact?: boolean
  /** Icon only on narrow screens; full wordmark from the `sm` breakpoint up. */
  responsive?: boolean
  className?: string
}) {
  return (
    <Link
      to="/"
      aria-label="CampusOS home"
      className={cn('flex items-center gap-2.5 rounded-md', className)}
    >
      <span
        aria-hidden="true"
        className="grid size-9 place-items-center rounded-md bg-teal font-display text-lg font-semibold text-surface"
      >
        C
      </span>
      {compact ? null : (
        <span
          className={cn(
            'font-display text-xl font-semibold tracking-tight text-ink',
            responsive && 'hidden sm:inline',
          )}
        >
          CampusOS
        </span>
      )}
    </Link>
  )
}
