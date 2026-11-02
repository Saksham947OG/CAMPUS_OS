import type { ReactNode } from 'react'

/** Page-level heading. Exactly one per route: it is the single <h1>. */
export function PageHeader({
  title,
  description,
  badge,
}: {
  title: string
  description?: string
  badge?: ReactNode
}) {
  return (
    <div className="mb-6 md:mb-8">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1
          id="page-title"
          className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
        >
          {title}
        </h1>
        {badge}
      </div>
      {description ? (
        <p className="mt-2 max-w-2xl text-base text-ink-muted">{description}</p>
      ) : null}
    </div>
  )
}
