import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Hourglass,
  Zap,
} from 'lucide-react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import { ConfirmationBadge } from '@/components/confirmation-badge'
import { Button } from '@/components/ui/button'
import { statusLabel } from '@/app/routes'
import { formatDateShort, formatTime } from '@/lib/time'
import { cn } from '@/lib/utils'
import { contextSuggestion } from '@/selectors/home'
import { deadlineFocus, type DeadlineEntry, type DeadlineStanding } from '@/selectors/deadlines'
import { itemsOnDate } from '@/selectors/occurrences'
import { upNext } from '@/selectors/up-next'
import { calendarLink } from '../calendar/calendar-url'
import { itemTimeText } from '../calendar/describe'
import { useTaskActions } from '../tasks/use-task-actions'
import { EmptyNote, HomeCard } from './home-card'
import type { HomeCtx } from './home-context'
import { resolveQuickActions } from './quick-actions'

/** H-W02 Up Next: today's timed, not-cancelled items; "Happening now" only with explicit start and end. */
export function UpNextWidget({ ctx }: { ctx: HomeCtx }) {
  const { data, now } = ctx
  const list = upNext(itemsOnDate(data, now.today), now)
  const first = list[0]
  const suggestion = contextSuggestion(data, now)
  return (
    <HomeCard
      id="upNext"
      title="Up next"
      icon={<Clock className="size-4 text-teal-strong" aria-hidden="true" />}
    >
      {!first ? (
        <EmptyNote>No more scheduled timed events today.</EmptyNote>
      ) : (
        <>
          <Link
            to={calendarLink({
              view: 'day',
              date: first.item.date,
              event: first.item.key,
              panel: 'details',
            })}
            className="block rounded-md border border-border bg-canvas p-3 hover:bg-mist"
          >
            {first.state === 'ongoing' ? (
              <span className="mb-1 inline-block rounded-full bg-teal px-2 py-0.5 text-xs font-semibold text-surface">
                Happening now
              </span>
            ) : null}
            <span className="flex items-center gap-1.5 font-semibold text-ink">
              <CategoryIcon category={first.item.category} />
              {first.item.title}
            </span>
            <span className="mt-1 block text-ink">{itemTimeText(first.item)}</span>
            {first.item.location ? (
              <span className="block text-ink-muted">{first.item.location}</span>
            ) : null}
            {first.item.verification === 'tentative' ? (
              <ConfirmationBadge verification="tentative" className="mt-2" />
            ) : null}
          </Link>
          {list.length > 1 ? (
            <p className="mt-2 text-xs text-ink-muted">
              {list.length - 1} more timed {list.length - 1 === 1 ? 'item' : 'items'} later today:{' '}
              {list
                .slice(1, 3)
                .map((e) => (e.item.time.kind === 'timed' ? formatTime(e.item.time.start) : ''))
                .join(', ')}
            </p>
          ) : null}
        </>
      )}
      {suggestion ? (
        <Link
          to={suggestion.href}
          data-suggestion={suggestion.rule}
          className="mt-3 block rounded-md border border-border-strong bg-terracotta-tint p-2.5 text-ink hover:underline"
        >
          <span className="block text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Suggestion
          </span>
          {suggestion.text}
          {suggestion.detail ? (
            <span className="block text-xs text-ink-muted">{suggestion.detail}</span>
          ) : null}
        </Link>
      ) : null}
    </HomeCard>
  )
}

const standingInfo: Record<
  DeadlineStanding,
  { label: string; Icon: typeof AlertCircle; tone: string }
> = {
  overdue: { label: 'Overdue', Icon: AlertCircle, tone: 'bg-terracotta-tint' },
  dueToday: { label: 'Due today', Icon: Clock, tone: 'bg-terracotta-tint' },
  upcoming: { label: 'Upcoming', Icon: CalendarClock, tone: 'bg-mist' },
  completed: { label: 'Personally completed', Icon: CheckCircle2, tone: 'bg-teal-tint' },
}

