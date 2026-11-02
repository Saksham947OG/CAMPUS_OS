import { orderPath } from './paths'
import { CheckCircle2, Circle, Receipt, XCircle } from 'lucide-react'
import { Link } from 'react-router'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Button } from '@/components/ui/button'
import {
  handlingLabel,
  statusChip,
  statusLabel,
  type ChillOrder,
  type OrderStatus,
} from '@/domain/chill'
import { pickupCodeFor } from '@/domain/chill-logic'
import { formatPaise } from '@/lib/money'
import { formatInstant } from '@/lib/time'
import { cn } from '@/lib/utils'
import {
  TRACKER_STEPS,
  itemSummary,
  lastChangeAt,
  recordedAhead,
  stepIndex,
} from '@/selectors/chill'

const tone: Record<OrderStatus, string> = {
  pending: 'bg-mist',
  queued: 'bg-coffee-tint',
  preparing: 'bg-coffee-tint',
  ready: 'bg-teal-tint',
  collected: 'bg-surface',
  rejected: 'bg-terracotta-tint',
  cancelled: 'bg-surface',
}

/** Status chip: icon-free text label, so it never relies on colour alone. */
export function StatusChip({ status, className }: { status: OrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-ink',
        tone[status],
        className,
      )}
    >
      {statusChip[status]}
    </span>
  )
}

/** Origin of the latest status: the student's own action, or a simulated café step. Always labelled. */
export function OriginBadges({ order }: { order: ChillOrder }) {
  const last = order.history[order.history.length - 1]!
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <DataModeBadge
        mode={order.provenance.dataMode === 'connected' ? 'provided' : order.provenance.dataMode}
      />
      {last.dataMode === 'simulated' && order.provenance.dataMode !== 'simulated' ? (
        <DataModeBadge mode="simulated" />
      ) : null}
    </span>
  )
}

export function OrderCard({
  order,
  onReorder,
}: {
  order: ChillOrder
  onReorder?: (o: ChillOrder) => void
}) {
  return (
    <li
      className="rounded-lg border border-border bg-surface p-3 shadow-card"
      data-order={order.id}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-ink">{order.displayNumber}</p>
          <p className="text-sm text-ink-muted">
            {itemSummary(order)} · Listed item subtotal {formatPaise(order.listedSubtotalMinor)}
          </p>
        </div>
        <StatusChip status={order.status} />
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        Last change {formatInstant(lastChangeAt(order))}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <OriginBadges order={order} />
        <Button asChild size="sm" variant="outline" className="min-h-11 ml-auto">
          <Link to={orderPath(order.id)}>
            Track order<span className="sr-only"> {order.displayNumber}</span>
          </Link>
        </Button>
        {onReorder ? (
          <Button size="sm" variant="outline" className="min-h-11" onClick={() => onReorder(order)}>
            Reorder<span className="sr-only"> {order.displayNumber}</span>
          </Button>
        ) : null}
      </div>
    </li>
  )
}

const stepLabel: Partial<Record<OrderStatus, string>> = {
  pending: 'Request submitted',
  queued: 'Accepted by the demo café',
  preparing: 'Preparation started',
  ready: 'Ready for pickup',
  collected: 'Collection recorded',
  rejected: 'Not accepted',
  cancelled: 'Cancelled by you',
}

