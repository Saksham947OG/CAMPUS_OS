import { useServices } from '@/app/services'
import { ProcessTimeTax } from '../sources/process-time-tax'
import {
  Activity,
  CalendarClock,
  ChevronDown,
  Cake,
  FlaskConical,
  Hourglass,
  ListTodo,
  Plus,
  UtensilsCrossed,
  Users,
} from 'lucide-react'
import { useState } from 'react'
import { useEssState } from '@/app/ess-store'
import { useAppStore } from '@/app/app-store'
import { essActivity, feeView } from '@/selectors/ess'
import { sportsActivity } from '@/selectors/sports'
import { adminActivity } from '@/selectors/admin'
import { academicsActivity } from '@/selectors/academics'
import { communityActivity } from '@/selectors/community'
import { useAcademicsState } from '@/app/academics-store'
import { useCommunityState } from '@/app/community-store'
import { useAdminState } from '@/app/admin-store'
import { useSportsState } from '@/app/sports-store'
import { useChill } from '../chill/use-chill'
import { Link } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Button } from '@/components/ui/button'
import { formatDateShort, formatTime, formatTimeRange } from '@/lib/time'
import { cn } from '@/lib/utils'
import { computeFreePockets } from '@/selectors/free-pockets'
import { activityEntries, campusPulse, timeTaxHours } from '@/selectors/home'
import { mealLabel, messPreview } from '@/selectors/mess'
import { itemsOnDate } from '@/selectors/occurrences'
import { standingOf } from '@/selectors/deadlines'
import { calendarLink } from '../calendar/calendar-url'
import { useTaskActions } from '../tasks/use-task-actions'
import { EmptyNote, HomeCard } from './home-card'
import type { HomeCtx } from './home-context'

const icon = 'size-4 text-teal-strong'

