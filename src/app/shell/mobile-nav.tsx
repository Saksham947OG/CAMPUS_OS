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
  'press flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-[11px] font-medium text-ink'

/** Floating bottom navigation, <768px: Home · Calendar · Services · Workspace · More (design spec §17). */
export function MobileNav() {
  const [moreOpen, setMoreOpen] = useState(false)

  return (
    <nav
      aria-label="Main navigation, mobile"
      className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[var(--z-nav)] rounded-[22px] p-1 md:hidden"
    >
      <ul className="grid grid-cols-5">
        {mobilePrimaryRoutes.map((route) => {
          const Icon = route.icon
          return (
            <li key={route.id}>
              <NavLink
                to={route.path}
                end={route.path === '/'}
                className={({ isActive }) =>
                  cn(tabClass, isActive ? 'bg-teal-tint font-semibold' : 'hover:bg-mist/70')
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
              <button type="button" className={cn(tabClass, 'w-full hover:bg-mist/70')}>
                <Ellipsis className="size-5" aria-hidden="true" />
                <span>More</span>
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-lg">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
                <SheetDescription>More places in CampusOS.</SheetDescription>
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