/** Transition history: only real recorded events, each labelled with who did it (never invented progress). */
export function Timeline({ order }: { order: ChillOrder }) {
  return (
    <ol className="flex flex-col gap-2" aria-label="Order history">
      {order.history.map((h) => (
        <li key={h.transitionId} className="flex items-start gap-2 text-sm">
          {h.to === 'rejected' || h.to === 'cancelled' ? (
            <XCircle className="mt-0.5 size-4 shrink-0 text-ink" aria-hidden="true" />
          ) : h.to === 'collected' ? (
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            <span className="font-medium text-ink">{stepLabel[h.to] ?? h.to}</span>
            <span className="block text-xs text-ink-muted">
              <time dateTime={h.occurredAt}>{formatInstant(h.occurredAt)}</time> ·{' '}
              {h.actor === 'student' ? 'You' : 'Demo café (simulated)'}
              {h.reason ? ` · ${h.reason}` : ''}
            </span>
            {h.handlingNote ? (
              <span className="block text-xs text-ink-muted">
                Started ahead of an older accepted order: {handlingLabel[h.handlingNote.kind]}
                {h.handlingNote.text ? ` · ${h.handlingNote.text}` : ''}. This explains the
                simulated log only.
              </span>
            ) : null}
          </span>
        </li>
      ))}
    </ol>
  )
}

/** Ticket rules (§8): a code only when Ready; nothing implies payment was made or verified. */
export function PickupTicket({ order }: { order: ChillOrder }) {
  if (order.status === 'ready') {
    return (
      <section
        aria-label="Pickup ticket"
        className="rounded-lg border-2 border-coffee bg-coffee-tint p-4 text-center"
      >
        <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-ink">
          <Receipt className="size-4" aria-hidden="true" /> Ready for pickup · Pay at café counter
        </p>
        <p className="mt-1 text-xs text-ink-muted">Pickup code</p>
        <p
          className="text-3xl font-bold tracking-widest text-ink"
          aria-label={`Pickup code ${pickupCodeFor(order).split('').join(' ')}`}
        >
          {pickupCodeFor(order)}
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Order {order.displayNumber}. This code does not verify payment. Payment is handled outside
          CampusOS.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          {order.readyAt ? (
            <>
              Ready at <time dateTime={order.readyAt}>{formatInstant(order.readyAt)}</time>{' '}
              (local).{' '}
            </>
          ) : null}
          Collection point not provided. Opening this ticket does not mark the order collected.
        </p>
      </section>
    )
  }
  if (order.status === 'collected') {
    return (
      <p className="rounded-md border border-border bg-canvas p-3 text-sm text-ink">
        Collection recorded; payment not verified in CampusOS.
      </p>
    )
  }
  if (order.status === 'pending' || order.status === 'queued' || order.status === 'preparing') {
    return (
      <p className="rounded-md border border-border bg-canvas p-3 text-sm text-ink">
        Order reference <strong>{order.displayNumber}</strong> · {statusLabel[order.status]}. A
        pickup ticket appears only when the order is ready.
      </p>
    )
  }
  return null
}

/** Qualified queue context for an order, or null when no honest figure exists. */
export function QueueContext({
  order,
  orders,
}: {
  order: ChillOrder
  orders: readonly ChillOrder[]
}) {
  if (order.status === 'pending')
    return (
      <p className="text-sm text-ink-muted">
        Awaiting café acceptance. This request is not in the preparation queue yet, so no queue
        position exists.
      </p>
    )
  if (order.status === 'preparing')
    return <p className="text-sm font-medium text-ink">Being prepared</p>
  const ahead = recordedAhead(orders, order)
  if (ahead === undefined) return null
  return (
    <div className="text-sm text-ink">
      <p className="font-medium">
        {ahead} recorded unfinished {ahead === 1 ? 'order' : 'orders'} ahead
      </p>
      <p className="text-xs text-ink-muted">
        Counts earlier orders the café has recorded. Walk-in work that was not recorded may be
        missing, so this is not your place in the whole physical queue and not a time estimate.
      </p>
    </div>
  )
}

/** Step markers for an accepted order. They show how far it got, not how much cooking time is left. */
export function StepBar({ status }: { status: OrderStatus }) {
  const at = stepIndex(status)
  if (at === null) return null
  return (
    <ol
      aria-label="Order steps"
      className="grid grid-cols-5 gap-1 text-center text-xs"
      data-testid="step-bar"
    >
      {TRACKER_STEPS.map((label, i) => (
        <li
          key={label}
          aria-current={i === at ? 'step' : undefined}
          className={cn(
            'rounded-md border px-1 py-1.5',
            i < at && 'border-border bg-mist text-ink',
            i === at && 'border-coffee bg-coffee-tint font-semibold text-ink',
            i > at && 'border-border bg-surface text-ink-muted',
          )}
        >
          <span className="sr-only">{i < at ? 'Done: ' : i === at ? 'Current: ' : 'Later: '}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

/** A flag is a note on the order. The order keeps its state and stays in the backlog. */
export function ExceptionNote({ order }: { order: ChillOrder }) {
  if (!order.exceptionFlag) return null
  return (
    <p
      role="note"
      className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm text-ink"
    >
      <strong>Needs attention (simulated note):</strong> {order.exceptionFlag.note}. The order is
      still {statusLabel[order.status].toLowerCase()}; nothing has been cancelled or moved.
    </p>
  )
}
