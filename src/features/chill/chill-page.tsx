import { CapacityNote } from '@/components/capacity-note'
import { orderPath } from './paths'
import { Coffee, Search, ShoppingCart } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { useConfirm } from '@/components/confirm-context'
import { inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { type MenuItem } from '@/domain/chill'
import { useMediaQuery } from '@/hooks/use-media-query'
import { useNow } from '@/hooks/use-now'
import { formatPaise } from '@/lib/money'
import { cn } from '@/lib/utils'
import {
  activeOrders,
  addToCart,
  historyOrders,
  queueSnapshot,
  reorderCart,
  representedCategories,
  searchMenu,
  sortMenuItems,
  validateCart,
  type MenuSort,
} from '@/selectors/chill'
import { CartPanel, CheckoutSheet } from './cart'
import { DemoOpsPanel } from './demo-ops-panel'
import { ItemSheet, MenuGrid } from './menu'
import { NextClassNote } from './next-class'
import { OrderCard, QueueContext, StatusChip } from './orders'
import { QueuePanel } from './queue-panel'
import { TimeTaxPanel } from './time-tax-panel'
import { useCart, useChill, useFavorites } from './use-chill'
import type { ChillOrder } from '@/domain/chill'

export function ChillSpotPage() {
  const services = useServices()
  const { chill } = services
  const { café, status, error, profileId, myOrders } = useChill()
  const { cart, ready, persisted, update, newId } = useCart()
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const toast = useToast()
  const confirm = useConfirm()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isLg = useMediaQuery('(min-width: 1024px)')
  const searchRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string | undefined>()
  const [open, setOpen] = useState<MenuItem | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [notes, setNotes] = useState<string[]>([])
  const [sort, setSort] = useState<MenuSort>('menu')
  const [favOnly, setFavOnly] = useState(false)
  const { favorites, toggle: toggleFavorite } = useFavorites()
  const [orderFilter, setOrderFilter] = useState<'all' | 'active' | 'history'>('all')

  const menu = chill.getMenu()
  const tab = params.get('tab') === 'orders' ? 'orders' : 'menu'
  const found = useMemo(() => searchMenu(menu, query, category), [menu, query, category])
  const items = useMemo(
    () => sortMenuItems(favOnly ? found.filter((i) => favorites.includes(i.id)) : found, sort),
    [found, favOnly, favorites, sort],
  )

  if (status === 'error')
    return (
      <p role="alert" className="text-sm text-ink">
        Chill Spot could not load: {error}
      </p>
    )
  if (!café || !ready) return <output className="block text-ink-muted">Loading Chill Spot…</output>

  const snapshot = queueSnapshot(café, now.ms)
  const validation = validateCart(menu, cart, { paused: !!café.pause })
  const count = cart.lines.reduce((n, l) => n + (Number.isInteger(l.quantity) ? l.quantity : 0), 0)
  const active = activeOrders(myOrders)
  const history = historyOrders(myOrders)

  const onAdd = (item: MenuItem, optionIds: string[], qty: number) => {
    void update((c) => addToCart(c, { menuItemId: item.id, optionIds, quantity: qty }, newId))
    setOpen(null)
    toast.notify('success', `${qty} × ${item.name} added to your cart`)
  }

  const cartPanel = (
    <CartPanel
      cart={cart}
      validation={validation}
      persisted={persisted}
      onQuantity={(id, q) =>
        void update((c) => ({
          ...c,
          lines: c.lines.map((l) => (l.lineId === id ? { ...l, quantity: q } : l)),
        }))
      }
      onRemove={(id) =>
        void update((c) => ({ ...c, lines: c.lines.filter((l) => l.lineId !== id) }))
      }
      onClear={() => void update(() => ({ schemaVersion: 1, lines: [] }))}
      onCheckout={() => {
        setCartOpen(false)
        setCheckout(true)
      }}
      onContinue={() => {
        setCartOpen(false)
        searchRef.current?.focus()
      }}
    />
  )

  const reorder = async (order: ChillOrder) => {
    if (cart.lines.length > 0) {
      const c = await confirm({
        title: 'Replace your current cart?',
        description:
          'Reordering starts a new cart from this earlier order. Your current cart items will be replaced. Nothing is ordered until you check out.',
        confirmLabel: 'Replace cart',
      })
      if (c !== 'confirm') return
    }
    const r = reorderCart(menu, order, newId)
    await update(() => r.cart)
    setNotes(r.changes)
    navigate('/services/chill-spot')
  }

  const submit = async (key: string, expected: number) => {
    const r = await chill.submitOrder(profileId, key, expected)
    if (!r.ok) return r.error.message
    setCheckout(false)
    setNotes([])
    toast.notify('success', 'Local order request submitted. It is awaiting café acceptance.')
    navigate(orderPath(r.value.order.id))
    return undefined
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="flex items-center gap-2 font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
          >
            <Coffee className="size-7 text-coffee" aria-hidden="true" /> Chill Spot
          </h1>
          <span className="rounded-full border border-border-strong bg-terracotta-tint px-2.5 py-1 text-xs font-semibold text-ink">
            Supplied Chill Spot menu
          </span>
        </div>
        <p className="mt-1 max-w-2xl text-base text-ink-muted">
          Order ahead and pay at the café counter. Menu names and prices come from the supplied café
          photographs. Orders are saved on this device; café acceptance, live stock and opening
          hours need confirmation. No payment is taken.
        </p>
        <div className="mt-2">
          <CapacityNote facility="chillSpot" />
        </div>
      </div>

      <nav aria-label="Chill Spot sections" className="flex gap-1 border-b border-border">
        {(
          [
            ['menu', 'Menu', '/services/chill-spot'],
            [
              'orders',
              `My orders${myOrders.length ? ` (${myOrders.length})` : ''}`,
              '/services/chill-spot?tab=orders',
            ],
          ] as const
        ).map(([id, label, to]) => (
          <Link
            key={id}
            to={to}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'min-h-11 border-b-4 px-4 py-2.5 text-sm font-medium text-ink',
              tab === id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist',
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'menu' ? (
        <>
          {active.length > 0 ? (
            <section aria-labelledby="active-h" className="flex flex-col gap-2">
              <h2 id="active-h" className="text-base font-semibold text-ink">
                Your active {active.length === 1 ? 'order' : `orders (${active.length})`}
              </h2>
              <ul className="flex flex-col gap-2">
                {active.map((o) => (
                  <li key={o.id} className="rounded-lg border border-border bg-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-semibold text-ink">{o.displayNumber}</span>
                      <StatusChip status={o.status} />
                    </div>
                    <div className="mt-1">
                      <QueueContext order={o} orders={café.orders} />
                    </div>
                    <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
                      <Link to={orderPath(o.id)}>Track order</Link>
                    </Button>
                  </li>
                ))}
              </ul>
              <NextClassNote />
            </section>
          ) : null}

          <QueuePanel snapshot={snapshot} />

          {notes.length > 0 ? (
            <output className="block rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm text-ink">
              <p className="font-semibold">Your reordered cart differs from the earlier order</p>
              <ul className="list-disc pl-5">
                {notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </output>
          ) : null}

          <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
            <section aria-labelledby="menu-h" className="flex min-w-0 flex-col gap-3">
              <h2 id="menu-h" className="text-base font-semibold text-ink">
                Menu <span className="font-normal text-ink-muted">· supplied prices</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <label className="relative min-w-48 flex-1">
                  <span className="sr-only">Search the menu</span>
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted"
                    aria-hidden="true"
                  />
                  <input
                    ref={searchRef}
                    type="search"
                    className={cn(inputClass, 'pl-9')}
                    placeholder="Search the menu"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </label>
              </div>
              <fieldset className="flex flex-wrap gap-1.5">
                <legend className="sr-only">Menu categories</legend>
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-pressed={!category}
                  onClick={() => setCategory(undefined)}
                >
                  All
                </Button>
                {representedCategories(menu).map((c) => (
                  <Button
                    key={c.id}
                    variant="outline"
                    className="min-h-11"
                    aria-pressed={category === c.id}
                    onClick={() => setCategory(c.id)}
                  >
                    {c.label}
                  </Button>
                ))}
              </fieldset>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-ink">
                  Sort by
                  <select
                    className={cn(inputClass, 'w-44')}
                    value={sort}
                    onChange={(e) => setSort(e.target.value as MenuSort)}
                  >
                    <option value="menu">Menu order</option>
                    <option value="name">Name</option>
                    <option value="price">Listed price (lowest first)</option>
                  </select>
                </label>
                <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={favOnly}
                    onChange={(e) => setFavOnly(e.target.checked)}
                  />
                  Favourites only ({favorites.length})
                </label>
                {sort === 'price' ? (
                  <span className="text-xs text-ink-muted">
                    Items with no listed price come last. They are not treated as free.
                  </span>
                ) : null}
              </div>
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
                  {favOnly && found.length > 0
                    ? 'None of the matching items is a favourite. Turn off “Favourites only” to see them.'
                    : `No menu items match “${query}”. Try another search or clear the category.`}
                </p>
              ) : (
                <MenuGrid
                  items={items}
                  categories={menu.categories}
                  onOpen={setOpen}
                  favorites={favorites}
                  onToggleFavorite={(i) => void toggleFavorite(i.id)}
                />
              )}
            </section>

            {isLg ? (
              <aside
                aria-label="Cart"
                className="sticky top-20 rounded-lg border border-border bg-surface p-4"
              >
                {cartPanel}
              </aside>
            ) : null}
          </div>
        </>
      ) : (
        <section aria-labelledby="orders-h" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="orders-h" className="text-base font-semibold text-ink">
              Your orders
            </h2>
            <label className="flex items-center gap-2 text-sm text-ink">
              Show
              <select
                className={cn(inputClass, 'w-36')}
                value={orderFilter}
                onChange={(e) => setOrderFilter(e.target.value as typeof orderFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="history">History</option>
              </select>
            </label>
          </div>
          {myOrders.length === 0 ? (
            <p className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
              You have no local orders yet.{' '}
              <Link to="/services/chill-spot" className="font-medium text-coffee underline">
                Browse the menu
              </Link>
              .
            </p>
          ) : null}
          {orderFilter !== 'history' && active.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-ink">Active</h3>
              <ul className="flex flex-col gap-2">
                {active.map((o) => (
                  <OrderCard key={o.id} order={o} onReorder={reorder} />
                ))}
              </ul>
            </>
          ) : null}
          {orderFilter !== 'active' && history.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-ink">History</h3>
              <ul className="flex flex-col gap-2">
                {history.map((o) => (
                  <OrderCard key={o.id} order={o} onReorder={reorder} />
                ))}
              </ul>
            </>
          ) : null}
        </section>
      )}

      {showDemoOps ? <DemoOpsPanel café={café} /> : null}
      <TimeTaxPanel />

      {tab === 'menu' && !isLg ? (
        <div className="fixed inset-x-0 bottom-16 z-30 border-t border-border bg-surface p-2 md:bottom-0 md:left-[var(--sidebar-rail-width)]">
          <Button className="min-h-12 w-full gap-2" onClick={() => setCartOpen(true)}>
            <ShoppingCart aria-hidden="true" /> View cart · {count} {count === 1 ? 'item' : 'items'}{' '}
            · {formatPaise(validation.subtotalMinor)}
          </Button>
        </div>
      ) : null}

      <ItemSheet item={open} onClose={() => setOpen(null)} onAdd={onAdd} />
      {!isLg ? (
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-lg p-4">
            <SheetHeader className="p-0 pb-2">
              <SheetTitle>Cart</SheetTitle>
              <SheetDescription>Pay at pickup. Saved on this device.</SheetDescription>
            </SheetHeader>
            {cartPanel}
          </SheetContent>
        </Sheet>
      ) : null}
      <CheckoutSheet
        open={checkout}
        onOpenChange={setCheckout}
        validation={validation}
        snapshot={snapshot}
        onSubmit={submit}
        newKey={() => newId('idem')}
      />
    </div>
  )
}
