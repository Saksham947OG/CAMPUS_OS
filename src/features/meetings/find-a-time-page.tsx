import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { findTimes, type Candidate, type Participant } from '@/domain/availability'
import { PURPOSES } from '@/domain/classrooms'
import { slotStatus } from '@/domain/classrooms-logic'
import { addDays, formatDateShort, type DateOnly, type LocalTime } from '@/lib/time'
import { Empty, Loading, Pill, SectionCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { statusText } from '../classrooms/classroom-text'
import { useMeetings } from './meeting-hooks'

type Pref = 'any' | 'morning' | 'afternoon'

/**
 * Find a time, agree with the group, find a room, confirm: one page, so nothing typed is lost when a
 * step fails. Suggestions come from recorded schedules only; a person with no recorded timetable is
 * never assumed free.
 */
export function FindATimePage() {
  const { meetings, rooms, status, profileId, profiles, now, repo, newId } = useMeetings()
  const nav = useNavigate()
  const { act } = useAction()
  const [title, setTitle] = useState('')
  const [purpose, setPurpose] = useState('')
  const [agenda, setAgenda] = useState('')
  const [duration, setDuration] = useState(45)
  const [from, setFrom] = useState<string>('')
  const [to, setTo] = useState<string>('')
  const [weekends, setWeekends] = useState(false)
  const [pref, setPref] = useState<Pref>('any')
  const [people, setPeople] = useState<{ id: string; required: boolean }[]>([])
  const [q, setQ] = useState('')
  const [needRoom, setNeedRoom] = useState(true)
  const [groupSize, setGroupSize] = useState('')
  const [picked, setPicked] = useState<string>('')
  const [room, setRoom] = useState<string>('')
  const [chosen, setChosen] = useState<string[]>([])
  const [error, setError] = useState('')
  const [opId] = useState(() => newId('op'))
  const [avail, setAvail] = useState<
    Record<string, { busy: Participant['busy']; coverage: Participant['coverage'] }>
  >({})
  const start = (from || addDays(now.today, 1)) as DateOnly
  const end = (to || addDays(now.today, 7)) as DateOnly
  const ids = useMemo(() => [profileId, ...people.map((p) => p.id)], [profileId, people])
  const key = `${ids.join(',')}|${start}|${end}`

  useEffect(() => {
    let live = true
    void (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => [id, await repo.availabilityOf(id, start, end)] as const),
      )
      if (live) setAvail(Object.fromEntries(entries))
    })()
    return () => {
      live = false
    }
    // `key` summarises ids, start and end.
  }, [key, repo]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'loading' || !meetings || !rooms) return <Loading />
  const name = (id: string) => profiles.find((p) => p.id === id)?.displayName ?? id
  const parts: Participant[] = ids
    .filter((id) => avail[id])
    .map((id) => ({
      id,
      label: name(id),
      required: id === profileId || (people.find((p) => p.id === id)?.required ?? true),
      busy: avail[id]!.busy,
      coverage: avail[id]!.coverage,
    }))
  const size = Number(groupSize) || ids.length
  const result = findTimes({
    participants: parts,
    from: start,
    to: end,
    durationMin: duration,
    dayWindow: { from: '09:00' as LocalTime, to: '18:00' as LocalTime },
    includeWeekends: weekends,
    stepMin: 15,
    bufferMin: 0,
    preference: pref,
    nowMs: now.ms,
    ...(needRoom
      ? {
          roomFit: (c) =>
            rooms.rooms.some((r) => slotStatus(rooms, r.id, c, profileId).kind === 'available'),
        }
      : {}),
  })
  const all: Candidate[] = [...result.suggestions, ...result.needsConfirmation]
  const sel = all.find((c) => c.id === picked)
  const matches = q.trim()
    ? profiles.filter(
        (p) =>
          p.id !== profileId &&
          !people.some((x) => x.id === p.id) &&
          `${p.displayName}`.toLowerCase().includes(q.trim().toLowerCase()),
      )
    : []
  const roomList = sel
    ? rooms.rooms.map((r) => ({ r, s: slotStatus(rooms, r.id, sel, profileId) }))
    : []

  const confirm = async () => {
    if (!sel) return
    setError('')
    if (!title.trim()) return setError('Give the meeting a title.')
    const chosenRoom = needRoom && room ? rooms.rooms.find((r) => r.id === room) : undefined
    const rs = chosenRoom ? slotStatus(rooms, chosenRoom.id, sel, profileId) : null
    const r = await act(
      () =>
        repo.schedule({
          organizerProfileId: profileId,
          title,
          purpose,
          agenda,
          date: sel.date,
          start: sel.start,
          end: sel.end,
          attendees: people.map((p) => ({ profileId: p.id, required: p.required })),
          ...(chosenRoom
            ? {
                room: {
                  roomId: chosenRoom.id,
                  purpose: PURPOSES[1],
                  groupName: title,
                  attendees: size,
                  ...(rs?.kind === 'unknown' ? { asVerificationRequest: true } : {}),
                },
              }
            : {}),
          opId,
        }),
      'Meeting set in the demo.',
    )
    if (r.ok) nav(`/calendar/meetings/${r.value.meeting.id}`)
    else setError(r.error.message)
  }

  const makePoll = async () => {
    const cands = all.filter((c) => chosen.includes(c.id))
    const r = await act(
      () =>
        repo.createPoll({
          organizerProfileId: profileId,
          title: title || 'Find a time',
          durationMin: duration,
          scope: { kind: 'project', label: title || 'Group meeting' },
          eligible: ids,
          requiredIds: parts.filter((p) => p.required).map((p) => p.id),
          candidates: cands.map((c) => ({ date: c.date, start: c.start, end: c.end })),
        }),
      'Poll opened in the demo.',
    )
    if (r.ok) nav(`/calendar/polls/${r.value.id}`)
    else setError(r.error.message)
  }

  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Find a time"
        description="Pick people and a duration, see the best times from recorded schedules, choose a room and confirm, all in one place."
        badge={<Pill tone="demo">Demo · based on recorded schedules</Pill>}
      />
      <p>
        <Link to="/calendar" className="text-sm font-medium text-coffee underline">
          Back to Calendar
        </Link>
      </p>
      <SectionCard id="ft-details-h" title="1. What and who">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Field label="Meeting title">
              {(a) => (
                <input
                  {...a}
                  className={`${inputClass} w-64`}
                  maxLength={80}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              )}
            </Field>
            <Field label="Duration">
              {(a) => (
                <select
                  {...a}
                  className={`${inputClass} w-32`}
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                >
                  {[30, 45, 60, 90].map((d) => (
                    <option key={d} value={d}>
                      {d} min
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="From">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={now.today}
                  className={`${inputClass} w-40`}
                  value={from || start}
                  onChange={(e) => setFrom(e.target.value)}
                />
              )}
            </Field>
            <Field label="To">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={start}
                  max={addDays(start, 14)}
                  className={`${inputClass} w-40`}
                  value={to || end}
                  onChange={(e) => setTo(e.target.value)}
                />
              )}
            </Field>
            <Field label="Prefer">
              {(a) => (
                <select
                  {...a}
                  className={`${inputClass} w-36`}
                  value={pref}
                  onChange={(e) => setPref(e.target.value as Pref)}
                >
                  <option value="any">No preference</option>
                  <option value="morning">Morning</option>
                  <option value="afternoon">Afternoon</option>
                </select>
              )}
            </Field>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={weekends}
              onChange={(e) => setWeekends(e.target.checked)}
            />{' '}
            Include weekends
          </label>
          <Field label="Add people (search by name)">
            {(a) => (
              <input
                {...a}
                className={`${inputClass} w-64`}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            )}
          </Field>
          {matches.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="Matches">
              {matches.map((p) => (
                <li key={p.id}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setPeople([...people, { id: p.id, required: true }])
                      setQ('')
                    }}
                  >
                    Add {p.displayName}
                  </Button>
                </li>
              ))}
            </ul>
          ) : q.trim() ? (
            <p className="text-sm text-ink-muted">No demo profile matches that name.</p>
          ) : null}
          <ul className="flex flex-col gap-1 text-sm" aria-label="People">
            <li>
              <strong>{name(profileId)}</strong> (you, organizer, required)
            </li>
            {people.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <strong>{name(p.id)}</strong>
                <label className="flex min-h-11 items-center gap-1.5">
                  <input
                    type="checkbox"
                    className="size-5"
                    checked={p.required}
                    onChange={(e) =>
                      setPeople(
                        people.map((x) =>
                          x.id === p.id ? { ...x, required: e.target.checked } : x,
                        ),
                      )
                    }
                  />{' '}
                  required
                </label>
                {avail[p.id]?.coverage === 'unknown' ? (
                  <Pill tone="warn">No recorded timetable</Pill>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => setPeople(people.filter((x) => x.id !== p.id))}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={needRoom}
              onChange={(e) => setNeedRoom(e.target.checked)}
            />{' '}
            I need a room
          </label>
          {needRoom ? (
            <Field label="Group size (optional)">
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={`${inputClass} w-28`}
                  value={groupSize}
                  onChange={(e) => setGroupSize(e.target.value.replace(/\D/g, ''))}
                />
              )}
            </Field>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard id="ft-sugg-h" title="2. Best times">
        <p className="text-xs text-ink-muted">
          Based on recorded schedules. A person with no recorded timetable is never treated as free.
          Ranking uses demo weights (optional guests 40%, preference 25%, small idle gaps 20%, room
          match 15%), not validated ones.
        </p>
        {people.length === 0 ? (
          <div className="mt-2">
            <Empty>Add at least one other person to see shared times.</Empty>
          </div>
        ) : result.suggestions.length === 0 && result.needsConfirmation.length === 0 ? (
          <div className="mt-2 flex flex-col gap-2">
            <Empty>No common time was found in this range.</Empty>
            <ul className="list-disc pl-5 text-sm">
              {result.blockers.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <p className="text-sm">Try a wider date range, a shorter duration, or open a poll.</p>
          </div>
        ) : (
          <>
            {result.suggestions.length > 0 ? (
              <p className="mt-2 text-sm font-medium">
                {result.suggestions.length === 3
                  ? 'Top three times'
                  : `${result.suggestions.length} time${result.suggestions.length === 1 ? '' : 's'} found`}
              </p>
            ) : null}
            {result.needsConfirmation.length > 0 ? (
              <p role="note" className="mt-2 rounded-md bg-mist p-2 text-sm">
                Needs availability confirmation: someone required has no recorded timetable, so
                these are not confirmed free times.
              </p>
            ) : null}
            <ul className="mt-2 flex flex-col gap-2" data-testid="suggestions">
              {all.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-lg border p-3 ${picked === c.id ? 'border-2 border-coffee' : 'border-border'}`}
                >
                  <p className="font-semibold">
                    {formatDateShort(c.date)}, {c.start}–{c.end}
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1.5" aria-label="Why">
                    {c.reasons.map((r) => (
                      <li key={r}>
                        <Pill>{r}</Pill>
                      </li>
                    ))}
                  </ul>
                  {c.unknownRequired.length ? (
                    <p className="mt-1 text-xs">
                      Availability not recorded for: {c.unknownRequired.join(', ')}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <Button className="min-h-11" onClick={() => setPicked(c.id)}>
                      Choose this time
                      <span className="sr-only">
                        {' '}
                        {c.date} {c.start}
                      </span>
                    </Button>
                    <label className="flex min-h-11 items-center gap-1.5 text-sm">
                      <input
                        type="checkbox"
                        className="size-5"
                        checked={chosen.includes(c.id)}
                        onChange={(e) =>
                          setChosen(
                            e.target.checked ? [...chosen, c.id] : chosen.filter((x) => x !== c.id),
                          )
                        }
                      />{' '}
                      Add to a poll
                    </label>
                  </div>
                </li>
              ))}
            </ul>
            <Button
              variant="outline"
              className="mt-2 min-h-11"
              disabled={chosen.length === 0}
              onClick={() => void makePoll()}
            >
              Open a poll with {chosen.length} time{chosen.length === 1 ? '' : 's'}
            </Button>
          </>
        )}
      </SectionCard>

      {sel && needRoom ? (
        <SectionCard id="ft-room-h" title="3. Room for this time">
          <ul className="flex flex-col gap-2" data-testid="rooms">
            {roomList.map(({ r, s }) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  <strong>{r.displayName}</strong> · {r.kindLabel}
                  <span className="block text-xs text-ink-muted">
                    {statusText(s).label} · Capacity {r.capacity ?? 'not provided'}
                    {groupSize ? ' (unverified for your group size)' : ''} ·{' '}
                    {r.bookingMode === 'approval'
                      ? 'needs a (simulated) review'
                      : 'instant demo booking'}
                  </span>
                </span>
                <Button
                  size="sm"
                  variant={room === r.id ? 'default' : 'outline'}
                  className="min-h-11"
                  aria-pressed={room === r.id}
                  disabled={s.kind === 'booked' || s.kind === 'blocked' || s.kind === 'pending'}
                  onClick={() => setRoom(room === r.id ? '' : r.id)}
                >
                  {room === r.id
                    ? 'Selected'
                    : s.kind === 'unknown'
                      ? 'Request verification'
                      : 'Use this room'}
                  <span className="sr-only"> {r.displayName}</span>
                </Button>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      {sel ? (
        <SectionCard id="ft-review-h" title="4. Review and confirm">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="font-medium">Time</dt>
              <dd>
                {formatDateShort(sel.date)}, {sel.start}–{sel.end}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Room</dt>
              <dd>
                {needRoom
                  ? room
                    ? rooms.rooms.find((r) => r.id === room)?.displayName
                    : 'None chosen yet'
                  : 'No room needed'}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">People</dt>
              <dd>
                {ids.map(name).join(', ')} (replies start as “invited”; choosing a time is not
                everyone’s acceptance)
              </dd>
            </div>
          </dl>
          <Field label="Agenda (optional)" className="mt-2">
            {(a) => (
              <textarea
                {...a}
                rows={2}
                maxLength={500}
                className={inputClass}
                value={agenda}
                onChange={(e) => setAgenda(e.target.value)}
              />
            )}
          </Field>
          <Field label="Purpose (optional)" className="mt-2">
            {(a) => (
              <input
                {...a}
                className={inputClass}
                maxLength={200}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="mt-2 text-sm font-medium text-danger">
              {error} Your answers are kept.
            </p>
          ) : null}
          <Button className="mt-3 min-h-11" onClick={() => void confirm()}>
            Confirm meeting
          </Button>
        </SectionCard>
      ) : null}
    </article>
  )
}
