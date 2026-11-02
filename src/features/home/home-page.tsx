import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { RouteStatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { routeById } from '@/app/routes'
import { useAppStore } from '@/app/app-store'
import type { HomePrefs, HomeWidgetId, WidgetLayout } from '@/data/prefs/home-prefs'
import { DataError } from '@/features/common/data-error'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { usePrefs } from '@/hooks/use-prefs'
import { formatDateLong } from '@/lib/time'
import { cn } from '@/lib/utils'
import { dailyBriefing, greetingFor } from '@/selectors/home'
import { itemsInRange } from '@/selectors/occurrences'
import type { DateOnly } from '@/lib/time'
import { EditorHost } from '../calendar/editors/editor-host'
import type { EditorRequest } from '../calendar/editors/editor-types'
import { CustomizeSheet } from './customize-sheet'
import type { HomeCtx } from './home-context'
import { homeWidgets } from './widgets'

const sizeClass: Record<WidgetLayout['size'], string> = {
  compact: 'lg:col-span-4',
  standard: 'lg:col-span-6',
  wide: 'md:col-span-2 lg:col-span-12',
}

function visibleIn(prefs: HomePrefs, zone: 1 | 2 | 3): WidgetLayout[] {
  return prefs.widgets
    .filter((w) => w.zone === zone && w.visible && w.id !== 'schedule' && homeWidgets[w.id])
    .sort((a, b) => a.order - b.order)
}

export function HomePage() {
  const route = routeById('home')!
  const { data, status, error } = useCampusData()
  const now = useNow()
  const home = usePrefs('home')
  const planning = usePrefs('planning')
  const profile = useAppStore((s) => s.profiles.find((p) => p.id === s.activeProfileId))
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [editor, setEditor] = useState<EditorRequest | null>(null)

  if (status === 'error') return <DataError message={error} />

  if (!home.ready || !planning.ready || status === 'loading') {
    return <output className="block text-ink-muted">Loading your dashboard…</output>
  }

  const ctx: HomeCtx = {
    data,
    now,
    prefs: home.value,
    planning: planning.value,
    profileName: profile?.displayName ?? '',
    updatePrefs: (fn) => home.update(fn),
    updatePlanning: (fn) => planning.update(fn),
    openEditor: setEditor,
  }
  const briefing = dailyBriefing(data, now)
  const render = (id: HomeWidgetId) => homeWidgets[id]!.render(ctx)
  const zone1 = visibleIn(home.value, 1)
  const zone2 = visibleIn(home.value, 2)
  const zone3 = visibleIn(home.value, 3)

  return (
    <div className="group/home flex flex-col gap-6" data-density={home.value.density}>
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink md:text-4xl"
          >
            {greetingFor(now.hour)}
            {ctx.profileName ? `, ${ctx.profileName}` : ''}
          </h1>
          {route.status !== 'live' ? <RouteStatusBadge status={route.status} /> : null}
          <Button
            variant="outline"
            className="min-h-11 gap-2 md:ml-auto"
            onClick={() => setCustomizeOpen(true)}
          >
            <Settings2 aria-hidden="true" /> Customize
          </Button>
        </div>
        <p className="mt-1 text-base text-ink-muted">{formatDateLong(now.today)}</p>
        <p className="mt-1 text-base text-ink" data-testid="briefing">
          {briefing.summary}
        </p>
      </div>

      {home.source === 'recovered' ? (
        <output className="block rounded-md border border-border-strong bg-mist p-3 text-sm text-ink">
          Your saved layout could not be read, so the default layout is shown. Your tasks and events
          were not affected.
        </output>
      ) : null}

      <section
        aria-label="Immediate priorities"
        className="flex flex-col gap-4 lg:grid lg:grid-cols-12"
      >
        <div className="order-2 lg:order-none lg:col-span-8 lg:row-span-3">
          {render('schedule')}
        </div>
        {zone1.map((w) => (
          <div
            key={w.id}
            className={cn('lg:order-none lg:col-span-4', w.id === 'upNext' ? 'order-1' : 'order-3')}
          >
            {render(w.id)}
          </div>
        ))}
      </section>

      {zone2.length > 0 ? (
        <section aria-labelledby="zone2-h" className="flex flex-col gap-3">
          <h2 id="zone2-h" className="font-display text-xl font-semibold text-ink">
            Things to do
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            {zone2.map((w) => (
              <div key={w.id} className={sizeClass[w.size]}>
                {render(w.id)}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {zone3.length > 0 ? (
        <section aria-labelledby="zone3-h" className="flex flex-col gap-3">
          <h2 id="zone3-h" className="font-display text-xl font-semibold text-ink">
            Discover &amp; reflect
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12">
            {zone3.map((w) => (
              <div key={w.id} className={sizeClass[w.size]}>
                {render(w.id)}
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <CustomizeSheet open={customizeOpen} onOpenChange={setCustomizeOpen} ctx={ctx} />
      <EditorHost
        request={editor}
        data={data}
        planning={planning.value}
        getItemsOn={(d: DateOnly) => itemsInRange(data, d, d)}
        onClose={() => setEditor(null)}
      />
    </div>
  )
}
