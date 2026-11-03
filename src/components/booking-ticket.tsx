import { ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import type { EventCategory } from '@/domain/records'
import { cn } from '@/lib/utils'

/**
 * A reservation as a ticket (design spec §9): a notched shape, time and place first, status and source as text.
 * No barcode or QR code: nothing here is scanned. The "Open details" link is always visible, not hover-only.
 */
export function BookingTicket({
  title,
  day,
  time,
  place,
  status,
  source,
  category = 'booking',
  to,
  tone = 'neutral',
  children,
}: {
  title: string
  day: string
  time: string
  place?: string
  /** Text status such as "Confirmed (local)". Colour is never the only signal. */
  status: string
  source: string
  category?: EventCategory
  to: string
  tone?: 'neutral' | 'good' | 'warn' | 'muted'
  children?: ReactNode
}) {
  return (
    <div className="ticket-wrap">
      <article className="ticket flex overflow-hidden rounded-[var(--radius-lg)] bg-surface text-ink [--notch-y:62%]">
        <div className="flex w-24 shrink-0 flex-col items-center justify-center gap-1 border-r border-dashed border-border-strong bg-teal-tint px-2 py-3 text-center">
          <CategoryIcon category={category} />
          <p className="font-display text-lg leading-tight font-semibold">
            {time.split('–')[0]?.trim()}
          </p>
          <p className="text-[11px] text-ink-muted">{day}</p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 p-3">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          <p className="text-xs text-ink-muted">
            {time}
            {place ? ` · ${place}` : ''}
          </p>
          <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-xs">
            <span
              className={cn(
                'rounded-full px-2 py-0.5 font-medium',
                tone === 'good' && 'bg-teal-tint text-teal-strong',
                tone === 'warn' && 'bg-terracotta-tint text-terracotta-text',
                (tone === 'neutral' || tone === 'muted') && 'bg-mist text-ink',
              )}
            >
              {status}
            </span>
            <span className="text-ink-muted">{source}</span>
          </p>
          {children}
        </div>
        <Link
          to={to}
          aria-label={`Open details: ${title}`}
          className="flex w-11 shrink-0 items-center justify-center border-l border-border text-ink-muted hover:bg-mist hover:text-ink"
        >
          <ArrowUpRight className="size-5" aria-hidden="true" />
        </Link>
      </article>
    </div>
  )
}
