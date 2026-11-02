import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { clash } from '@/domain/availability'
import { rsvpLabel, voteLabel, VOTES, type Rsvp, type Vote } from '@/domain/meetings'
import { tally } from '@/domain/meetings-logic'
import { formatDateShort, formatInstant, type DateOnly, type LocalTime } from '@/lib/time'
import { roomStateOf } from '@/selectors/availability'
import { instantMs } from '@/selectors/now'
import { Empty, Loading, Pill, SectionCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useMeetings } from './meeting-hooks'

const roomText = {
  none: 'No room',
  confirmed: 'Room reserved (local)',
  pending: 'Room requested, not reserved',
  notConfirmed: 'Room not confirmed',
} as const

export function MeetingPage() {
  const { meetingId = '' } = useParams()
  const { meetings, rooms, status, profileId, profiles, repo } = useMeetings()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [error, setError] = useState('')
  if (status === 'loading' || !meetings) return <Loading />
  const m = meetings.meetings.find(
    (x) => x.id === meetingId && x.attendees.some((a) => a.profileId === profileId),
  )
  const name = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? id
  if (!m)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Meeting not found" />
        <Empty>
          This meeting is not in your invitations.{' '}
          <Link to="/calendar" className="underline">
            Back to Calendar
          </Link>
        </Empty>
      </article>
    )
  const mine = m.attendees.find((a) => a.profileId === profileId)!
  const organizer = m.organizerProfileId === profileId
  const room = roomStateOf(m, rooms)
  const open = m.status === 'CONFIRMED'
  const reply = (r: Exclude<Rsvp, 'INVITED'>) =>
    void act(() => repo.respond(profileId, m.id, r), 'Reply recorded on this device.')
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={m.title} badge={<Pill tone="demo">Local · local meeting</Pill>} />
      <p className="flex flex-wrap gap-3 text-sm font-medium text-coffee">
        <Link to={`/calendar?view=agenda&date=${m.date}`} className="underline">
          Open in Calendar
        </Link>
        {m.roomReservationId ? (
          <Link to="/bookings/my" className="underline">
            View My bookings
          </Link>
        ) : null}
      </p>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard
        id="mt-sum-h"
        title="Meeting"
        action={
          <Pill tone={m.status === 'CANCELLED' ? 'warn' : 'plain'}>
            {m.status === 'CANCELLED'
              ? 'Cancelled'
              : room === 'pending'
                ? 'Time set · room requested'
                : 'Confirmed time'}
          </Pill>
        }
      >
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium">When</dt>
            <dd>
              {formatDateShort(m.date)}, {m.start}–{m.end} (Asia/Kolkata)
            </dd>
          </div>
          <div>
            <dt className="font-medium">Organizer</dt>
            <dd>{name(m.organizerProfileId)}</dd>
          </div>
          <div>
            <dt className="font-medium">Room</dt>
            <dd data-testid="room-state">
              {roomText[room]}
              {m.roomId
                ? ` · ${rooms?.rooms.find((r) => r.id === m.roomId)?.displayName ?? m.roomId}`
                : ''}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Revision</dt>
            <dd>{m.revision}</dd>
          </div>
          {m.purpose ? (
            <div className="sm:col-span-2">
              <dt className="font-medium">Purpose</dt>
              <dd>{m.purpose}</dd>
            </div>
          ) : null}
          {m.agenda ? (
            <div className="sm:col-span-2">
              <dt className="font-medium">Agenda</dt>
              <dd>{m.agenda}</dd>
            </div>
          ) : null}
        </dl>
        <p className="mt-2 text-xs text-ink-muted">
          The organizer chose this time. That is not everyone’s acceptance, and a room reservation
          does not show the room is physically empty.
        </p>
      </SectionCard>
      <SectionCard id="mt-who-h" title="People and replies">
        <ul className="flex flex-col gap-1 text-sm">
          {m.attendees.map((a) => (
            <li key={a.profileId}>
              <strong>{name(a.profileId)}</strong> · {a.required ? 'required' : 'optional'} ·{' '}
              {rsvpLabel[a.rsvp]}
              {a.needsReconfirm ? ' (time changed: please reply again)' : ''}
            </li>
          ))}
        </ul>
        {open ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-sm">
              Reply as {name(profileId)} ({rsvpLabel[mine.rsvp].toLowerCase()}):
            </span>
            <Button size="sm" className="min-h-11" onClick={() => reply('ACCEPTED')}>
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => reply('TENTATIVE')}
            >
              Maybe
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() => reply('DECLINED')}
            >
              Decline
            </Button>
          </div>
        ) : null}
        <p className="mt-2 text-xs text-ink-muted">
          Other people are personas. Switch profile to reply as them; nothing here reaches another
          device.
        </p>
      </SectionCard>
      {organizer && open ? (
        <SectionCard id="mt-move-h" title="Change the time">
          <p className="text-sm text-ink-muted">
            The new time and room are checked first. If that fails, the current booking stays as it
            is.
          </p>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault()
              setError('')
              const r = await act(
                () =>
                  repo.reschedule(profileId, m.id, m.revision, {
                    date: (date || m.date) as DateOnly,
                    start: (start || m.start) as LocalTime,
                    end: (end || m.end) as LocalTime,
                  }),
                'Meeting moved. Guests were asked to reply again.',
              )
              if (!r.ok) setError(r.error.message)
            }}
          >
            <Field label="Date">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  className={`${inputClass} w-40`}
                  value={date || m.date}
                  onChange={(e) => setDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="From">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={`${inputClass} w-32`}
                  value={start || m.start}
                  onChange={(e) => setStart(e.target.value)}
                />
              )}
            </Field>
            <Field label="To">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={`${inputClass} w-32`}
                  value={end || m.end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" className="min-h-11">
              Move meeting
            </Button>
          </form>
          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button
            variant="outline"
            className="mt-3 min-h-11 border-danger text-danger"
            onClick={async () => {
              const c = await confirm({
                title: 'Cancel this meeting?',
                description: (
                  <p>The linked room is released in the recorded schedule only. History is kept.</p>
                ),
                confirmLabel: 'Cancel meeting',
                danger: true,
              })
              if (c === 'confirm')
                await act(() => repo.cancel(profileId, m.id), 'Meeting cancelled.')
            }}
          >
            Cancel meeting
          </Button>
        </SectionCard>
      ) : null}
      <SectionCard id="mt-hist-h" title="What changed">
        <ol className="flex flex-col gap-1 text-sm">
          {m.history.map((h) => (
            <li key={h.id}>
              {formatInstant(h.at)} · {name(h.actor)} · {h.type}
              {h.note ? ` · ${h.note}` : ''}
            </li>
          ))}
        </ol>
      </SectionCard>
    </article>
  )
}

