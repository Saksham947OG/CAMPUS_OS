import { CircleCheck, CircleHelp, CircleSlash } from 'lucide-react'
import type { Verification } from '@/domain/provenance'
import { cn } from '@/lib/utils'

/**
 * Confirmation of a record's content (not its origin and not institutional authority).
 * `notApplicable` renders nothing. Icon + text, never colour alone.
 */
export function ConfirmationBadge({
  verification,
  className,
}: {
  verification: Verification
  className?: string
}) {
  if (verification === 'notApplicable') return null
  const map = {
    confirmed: { Icon: CircleCheck, label: 'Confirmed', tone: 'bg-teal-tint' },
    tentative: { Icon: CircleHelp, label: 'Tentative', tone: 'bg-terracotta-tint' },
    unknown: { Icon: CircleSlash, label: 'Confirmation unknown', tone: 'bg-mist' },
  } as const
  const { Icon, label, tone } = map[verification]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  )
}
