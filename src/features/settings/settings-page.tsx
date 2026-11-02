import { Database, Presentation, UserRound } from 'lucide-react'
import { DataModeBadge } from '@/components/data-mode-badge'
import { dataModeInfo } from '@/components/data-mode-info'
import { PageHeader } from '@/components/page-header'
import { RouteStatusBadge } from '@/components/status-badge'
import { useAppStore } from '@/app/app-store'
import { routeById } from '@/app/routes'
import { ReminderSettings } from '@/features/notifications/reminder-settings'
import { DataSources, ResetDemo } from './data-management'

function Card({
  id,
  title,
  icon,
  children,
}: {
  id?: string
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id ?? title}-h`}
      className="scroll-mt-24 rounded-lg border border-border bg-surface p-5 shadow-card md:p-6"
    >
      <h2
        id={`${id ?? title}-h`}
        className="flex items-center gap-2 text-base font-semibold text-ink"
      >
        {icon}
        {title}
      </h2>
      <div className="mt-3 text-sm text-ink-muted">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const route = routeById('settings')!
  const profiles = useAppStore((s) => s.profiles)
  const activeId = useAppStore((s) => s.activeProfileId)
  const storageMode = useAppStore((s) => s.storageMode)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const setShowDemoOps = useAppStore((s) => s.setShowDemoOps)
  const active = profiles.find((p) => p.id === activeId)

  return (
    <article>
      <PageHeader
        title="Settings"
        description={route.summary}
        badge={<RouteStatusBadge status={route.status} />}
      />

      <div className="grid max-w-3xl gap-4">
        <Card
          title="Demo profile"
          icon={<UserRound className="size-4 text-teal-strong" aria-hidden="true" />}
        >
          <p className="flex flex-wrap items-center gap-2">
            <strong className="text-ink">{active?.displayName ?? '—'}</strong>
            <DataModeBadge mode="demoSeed" />
          </p>
          <p className="mt-2">{active?.description}</p>
          <p className="mt-2">
            A demo profile only changes which sample and personal data you see. It is not an account
            and there is no sign-in. Switch profiles from the profile menu in the top bar.
          </p>
        </Card>

        <Card
          title="Storage on this device"
          icon={<Database className="size-4 text-teal-strong" aria-hidden="true" />}
        >
          {storageMode === 'persistent' ? (
            <p>
              Anything you create or change is saved in this browser on this device only. Nothing is
              sent to a server, and clearing site data removes it.
            </p>
          ) : (
            <p>
              Browser storage is unavailable, so changes are kept in temporary memory and will be
              lost when you reload.
            </p>
          )}
        </Card>

        <Card id="data-labels" title="What the data labels mean">
          <ul className="grid gap-3">
            {(Object.keys(dataModeInfo) as (keyof typeof dataModeInfo)[]).map((mode) => (
              <li key={mode} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
                <span className="sm:w-32 sm:shrink-0">
                  <DataModeBadge mode={mode} />
                </span>
                <span>{dataModeInfo[mode].meaning}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3">
            A fifth label, “connected”, is reserved for a future authorized integration. No data in
            this prototype is live, official or connected to any campus system.
          </p>
        </Card>

        <Card id="reminders" title="In-app reminders">
          <ReminderSettings />
        </Card>

        <Card id="data-sources" title="Data sources on this profile">
          <DataSources />
        </Card>

        <Card
          id="presentation-tools"
          title="Presentation tools"
          icon={<Presentation className="size-4 text-teal-strong" aria-hidden="true" />}
        >
          <div className="flex min-h-11 items-start gap-3 text-ink">
            <input
              id="show-demo-ops"
              type="checkbox"
              className="mt-1 size-5 shrink-0"
              checked={showDemoOps}
              onChange={(e) => setShowDemoOps(e.target.checked)}
            />
            <label htmlFor="show-demo-ops">
              <strong>Show Demo Operations on service pages</strong>
              <span className="block font-normal text-ink-muted">
                Adds a clearly labelled panel on Chill Spot, Laundry, Mess, Parcels, Bookings and
                Administration where you act as the provider, café or desk, one visible click at a
                time. It only changes data stored in this browser. Nothing runs by itself, nothing
                reaches another device, and no real café, provider or desk is involved.
              </span>
            </label>
          </div>
        </Card>

        <Card id="reset-demo" title="Reset demo data">
          <ResetDemo />
        </Card>
      </div>
    </article>
  )
}