export function PollsPage() {
  const { meetings, status, profileId, repo } = useMeetings()
  if (status === 'loading' || !meetings) return <Loading />
  const mine = meetings.polls.filter((p) => p.eligible.includes(profileId))
  void repo
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Time polls"
        description="Polls you can vote in or run. A vote is a preference; it never overrides a clash with a timetable."
        badge={<Pill tone="demo">Local · local polls</Pill>}
      />
      <p className="flex gap-3 text-sm font-medium text-coffee">
        <Link to="/calendar/find-a-time" className="underline">
          Find a time
        </Link>
        <Link to="/calendar" className="underline">
          Back to Calendar
        </Link>
      </p>
      {mine.length === 0 ? (
        <Empty>No poll yet. Start one from Find a time.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3"
            >
              <Link to={`/calendar/polls/${p.id}`} className="font-medium text-coffee underline">
                {p.title}
              </Link>
              <span className="text-sm text-ink-muted">
                {p.scope.label} · {Object.keys(p.ballots).length} of {p.eligible.length} voted ·{' '}
                {p.status.toLowerCase()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </article>
  )
}

export function PollPage() {
  const { pollId = '' } = useParams()
  const { meetings, status, profileId, profiles, repo } = useMeetings()
  const { act, message } = useAction()
  const nav = useNavigate()
  const [draft, setDraft] = useState<Record<string, Vote>>({})
  const [feasible, setFeasible] = useState<Set<string> | null>(null)
  const poll = meetings?.polls.find((p) => p.id === pollId && p.eligible.includes(profileId))
  const cands = useMemo(() => poll?.candidates ?? [], [poll])
  // A time is feasible only if every required person is still free at it, checked now.
  useEffect(() => {
    if (!poll) return
    let live = true
    void (async () => {
      const ok = new Set<string>()
      for (const c of cands) {
        const slot = { start: instantMs(c.date, c.start), end: instantMs(c.date, c.end) }
        let free = true
        for (const id of poll.requiredIds) {
          const av = await repo.availabilityOf(id, c.date, c.date)
          if (av.busy.some((b) => clash(slot, b))) free = false
        }
        if (free) ok.add(c.id)
      }
      if (live) setFeasible(ok)
    })()
    return () => {
      live = false
    }
  }, [poll, cands, repo])
  if (status === 'loading' || !meetings) return <Loading />
  if (!poll)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Poll not found" />
        <Empty>
          You are not on this poll’s list, or it does not exist.{' '}
          <Link to="/calendar/polls" className="underline">
            Back to polls
          </Link>
        </Empty>
      </article>
    )
  const name = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? id
  const t = tally(poll, feasible ?? new Set())
  const organizer = poll.organizerProfileId === profileId
  const mineBallot = poll.ballots[profileId]
  const finalizeable = poll.status !== 'FINALIZED' && organizer
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={poll.title}
        badge={
          <Pill tone="demo">
            {poll.scope.label} · {poll.status.toLowerCase()}
          </Pill>
        }
      />
      <p>
        <Link to="/calendar/polls" className="text-sm font-medium text-coffee underline">
          Back to polls
        </Link>
      </p>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard id="pl-vote-h" title="Times">
        <p className="text-xs text-ink-muted">
          Eligible: {poll.eligible.map(name).join(', ')}. Not yet voted:{' '}
          {poll.eligible
            .filter((e) => !poll.ballots[e])
            .map(name)
            .join(', ') || 'nobody'}
          . Someone who has not voted is not counted as “No”.
        </p>
        <ul className="mt-2 flex flex-col gap-2" data-testid="poll-rows">
          {poll.candidates.map((c) => {
            const row = t.rows.find((r) => r.candidateId === c.id)!
            return (
              <li key={c.id} className="rounded-md border border-border p-3 text-sm">
                <p className="font-semibold">
                  {formatDateShort(c.date)}, {c.start}–{c.end}{' '}
                  {feasible ? (
                    row.feasible ? (
                      <Pill>Feasible</Pill>
                    ) : (
                      <Pill tone="warn">A required person is busy</Pill>
                    )
                  ) : null}
                </p>
                <p className="text-ink-muted">
                  Yes {row.yes} · If needed {row.ifNeeded} · No {row.no} · No reply {row.noReply}
                </p>
                {poll.status === 'OPEN' ? (
                  <label className="mt-1 flex items-center gap-2">
                    Your vote
                    <select
                      className={`${inputClass} w-36`}
                      value={draft[c.id] ?? mineBallot?.votes[c.id] ?? ''}
                      onChange={(e) => setDraft({ ...draft, [c.id]: e.target.value as Vote })}
                    >
                      <option value="">No vote</option>
                      {VOTES.map((v) => (
                        <option key={v} value={v}>
                          {voteLabel[v]}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                {finalizeable && row.feasible ? (
                  <Button
                    size="sm"
                    className="mt-2 min-h-11"
                    onClick={async () => {
                      const r = await act(
                        () =>
                          repo.finalizePoll(poll.id, profileId, c.id, {
                            title: poll.title,
                            attendees: poll.eligible
                              .filter((e) => e !== profileId)
                              .map((e) => ({
                                profileId: e,
                                required: poll.requiredIds.includes(e),
                              })),
                          }),
                        'One meeting was created from this poll.',
                      )
                      if (r.ok) nav(`/calendar/meetings/${r.value.id}`)
                    }}
                  >
                    Finalize this time
                    <span className="sr-only">
                      {' '}
                      {c.date} {c.start}
                    </span>
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
        {t.tieNote ? (
          <p className="mt-2 text-sm" data-testid="tie-note">
            {t.tieNote}
          </p>
        ) : null}
        {t.ranked[0] ? (
          <p className="mt-1 text-sm">
            Leading feasible time: {t.ranked[0].candidateId.replace('T', ' ')}. The organizer
            decides; nothing is chosen automatically.
          </p>
        ) : feasible ? (
          <p className="mt-1 text-sm">
            No time is feasible for everyone required. Open a new poll with other times.
          </p>
        ) : null}
        {poll.status === 'OPEN' ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              className="min-h-11"
              onClick={() =>
                void act(
                  () =>
                    repo.vote(poll.id, profileId, {
                      ...(mineBallot?.votes ?? {}),
                      ...Object.fromEntries(Object.entries(draft).filter(([, v]) => v)),
                    }),
                  'Your vote was saved.',
                )
              }
            >
              Save my vote
            </Button>
            {organizer ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() => void act(() => repo.closePoll(poll.id, profileId), 'Poll closed.')}
              >
                Close voting
              </Button>
            ) : null}
          </div>
        ) : null}
        {poll.finalMeetingId ? (
          <p className="mt-2">
            <Link
              to={`/calendar/meetings/${poll.finalMeetingId}`}
              className="font-medium text-coffee underline"
            >
              Open the meeting
            </Link>
          </p>
        ) : null}
      </SectionCard>
    </article>
  )
}