/** H-W05: active records owned by other modules: sample bookings and the profile's café orders. */
export function ActivityWidget({ ctx }: { ctx: HomeCtx }) {
  const { myOrders } = useChill()
  const ess = useEssState((x) => x.ess)
  const profileId = useAppStore((x) => x.activeProfileId)
  const sports = useSportsState((x) => x.sports)
  const admin = useAdminState((x) => x.admin)
  const academics = useAcademicsState((x) => x.academics)
  const community = useCommunityState((x) => x.community)
  const extra = [
    ...(admin ? adminActivity(admin, profileId) : []),
    ...(academics ? academicsActivity(academics, profileId) : []),
    ...(community ? communityActivity(community, profileId) : []),
    ...(ess ? essActivity(ess, profileId, ctx.now.ms) : []),
    ...(sports ? sportsActivity(sports, profileId, ctx.now.ms) : []),
  ]
  const { active, history } = activityEntries(ctx.data, ctx.now, myOrders, extra)
  const [showHistory, setShowHistory] = useState(false)
  const row = (e: (typeof active)[number]) => (
    <li key={e.id}>
      <Link
        to={e.href}
        className="block rounded-md border border-border bg-canvas p-3 hover:bg-mist"
      >
        <span className="flex items-center justify-between gap-2">
          <span className="font-medium text-ink">{e.label}</span>
          <DataModeBadge mode={e.mode === 'connected' ? 'provided' : e.mode} />
        </span>
        <span className="block text-ink-muted">
          {e.type} · {e.status}
        </span>
        <span className="block text-ink-muted">{e.when}</span>
        {e.type === 'Café order' ? (
          <span className="mt-1 block text-xs font-medium text-teal-strong">
            Track order · not a real café
          </span>
        ) : e.type === 'Laundry load' ||
          e.type === 'Parcel' ||
          e.type === 'Machine cycle' ||
          e.type === 'Waitlist offer' ||
          e.type === 'Leave request' ||
          e.type === 'Complaint' ||
          e.type === 'Teaching-aid report' ? (
          <span className="mt-1 block text-xs font-medium text-teal-strong">
            Open details · local record; source shown above
          </span>
        ) : null}
      </Link>
    </li>
  )
  return (
    <HomeCard
      id="activity"
      title="My activity"
      icon={<Activity className={icon} aria-hidden="true" />}
    >
      {active.length === 0 ? (
        <EmptyNote>
          No active requests or bookings yet.{' '}
          <Link to="/services" className="font-medium text-teal-strong underline">
            Explore services
          </Link>
        </EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">{active.slice(0, 4).map(row)}</ul>
      )}
      {history.length > 0 ? (
        <div className="mt-2">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 gap-1"
            aria-expanded={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            <ChevronDown
              className={cn('transition-transform', showHistory && 'rotate-180')}
              aria-hidden="true"
            />{' '}
            Recent history ({history.length})
          </Button>
          {showHistory ? <ul className="mt-1 flex flex-col gap-2">{history.map(row)}</ul> : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs text-ink-muted">
        Your activity combines bookings, orders, laundry, parcels and requests. Source labels
        distinguish supplied records from illustrative entries and actions saved on this device.
      </p>
    </HomeCard>
  )
}

/** Only when someone supplied fee details: a plain reminder. It is not a payment status and sends nothing. */
function FeeReminder() {
  const ess = useEssState((x) => x.ess)
  const profileId = useAppStore((x) => x.activeProfileId)
  if (!ess?.fee?.dueDate) return null
  const f = feeView(ess, profileId)
  if (f.status === 'studentReportedSubmitted') return null
  return (
    <p className="mt-2 rounded-md bg-terracotta-tint p-2 text-sm text-ink">
      Mess fee details were supplied (local): due {f.dueText}.{' '}
      <Link to="/services/mess/fees" className="font-medium text-teal-strong underline">
        See fee details
      </Link>
    </p>
  )
}

/** H-W06: next meal from supplied serving windows, or the day's menu without time claims. */
export function MessPreviewWidget({ ctx }: { ctx: HomeCtx }) {
  const preview = messPreview(ctx.data, ctx.now)
  const meals =
    preview.kind === 'next' ? [preview.meal] : preview.kind === 'menuOnly' ? preview.meals : []
  return (
    <HomeCard
      id="messPreview"
      title="Mess preview"
      icon={<UtensilsCrossed className={icon} aria-hidden="true" />}
      action={
        meals[0] ? (
          <DataModeBadge
            mode={
              meals[0].provenance.dataMode === 'connected'
                ? 'provided'
                : meals[0].provenance.dataMode
            }
          />
        ) : undefined
      }
    >
      {meals.length === 0 ? (
        <EmptyNote>Mess menu not supplied for this day.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {meals.map((m) => (
            <li key={m.id} className="rounded-md border border-border bg-canvas p-3">
              <p className="font-medium text-ink">
                {mealLabel[m.meal]}
                <span className="ml-2 font-normal text-ink-muted">
                  {m.start && m.end ? formatTimeRange(m.start, m.end) : 'Serving time not provided'}
                </span>
              </p>
              <p className="text-ink-muted">
                {m.items?.length ? m.items.slice(0, 4).join(', ') : 'Menu not supplied'}
              </p>
            </li>
          ))}
        </ul>
      )}
      <FeeReminder />
      <p className="mt-2 text-xs text-ink-muted">
        Menu source is shown above. Allergens, current availability and payment verification need
        confirmation.
      </p>
      <Button asChild variant="outline" className="mt-2 min-h-11">
        <Link to="/services/mess">Open Mess</Link>
      </Button>
    </HomeCard>
  )
}

/** H-W07: personal tasks. Completion is personal only; dated tasks first, undated after, never given invented dates. */
export function MyTasksWidget({ ctx }: { ctx: HomeCtx }) {
  const { data, now } = ctx
  const actions = useTaskActions()
  const confirm = useConfirm()
  const [expanded, setExpanded] = useState(false)
  const pending = data.tasks
    .filter((t) => t.state !== 'personallyCompleted')
    .sort((a, b) =>
      a.dueDate && b.dueDate
        ? a.dueDate < b.dueDate
          ? -1
          : a.dueDate > b.dueDate
            ? 1
            : 0
        : a.dueDate
          ? -1
          : b.dueDate
            ? 1
            : 0,
    )
  const shown = expanded ? pending : pending.slice(0, 5)
  return (
    <HomeCard
      id="myTasks"
      title="My tasks"
      icon={<ListTodo className={icon} aria-hidden="true" />}
      action={
        <Button
          size="sm"
          className="min-h-11 gap-1"
          onClick={() => ctx.openEditor({ kind: 'task' })}
        >
          <Plus aria-hidden="true" /> Add task
        </Button>
      }
    >
      {pending.length === 0 ? (
        <EmptyNote>No pending tasks. Add one to plan your own work.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((t) => {
            const standing = t.dueDate ? standingOf(t.dueDate, t.dueTime, now, false) : undefined
            return (
              <li key={t.id} className="rounded-md border border-border bg-canvas p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 size-5 shrink-0 accent-[var(--accent-teal)]"
                    aria-label={`${t.title}: personally completed`}
                    checked={false}
                    disabled={actions.pending.has(t.id)}
                    onChange={() => void actions.toggleComplete(t)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ink">{t.title}</p>
                    <p className="text-xs text-ink-muted">
                      {t.dueDate
                        ? `Due ${formatDateShort(t.dueDate)}${t.dueTime ? `, ${formatTime(t.dueTime)}` : ' (date only)'}`
                        : 'No due date'}
                      {standing === 'overdue'
                        ? ' · Overdue'
                        : standing === 'dueToday'
                          ? ' · Due today'
                          : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-1 flex gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={() => ctx.openEditor({ kind: 'task', task: t })}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="min-h-11"
                    onClick={async () => {
                      const c = await confirm({
                        title: 'Delete this task?',
                        description: 'Only your task is deleted.',
                        confirmLabel: 'Delete task',
                        danger: true,
                      })
                      if (c === 'confirm') await actions.remove(t)
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {pending.length > 5 ? (
        <Button
          variant="ghost"
          className="mt-2 min-h-11"
          aria-expanded={expanded}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Show fewer' : `Show all ${pending.length}`}
        </Button>
      ) : null}
      <p className="mt-2 text-xs text-ink-muted">
        A checkmark here is personal. It is not an official submission.
      </p>
    </HomeCard>
  )
}

/** H-W08: gaps between known timed commitments today — "Open in your recorded schedule", never "you are free". */
export function FreePocketsWidget({ ctx }: { ctx: HomeCtx }) {
  const today = ctx.now.today
  const result = computeFreePockets(itemsOnDate(ctx.data, today), ctx.planning)
  const pockets = result.kind === 'gaps' ? result.pockets : []
  return (
    <HomeCard
      id="freePockets"
      title="My Free Pockets"
      icon={<CalendarClock className={icon} aria-hidden="true" />}
      action={
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link to={calendarLink({ view: 'day', date: today, panel: 'context' })}>View day</Link>
        </Button>
      }
    >
      {result.kind === 'noData' ? (
        <EmptyNote>Not enough schedule data to identify gaps. Check your Calendar.</EmptyNote>
      ) : result.kind === 'none' ? (
        <EmptyNote>No qualifying gaps between scheduled commitments.</EmptyNote>
      ) : (
        <>
          <p className="mb-2 text-xs font-medium text-ink-muted">Open in your recorded schedule</p>
          <ul className="flex flex-col gap-2">
            {pockets.slice(0, 3).map((g) => (
              <li key={g.start} className="rounded-md border border-border bg-canvas p-3">
                <p className="font-medium text-ink">
                  {formatTimeRange(g.start, g.end)}{' '}
                  <span className="font-normal text-ink-muted">({g.minutes} min)</span>
                </p>
                {g.cautions.length ? (
                  <p className="text-xs text-ink-muted">
                    May be shorter: tentative {g.cautions.map((c) => c.title).join(', ')}.
                  </p>
                ) : null}
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      ctx.openEditor({
                        kind: 'event',
                        prefill: { date: today, start: g.start, end: g.end },
                      })
                    }
                  >
                    Add personal event
                  </Button>
                  <Button asChild size="sm" variant="outline" className="min-h-11">
                    <Link to="/bookings">Explore bookings</Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {pockets.length > 3 ? (
            <p className="mt-1 text-xs text-ink-muted">
              +{pockets.length - 3} more in your day view.
            </p>
          ) : null}
        </>
      )}
      <p className="mt-2 text-xs text-ink-muted">
        Based only on known timed commitments. “Explore bookings” does not mean anything is
        available.
      </p>
    </HomeCard>
  )
}

/** H-W09: up to four permissioned items with a source label. Birthdays show day and month only. */
export function CampusPulseWidget({ ctx }: { ctx: HomeCtx }) {
  const entries = campusPulse(ctx.data, ctx.now)
  return (
    <HomeCard
      id="campusPulse"
      title="Campus Pulse"
      icon={<Users className={icon} aria-hidden="true" />}
      action={
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link to="/community">Explore campus</Link>
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyNote>No campus updates in the available records.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={`${e.kind}-${e.id}`}>
              <Link
                to={e.href}
                className="block rounded-md border border-border bg-canvas p-3 hover:bg-mist"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium text-ink">
                    {e.kind === 'birthday' ? (
                      <Cake className="size-4 shrink-0" aria-hidden="true" />
                    ) : null}
                    {e.important ? (
                      <span className="rounded-full bg-terracotta-tint px-2 py-0.5 text-[11px] font-semibold">
                        Important
                      </span>
                    ) : null}
                    {e.title}
                  </span>
                  <DataModeBadge mode={e.mode === 'connected' ? 'provided' : e.mode} />
                </span>
                <span className="block text-ink-muted">{e.when}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </HomeCard>
  )
}

/** H-W10: an explicitly illustrative what-if. It is never a measured saving and never moves with clicks. */
export function TimeTaxWidget({ ctx }: { ctx: HomeCtx }) {
  const { sourceData } = useServices()
  return sourceData ? <ProcessTimeTax compact /> : <LegacyTimeTaxWidget ctx={ctx} />
}
function LegacyTimeTaxWidget({ ctx }: { ctx: HomeCtx }) {
  const scenario = ctx.data.timeTax[0]
  const result = scenario ? timeTaxHours(scenario) : undefined
  return (
    <HomeCard
      id="timeTax"
      title="Time Tax snapshot"
      icon={<Hourglass className={icon} aria-hidden="true" />}
      action={
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link to="/time-tax">Explore analysis</Link>
        </Button>
      }
    >
      {!scenario || !result ? (
        <EmptyNote>No scenario is available yet.</EmptyNote>
      ) : (
        <>
          <p className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-border bg-terracotta-tint px-2.5 py-1 text-xs font-semibold text-ink">
            <FlaskConical className="size-3.5" aria-hidden="true" /> Illustrative scenario
          </p>
          <p className="font-medium text-ink">{scenario.label}</p>
          <p className="mt-1 text-ink">
            If physical waiting changed from {scenario.baselineWaitMinutes} to{' '}
            {scenario.scenarioWaitMinutes} minutes, the net change would be{' '}
            <strong>
              {result.netChangeMinutes > 0 ? '−' : result.netChangeMinutes < 0 ? '+' : ''}
              {Math.abs(result.netChangeMinutes)} minutes per visit
            </strong>
            {result.netChangeMinutes < 0
              ? ' (more waiting)'
              : result.netChangeMinutes === 0
                ? ' (no change)'
                : ''}
            ; the hypothetical <em>potential</em> waiting avoided would be about{' '}
            <strong>{Math.round(result.hoursPerWeek)} student-hours per week</strong>.
          </p>
          <details className="mt-2">
            <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-teal-strong">
              How this is calculated
            </summary>
            <p className="text-ink-muted">
              students × visits per week × (baseline − scenario wait) ÷ 60 = {scenario.students} ×{' '}
              {scenario.visitsPerStudentPerWeek} × {result.minutesSavedPerVisit} ÷ 60. Every input
              is an assumption, not an observation.
            </p>
          </details>
          <p className="mt-2 text-xs text-ink-muted">
            This is a what-if, not a measured saving. It does not change when you use CampusOS.
          </p>
        </>
      )}
    </HomeCard>
  )
}
