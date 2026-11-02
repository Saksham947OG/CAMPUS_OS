import { ArrowLeft } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useCampusData } from '@/hooks/use-campus-data'
import {
  ASSET_TYPES,
  CATEGORIES,
  assetLabel,
  categoryLabel,
  ticketStatusLabel,
  type Attachment,
  type Ticket,
} from '@/domain/admin'
import { formatInstant } from '@/lib/time'
import {
  demoDurationMinutes,
  earlierTeachingReports,
  ownTickets,
  similarOpenTickets,
  ticketHref,
  timetableRooms,
} from '@/selectors/admin'
import {
  Empty,
  Loading,
  Pill,
  PersonMinutesScenario,
  SectionCard,
  SubNav,
} from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import type { EvidenceMeta } from '@/domain/evidence'
import { EvidencePicker, EvidencePreview } from '../help/report-page'
import { AttachmentField, DemoBanner, EMERGENCY_NOTE, StatusPill, Timeline } from './admin-common'
import { useAdmin } from './admin-hooks'
import { adminTabs } from './admin-nav'
import { AdminOps } from './admin-ops'

const PHOTO_WARNING =
  'Optional. Only the image’s name, type and size are kept, never the picture itself. Use a PNG, JPEG or WebP up to 2 MB.'

function TicketList({ kind, current }: { kind: 'complaint' | 'teachingAid'; current: string }) {
  const { admin, status, profileId, showDemoOps } = useAdmin()
  if (status === 'loading' || !admin) return <Loading />
  const mine = ownTickets(admin, profileId).filter((t) => t.kind === kind)
  const isTeaching = kind === 'teachingAid'
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title={isTeaching ? 'Classroom equipment' : 'Complaint tracker'}
        description={
          isTeaching
            ? 'Report a faulty projector, microphone, air conditioner or smartboard and follow a simulated repair. It uses the same ticket engine as facility complaints.'
            : 'Report a facility issue and follow a simulated response. A ticket here is a record in this app only.'
        }
        badge={<Pill tone="demo">Demo · not a real work order</Pill>}
      />
      <SubNav label="Administration sections" items={adminTabs} current={current} />
      <DemoBanner>
        No response time is promised and no team has been told.{' '}
        <strong>Not for emergencies.</strong> {EMERGENCY_NOTE}
      </DemoBanner>
      <div>
        <Button asChild className="min-h-11">
          <Link
            to={isTeaching ? '/administration/teaching-aids/new' : '/administration/complaints/new'}
          >
            {isTeaching ? 'Report equipment' : 'Report a facility issue'}
          </Link>
        </Button>
      </div>
      <SectionCard
        id="tk-list-h"
        title={`Your ${isTeaching ? 'equipment reports' : 'tickets'} (${mine.length})`}
      >
        {mine.length === 0 ? (
          <Empty>
            {isTeaching
              ? 'You have not reported any equipment faults.'
              : 'You have not reported any facility issues.'}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">
                    {isTeaching && t.teaching
                      ? `${assetLabel[t.teaching.assetType]}, ${t.teaching.classroomReference}`
                      : `${categoryLabel[t.category]}${t.location ? `, ${t.location}` : ''}`}
                  </span>
                  <StatusPill
                    label={ticketStatusLabel[t.status]}
                    tone={t.status === 'reopened' ? 'warn' : 'plain'}
                  />
                </div>
                <p className="text-sm text-ink-muted">
                  Reported {formatInstant(t.createdAt)} · last updated {formatInstant(t.updatedAt)}
                </p>
                <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
                  <Link to={ticketHref(t)}>Open ticket</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <PersonMinutesScenario
        id="tk-tt-h"
        noun={
          isTeaching ? 'classroom disruption and follow-ups' : 'status-checking trips and calls'
        }
      />
      {showDemoOps ? <AdminOps /> : null}
    </article>
  )
}

export const ComplaintsPage = () => <TicketList kind="complaint" current="complaints" />
export const TeachingAidsPage = () => <TicketList kind="teachingAid" current="teaching" />

function NewTicketPage({ kind }: { kind: 'complaint' | 'teachingAid' }) {
  const { admin, profileId, repo, newId, now } = useAdmin()
  const { data } = useCampusData()
  const navigate = useNavigate()
  const { act } = useAction()
  const isTeaching = kind === 'teachingAid'
  const [key] = useState(() => newId('idem'))
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('plumbing')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'normal' | 'urgent'>('normal')
  const [files, setFiles] = useState<Attachment[]>([])
  const [evidence, setEvidence] = useState<EvidenceMeta[]>([])
  const [classroom, setClassroom] = useState('')
  const [asset, setAsset] = useState<(typeof ASSET_TYPES)[number]>('projector')
  const [device, setDevice] = useState('')
  const [impact, setImpact] = useState<'' | 'none' | 'delayed' | 'disrupted'>('')
  const [error, setError] = useState<string>()
  const [busy, setBusy] = useState(false)
  const rooms = useMemo(() => timetableRooms(data, now.today), [data, now.today])

  const similar =
    admin && !isTeaching ? similarOpenTickets(admin, profileId, category, location) : []

  const submit = async () => {
    if (busy) return
    setBusy(true)
    const r = await act(
      () =>
        repo.submitTicket(
          profileId,
          {
            kind,
            category: isTeaching ? 'other' : category,
            description,
            ...(isTeaching ? { location: classroom } : { location }),
            locationSource: isTeaching
              ? rooms.includes(classroom)
                ? 'timetable'
                : 'selfReported'
              : 'selfReported',
            reportedSeverity: severity,
            attachments: files,
            ...(evidence.length ? { evidence } : {}),
            ...(isTeaching
              ? {
                  teaching: {
                    classroomReference: classroom,
                    classroomSource: rooms.includes(classroom)
                      ? ('timetable' as const)
                      : ('selfReported' as const),
                    assetType: asset,
                    ...(device.trim() ? { deviceIdentifier: device.trim() } : {}),
                    ...(impact ? { classImpact: impact } : {}),
                  },
                }
              : {}),
          },
          key,
        ),
      'Ticket recorded on this device.',
    )
    setBusy(false)
    if (!r.ok) {
      setError(r.error.message)
      return
    }
    navigate(`${ticketHref(r.value.ticket)}?submitted=1`)
  }

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to={isTeaching ? '/administration/teaching-aids' : '/administration/complaints'}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />{' '}
        {isTeaching ? 'Classroom equipment' : 'Complaint tracker'}
      </Link>
      <PageHeader
        title={isTeaching ? 'Report teaching equipment' : 'Report a facility issue'}
        badge={<Pill tone="demo">Demo only</Pill>}
      />
      <DemoBanner>
        <strong>Not for emergencies.</strong> {EMERGENCY_NOTE}
      </DemoBanner>
      <SectionCard id="tk-new-h" title="What is wrong?">
        <form
          className="flex flex-col gap-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            setError(undefined)
            void submit()
          }}
        >
          {isTeaching ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Classroom"
                hint={
                  rooms.length
                    ? 'Pick one from your timetable or type your own. Typed rooms are marked self-reported.'
                    : 'No room list is supplied, so type it. It is marked self-reported.'
                }
              >
                {(a) => (
                  <>
                    <input
                      {...a}
                      list="rooms"
                      className={inputClass}
                      value={classroom}
                      onChange={(e) => setClassroom(e.target.value)}
                      maxLength={80}
                    />
                    <datalist id="rooms">
                      {rooms.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </datalist>
                  </>
                )}
              </Field>
              <Field label="Equipment type">
                {(a) => (
                  <select
                    {...a}
                    className={inputClass}
                    value={asset}
                    onChange={(e) => setAsset(e.target.value as typeof asset)}
                  >
                    {ASSET_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {assetLabel[t]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Device label (optional)">
                {(a) => (
                  <input
                    {...a}
                    className={inputClass}
                    maxLength={40}
                    value={device}
                    onChange={(e) => setDevice(e.target.value)}
                  />
                )}
              </Field>
              <Field
                label="Effect on class (optional)"
                hint="What you saw. It is your own report, not measured minutes lost."
              >
                {(a) => (
                  <select
                    {...a}
                    className={inputClass}
                    value={impact}
                    onChange={(e) => setImpact(e.target.value as typeof impact)}
                  >
                    <option value="">Not stated</option>
                    <option value="none">No effect on class</option>
                    <option value="delayed">Class was delayed</option>
                    <option value="disrupted">Class was disrupted</option>
                  </select>
                )}
              </Field>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Category">
                {(a) => (
                  <select
                    {...a}
                    className={inputClass}
                    value={category}
                    onChange={(e) => setCategory(e.target.value as typeof category)}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {categoryLabel[c]}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field
                label="Location (optional)"
                hint="No campus room list is supplied, so what you type is marked self-reported."
              >
                {(a) => (
                  <input
                    {...a}
                    className={inputClass}
                    maxLength={80}
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                )}
              </Field>
            </div>
          )}
          <Field label="Description">
            {(a) => (
              <textarea
                {...a}
                rows={3}
                maxLength={500}
                className={`${inputClass} py-2`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">How urgent does it seem to you?</legend>
            <div className="flex flex-wrap gap-4">
              {(['normal', 'urgent'] as const).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="severity"
                    className="size-5"
                    checked={severity === v}
                    onChange={() => setSeverity(v)}
                  />
                  {v === 'normal' ? 'Normal' : 'Urgent (my view)'}
                </label>
              ))}
            </div>
            <p className="text-xs text-ink-muted">
              This is your view only. It does not set an official priority or a response time.
            </p>
          </fieldset>
          <AttachmentField
            label="Photo (optional)"
            kind="image"
            value={files}
            onChange={setFiles}
            newId={newId}
            warning={PHOTO_WARNING}
          />
          <EvidencePicker value={evidence} onChange={setEvidence} />
          {similar.length > 0 ? (
            <p role="note" className="rounded-md bg-mist p-3 text-sm">
              You already have a similar open ticket here:{' '}
              {similar.map((t) => (
                <Link key={t.id} to={ticketHref(t)} className="font-medium text-coffee underline">
                  {categoryLabel[t.category]}, reported {formatInstant(t.createdAt)}
                </Link>
              ))}
              . You can still submit this one; nothing is merged for you.
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm font-medium"
            >
              {error}
            </p>
          ) : null}
          <div>
            <Button type="submit" className="min-h-11" disabled={busy}>
              {isTeaching ? 'Submit equipment report' : 'Submit demo ticket'}
            </Button>
          </div>
        </form>
      </SectionCard>
    </article>
  )
}

export const ComplaintNewPage = () => <NewTicketPage kind="complaint" />
export const TeachingAidNewPage = () => <NewTicketPage kind="teachingAid" />

export function TicketDetailPage() {
  const { ticketId } = useParams()
  const { admin, status, profileId, repo } = useAdmin()
  const confirm = useConfirm()
  const { act, message } = useAction()
  const [reopening, setReopening] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string>()
  if (status === 'loading' || !admin) return <Loading />
  const t: Ticket | undefined = ownTickets(admin, profileId).find((x) => x.id === ticketId)
  if (!t)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Ticket not found
        </h1>
        <p className="mt-2 text-ink-muted">
          We could not find that ticket for this persona. It may not exist, or it may belong to
          another profile. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/administration/requests">Back to My requests</Link>
        </Button>
      </div>
    )
  const teaching = t.kind === 'teachingAid'
  const earlier = earlierTeachingReports(admin, profileId, t)
  const canCancel = t.status === 'submitted' || t.status === 'assigned'
  const solveMinutes = demoDurationMinutes(t, 'submitted', 'resolve')

  const cancel = async () => {
    const c = await confirm({
      title: 'Cancel this ticket?',
      description: 'It stays in your history as cancelled.',
      confirmLabel: 'Cancel ticket',
      danger: true,
    })
    if (c === 'confirm')
      await act(() => repo.ticketAct(t.id, 'cancel', 'student', { profileId }), 'Ticket cancelled.')
  }
  const reopen = async () => {
    if (!reason.trim()) {
      setReasonError('Say what is still wrong so the history makes sense')
      return
    }
    setReasonError(undefined)
    const r = await act(
      () => repo.ticketAct(t.id, 'reopen', 'student', { profileId, reason }),
      'Reopened on the same ticket.',
    )
    if (r.ok) {
      setReopening(false)
      setReason('')
    }
  }

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to={teaching ? '/administration/teaching-aids' : '/administration/complaints'}
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />{' '}
        {teaching ? 'Classroom equipment' : 'Complaint tracker'}
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {teaching && t.teaching
              ? `${assetLabel[t.teaching.assetType]} report`
              : `${categoryLabel[t.category]} ticket`}
          </h1>
          <StatusPill
            label={ticketStatusLabel[t.status]}
            tone={t.status === 'reopened' ? 'warn' : 'plain'}
          />
        </div>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          Ticket ID {t.id} · reported {formatInstant(t.createdAt)} · last updated{' '}
          {formatInstant(t.updatedAt)}
        </p>
      </div>
      <DemoBanner>Assignment and progress are simulated. {EMERGENCY_NOTE}</DemoBanner>
      {t.status === 'resolvedInDemo' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-coffee-tint p-3 text-sm"
        >
          <strong>Marked resolved (simulated).</strong> Please confirm it is sorted, or reopen it if
          it is not.
        </p>
      ) : null}

      <SectionCard id="tk-det-h" title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          {teaching && t.teaching ? (
            <>
              <dt className="text-ink-muted">Classroom</dt>
              <dd>
                {t.teaching.classroomReference}{' '}
                <span className="text-ink-muted">
                  (
                  {t.teaching.classroomSource === 'timetable'
                    ? 'from your timetable'
                    : 'self-reported'}
                  )
                </span>
              </dd>
              <dt className="text-ink-muted">Equipment</dt>
              <dd>
                {assetLabel[t.teaching.assetType]}
                {t.teaching.deviceIdentifier ? ` · ${t.teaching.deviceIdentifier}` : ''}
              </dd>
              {t.teaching.classImpact ? (
                <>
                  <dt className="text-ink-muted">Effect on class</dt>
                  <dd>
                    {
                      {
                        none: 'No effect',
                        delayed: 'Class was delayed',
                        disrupted: 'Class was disrupted',
                      }[t.teaching.classImpact]
                    }{' '}
                    <span className="text-ink-muted">(your own report, not measured)</span>
                  </dd>
                </>
              ) : null}
              <dt className="text-ink-muted">Earlier reports</dt>
              <dd>
                {earlier} earlier {earlier === 1 ? 'report' : 'reports'} of this equipment from you.
                No campus maintenance history is available.
              </dd>
            </>
          ) : (
            <>
              <dt className="text-ink-muted">Category</dt>
              <dd>{categoryLabel[t.category]}</dd>
              <dt className="text-ink-muted">Location</dt>
              <dd>{t.location ? `${t.location} (self-reported)` : 'Not given'}</dd>
            </>
          )}
          <dt className="text-ink-muted">Problem</dt>
          <dd>{t.description}</dd>
          <dt className="text-ink-muted">Student reported</dt>
          <dd>{t.reportedSeverity === 'urgent' ? 'Urgent (your view)' : 'Normal'}</dd>
          <dt className="text-ink-muted">Demo assigned priority</dt>
          <dd>{t.demoPriority ?? 'Not assigned'}</dd>
          <dt className="text-ink-muted">Team</dt>
          <dd>{t.teamLabel ?? 'Team not assigned'}</dd>
          <dt className="text-ink-muted">Response time</dt>
          <dd>
            {t.demoTargetHours
              ? `Demo target: ${t.demoTargetHours} hours (not an SLA)`
              : 'No response target has been provided. CampusOS shows no SLA.'}
          </dd>
          <dt className="text-ink-muted">Photos</dt>
          <dd>
            {t.attachments.length
              ? t.attachments.map((a) => a.displayName).join(', ') + ' (names only)'
              : 'None'}
          </dd>
          <dt className="text-ink-muted">Photo or video evidence</dt>
          <dd>
            {t.evidence?.length ? (
              <span className="flex flex-col gap-2">
                {t.evidence.map((m) => (
                  <EvidencePreview key={m.id} meta={m} />
                ))}
                <span className="text-xs text-ink-muted">
                  Saved on this device only. It was not sent to any team.
                </span>
              </span>
            ) : (
              'None'
            )}
          </dd>
        </dl>
        {solveMinutes !== null ? (
          <p className="mt-2 text-xs text-ink-muted">
            Demo timing: marked resolved {solveMinutes} minutes after it was reported. This comes
            from simulator clicks, not from any campus performance.
          </p>
        ) : null}
      </SectionCard>

      <SectionCard id="tk-tl-h" title="Timeline">
        <Timeline events={t.history} />
      </SectionCard>

      {reopening ? (
        <SectionCard id="tk-reopen-h" title="Reopen this ticket">
          <form
            className="flex flex-col gap-2"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void reopen()
            }}
          >
            <Field label="What is still wrong?" error={reasonError}>
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={300}
                  className={`${inputClass} py-2`}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
            </Field>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-11">
                Reopen ticket
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setReopening(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </SectionCard>
      ) : (
        <div className="flex flex-wrap gap-2">
          {t.status === 'resolvedInDemo' ? (
            <>
              <Button
                className="min-h-11"
                onClick={() =>
                  void act(
                    () => repo.ticketAct(t.id, 'acknowledge', 'student', { profileId }),
                    'Closed on this device.',
                  )
                }
              >
                It is sorted: close ticket
              </Button>
              <Button variant="outline" className="min-h-11" onClick={() => setReopening(true)}>
                It is not fixed: reopen
              </Button>
            </>
          ) : null}
          {canCancel ? (
            <Button variant="outline" className="min-h-11" onClick={() => void cancel()}>
              Cancel ticket
            </Button>
          ) : null}
        </div>
      )}
      <output className="block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
    </article>
  )
}
