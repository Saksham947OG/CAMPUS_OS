import { PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react'
import { useLayoutEffect, useRef } from 'react'
import { NavLink, useLocation } from 'react-router'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { useAppStore } from '../app-store'
import { routeById, statusLabel, type RouteDef } from '../routes'
import { FOOTER_IDS, navGroups } from './nav-groups'
import { PinsEditor } from './nav-pins'
import { NextUpCapsule } from './next-up-capsule'
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
          'group relative z-[1] flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink transition-colors',
          'hover:bg-mist/70',
          isActive && 'font-semibold hover:bg-transparent',
          !expanded && 'justify-center px-0',
        )
      }
    >
      <Icon className="nav-icon size-5 shrink-0" aria-hidden="true" />
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

/**
 * The floating campus sidebar (design spec §6): an inset, tinted shell with grouped destinations, a selection
 * pill that travels between rows, pinned shortcuts, a Next-up capsule and a remembered compact mode.
 */
export function Sidebar() {
  const { pathname } = useLocation()
  const isWide = useMediaQuery('(min-width: 1024px)')
  const compactChoice = useAppStore((s) => s.sidebarCompact)
  const setCompact = useAppStore((s) => s.setSidebarCompact)
  const pins = useAppStore((s) => s.pins)
  const setCommandOpen = useAppStore((s) => s.setCommandOpen)
  const persona = useAppStore(
    (s) => s.profiles.find((p) => p.id === s.activeProfileId)?.displayName,
  )
  const expanded = isWide && !compactChoice
  const listRef = useRef<HTMLDivElement>(null)
  const pillRef = useRef<HTMLDivElement>(null)

  // The pill travels to the active row. It is positioned directly on the element, so no state is re-rendered.
  useLayoutEffect(() => {
    const list = listRef.current
    const pill = pillRef.current
    if (!list || !pill) return
    const active = list.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!active) {
      pill.style.opacity = '0'
      return
    }
    const a = active.getBoundingClientRect()
    const l = list.getBoundingClientRect()
    pill.style.opacity = '1'
    pill.style.height = `${a.height}px`
    pill.style.transform = `translateY(${a.top - l.top + list.scrollTop}px)`
  }, [pathname, expanded, pins.length])

  const pinned = pins
    .map((id) => routeById(id))
    .filter((r): r is RouteDef => !!r && r.status === 'live')
  const footer = FOOTER_IDS.map((id) => routeById(id)).filter((r): r is RouteDef => !!r)

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 py-[var(--shell-inset)] pl-[var(--shell-inset)] md:block',
        expanded
          ? 'w-[calc(var(--sidebar-width)+var(--shell-inset))]'
          : 'w-[calc(var(--sidebar-rail-width)+var(--shell-inset))]',
      )}
    >
      <div className="glass z-[var(--z-nav)] flex h-full flex-col rounded-[var(--radius-shell)]">
        <div className={cn('flex flex-col gap-0.5 px-4 pt-4', !expanded && 'items-center px-0')}>
          <Wordmark compact={!expanded} />
          {expanded && persona ? (
            <p className="truncate pl-[46px] text-xs text-ink-muted">{persona}</p>
          ) : null}
        </div>

        <div className={cn('px-3 pt-3', !expanded && 'px-2')}>
          <button
            type="button"
            onClick={() => setCommandOpen(true)}
            aria-label="Search or jump to"
            className={cn(
              'press flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface/70 px-3 text-sm text-ink-muted hover:bg-surface hover:text-ink',
              !expanded && 'justify-center px-0',
            )}
          >
            <Search className="size-4 shrink-0" aria-hidden="true" />
            {expanded ? (
              <>
                <span className="flex-1 text-left">Search or jump to…</span>
                <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] font-sans">
                  Ctrl K
                </kbd>
              </>
            ) : null}
          </button>
        </div>

        <nav aria-label="Main navigation" className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div ref={listRef} className="relative flex flex-col gap-4">
            <div
              ref={pillRef}
              aria-hidden="true"
              className="nav-pill pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-teal-tint opacity-0"
            />
            {navGroups().map((g) => (
              <section key={g.label} aria-label={g.label}>
                {expanded ? (
                  <h2 className="mb-1 px-3 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    {g.label}
                  </h2>
                ) : (
                  <hr className="mx-3 mb-2 border-border" />
                )}
                <ul className="flex flex-col gap-0.5">
                  {g.routes.map((route) => (
                    <li key={route.id}>
                      <SidebarLink route={route} expanded={expanded} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            <section aria-label="Pinned shortcuts">
              <div
                className={cn(
                  'mb-1 flex items-center justify-between px-3',
                  !expanded && 'justify-center px-0',
                )}
              >
                {expanded ? (
                  <h2 className="text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    Pins
                  </h2>
                ) : null}
                <PinsEditor />
              </div>
              {pinned.length ? (
                <ul className="flex flex-col gap-0.5">
                  {pinned.map((route) => (
                    <li key={route.id}>
                      <SidebarLink route={route} expanded={expanded} />
                    </li>
                  ))}
                </ul>
              ) : expanded ? (
                <p className="px-3 text-xs text-ink-muted">Pin the places you open most.</p>
              ) : null}
            </section>
          </div>
        </nav>

        <div
          className={cn(
            'flex flex-col gap-2 border-t border-border p-3',
            !expanded && 'items-center p-2',
          )}
        >
          <NextUpCapsule compact={!expanded} />
          <nav aria-label="Footer navigation">
            <ul className="flex flex-col gap-0.5">
              {footer.map((route) => (
                <li key={route.id}>
                  <SidebarLink route={route} expanded={expanded} />
                </li>
              ))}
            </ul>
          </nav>
          {isWide ? (
            <button
              type="button"
              onClick={() => setCompact(!compactChoice)}
              aria-expanded={!compactChoice}
              className={cn(
                'press flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-ink-muted hover:bg-mist/70 hover:text-ink',
                !expanded && 'justify-center px-0',
              )}
            >
              {compactChoice ? (
                <PanelLeftOpen className="size-5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="size-5" aria-hidden="true" />
              )}
              <span className={cn(!expanded && 'sr-only')}>
                {compactChoice ? 'Expand sidebar' : 'Collapse sidebar'}
              </span>
            </button>
          ) : null}
        </div>
      </div>
    </aside>
  )
}
