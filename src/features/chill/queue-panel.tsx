import { Clock3, PauseCircle, ShoppingBag, UsersRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { Freshness, QueueSnapshot } from '@/selectors/chill'

function FreshnessChip({ f }: { f: Freshness }) {
  if (f.state === 'none') return null
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-ink',
        f.state === 'stale' ? 'bg-terracotta-tint' : 'bg-mist',
      )}
    >
      <Clock3 className="size-3" aria-hidden="true" />
      {f.state === 'stale'
        ? `Stale · last reported ${f.ageMinutes} min ago`
        : `Reported ${f.asOfLabel}`}
    </span>
  )
}

function Tile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-coffee">
        {icon}
        {title}
      </p>
      <div className="mt-1 flex flex-col gap-1 text-sm text-ink">{children}</div>
    </li>
  )
}

/**
 * Reported café state (§6.3). Three different things are shown separately and never added together:
 * the physical counter line (a manual report), the recorded preparation backlog, and orders ready.
 */
export function QueuePanel({
  snapshot,
  compact = false,
}: {
  snapshot: QueueSnapshot
  compact?: boolean
}) {
  return (
    <section
      aria-labelledby="queue-h"
      className="rounded-lg border border-border bg-coffee-tint p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="queue-h" className="text-base font-semibold text-ink">
          Café status
        </h2>
        <span className="rounded-full border border-border-strong bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink">
          Local · simulated data
        </span>
      </div>

      {snapshot.paused ? (
        <output className="block mt-3 flex items-start gap-2 rounded-md border border-border-strong bg-surface p-3 text-sm text-ink">
          <PauseCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Temporarily not taking new requests.</strong> Reason (local):{' '}
            {snapshot.paused.reason}. Orders already placed continue.
          </span>
        </output>
      ) : null}

      <p className="mt-3 text-sm text-ink" data-testid="condition">
        Reported condition:{' '}
        <strong>
          {snapshot.condition === 'unknown'
            ? 'Unknown (no recent report)'
            : snapshot.condition === 'paused'
              ? 'Paused (new requests are off)'
              : snapshot.condition.charAt(0).toUpperCase() + snapshot.condition.slice(1)}
        </strong>
        . A busy report does not stop orders and is not a ready-time prediction.
      </p>
      <ul
        className={cn(
          'mt-3 grid gap-2',
          compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-4',
        )}
      >
        <Tile icon={<UsersRound className="size-3.5" aria-hidden="true" />} title="Busy indicator">
          <span className="font-medium">{snapshot.busy.text}</span>
          <FreshnessChip f={snapshot.busy.freshness} />
        </Tile>
        <Tile icon={<UsersRound className="size-3.5" aria-hidden="true" />} title="Counter line">
          <span className="font-medium">{snapshot.counter.text}</span>
          <FreshnessChip f={snapshot.counter.freshness} />
          <span className="text-xs text-ink-muted">
            A separate report. It does not change when orders move.
          </span>
        </Tile>
        <Tile icon={<ShoppingBag className="size-3.5" aria-hidden="true" />} title="Preparation">
          <span className="font-medium">{snapshot.preparation.text}</span>
          <span className="text-xs text-ink-muted">{snapshot.preparation.caveat}</span>
          <span className="text-xs text-ink-muted">
            {snapshot.backlogAsOfLabel
              ? `Last recorded order change: ${snapshot.backlogAsOfLabel}`
              : 'No order has been recorded yet.'}
          </span>
        </Tile>
        <Tile icon={<ShoppingBag className="size-3.5" aria-hidden="true" />} title="Pickup">
          <span className="font-medium">{snapshot.pickup.text}</span>
          <span className="text-xs text-ink-muted">Orders, not people waiting.</span>
          {snapshot.backlogAsOfLabel ? (
            <span className="text-xs text-ink-muted">
              Last recorded order change: {snapshot.backlogAsOfLabel}
            </span>
          ) : null}
        </Tile>
      </ul>
      <p className="mt-3 text-xs text-ink-muted">
        Sample figures from a local demonstration, not a live view of any café. Hours not provided.
        No ready-time estimate is given.
      </p>
    </section>
  )
}
