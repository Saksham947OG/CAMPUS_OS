import { Ellipsis } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { mobileMoreRoutes, mobilePrimaryRoutes, statusLabel } from '../routes'

const tabClass =
  'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium text-ink'

/** Bottom navigation, <768px: Home · Calendar · Services · More (COS-HOME-001 §3.3, DEC-019). */
export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <nav
      aria-label="Main navigation, mobile"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-4">
        {mobilePrimaryRoutes.map((route) => {
          const Icon = route.icon
          return (
            <li key={route.id}>
              <NavLink
                to={route.path}
                end={route.path === '/'}
                className={({ isActive }) =>
                  cn(
                    tabClass,
                    'border-t-4',
                    isActive ? 'border-teal bg-teal-tint font-semibold' : 'border-transparent',
                  )
                }
              >
                <Icon className="size-5" aria-hidden="true" />
                <span>{route.shortLabel ?? route.label}</span>
              </NavLink>
            </li>
          )
        })}
        <li>
          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className={cn(tabClass, 'w-full border-t-4 border-transparent')}
              >
                <Ellipsis className="size-5" aria-hidden="true" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-lg">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
                <SheetDescription>
                  Pages marked “Coming later” are not part of the current build and show no live
                  data.
                </SheetDescription>
              </SheetHeader>
              <ul className="flex flex-col gap-1 px-4 pb-6">
                {mobileMoreRoutes.map((route) => {
                  const Icon = route.icon
                  return (
                    <li key={route.id}>
                      <Link
                        to={route.path}
                        onClick={() => setMoreOpen(false)}
                        className="flex min-h-12 items-center gap-3 rounded-md px-3 text-sm font-medium text-ink hover:bg-mist"
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        <span>{route.label}</span>
                        {route.status !== 'live' ? (
                          <span className="ml-auto text-xs font-normal text-ink-muted">
                            {statusLabel[route.status]}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  )
}
