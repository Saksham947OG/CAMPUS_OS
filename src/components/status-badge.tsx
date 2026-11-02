import { CircleCheck, Clock, Hammer, type LucideIcon } from 'lucide-react'
import { statusLabel, type RouteStatus } from '@/app/routes'
import { cn } from '@/lib/utils'

const styles: Record<RouteStatus, { icon: LucideIcon; className: string }> = {
  live: { icon: CircleCheck, className: 'bg-teal-tint' },
  devStub: { icon: Hammer, className: 'bg-terracotta-tint' },
  comingLater: { icon: Clock, className: 'bg-mist' },
}

/** Route availability chip. Icon + text label — never colour alone. */
export function RouteStatusBadge({
  status,
  className,
}: {
  status: RouteStatus
  className?: string
}) {
  const { icon: Icon, className: tone } = styles[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink',
        tone,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {statusLabel[status]}
    </span>
  )
}
