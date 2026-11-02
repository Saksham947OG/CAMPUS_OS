import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Shared widget frame: labelled region, consistent title row, density-aware padding. */
export function HomeCard({
  id,
  title,
  icon,
  action,
  children,
  className,
}: {
  id: string
  title: string
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-labelledby={`${id}-h`}
      data-widget={id}
      className={cn(
        'flex h-full min-w-0 flex-col rounded-lg border border-border bg-surface p-5 shadow-card',
        'group-data-[density=compact]/home:p-3',
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id={`${id}-h`} className="flex items-center gap-2 text-base font-semibold text-ink">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      <div className="min-h-0 flex-1 text-sm">{children}</div>
    </section>
  )
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border-strong bg-canvas p-3 text-ink-muted">
      {children}
    </p>
  )
}