function dueText(e: DeadlineEntry): string {
  const day = formatDateShort(e.dueDate)
  if (e.standing === 'overdue')
    return e.dueTime ? `Was due ${day}, ${formatTime(e.dueTime)}` : `Was due ${day} (date only)`
  return e.dueTime ? `Due ${day}, ${formatTime(e.dueTime)}` : `Due ${day} (date only)`
}

/** H-W03 Deadline Focus: overdue → today → nearest. Personal completion is never "submitted". */
export function DeadlineWidget({ ctx }: { ctx: HomeCtx }) {
  const { data, now, prefs } = ctx
  const actions = useTaskActions()
  const entries = deadlineFocus(data, now, {
    hideCompleted: !prefs.filters.showCompleted,
    limit: 3,
  })
  return (
    <HomeCard
      id="deadlines"
      title="Deadline focus"
      icon={<Hourglass className="size-4 text-teal-strong" aria-hidden="true" />}
      action={
        <Button asChild variant="ghost" size="sm" className="min-h-11">
          <Link to={calendarLink({ view: 'agenda', panel: 'tasks' })}>View all</Link>
        </Button>
      }
    >
      {entries.length === 0 ? (
        <EmptyNote>No deadlines found in the available records.</EmptyNote>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => {
            const { Icon, label, tone } = standingInfo[e.standing]
            const task =
              e.source === 'task' ? data.tasks.find((t) => t.id === e.recordId) : undefined
            return (
              <li key={e.key} className="rounded-md border border-border bg-canvas p-3">
                <Link
                  to={calendarLink({
                    view: 'day',
                    date: e.dueDate,
                    event: e.calendarKey,
                    panel: 'details',
                  })}
                  className={cn(
                    'font-medium text-ink hover:underline',
                    e.standing === 'completed' && 'line-through',
                  )}
                >
                  {e.title}
                </Link>
                <p className="mt-0.5 text-ink-muted">{dueText(e)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-ink',
                      tone,
                    )}
                  >
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </span>
                  {e.verification === 'tentative' ? (
                    <ConfirmationBadge verification="tentative" />
                  ) : null}
                  <span className="text-xs text-ink-muted">
                    {e.source === 'task' ? 'Your task' : 'Supplied deadline'}
                  </span>
                </div>
                {task ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 min-h-11"
                    disabled={actions.pending.has(task.id)}
                    onClick={() => void actions.toggleComplete(task)}
                  >
                    {task.state === 'personallyCompleted'
                      ? 'Undo completion'
                      : 'Mark personally completed'}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-3 text-xs text-ink-muted">
        A personal checkmark is not an official submission.
      </p>
    </HomeCard>
  )
}

/** H-W04 Quick Actions: four configured destinations; each navigates to a real route. */
export function QuickActionsWidget({ ctx }: { ctx: HomeCtx }) {
  const { prefs } = ctx
  const { routes: resolved, replaced } = resolveQuickActions(prefs.quickActions)
  return (
    <HomeCard
      id="quickActions"
      title="Quick actions"
      icon={<Zap className="size-4 text-teal-strong" aria-hidden="true" />}
    >
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {resolved.map((r) => {
          const Icon = r.icon
          return (
            <li key={r.id}>
              <Link
                to={r.path}
                className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-md border border-border bg-canvas p-2 text-center font-medium text-ink hover:bg-mist"
              >
                <Icon className="size-5 text-teal-strong" aria-hidden="true" />
                <span>{r.label}</span>
                {r.status !== 'live' ? (
                  <span className="text-[11px] font-normal text-ink-muted">
                    {statusLabel[r.status]}
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
      {replaced ? (
        <p className="mt-2 text-xs text-ink-muted" role="note">
          A shortcut was replaced because its destination is no longer available.
        </p>
      ) : null}
      <p className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
        <ArrowRight className="size-3" aria-hidden="true" /> Shortcuts marked “Coming later” open an
        honest placeholder page.
      </p>
    </HomeCard>
  )
}
