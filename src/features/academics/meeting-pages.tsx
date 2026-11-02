import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/confirm-context'
import { TOPICS, type Meeting, type MeetingActorKind } from '@/domain/academics'
import { useCampusData } from '@/hooks/use-campus-data'
import {
  formatDateShort,
  formatInstant,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { conflictsForSlot } from '@/selectors/conflicts'
import { itemsOnDate } from '@/selectors/occurrences'
import { isOpenMeeting, meetingWith, myMeetings, openWindows } from '@/selectors/academics'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { BackLink, DemoNotice, MeetingStatusPill } from './academics-common'
import { academicsTabs } from './academics-nav'
import { useAcademics } from './academics-hooks'
import { AcademicsOps } from './academics-ops'

export function FacultyDirectoryPage() {
  const { academics, status } = useAcademics()
  const [q, setQ] = useState('')
  if (status === 'loading' || !academics) return <Loading />
  const shown = academics.faculty.filter((f) =>
    f.displayName.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Faculty Connect"
        description="Faculty names come from supplied documents; office hours and meeting windows are not supplied. Presence is never shown: nothing here says someone is in their office."
        badge={<Pill tone="demo">Local · fictional people</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="faculty" />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Search faculty">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-64`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </Field>
        <Link
          to="/academics/faculty/appointments"
          className="min-h-11 py-2 font-medium text-coffee underline"
        >
          My faculty meetings
        </Link>
      </div>
      {shown.length === 0 ? (
        <Empty>No faculty profile matches.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((f) => (
            <li key={f.id}>
              <Link
                to={`/academics/faculty/${f.id}`}
                className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
              >
                <span className="text-base font-semibold text-ink">{f.displayName}</span>
                <span className="text-sm text-ink-muted">
                  Office hours: {f.officeHoursText ?? 'not provided'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function FacultyProfilePage() {
  const { facultyId = '' } = useParams()
  const { academics, status, now } = useAcademics()
  if (status === 'loading' || !academics) return <Loading />
  const f = academics.faculty.find((x) => x.id === facultyId)
  if (!f)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Faculty profile not found" />
        <Empty>
          <Link to="/academics/faculty" className="underline">
            Back to Faculty Connect
          </Link>
        </Empty>
      </article>
    )
  const windows = openWindows(academics, 'faculty', f.id, now.ms)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={f.displayName} badge={<Pill tone="demo">Local · fictional person</Pill>} />
      <BackLink to="/academics/faculty">Back to Faculty Connect</BackLink>
      <SectionCard id="fp-info-h" title="Profile">
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Office hours</dt>
            <dd>{f.officeHoursText ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Location</dt>
            <dd>{f.locationText ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Source</dt>
            <dd>{f.sourceLabel}</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard
        id="fp-win-h"
        title="Published sample windows"
        action={
          <Link
            to={`/academics/faculty/appointments/new?actor=${f.id}`}
            className="min-h-11 py-2 font-medium text-coffee underline"
          >
            Request a meeting
          </Link>
        }
      >
        {windows.length === 0 ? (
          <Empty>
            No window is published.{' '}
            {academics.config.allowProposals
              ? 'You can still propose a time in the request form.'
              : 'Proposing a time is switched off.'}
          </Empty>
        ) : (
          <ul className="list-disc pl-5">
            {windows.map((w) => (
              <li key={w.id}>
                {formatDateShort(w.date)} {w.start}–{w.end}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </article>
  )
}

function MeetingList({
  kind,
  title,
  newTo,
  current,
}: {
  kind: MeetingActorKind
  title: string
  newTo: string
  current: string
}) {
  const { academics, status, profileId, showDemoOps } = useAcademics()
  if (status === 'loading' || !academics) return <Loading />
  const rows = myMeetings(academics, profileId, kind)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title={title}
        badge={<Pill tone="demo">Local · recorded on this device only</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current={current} />
      <div>
        <Button asChild className="min-h-11">
          <Link to={newTo}>New request</Link>
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty>You have no requests yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3"
            >
              <Link
                to={`/academics/appointments/${m.id}`}
                className="font-medium text-coffee underline"
              >
                {meetingWith(academics, m)} · {formatDateShort(m.date)} {m.start}–{m.end}
              </Link>
              <MeetingStatusPill status={m.status} />
            </li>
          ))}
        </ul>
      )}
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}

export const FacultyMeetingsPage = () => (
  <MeetingList
    kind="faculty"
    title="My faculty meetings"
    newTo="/academics/faculty/appointments/new"
    current="faculty"
  />
)
export const OfficeMeetingsPage = () => (
  <MeetingList
    kind="office"
    title="My BMS Office requests"
    newTo="/academics/office/appointments/new"
    current="office"
  />
)

/** One form for faculty and the office: both use the shared meeting engine, only the actor kind differs. */
export function MeetingNewPage({ kind }: { kind: MeetingActorKind }) {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { academics, status, profileId, now, repo, newId } = useAcademics()
  const { data } = useCampusData()
  const { act, message } = useAction()
  const [key] = useState(() => newId('idem'))
  const [actor, setActor] = useState(params.get('actor') ?? '')
  const [slot, setSlot] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const groupId = params.get('group') ?? undefined
  const [topic, setTopic] = useState<Meeting['topic']>(groupId ? 'Project guidance' : TOPICS[0])
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const actorId = kind === 'office' ? (academics?.office.id ?? '') : actor
  const windows = academics ? openWindows(academics, kind, actorId, now.ms) : []
  const chosen = windows.find((w) => w.id === slot)
  const when =
    chosen ?? (isDateOnly(date) && start && end ? { date: date as DateOnly, start, end } : null)
  const clashes =
    data && when ? conflictsForSlot(itemsOnDate(data, when.date as DateOnly), when) : []
  if (status === 'loading' || !academics) return <Loading />
  const title = kind === 'office' ? 'New BMS Office request' : 'New faculty meeting request'
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={title} badge={<Pill tone="demo">Local · not delivered to anyone</Pill>} />
      <BackLink to={kind === 'office' ? '/academics/office' : '/academics/faculty'}>Back</BackLink>
      <DemoNotice>
        Submitting records a request on this device. It is not an appointment until the local
        simulator accepts it, and nothing is sent to a real person or office.
      </DemoNotice>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          setError('')
          if (!actorId)
            return setError(
              kind === 'office' ? 'The office was not found.' : 'Choose a faculty member.',
            )
          if (!slot && !(isDateOnly(date) && start && end))
            return setError(
              academics.config.allowProposals
                ? 'Choose a published window, or enter a date and times to propose.'
                : 'Choose a published window.',
            )
          const r = await act(
            () =>
              repo.submitMeeting(
                profileId,
                {
                  actorKind: kind,
                  actorId,
                  topic,
                  note,
                  ...(groupId ? { groupId } : {}),
                  ...(slot
                    ? { slotId: slot }
                    : { date: date as DateOnly, start: start as LocalTime, end: end as LocalTime }),
                },
                key,
              ),
            'Request recorded on this device.',
          )
          if (r.ok) nav(`/academics/appointments/${r.value.meeting.id}`)
          else setError(r.error.message)
        }}
      >
        {kind === 'faculty' ? (
          <Field label="Faculty member">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={actor}
                onChange={(e) => {
                  setActor(e.target.value)
                  setSlot('')
                }}
              >
                <option value="">Choose…</option>
                {academics.faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName}
                  </option>
                ))}
              </select>
            )}
          </Field>
        ) : (
          <p className="text-sm">To: {academics.office.name}</p>
        )}
        <Field label="Published sample window">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
            >
              <option value="">
                {windows.length ? 'None (propose a time below)' : 'None published'}
              </option>
              {windows.map((w) => (
                <option key={w.id} value={w.id}>
                  {formatDateShort(w.date)} {w.start}–{w.end}
                </option>
              ))}
            </select>
          )}
        </Field>
        {academics.config.allowProposals && !slot ? (
          <div className="flex flex-wrap gap-3">
            <Field label="Proposed date">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  className={inputClass}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="Start">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={inputClass}
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
            <Field label="End">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={inputClass}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              )}
            </Field>
          </div>
        ) : null}
        {clashes.length > 0 ? (
          <p
            role="alert"
            className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
          >
            This overlaps {clashes.map((c) => c.title).join(', ')}. You can still send the request;
            nothing on your Calendar is moved.
          </p>
        ) : null}
        <Field label="Topic">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={topic}
              onChange={(e) => setTopic(e.target.value as Meeting['topic'])}
            >
              {TOPICS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Note (optional, up to 300 characters)">
          {(a) => (
            <textarea
              {...a}
              rows={3}
              maxLength={300}
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}
        </Field>
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <output aria-live="polite" className="sr-only">
          {message}
        </output>
        <Button type="submit" className="min-h-11 self-start">
          Record request locally
        </Button>
      </form>
    </article>
  )
}

