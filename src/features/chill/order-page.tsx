import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { useServices } from '@/app/services'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/domain/chill'
import { formatPaise } from '@/lib/money'
import { formatInstant } from '@/lib/time'
import { NextClassNote } from './next-class'
import {
  ExceptionNote,
  OriginBadges,
  PickupTicket,
  QueueContext,
  StatusChip,
  StepBar,
  Timeline,
} from './orders'
import { useCart, useChill } from './use-chill'
import { nextStep, reorderCart } from '@/selectors/chill'
import { useNavigate } from 'react-router'

function Missing() {
  return (
    <div className="max-w-xl">
      <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
        Order not found
      </h1>
      <p className="mt-2 text-ink-muted">
        We could not find that order for this persona. It may not exist, or it may belong to another
        profile. Nothing was changed.
      </p>
      <Button asChild className="mt-4 min-h-11">
        <Link to="/services/chill-spot?tab=orders">Back to your orders</Link>
      </Button>
    </div>
  )
}

/** One order's tracker. Only the owner can see it; anyone else gets the same "not found" as a missing id. */
export function ChillOrderPage() {
  const { orderId } = useParams()
  const { chill } = useServices()
  const toast = useToast()
  const confirm = useConfirm()
  const { café, status, profileId, myOrders } = useChill()
  const navigate = useNavigate()
  const { cart, update, newId } = useCart()
  if (status === 'loading' || !café)
    return <output className="block text-ink-muted">Loading order…</output>
  const order = myOrders.find((o) => o.id === orderId)
  if (!order) return <Missing />

  const cancel = async () => {
    const c = await confirm({
      title: 'Cancel this order request?',
      description: 'It has not been accepted yet, so you can cancel it. This cannot be undone.',
      confirmLabel: 'Cancel request',
      cancelLabel: 'Keep request',
      danger: true,
    })
    if (c !== 'confirm') return
    const r = await chill.cancelPending(profileId, order.id)
    if (r.ok) toast.notify('success', 'Local order request cancelled.')
    else toast.notify('error', r.error.message)
  }

  const reorder = async () => {
    if (cart.lines.length > 0) {
      const c = await confirm({
        title: 'Replace your current cart?',
        description:
          'Reordering starts a new cart from this earlier order using the current menu. Nothing is ordered until you check out.',
        confirmLabel: 'Replace cart',
      })
      if (c !== 'confirm') return
    }
    const r = reorderCart(chill.getMenu(), order, newId)
    await update(() => r.cart)
    navigate('/services/chill-spot')
  }

  const markArrival = async () => {
    const r = await chill.recordArrival(profileId, order.id)
    if (r.ok)
      toast.notify(
        'info',
        'Your arrival was noted. It is a self-report: it does not change the order or move you up.',
      )
    else toast.notify('error', r.error.message)
  }

  const timestamps: [string, string | undefined][] = [
    ['Submitted', order.submittedAt],
    ['Accepted', order.acceptedAt],
    ['Preparation started', order.startedPreparingAt],
    ['Ready', order.readyAt],
    ['Collected', order.collectedAt],
  ]

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/services/chill-spot?tab=orders"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Chill Spot orders
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            Order {order.displayNumber}
          </h1>
          <StatusChip status={order.status} />
        </div>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          {statusLabel[order.status]}
        </p>
        <div className="mt-2">
          <OriginBadges order={order} />
        </div>
      </div>

      <StepBar status={order.status} />
      <p className="text-sm text-ink" data-testid="next-step">
        <strong>What happens next:</strong> {nextStep(order)}
      </p>
      <ExceptionNote order={order} />

      <PickupTicket order={order} />

      <section aria-labelledby="ctx-h" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="ctx-h" className="text-base font-semibold text-ink">
          Queue context
        </h2>
        <div className="mt-1">
          <QueueContext order={order} orders={café.orders} />
        </div>
        {order.status === 'pending' || order.status === 'queued' || order.status === 'preparing' ? (
          <p className="mt-2 text-xs text-ink-muted">
            No ready time is estimated. Status changes only when the café records them.
          </p>
        ) : null}
      </section>

      <section aria-labelledby="items-h" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="items-h" className="text-base font-semibold text-ink">
          Items as you ordered them
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-sm">
          {order.items.map((l, i) => (
            <li
              key={`${l.menuItemId}-${i}`}
              className="flex justify-between gap-2 border-b border-border pb-1.5"
            >
              <span>
                {l.quantity} × {l.nameAtOrder}
                {l.optionLabelsAtOrder.length ? ` (${l.optionLabelsAtOrder.join(', ')})` : ''}{' '}
                <span className="text-ink-muted">at {formatPaise(l.unitPriceMinorAtOrder)}</span>
              </span>
              <span className="font-medium">{formatPaise(l.lineSubtotalMinor)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex justify-between text-sm font-semibold text-ink">
          <span>Listed item subtotal</span>
          <span>{formatPaise(order.listedSubtotalMinor)}</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Pay at Pickup. Payment is handled outside CampusOS and is never verified here. Prices are
          as shown when you placed the request.
        </p>
      </section>

      <section aria-labelledby="hist-h" className="rounded-lg border border-border bg-surface p-4">
        <h2 id="hist-h" className="text-base font-semibold text-ink">
          Timeline
        </h2>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5 text-sm">
          {timestamps
            .filter(([, v]) => v)
            .map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{k}</dt>
                <dd className="text-ink">
                  <time dateTime={v}>{formatInstant(v!)}</time>
                </dd>
              </div>
            ))}
        </dl>
        <div className="mt-3">
          <Timeline order={order} />
        </div>
      </section>

      {order.status === 'pending' ? (
        <Button variant="outline" className="min-h-11 self-start" onClick={() => void cancel()}>
          Cancel request
        </Button>
      ) : order.status === 'queued' || order.status === 'preparing' || order.status === 'ready' ? (
        <p className="text-sm text-ink-muted">
          Cancellation isn't available for accepted orders on this device.
        </p>
      ) : null}

      {order.status !== 'collected' &&
      order.status !== 'rejected' &&
      order.status !== 'cancelled' ? (
        <section aria-labelledby="arr-h" className="rounded-lg border border-border bg-surface p-4">
          <h2 id="arr-h" className="text-base font-semibold text-ink">
            Arrival (optional)
          </h2>
          {order.studentReportedArrivalAt ? (
            <p className="mt-1 text-sm text-ink">
              You marked arrival at{' '}
              <time dateTime={order.studentReportedArrivalAt}>
                {formatInstant(order.studentReportedArrivalAt)}
              </time>{' '}
              (self-reported).
            </p>
          ) : (
            <Button variant="outline" className="mt-2 min-h-11" onClick={() => void markArrival()}>
              I arrived at pickup
            </Button>
          )}
          <p className="mt-1 text-xs text-ink-muted">
            This is your own report. It proves nothing about where you were, does not change the
            order, gives no priority and is not field evidence.
          </p>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/services/chill-spot">Return to menu</Link>
        </Button>
        {order.status === 'collected' ||
        order.status === 'rejected' ||
        order.status === 'cancelled' ? (
          <Button className="min-h-11" onClick={() => void reorder()}>
            Reorder
          </Button>
        ) : null}
      </div>

      {order.status !== 'collected' &&
      order.status !== 'rejected' &&
      order.status !== 'cancelled' ? (
        <NextClassNote />
      ) : null}
    </article>
  )
}
