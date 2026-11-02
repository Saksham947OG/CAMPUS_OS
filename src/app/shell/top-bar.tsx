import { Link, useLocation } from 'react-router'
import { usePrefs } from '@/hooks/use-prefs'
import { unreadCount } from '@/selectors/notifications'
import { Button } from '@/components/ui/button'
import { matchRoute, routeById } from '../routes'
import { CampusAi } from './campus-ai'
import { DemoBadge } from './demo-badge'
import { ProfileMenu } from './profile-menu'
import { Wordmark } from './wordmark'

function UtilityLink({
  id,
  badge,
}: {
  id: 'search' | 'notifications' | 'settings'
  badge?: number
}) {
  const route = routeById(id)!
  const Icon = route.icon
  const label = badge ? `${route.label}, ${badge} unread` : route.label
  return (
    <Button asChild variant="ghost" size="icon" className="size-11">
      <Link to={route.path} aria-label={label} className="relative">
        <Icon className="size-5" aria-hidden="true" />
        {badge ? (
          <span
            aria-hidden="true"
            className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-4 text-surface"
          >
            {badge > 9 ? '9+' : badge}
          </span>
        ) : null}
      </Link>
    </Button>
  )
}

export function TopBar() {
  const { pathname } = useLocation()
  const current = matchRoute(pathname)
  const notifications = usePrefs('notifications')
  const nprefs = usePrefs('notificationPrefs')
  const unread = unreadCount(notifications.value.items, nprefs.value)

  return (
    <header className="sticky top-0 z-30 flex h-[var(--topbar-height)] items-center gap-1 border-b border-border bg-surface/95 px-3 backdrop-blur md:gap-2 md:px-6">
      <div className="md:hidden">
        <Wordmark responsive />
      </div>
      <p className="hidden text-sm text-ink-muted md:block">
        <span className="font-medium text-ink">CampusOS</span>
        {current ? <span aria-hidden="true"> / {current.label}</span> : null}
      </p>

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {/* Search is still a "coming later" page, so on the narrowest phones its icon makes room for Campus AI. */}
        <div className="max-[359px]:hidden">
          <UtilityLink id="search" />
        </div>
        <CampusAi />
        <UtilityLink id="notifications" badge={unread} />
        <DemoBadge />
        <ProfileMenu />
        <div className="hidden md:block">
          <UtilityLink id="settings" />
        </div>
      </div>
    </header>
  )
}
