import { CampusLife } from '@/features/presence/campus-life'
import { TriangleAlert } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useReminderEngine } from '@/features/notifications/use-reminder-engine'
import { useAppStore } from '../app-store'
import { matchRoute } from '../routes'
import { CampusAssistant } from '@/features/chat/campus-assistant'
import { MobileNav } from './mobile-nav'
import { Sidebar } from './sidebar'
import { TopBar } from './top-bar'

function StorageNotice() {
  const mode = useAppStore((s) => s.storageMode)
  if (mode === 'persistent') return null
  return (
    <output className="flex items-start gap-2 border-b border-border-strong bg-terracotta-tint px-4 py-2 text-sm text-ink">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        Browser storage is unavailable, so changes are kept in temporary memory only and will be
        lost when you reload this page.
      </p>
    </output>
  )
}

function MainContent() {
  const status = useAppStore((s) => s.status)
  const error = useAppStore((s) => s.error)

  if (status === 'loading') {
    return <output className="block text-ink-muted">Loading personas…</output>
  }
  if (status === 'error') {
    return (
      <div role="alert" className="rounded-lg border border-border-strong bg-surface p-6">
        <h1 className="font-display text-2xl font-semibold text-ink">CampusOS could not start</h1>
        <p className="mt-2 text-ink-muted">
          {error ?? 'Something went wrong loading the personas.'}
        </p>
      </div>
    )
  }
  return <Outlet />
}

export function AppShell() {
  useReminderEngine()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // Per-route document title, and move focus to <main> on client-side navigation so keyboard and
  // screen-reader users land at the new page rather than staying on the link they activated.
  useEffect(() => {
    const route = matchRoute(pathname)
    document.title = `${route?.label ?? 'Page not found'} · CampusOS`
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-md bg-surface px-4 py-3 text-sm font-semibold text-ink focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:border focus:border-border-strong"
      >
        Skip to main content
      </a>
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <StorageNotice />
        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-4 pb-24 pt-6 outline-none md:px-6 md:pb-8 md:pt-8"
        >
          <CampusLife />
          <MainContent />
        </main>
      </div>
      <MobileNav />
      <CampusAssistant />
    </div>
  )
}
