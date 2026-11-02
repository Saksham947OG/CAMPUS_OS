import { cn } from '@/lib/utils'
import { dataModeInfo, type ShownMode } from './data-mode-info'

/**
 * Provenance chip. `connected` is intentionally not renderable: no authorized integration
 * exists, so showing it would be a misleading "live" signal.
 */
export function DataModeBadge({ mode, className }: { mode: ShownMode; className?: string }) {
  const { label, icon: Icon, tone } = dataModeInfo[mode]
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
