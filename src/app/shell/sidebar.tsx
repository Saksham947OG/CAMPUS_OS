import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useState } from 'react'
import { NavLink } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { sidebarRoutes, statusLabel, type RouteDef } from '../routes'
import { Wordmark } from './wordmark'

/** Compact visible tag; the full label stays available to assistive technology. */
const shortStatus = { live: '', devStub: 'In dev', comingLater: 'Soon' } as const

function SidebarLink({ route, expanded }: { route: RouteDef; expanded: boolean }) {
  const Icon = route.icon
  const notLive = route.status !== 'live'

  const link = (
    <NavLink
      to={route.path}
      end={route.path === '/'}
      className={({ isActive }) =>
        cn(
          'flex min-h-11 items-center gap-3 rounded-md border-l-4 px-3 text-sm font-medium text-ink transition-colors',
          'hover:bg-mist',
          isActive ? 'border-teal bg-teal-tint font-semibold' : 'border-transparent',
          !expanded && 'justify-center px-0',
        )
      }
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span className={cn(!expanded && 'sr-only')}>{route.label}</span>
      {notLive ? (
        <span
          className={cn(
            'ml-auto shrink-0 text-[11px] font-normal text-ink-muted',
            !expanded && 'sr-only',
          )}
        >
          <span className="sr-only">, {statusLabel[route.status]}</span>
          <span aria-hidden="true">{shortStatus[route.status]}</span>
        </span>
      ) : null}
    </NavLink>
  )

  if (expanded) return link
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">
        {route.label}
        {notLive ? ` — ${statusLabel[route.status].toLowerCase()}` : ''}
      </TooltipContent>
    </Tooltip>
  )
}

/** Desktop sidebar (≥1024px, collapsible) and icon rail (768–1023px). Hidden on mobile. */
export function Sidebar() {
  const isWide = useMediaQuery('(min-width: 1024px)')
  const [collapsed, setCollapsed] = useState(false)
  const expanded = isWide && !collapsed

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex',
        expanded ? 'w-[var(--sidebar-width)]' : 'w-[var(--sidebar-rail-width)]',
      )}
    >
      <div
        className={cn(
          'flex h-[var(--topbar-height)] items-center border-b border-border px-4',
          !expanded && 'justify-center px-0',
        )}
      >
        <Wordmark compact={!expanded} />
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {sidebarRoutes.map((route) => (
            <li key={route.id}>
              <SidebarLink route={route} expanded={expanded} />
            </li>
          ))}
        </ul>
      </nav>

      {isWide ? (
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm text-ink-muted hover:bg-mist hover:text-ink',
              !expanded && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="size-5" aria-hidden="true" />
            )}
            <span className={cn(!expanded && 'sr-only')}>
              {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            </span>
          </button>
        </div>
      ) : null}
    </aside>
  )
}