export const FacultyNewPage = () => <MeetingNewPage kind="faculty" />
export const OfficeNewPage = () => <MeetingNewPage kind="office" />

export function OfficePage() {
  const { academics, status, now, showDemoOps } = useAcademics()
  if (status === 'loading' || !academics) return <Loading />
  const o = academics.office
  const windows = openWindows(academics, 'office', o.id, now.ms)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="BMS Office"
        description="A fictional office. This page does not change leave approvals or campus access."
        badge={<Pill tone="demo">Illustrative data office</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="office" />
      <SectionCard id="of-info-h" title={o.name}>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Hours</dt>
            <dd>{o.hoursText ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Location</dt>
            <dd>{o.locationText ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Topics</dt>
            <dd>{o.topics.join(', ')}</dd>
          </div>
          <div>
            <dt className="font-medium">Contact</dt>
            <dd>Not provided on this device</dd>
          </div>
        </dl>
      </SectionCard>
      <SectionCard
        id="of-win-h"
        title="Sample requestable windows"
        action={
          <Link
            to="/academics/office/appointments/new"
            className="min-h-11 py-2 font-medium text-coffee underline"
          >
            Request an appointment
          </Link>
        }
      >
        {windows.length === 0 ? (
          <Empty>No window is published.</Empty>
        ) : (
          <ul className="list-disc pl-5">
            {windows.map((w) => (
              <li key={w.id}>
                {formatDateShort(w.date)} {w.start}–{w.end} (up to {w.capacity})
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2">
          <Link to="/academics/office/appointments" className="underline">
            My BMS Office requests
          </Link>
        </p>
      </SectionCard>
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}

export function MeetingDetailPage() {
  const { requestId = '' } = useParams()
  const { academics, status, profileId, repo, showDemoOps } = useAcademics()
  const { act, message } = useAction()
  const confirm = useConfirm()
  if (status === 'loading' || !academics) return <Loading />
  const m = academics.meetings.find((x) => x.id === requestId && x.ownerProfileId === profileId)
  if (!m)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Request not found" />
        <Empty>
          This request is not in your records.{' '}
          <Link to="/academics" className="underline">
            Back to Academics
          </Link>
        </Empty>
      </article>
    )
  const step = async (
    action: 'withdraw' | 'acceptAlternative' | 'declineAlternative' | 'requestCancellation',
    done: string,
    ask?: string,
  ) => {
    if (ask) {
      const c = await confirm({
        title: ask,
        description: <p>Your request history is kept.</p>,
        confirmLabel: 'Yes, continue',
      })
      if (c !== 'confirm') return
    }
    await act(() => repo.studentAct(profileId, m.id, action, m.statusVersion), done)
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={`Meeting with ${meetingWith(academics, m)}`}
        badge={<Pill tone="demo">Local · not an official appointment</Pill>}
      />
      <BackLink
        to={
          m.actorKind === 'office'
            ? '/academics/office/appointments'
            : '/academics/faculty/appointments'
        }
      >
        Back to my requests
      </BackLink>
      <SectionCard id="md-sum-h" title="Request" action={<MeetingStatusPill status={m.status} />}>
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">When</dt>
            <dd>
              {formatDateShort(m.date)} {m.start}–{m.end}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Topic</dt>
            <dd>{m.topic}</dd>
          </div>
          <div>
            <dt className="font-medium">Your note</dt>
            <dd>{m.note ?? 'None'}</dd>
          </div>
          <div>
            <dt className="font-medium">State version</dt>
            <dd>{m.statusVersion}</dd>
          </div>
        </dl>
        {m.alternative ? (
          <p className="mt-3 rounded-md border border-border-strong bg-mist p-3">
            Alternative proposed (simulated): {formatDateShort(m.alternative.date)}{' '}
            {m.alternative.start}–{m.alternative.end}. Your original time stays as it is until you
            accept.
          </p>
        ) : null}
        <output aria-live="polite" className="mt-2 block min-h-5 font-medium">
          {message}
        </output>
        <div className="mt-3 flex flex-wrap gap-2">
          {m.status === 'alternativeProposed' ? (
            <>
              <Button
                className="min-h-11"
                onClick={() =>
                  void step(
                    'acceptAlternative',
                    'Alternative accepted, awaiting demo confirmation.',
                  )
                }
              >
                Accept alternative
              </Button>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void step('declineAlternative', 'Request ended.')}
              >
                Decline alternative
              </Button>
            </>
          ) : null}
          {['requested', 'alternativeProposed', 'alternativeAccepted'].includes(m.status) ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void step('withdraw', 'Request withdrawn.', 'Withdraw this request?')}
            >
              Withdraw request
            </Button>
          ) : null}
          {m.status === 'acceptedDemo' ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void step(
                  'requestCancellation',
                  'Cancellation requested.',
                  'Ask to cancel this accepted meeting?',
                )
              }
            >
              Request cancellation
            </Button>
          ) : null}
          {!isOpenMeeting(m) ? (
            <p className="text-ink-muted">This request is finished. It stays in your history.</p>
          ) : null}
        </div>
      </SectionCard>
      <SectionCard id="md-hist-h" title="History">
        <ol className="flex flex-col gap-1">
          {m.history.map((h) => (
            <li key={h.id}>
              {formatInstant(h.at)} ·{' '}
              {h.actorType === 'student' ? 'You' : `Simulated role (${h.actorType})`} ·{' '}
              {h.eventType}
              {h.reason ? ` · ${h.reason}` : ''}
            </li>
          ))}
        </ol>
      </SectionCard>
      <DemoNotice>
        In-app only. No email, push or message was sent to anyone about this request.
      </DemoNotice>
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}
