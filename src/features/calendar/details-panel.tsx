import { Ban, CalendarX2, EyeOff, MoveRight, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { CategoryIcon } from '@/components/category-icon'
import { ConfirmationBadge } from '@/components/confirmation-badge'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Button } from '@/components/ui/button'
import { categoryLabel } from '@/domain/categories'
import type { ProfileData } from '@/domain/records'
import { formatDateLong, formatTimeRange } from '@/lib/time'
import type { Conflict } from '@/selectors/conflicts'
import type { CalendarItem } from '@/selectors/items'
import { describeRule, itemTimeText } from './describe'
import { useFlag } from './bottleneck-flags'
import { FlagBadge } from './flag-badge'

interface Props {
  data: ProfileData
  item?: CalendarItem
  /** A deep link named an event we cannot find. */
  missingKey?: string
  hiddenReason?: string | null
  conflicts: Conflict[]
  actions?: ReactNode
  empty?: ReactNode
  onReveal: () => void
  onSelectItem: (i: CalendarItem) => void
}

const NOT_PROVIDED = <span className="text-ink-muted">Not provided</span>

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mb-3 text-sm text-ink">{children}</dd>
    </>
  )
}

const taskStateText = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  personallyCompleted: 'Personally completed',
} as const

/** Universal event header + provenance (COS-CAL-001 §8). Unknown fields say "Not provided" — never guessed. */
export function DetailsPanel({
  data,
  item,
  missingKey,
  hiddenReason,
  conflicts,
  actions,
  empty,
  onReveal,
  onSelectItem,
}: Props) {
  const queue = useFlag(item?.key ?? '')
  if (missingKey && !item) {
    return (
      <output className="block rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <CalendarX2 className="size-4" aria-hidden="true" /> That record could not be found
        </p>
        <p className="mt-1 text-ink-muted">
          It may have been deleted, or the link may belong to another persona. Nothing was changed.
        </p>
      </output>
    )
  }
  if (!item) {
    return (
      <div className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
        {empty ?? 'Select an event, deadline or task to see its details here.'}
      </div>
    )
  }

  const series = item.seriesId ? data.series.find((s) => s.id === item.seriesId) : undefined
  const course = item.courseId ? data.courses.find((c) => c.id === item.courseId) : undefined
  const showsPeople = item.layer === 'academic' && item.recordKind !== 'deadline'

  return (
    <article aria-label={`Details: ${item.title}`}>
      {hiddenReason ? (
        <output className="mb-3 block rounded-md border border-border-strong bg-mist p-3 text-sm">
          <p className="flex items-center gap-2 font-semibold text-ink">
            <EyeOff className="size-4" aria-hidden="true" /> Hidden by filters
          </p>
          <p className="mt-1 text-ink-muted">{hiddenReason}</p>
          <Button variant="outline" size="sm" className="mt-2 min-h-11" onClick={onReveal}>
            Show this event
          </Button>
          <p className="mt-1 text-xs text-ink-muted">
            Shows it for this visit only; your saved filters are not changed.
          </p>
        </output>
      ) : null}

      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        <CategoryIcon category={item.category} /> {categoryLabel[item.category]}
      </p>
      <h3 className="mt-1 text-lg font-semibold leading-snug text-ink">{item.title}</h3>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <ConfirmationBadge verification={item.verification} />
        <DataModeBadge
          mode={item.provenance.dataMode === 'connected' ? 'provided' : item.provenance.dataMode}
        />
        {item.status === 'cancelled' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-canvas px-2.5 py-1 text-xs font-semibold text-ink">
            <Ban className="size-3.5" aria-hidden="true" /> Cancelled
          </span>
        ) : null}
        {item.status === 'rescheduled' ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-terracotta-tint px-2.5 py-1 text-xs font-semibold text-ink">
            <MoveRight className="size-3.5" aria-hidden="true" /> Moved
          </span>
        ) : null}
      </div>

      {queue ? (
        <section
          aria-label="Process bottleneck"
          className="mt-3 rounded-md border border-border-strong bg-mist p-2.5 text-sm text-ink"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <FlagBadge flag={queue} withText /> · {queue.process}
          </p>
          <p className="mt-1">
            {queue.waitText ? `Typically ${queue.waitText} of waiting. ` : ''}
            {queue.fillText ? `${queue.fillText}. ` : ''}
            {queue.capacityText ? `Holds ${queue.capacityText}.` : ''}
          </p>
          <p className="mt-1">{queue.advice}</p>
          <Link to={queue.link.to} className="mt-1 inline-block font-medium text-coffee underline">
            {queue.link.label}
          </Link>
        </section>
      ) : null}

      {conflicts.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5" aria-label="Schedule overlaps">
          {conflicts.map((c) => {
            const other = c.a.key === item.key ? c.b : c.a
            return (
              <li
                key={other.key}
                className="flex items-start gap-2 rounded-md border border-border-strong bg-terracotta-tint p-2.5 text-sm text-ink"
              >
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>
                  {c.certainty === 'definite'
                    ? 'Overlaps with'
                    : 'May overlap with (one is tentative)'}{' '}
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => onSelectItem(other)}
                  >
                    {other.title}
                  </button>
                  . Nothing was moved or hidden.
                </span>
              </li>
            )
          })}
        </ul>
      ) : null}

      <dl className="mt-4">
        <Row label="When">
          {formatDateLong(item.date)}
          <br />
          {itemTimeText(item)}
        </Row>
        {item.changedFrom ? (
          <Row label="Originally">
            {formatDateLong(item.changedFrom.date)}
            {item.changedFrom.start && item.changedFrom.end
              ? `, ${formatTimeRange(item.changedFrom.start, item.changedFrom.end)}`
              : ''}
          </Row>
        ) : null}
        {item.changeReason ? <Row label="Reason">{item.changeReason}</Row> : null}
        {item.changedFrom || item.status === 'cancelled' ? (
          <Row label="Last update">
            {item.changeUpdatedAt ? item.changeUpdatedAt : 'Last update time not provided'}
          </Row>
        ) : null}
        {series ? <Row label="Repeats">{describeRule(series.rule)}</Row> : null}
        {item.recordKind !== 'birthday' &&
        item.recordKind !== 'task' &&
        item.category !== 'holiday' ? (
          <Row label="Location">{item.location ?? NOT_PROVIDED}</Row>
        ) : null}
        {showsPeople ? <Row label="Instructor">{item.instructor ?? NOT_PROVIDED}</Row> : null}
        {course ? (
          <Row label="Course">
            {course.code} · {course.title}
          </Row>
        ) : null}
        {item.recordKind === 'task' && item.taskState ? (
          <Row label="Your status">
            {taskStateText[item.taskState]}
            <span className="block text-xs text-ink-muted">
              A personal checkmark only: it is not an official submission.
            </span>
          </Row>
        ) : null}
        {item.description ? <Row label="Notes">{item.description}</Row> : null}
        <Row label="Source">
          {item.provenance.sourceLabel ??
            (item.provenance.dataMode === 'userCreated'
              ? 'Created by you on this device'
              : NOT_PROVIDED)}
        </Row>
      </dl>

      {item.manageRoute ? (
        <p className="mt-2 text-sm text-ink-muted">
          Bookings are managed in the Bookings module, which is not built yet. This entry is a
          read-only reference.
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {actions}
        {item.manageRoute ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link to={item.manageRoute}>Manage booking (coming later)</Link>
          </Button>
        ) : null}
        {course && item.layer === 'academic' ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/academics">View course (coming later)</Link>
          </Button>
        ) : null}
      </div>
    </article>
  )
}
