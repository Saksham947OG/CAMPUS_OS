import { Hourglass } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessFlag } from '@/selectors/process-bottleneck'

/** A small queue marker on a calendar item. Icon plus words, so the level is never colour alone. */
export function FlagBadge({
  flag,
  withText = false,
  className,
}: {
  flag: ProcessFlag
  withText?: boolean
  className?: string
}) {
  const word = flag.level === 'high' ? 'Likely queue' : 'Possible wait'
  return (
    <span
      title={flag.summary}
      className={cn(
        'inline-flex shrink-0 items-center gap-1 text-xs font-semibold',
        flag.level === 'high' ? 'text-danger' : 'text-warning',
        className,
      )}
    >
      <Hourglass className="size-3.5" aria-hidden="true" />
      {withText ? (
        <span>
          {word}
          {flag.waitText ? ` · ${flag.waitText}` : ''}
        </span>
      ) : (
        <span className="sr-only">{word}</span>
      )}
    </span>
  )
}
