import type { ReactNode } from 'react'
import { HoverCard } from 'radix-ui'
import { Link } from 'react-router'

/**
 * A preview that belongs to its trigger (design spec §5.3). It opens after a short intent delay on hover or
 * immediately on keyboard focus, stays open while the pointer is over it, closes with Escape and keeps inside the
 * viewport. It never holds essential information: the same facts and an "Open" link are reachable without it, and
 * touch devices use that link, because a preview cannot open from a tap.
 */
export function ContextPreview({
  trigger,
  title,
  lines,
  source,
  to,
  openLabel = 'Open',
}: {
  trigger: ReactNode
  title: string
  lines: string[]
  source?: string
  to?: string
  openLabel?: string
}) {
  return (
    <HoverCard.Root openDelay={380} closeDelay={160}>
      <HoverCard.Trigger asChild>{trigger}</HoverCard.Trigger>
      <HoverCard.Portal>
        <HoverCard.Content
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-[var(--z-popover)] w-72 rounded-2xl border border-border bg-surface p-3 text-sm text-ink shadow-[var(--shadow-overlay)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1"
        >
          <p className="font-semibold">{title}</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-ink-muted">
            {lines.filter(Boolean).map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {source ? <p className="mt-2 text-xs text-ink-muted">Source: {source}</p> : null}
          {to ? (
            <Link
              to={to}
              className="mt-2 inline-block min-h-9 py-1.5 text-sm font-medium text-coffee underline"
            >
              {openLabel}
            </Link>
          ) : null}
        </HoverCard.Content>
      </HoverCard.Portal>
    </HoverCard.Root>
  )
}
