import { Coffee, Minus, Plus, Star } from 'lucide-react'
import { useState } from 'react'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { MenuCategory, MenuItem } from '@/domain/chill'
import { formatPaise } from '@/lib/money'
import { cn } from '@/lib/utils'
import { blockMessage, MAX_LINE_QUANTITY, orderBlock } from '@/selectors/chill'
import { useMediaQuery } from '@/hooks/use-media-query'

/** Accessible placeholder: no food photos have been supplied, so none are invented. */
export function ItemPlaceholder({ name, className }: { name: string; className?: string }) {
  return (
    <div
      aria-hidden="true"
      data-placeholder-for={name}
      className={cn('grid place-items-center rounded-md bg-coffee-tint text-coffee', className)}
    >
      <Coffee className="size-6" aria-hidden="true" />
    </div>
  )
}

const availabilityLabel = {
  available: 'Available',
  unavailable: 'Unavailable',
  unknown: 'Availability not confirmed',
} as const

export function MenuGrid({
  items,
  categories,
  onOpen,
  favorites = [],
  onToggleFavorite,
}: {
  items: MenuItem[]
  categories: MenuCategory[]
  onOpen: (item: MenuItem) => void
  favorites?: string[]
  onToggleFavorite?: (item: MenuItem) => void
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const block = orderBlock(item)
        return (
          <li
            key={item.id}
            className="flex flex-col rounded-lg border border-border bg-surface p-3 shadow-card"
            data-menu-item={item.id}
          >
            <ItemPlaceholder name={item.name} className="mb-2 h-20" />
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-ink">{item.name}</h3>
              {onToggleFavorite ? (
                <button
                  type="button"
                  className="-mr-1 -mt-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-mist"
                  aria-pressed={favorites.includes(item.id)}
                  aria-label={`Favourite ${item.name}`}
                  onClick={() => onToggleFavorite(item)}
                >
                  <Star
                    className={cn(
                      'size-5',
                      favorites.includes(item.id) && 'fill-current text-coffee',
                    )}
                    aria-hidden="true"
                  />
                </button>
              ) : null}
            </div>
            <p className="text-xs text-ink-muted">
              {categories.find((c) => c.id === item.categoryId)?.label}
            </p>
            <p className="mt-1 text-sm font-medium text-ink">
              {item.priceMinor === null ? 'Price not provided' : formatPaise(item.priceMinor)}
            </p>
            <p
              className={cn(
                'mt-1 inline-flex w-fit rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-ink',
                block ? 'bg-terracotta-tint' : 'bg-mist',
              )}
            >
              {availabilityLabel[item.availability]}
            </p>
            {item.description ? (
              <p className="mt-1 text-xs text-ink-muted">{item.description}</p>
            ) : null}
            <div className="mt-auto flex items-center justify-between gap-2 pt-3">
              <DataModeBadge mode="demoSeed" />
              <Button
                size="sm"
                variant={block ? 'outline' : 'default'}
                className="min-h-11"
                onClick={() => onOpen(item)}
              >
                {block ? 'View details' : 'Choose'}
                <span className="sr-only"> {item.name}</span>
              </Button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Item detail: options only if the source menu defines them; Add is disabled with a reason when blocked. */
export function ItemSheet({
  item,
  onClose,
  onAdd,
}: {
  item: MenuItem | null
  onClose: () => void
  onAdd: (item: MenuItem, optionIds: string[], qty: number) => void
}) {
  const isMd = useMediaQuery('(min-width: 768px)')
  return (
    <Sheet open={item !== null} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        className={
          isMd
            ? 'w-[min(26rem,100vw)] overflow-y-auto p-4'
            : 'max-h-[90dvh] overflow-y-auto rounded-t-lg p-4'
        }
      >
        {item ? <ItemForm key={item.id} item={item} onAdd={onAdd} /> : null}
      </SheetContent>
    </Sheet>
  )
}

function ItemForm({
  item,
  onAdd,
}: {
  item: MenuItem
  onAdd: Parameters<typeof ItemSheet>[0]['onAdd']
}) {
  const [picked, setPicked] = useState<string[]>([])
  const [qty, setQty] = useState(1)
  const block = orderBlock(item)
  const unit =
    item.priceMinor === null
      ? null
      : item.priceMinor +
        picked.reduce(
          (s, id) => s + (item.options?.find((o) => o.id === id)?.priceDeltaMinor ?? 0),
          0,
        )
  return (
    <>
      <SheetHeader className="p-0 pb-3">
        <SheetTitle>{item.name}</SheetTitle>
        <SheetDescription>
          {availabilityLabel[item.availability]} · {item.provenance.sourceLabel}
        </SheetDescription>
      </SheetHeader>
      <ItemPlaceholder name={item.name} className="mb-3 h-28" />
      {item.description ? <p className="mb-3 text-sm text-ink-muted">{item.description}</p> : null}
      <p className="mb-3 text-xs text-ink-muted">
        Allergen and dietary information has not been provided for this item.
      </p>

      {item.options?.length ? (
        <fieldset className="mb-3 flex flex-col">
          <legend className="mb-1 text-sm font-medium text-ink">Options</legend>
          {item.options.map((o) => (
            <label key={o.id} className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
              <input
                type="checkbox"
                className="size-5 accent-[var(--accent-teal)]"
                checked={picked.includes(o.id)}
                disabled={!!block}
                onChange={() =>
                  setPicked((p) => (p.includes(o.id) ? p.filter((x) => x !== o.id) : [...p, o.id]))
                }
              />
              <span>{o.label}</span>
              <span className="ml-auto text-ink-muted">
                {o.priceDeltaMinor >= 0 ? '+' : '−'}
                {formatPaise(Math.abs(o.priceDeltaMinor))}
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <fieldset className="mb-3 flex items-center gap-2">
        <legend className="sr-only">Quantity</legend>
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Decrease quantity"
          disabled={qty <= 1}
          onClick={() => setQty((q) => q - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output className="min-w-8 text-center text-base font-semibold text-ink" aria-live="polite">
          {qty}
        </output>
        <Button
          variant="outline"
          size="icon"
          className="size-11"
          aria-label="Increase quantity"
          disabled={qty >= MAX_LINE_QUANTITY}
          onClick={() => setQty((q) => q + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
        <span className="ml-auto text-sm font-semibold text-ink">
          {unit === null ? '—' : formatPaise(unit * qty)}
        </span>
      </fieldset>

      {block ? (
        <p
          role="alert"
          className="mb-3 rounded-md border border-border-strong bg-terracotta-tint p-2.5 text-sm text-ink"
        >
          {blockMessage[block]}.
        </p>
      ) : null}
      <Button
        className="min-h-11 w-full"
        disabled={!!block}
        onClick={() => onAdd(item, picked, qty)}
      >
        Add to cart
      </Button>
    </>
  )
}
