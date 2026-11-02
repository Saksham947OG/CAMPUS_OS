import { Minus, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useConfirm } from '@/components/confirm-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { Cart } from '@/domain/chill'
import { useMediaQuery } from '@/hooks/use-media-query'
import { formatPaise } from '@/lib/money'
import { MAX_LINE_QUANTITY, type CartValidation, type QueueSnapshot } from '@/selectors/chill'

interface CartProps {
  cart: Cart
  validation: CartValidation
  onQuantity: (lineId: string, qty: number) => void
  onRemove: (lineId: string) => void
  onClear: () => void
  onCheckout: () => void
  onContinue: () => void
  persisted: boolean
}

/** Cart lines with working quantity, Remove, Clear, Continue browsing and Checkout. Totals are integer paise. */
export function CartPanel({
  cart,
  validation,
  onQuantity,
  onRemove,
  onClear,
  onCheckout,
  onContinue,
  persisted,
}: CartProps) {
  const confirm = useConfirm()
  return (
    <section aria-labelledby="cart-h" className="flex flex-col gap-3">
      <h2 id="cart-h" className="text-base font-semibold text-ink">
        Your cart
      </h2>
      {cart.lines.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-strong bg-canvas p-3 text-sm text-ink-muted">
          Your cart is empty. Choose items from the menu.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {validation.lines.map((l) => (
            <li
              key={l.line.lineId}
              className="rounded-md border border-border bg-surface p-3 text-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {l.item?.name ?? 'Item no longer on the menu'}
                  </p>
                  {l.optionLabels.length ? (
                    <p className="text-xs text-ink-muted">{l.optionLabels.join(', ')}</p>
                  ) : null}
                  {l.issues.length === 0 ? (
                    <p className="text-xs text-ink-muted">{formatPaise(l.unitPriceMinor)} each</p>
                  ) : null}
                </div>
                <p className="shrink-0 font-semibold text-ink">
                  {l.issues.length === 0 ? formatPaise(l.subtotalMinor) : '—'}
                </p>
              </div>
              {l.issues.map((i) => (
                <p key={i.code} role="alert" className="mt-1 text-xs font-medium text-danger">
                  {i.message}
                </p>
              ))}
              <div className="mt-2 flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label={`Decrease quantity of ${l.item?.name ?? 'item'}`}
                  disabled={l.line.quantity <= 1}
                  onClick={() => onQuantity(l.line.lineId, l.line.quantity - 1)}
                >
                  <Minus aria-hidden="true" />
                </Button>
                <output
                  className="min-w-8 text-center font-semibold text-ink"
                  aria-label={`Quantity of ${l.item?.name ?? 'item'}`}
                >
                  {l.line.quantity}
                </output>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11"
                  aria-label={`Increase quantity of ${l.item?.name ?? 'item'}`}
                  disabled={l.line.quantity >= MAX_LINE_QUANTITY}
                  onClick={() => onQuantity(l.line.lineId, l.line.quantity + 1)}
                >
                  <Plus aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  className="ml-auto min-h-11 gap-1.5"
                  onClick={() => onRemove(l.line.lineId)}
                >
                  <Trash2 aria-hidden="true" /> Remove
                  <span className="sr-only"> {l.item?.name}</span>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="rounded-md bg-coffee-tint p-3 text-sm text-ink">
        <p className="flex justify-between font-semibold">
          <span>Listed item subtotal</span>
          <span>{formatPaise(validation.subtotalMinor)}</span>
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Pay at pickup, at the café counter. This is not a final bill; fees or tax, if any, are not
          known.
        </p>
      </div>
      {!persisted ? (
        <output className="block text-xs font-medium text-danger">
          Your cart could not be saved on this device, so it may be lost when you reload.
        </output>
      ) : null}

      <Button className="min-h-11" disabled={cart.lines.length === 0} onClick={onCheckout}>
        Review checkout
      </Button>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="min-h-11" onClick={onContinue}>
          Continue browsing
        </Button>
        <Button
          variant="ghost"
          className="min-h-11"
          disabled={cart.lines.length === 0}
          onClick={async () => {
            const c = await confirm({
              title: 'Clear your cart?',
              description: 'All items are removed from this cart. Nothing has been ordered.',
              confirmLabel: 'Clear cart',
              danger: true,
            })
            if (c === 'confirm') onClear()
          }}
        >
          Clear cart
        </Button>
      </div>
    </section>
  )
}

interface CheckoutProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  validation: CartValidation
  snapshot: QueueSnapshot
  /** Resolves with an error message, or undefined on success. */
  onSubmit: (idempotencyKey: string, expectedSubtotalMinor: number) => Promise<string | undefined>
  newKey: () => string
}

/** Review step: restates Pay at Pickup, the queue caveat and what this is NOT, then one idempotent submit. */
export function CheckoutSheet({
  open,
  onOpenChange,
  validation,
  snapshot,
  onSubmit,
  newKey,
}: CheckoutProps) {
  const isMd = useMediaQuery('(min-width: 768px)')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const key = useRef<string>('')
  const submitting = useRef(false)

  const submit = async () => {
    if (submitting.current) return // repeat clicks while a request is in flight are ignored
    submitting.current = true
    setPending(true)
    setError(undefined)
    // One key per checkout attempt: a retry after an error reuses it, so it can never create two orders.
    if (!key.current) key.current = newKey()
    const message = await onSubmit(key.current, validation.subtotalMinor)
    submitting.current = false
    setPending(false)
    if (message) setError(message)
    else key.current = ''
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (!o) key.current = ''
        onOpenChange(o)
      }}
    >
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        className={
          isMd
            ? 'w-[min(28rem,100vw)] overflow-y-auto p-4'
            : 'max-h-[92dvh] overflow-y-auto rounded-t-lg p-4'
        }
      >
        <SheetHeader className="p-0 pb-3">
          <SheetTitle>Review your local order</SheetTitle>
          <SheetDescription>
            This is a demonstration. Nothing here reaches a real café.
          </SheetDescription>
        </SheetHeader>
        <ul className="flex flex-col gap-1.5 text-sm">
          {validation.lines.map((l) => (
            <li
              key={l.line.lineId}
              className="flex justify-between gap-2 border-b border-border pb-1.5"
            >
              <span>
                {l.line.quantity} × {l.item?.name}
                {l.optionLabels.length ? ` (${l.optionLabels.join(', ')})` : ''}
              </span>
              <span className="font-medium">{formatPaise(l.subtotalMinor)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex justify-between text-sm font-semibold text-ink">
          <span>Listed item subtotal</span>
          <span>{formatPaise(validation.subtotalMinor)}</span>
        </p>

        <div className="mt-3 flex flex-col gap-2 rounded-md bg-coffee-tint p-3 text-sm text-ink">
          <p>
            <strong>Pay at Pickup.</strong> You pay at the café counter, outside CampusOS. CampusOS
            does not take or verify payment.
          </p>
          <p>
            <strong>This is a request.</strong> It stays pending until the café accepts it, so it is
            not a confirmed order and no payment or refund is involved.
          </p>
          <p>No delivery, and no promised ready time or position in the physical queue.</p>
          <p>
            Right now: {snapshot.preparation.text}. {snapshot.preparation.caveat}
          </p>
          {snapshot.paused ? (
            <p className="font-semibold">
              New requests are paused (local): {snapshot.paused.reason}.
            </p>
          ) : null}
        </div>

        {validation.issues.length > 0 ? (
          <ul
            role="alert"
            className="mt-3 list-disc rounded-md border border-border-strong bg-terracotta-tint p-3 pl-6 text-sm text-ink"
          >
            {validation.issues.map((i) => (
              <li key={`${i.code}${i.lineId ?? ''}`}>{i.message}</li>
            ))}
          </ul>
        ) : null}
        {error ? (
          <p
            role="alert"
            className="mt-3 rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm font-medium text-ink"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <Button
            className="min-h-11"
            disabled={pending || !validation.canSubmit}
            onClick={() => void submit()}
          >
            {pending ? 'Placing request…' : 'Place local order request'}
          </Button>
          <Button variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            Back to cart
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
