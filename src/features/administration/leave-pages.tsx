import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useCampusData } from '@/hooks/use-campus-data'
import {
  LEAVE_TYPES,
  leaveStatusLabel,
  leaveTypeLabel,
  type Attachment,
  type LeaveRequest,
} from '@/domain/admin'
import { checkLeaveInput, type LeaveInput } from '@/domain/admin-logic'
import {
  formatDateShort,
  formatInstant,
  formatTime,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { classesBetween, leaveHref, ownLeaves } from '@/selectors/admin'
import {
  Empty,
  Loading,
  Pill,
  SectionCard,
  SubNav,
  PersonMinutesScenario,
} from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { AttachmentField, DemoBanner, EMERGENCY_NOTE, StatusPill, Timeline } from './admin-common'
import { useAdmin } from './admin-hooks'
import { adminTabs } from './admin-nav'
import { AdminOps } from './admin-ops'

const PROOF_WARNING =
  'Optional. Only the file’s name and size are kept, never its contents. Do not attach real medical or personal documents to this app.'

const STATUS_TABS: { id: string; label: string; match: (l: LeaveRequest) => boolean }[] = [
  { id: 'all', label: 'All', match: () => true },
  {
    id: 'pending',
    label: 'Pending',
    match: (l) => ['submitted', 'underReview', 'resubmitted'].includes(l.status),
  },
  { id: 'changes', label: 'Changes requested', match: (l) => l.status === 'changesRequested' },
  {
    id: 'accepted',
    label: 'Approved locally',
    match: (l) => ['approvedInDemo', 'gateDepartureLogged', 'gateReturnLogged'].includes(l.status),
  },
  { id: 'rejected', label: 'Rejected', match: (l) => l.status === 'rejected' },
  { id: 'withdrawn', label: 'Withdrawn', match: (l) => l.status === 'withdrawn' },
]

function intervalText(l: Pick<LeaveRequest, 'startDate' | 'startTime' | 'endDate' | 'endTime'>) {
  return l.endDate === l.startDate
    ? `${formatDateShort(l.startDate)}, ${formatTime(l.startTime)}–${formatTime(l.endTime)}`
    : `${formatDateShort(l.startDate)} ${formatTime(l.startTime)} → ${formatDateShort(l.endDate)} ${formatTime(l.endTime)}`
}

export function LeavePage() {
  const { admin, status, profileId, showDemoOps } = useAdmin()
  const [tab, setTab] = useState('all')
  if (status === 'loading' || !admin) return <Loading />
  const mine = ownLeaves(admin, profileId)
  const current = STATUS_TABS.find((t) => t.id === tab)!
  const list = [...mine].filter(current.match).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Leave and out-time"
        description="Ask for time away on this devicenstration and follow a simulated review. A request here is a record in this app only."
        badge={<Pill tone="demo">Demo · not an official permission</Pill>}
      />
      <SubNav label="Administration sections" items={adminTabs} current="leave" />
      <DemoBanner>
        An approval shown here is a simulated step and is never a valid campus leave permission.
      </DemoBanner>
      <div>
        <Button asChild className="min-h-11">
          <Link to="/administration/leave/new">New request</Link>
        </Button>
      </div>
      <SectionCard id="lv-list-h" title={`Your requests (${list.length})`}>
        <fieldset className="mb-2 flex flex-wrap gap-1.5">
          <legend className="sr-only">Filter by status</legend>
          {STATUS_TABS.map((t) => (
            <Button
              key={t.id}
              variant="outline"
              size="sm"
              className="min-h-11"
              aria-pressed={tab === t.id}
              onClick={() => setTab(t.id)}
            >
              {t.label} ({mine.filter(t.match).length})
            </Button>
          ))}
        </fieldset>
        {list.length === 0 ? (
          <Empty>
            {mine.length === 0
              ? 'You have not made any leave requests yet.'
              : 'No requests match this filter. Nothing was deleted.'}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((l) => (
              <li key={l.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {leaveTypeLabel[l.leaveType]} · {intervalText(l)}
                  </span>
                  <StatusPill
                    label={leaveStatusLabel[l.status]}
                    tone={
                      l.status === 'rejected' || l.status === 'changesRequested' ? 'warn' : 'plain'
                    }
                  />
                </div>
                <p className="text-sm text-ink-muted">
                  Private reason · revision {l.revision} · updated {formatInstant(l.updatedAt)}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
                  <Link to={leaveHref(l.id)}>Open request</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <PersonMinutesScenario id="lv-tt-h" noun="office and approver follow-up trips" />
      {showDemoOps ? <AdminOps /> : null}
    </article>
  )
}

/** One form for a new request and for a revision. A refused submit never clears what was typed. */
function LeaveForm({
  initial,
  submitLabel,
  onSubmit,
}: {
  initial?: LeaveRequest
  submitLabel: string
  onSubmit: (input: LeaveInput) => Promise<string | undefined>
}) {
  const { now, newId } = useAdmin()
  const { data } = useCampusData()
  const [type, setType] = useState<LeaveRequest['leaveType']>(initial?.leaveType ?? 'personal')
  const [startDate, setStartDate] = useState<string>(initial?.startDate ?? now.today)
  const [startTime, setStartTime] = useState<string>(initial?.startTime ?? '09:00')
  const [endDate, setEndDate] = useState<string>(initial?.endDate ?? now.today)
  const [endTime, setEndTime] = useState<string>(initial?.endTime ?? '17:00')
  const [reason, setReason] = useState(initial?.reason ?? '')
  const [picked, setPicked] = useState<string[]>(initial?.classesMissed.map((c) => c.key) ?? [])
  const [files, setFiles] = useState<Attachment[]>(initial?.attachments ?? [])
  const [review, setReview] = useState(false)
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)

  const validDates = isDateOnly(startDate) && isDateOnly(endDate)
  const classes = useMemo(
    () =>
      validDates && endDate >= startDate
        ? classesBetween(data, startDate as DateOnly, endDate as DateOnly)
        : [],
    [data, startDate, endDate, validDates],
  )

  const build = (): LeaveInput => ({
    leaveType: type,
    startDate: startDate as DateOnly,
    startTime: startTime as LocalTime,
    endDate: endDate as DateOnly,
    endTime: endTime as LocalTime,
    reason,
    classesMissed: classes.filter((c) => picked.includes(c.key)),
    attachments: files,
  })

  const check = () => {
    if (!validDates) return 'Enter valid departure and return dates.'
    return checkLeaveInput(build()) ?? undefined
  }

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const message = await onSubmit(build())
    setBusy(false)
    if (message) setError(message)
  }

  return (
    <form
      className="flex flex-col gap-3"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!review) {
          const bad = check()
          setError(bad)
          if (!bad) setReview(true)
          return
        }
        void submit()
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Request type"
          hint="These types are examples, not the campus’s official categories."
        >
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              disabled={review}
            >
              {LEAVE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {leaveTypeLabel[t]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <div />
        <Field label="Departure date">
          {(a) => (
            <input
              {...a}
              type="date"
              className={inputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={review}
            />
          )}
        </Field>
        <Field label="Departure time">
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              disabled={review}
            />
          )}
        </Field>
        <Field label="Return date" hint="Use a later date for an overnight request.">
          {(a) => (
            <input
              {...a}
              type="date"
              className={inputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={review}
            />
          )}
        </Field>
        <Field label="Return time">
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              disabled={review}
            />
          )}
        </Field>
      </div>
      <Field
        label="Reason"
        hint="Keep it short. You do not need to share private medical or personal detail."
      >
        {(a) => (
          <textarea
            {...a}
            rows={3}
            maxLength={500}
            className={`${inputClass} py-2`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={review}
          />
        )}
      </Field>

      {type === 'emergency' ? (
        <p
          role="note"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Not an emergency channel.</strong> {EMERGENCY_NOTE}
        </p>
      ) : null}

      <fieldset className="flex flex-col gap-1" disabled={review}>
        <legend className="mb-1 text-sm font-medium">Classes you would miss (optional)</legend>
        {classes.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No classes from your own Calendar fall in this interval. None are invented.
          </p>
        ) : (
          classes.map((c) => (
            <label key={c.key} className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={picked.includes(c.key)}
                onChange={(e) =>
                  setPicked(
                    e.target.checked ? [...picked, c.key] : picked.filter((k) => k !== c.key),
                  )
                }
              />
              {c.title} · {formatDateShort(c.date)}
            </label>
          ))
        )}
        <p className="text-xs text-ink-muted">
          Missing a class does not cancel it. Your Calendar and timetable stay as they are.
        </p>
      </fieldset>

      {!review ? (
        <AttachmentField
          label="Supporting proof (optional)"
          kind="any"
          value={files}
          onChange={setFiles}
          newId={newId}
          warning={PROOF_WARNING}
        />
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm font-medium"
        >
          {error}
        </p>
      ) : null}

      {review ? (
        <div className="rounded-md border border-border bg-coffee-tint p-3 text-sm">
          <p className="font-semibold">Review your local request</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
            <dt className="text-ink-muted">Type</dt>
            <dd>{leaveTypeLabel[type]}</dd>
            <dt className="text-ink-muted">When</dt>
            <dd>
              {intervalText({
                startDate: startDate as DateOnly,
                startTime: startTime as LocalTime,
                endDate: endDate as DateOnly,
                endTime: endTime as LocalTime,
              })}
            </dd>
            <dt className="text-ink-muted">Reason</dt>
            <dd>{reason}</dd>
            <dt className="text-ink-muted">Classes</dt>
            <dd>{picked.length ? `${picked.length} selected` : 'None selected'}</dd>
            <dt className="text-ink-muted">Proof</dt>
            <dd>
              {files.length
                ? `${files.length} descriptor${files.length > 1 ? 's' : ''} (names only)`
                : 'None'}
            </dd>
          </dl>
          <p className="mt-2 text-xs">
            Submitting saves this in the on this device only. It is not received by the university
            and is not a campus permission.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {review ? (
          <>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {submitLabel}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setReview(false)}
            >
              Back to edit
            </Button>
          </>
        ) : (
          <Button type="submit" className="min-h-11">
            Review request
          </Button>
        )}
      </div>
    </form>
  )
}

export function LeaveNewPage() {
  const { repo, profileId, newId } = useAdmin()
  const navigate = useNavigate()
  const [key] = useState(() => newId('idem'))
  const { act } = useAction()
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/administration/leave"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Leave and out-time
      </Link>
      <PageHeader
        title="New leave request"
        description="Fill in the details, review them, then save the request on this device."
        badge={<Pill tone="demo">Demo only</Pill>}
      />
      <DemoBanner />
      <SectionCard id="lv-new-h" title="Request details">
        <LeaveForm
          submitLabel="Submit local request"
          onSubmit={async (input) => {
            const r = await act(
              () => repo.submitLeave(profileId, input, key),
              'Local request saved.',
            )
            if (!r.ok) return r.error.message
            navigate(`/administration/leave/${r.value.leave.id}?submitted=1`)
            return undefined
          }}
        />
      </SectionCard>
    </article>
  )
}

export function LeaveDetailPage() {
  const { requestId } = useParams()
  const { admin, status, profileId, repo } = useAdmin()
  const confirm = useConfirm()
  const { act, message } = useAction()
  const [editing, setEditing] = useState(false)
  const [params] = useSearchParams()
  const justSubmitted = params.get('submitted') === '1'
  if (status === 'loading' || !admin) return <Loading />
  const l = ownLeaves(admin, profileId).find((x) => x.id === requestId)
  if (!l)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Request not found
        </h1>
        <p className="mt-2 text-ink-muted">
          We could not find that request for this persona. It may not exist, or it may belong to
          another profile. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/administration/requests">Back to My requests</Link>
        </Button>
      </div>
    )
  const canEdit = l.status === 'changesRequested' || l.status === 'approvedInDemo'
  const canWithdraw = ['submitted', 'underReview', 'changesRequested', 'resubmitted'].includes(
    l.status,
  )
  const lastReason = [...l.history].reverse().find((h) => h.eventType === 'requestChanges')?.reason

  const withdraw = async () => {
    const c = await confirm({
      title: 'Withdraw this request?',
      description: 'It stays in your history as withdrawn. This cannot be undone.',
      confirmLabel: 'Withdraw request',
      danger: true,
    })
    if (c === 'confirm') await act(() => repo.withdrawLeave(profileId, l.id), 'Request withdrawn.')
  }

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/administration/leave"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Leave and out-time
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {leaveTypeLabel[l.leaveType]} request
          </h1>
          <StatusPill
            label={leaveStatusLabel[l.status]}
            tone={l.status === 'rejected' || l.status === 'changesRequested' ? 'warn' : 'plain'}
          />
        </div>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          Request ID {l.id} · revision {l.revision} · saved {formatInstant(l.createdAt)} · last
          updated {formatInstant(l.updatedAt)}
        </p>
      </div>
      {justSubmitted ? (
        <output className="block rounded-md border border-border-strong bg-coffee-tint p-3 text-sm font-medium">
          Saved on this device as {l.id} at {formatInstant(l.createdAt)}. Status:{' '}
          {leaveStatusLabel[l.status]}. It has not been sent to anyone.
        </output>
      ) : null}
      <DemoBanner>
        {l.status === 'approvedInDemo' ||
        l.status === 'gateDepartureLogged' ||
        l.status === 'gateReturnLogged'
          ? 'This is a simulated approval. It is NOT A VALID GATE PASS.'
          : 'Status changes here are simulated.'}
      </DemoBanner>

      {l.status === 'changesRequested' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Changes requested (simulated).</strong> {lastReason}
        </p>
      ) : null}
      {l.decision?.decision === 'rejected' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Rejected locally:</strong> {l.decision.reason}. This is not an official decision.
        </p>
      ) : null}

      {editing ? (
        <SectionCard
          id="lv-edit-h"
          title={l.status === 'approvedInDemo' ? 'Change an approved request' : 'Edit and resubmit'}
        >
          {l.status === 'approvedInDemo' ? (
            <p className="mb-2 text-sm">
              Changing an approved request creates a new revision and sends it for review again. The
              earlier demo approval no longer applies.
            </p>
          ) : null}
          <LeaveForm
            initial={l}
            submitLabel="Submit new revision"
            onSubmit={async (input) => {
              const r = await act(
                () => repo.reviseLeave(profileId, l.id, input),
                'New revision saved.',
              )
              if (!r.ok) return r.error.message
              setEditing(false)
              return undefined
            }}
          />
        </SectionCard>
      ) : (
        <SectionCard id="lv-det-h" title="Details">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-ink-muted">When</dt>
            <dd>{intervalText(l)}</dd>
            <dt className="text-ink-muted">Reason</dt>
            <dd>{l.reason}</dd>
            <dt className="text-ink-muted">Classes missed</dt>
            <dd>
              {l.classesMissed.length
                ? l.classesMissed.map((c) => `${c.title} (${formatDateShort(c.date)})`).join(', ')
                : 'None selected'}
            </dd>
            <dt className="text-ink-muted">Proof</dt>
            <dd>
              {l.attachments.length
                ? l.attachments.map((a) => a.displayName).join(', ') + ' (names only)'
                : 'None'}
            </dd>
            <dt className="text-ink-muted">Gate (simulated)</dt>
            <dd>
              {l.gate.departedAt
                ? `Departure logged ${formatInstant(l.gate.departedAt)}`
                : 'No departure logged'}
              {l.gate.returnedAt ? ` · Return logged ${formatInstant(l.gate.returnedAt)}` : ''}
            </dd>
          </dl>
          <p className="mt-2 text-xs text-ink-muted">
            The classes list is a snapshot from when you submitted. If your timetable changes later,
            this record keeps what you saw then, and your Calendar is never changed by a request.
          </p>
        </SectionCard>
      )}

      <SectionCard id="lv-tl-h" title="Timeline">
        <Timeline events={l.history} />
        {l.revisions.length > 1 ? (
          <p className="mt-2 text-xs text-ink-muted">
            {l.revisions.length} revisions are kept. Earlier ones are never overwritten.
          </p>
        ) : null}
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        {canEdit && !editing ? (
          <Button className="min-h-11" onClick={() => setEditing(true)}>
            {l.status === 'approvedInDemo' ? 'Request a change' : 'Edit and resubmit'}
          </Button>
        ) : null}
        {editing ? (
          <Button variant="outline" className="min-h-11" onClick={() => setEditing(false)}>
            Cancel editing
          </Button>
        ) : null}
        {canWithdraw ? (
          <Button variant="outline" className="min-h-11" onClick={() => void withdraw()}>
            Withdraw request
          </Button>
        ) : null}
      </div>
      <output className="block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
    </article>
  )
}
