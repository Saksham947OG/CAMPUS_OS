import { useState } from 'react'
import { useClassroomState } from '@/app/classrooms-store'
import { Button } from '@/components/ui/button'
import { findTimes, type Candidate, type FindResult, type Participant } from '@/domain/availability'
import { createPoll } from '@/domain/workspace-ext'
import type { Project } from '@/domain/workspace'
import { DEMO_AVAILABILITY_DATE, DEMO_ROOM } from '@/data/seeds/demo/workspace-demo'
import { addDays, formatDateLong, formatTimeRange, type DateOnly, type LocalTime } from '@/lib/time'
import { timeToMinutes } from '@/selectors/now'
import { clashing, isDemoMember, loadParticipants, roomOptions } from './team-helpers'
import type { WorkspaceApi } from './use-workspace'
import { WsCard, fieldClass } from './ws-ui'

/**
 * Find a team time on the main availability engine. A team of real CampusOS profiles reads their
 * recorded schedules and can hold a real campus room through Classrooms (and the meeting then also
 * appears in everyone's Calendar). A team with fictional members uses the demo availability and the
 * demo room. Mixed teams use demo availability for the fictional people and the real schedule for the rest.
 */
export function FindTeamTime({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, now } = w
  const rooms = useClassroomState((s) => s.classrooms)
  const members = ws.members.filter((m) => m.spaceId === project.spaceId && !m.invitation)
  const anyDemo = members.some((m) => isDemoMember(w, m.userId))
  const [pick, setPick] = useState<Record<string, { on: boolean; required: boolean }>>(() =>
    Object.fromEntries(
      members.map((m) => [
        m.userId,
        {
          on: m.role !== 'viewer',
          required: m.userId === actor || m.role === 'owner' || m.role === 'editor',
        },
      ]),
    ),
  )
  const [duration, setDuration] = useState(45)
  const [from, setFrom] = useState<DateOnly>(
    anyDemo ? DEMO_AVAILABILITY_DATE : addDays(now.today, 1),
  )
  const [to, setTo] = useState<DateOnly>(anyDemo ? DEMO_AVAILABILITY_DATE : addDays(now.today, 7))
  const [wFrom, setWFrom] = useState('09:00')
  const [wTo, setWTo] = useState('17:00')
  const [needRoom, setNeedRoom] = useState(true)
  const [result, setResult] = useState<FindResult | null>(null)
  const [people, setPeople] = useState<Participant[]>([])
  const [choice, setChoice] = useState<Candidate | null>(null)
  const [roomId, setRoomId] = useState('')
  const [title, setTitle] = useState('Team meeting')
  const [busy, setBusy] = useState(false)
  const [op, setOp] = useState(() => w.services.newId('op'))
  const [pollOp, setPollOp] = useState(() => w.services.newId('op'))

  const chosen = members.filter((m) => pick[m.userId]?.on)
  const realTeam = chosen.length > 0 && chosen.every((m) => !isDemoMember(w, m.userId))
  const held = ws.meetings.filter(
    (m) => m.status === 'confirmed' && m.roomLabel === DEMO_ROOM.label,
  )
  const requiredOf = (id: string) => Boolean(pick[id]?.required)

  const demoRoomFree = (c: { date: DateOnly; start: LocalTime; end: LocalTime }) =>
    timeToMinutes(c.start) >= timeToMinutes(DEMO_ROOM.from) &&
    timeToMinutes(c.end) <= timeToMinutes(DEMO_ROOM.to) &&
    chosen.length <= DEMO_ROOM.seats &&
    !held.some(
      (h) =>
        h.date === c.date &&
        timeToMinutes(h.start) < timeToMinutes(c.end) &&
        timeToMinutes(c.start) < timeToMinutes(h.end),
    )
  const roomFit = !needRoom
    ? undefined
    : realTeam
      ? (c: { date: DateOnly; start: LocalTime; end: LocalTime }) =>
          roomOptions(rooms, c, actor, chosen.length).some((r) => r.kind === 'available')
      : anyDemo
        ? demoRoomFree
        : undefined

  const search = async () => {
    if (!chosen.length) return w.toast.notify('error', 'Choose at least one person.')
    if (to < from) return w.toast.notify('error', 'The last date is before the first date.')
    setBusy(true)
    const ps = await loadParticipants(
      w,
      chosen.map((m) => m.userId),
      requiredOf,
      from,
      to,
    )
    setPeople(ps)
    setChoice(null)
    setResult(
      findTimes({
        participants: ps,
        from,
        to,
        durationMin: duration,
        dayWindow: { from: wFrom as LocalTime, to: wTo as LocalTime },
        includeWeekends: true,
        stepMin: 30,
        bufferMin: 0,
        preference: 'any',
        nowMs: now.ms,
        ...(roomFit ? { roomFit } : {}),
      }),
    )
    setBusy(false)
  }

  const options =
    choice && needRoom && realTeam ? roomOptions(rooms, choice, actor, chosen.length) : []
  const room = options.find((o) => o.room.id === roomId) ?? options[0]

  /** The people are checked again at confirmation, because the answer may have changed since the search. */
  const confirm = async () => {
    if (!choice) return
    setBusy(true)
    const fresh = await loadParticipants(
      w,
      chosen.map((m) => m.userId),
      requiredOf,
      from,
      to,
    )
    const now = clashing(fresh, choice)
    if (now.length) {
      setBusy(false)
      setChoice(null)
      return w.toast.notify(
        'error',
        `${now.map((p) => p.label).join(', ')} now has something at that time. Search again.`,
      )
    }
    const r = await w.services.workspace.scheduleTeamMeeting(actor, {
      projectId: project.id,
      title,
      date: choice.date,
      start: choice.start,
      end: choice.end,
      attendees: chosen
        .filter((m) => m.userId !== actor)
        .map((m) => ({ userId: m.userId, required: requiredOf(m.userId) })),
      ...(needRoom && anyDemo && !realTeam ? { roomLabel: DEMO_ROOM.label } : {}),
      ...(needRoom && realTeam && room
        ? {
            room: {
              room: room.room,
              groupSize: chosen.length,
              verification: room.kind === 'unknown',
            },
          }
        : {}),
      opId: op,
    })
    setBusy(false)
    if (!r.ok) return w.toast.notify('error', r.error.message)
    w.toast.notify(
      'success',
      realTeam
        ? 'Meeting scheduled. It is also in each person’s Calendar, with the room held. Nobody is emailed.'
        : 'Meeting scheduled for the team. Invitations show here only; nobody is emailed.',
    )
    setChoice(null)
    setResult(null)
    setOp(w.services.newId('op'))
  }

  const openPoll = async (list: Candidate[]) => {
    const r = await w.act(
      (s, c) =>
        createPoll(s, c, actor, {
          projectId: project.id,
          title,
          durationMin: duration,
          candidates: list.slice(0, 5).map((x) => ({ date: x.date, start: x.start, end: x.end })),
          voters: chosen
            .filter((m) => m.userId !== actor)
            .map((m) => ({ userId: m.userId, required: requiredOf(m.userId) })),
          roomPlan: !needRoom ? 'none' : realTeam ? 'campus' : 'demo',
          opId: pollOp,
        }),
      'Poll opened. Everyone invited can vote from this tab.',
    )
    if (r.ok) {
      setPollOp(w.services.newId('op'))
      setResult(null)
    }
  }

  const all = result ? [...result.suggestions, ...result.needsConfirmation] : []
  const row = (c: Candidate, unsure: boolean) => (
    <li key={c.id} className="rounded-md border border-border p-2 text-sm">
      <p>
        <strong>{formatDateLong(c.date)}</strong>, {formatTimeRange(c.start, c.end)}
      </p>
      <ul className="text-xs text-ink-muted">
        {c.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
        {unsure ? (
          <li>
            Needs confirmation: availability is not recorded for {c.unknownRequired.join(', ')}.
          </li>
        ) : null}
      </ul>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-1 min-h-9"
        onClick={() => setChoice(c)}
      >
        Choose this time
      </Button>
    </li>
  )

  return (
    <WsCard title="Find a team time" id="tc-find">
      {anyDemo ? (
        <p className="mb-2 text-sm text-ink-muted">
          Fictional members use availability recorded for {formatDateLong(DEMO_AVAILABILITY_DATE)}{' '}
          only; other dates show as unknown, never free. Rohan has no recorded availability.
        </p>
      ) : (
        <p className="mb-2 text-sm text-ink-muted">
          Uses each person’s recorded CampusOS schedule. Anyone without one is shown as unknown,
          never as free. Only busy or free is used; titles stay private.
        </p>
      )}
      <fieldset className="mb-3">
        <legend className="text-sm font-medium text-ink">Who needs to be there</legend>
        {members.map((m) => (
          <div key={m.userId} className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4"
                checked={Boolean(pick[m.userId]?.on)}
                onChange={(e) =>
                  setPick({ ...pick, [m.userId]: { ...pick[m.userId]!, on: e.target.checked } })
                }
              />
              {w.name(m.userId)}
            </label>
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              <input
                type="checkbox"
                className="size-4"
                disabled={!pick[m.userId]?.on}
                checked={requiredOf(m.userId)}
                onChange={(e) =>
                  setPick({
                    ...pick,
                    [m.userId]: { ...pick[m.userId]!, required: e.target.checked },
                  })
                }
              />
              required
            </label>
          </div>
        ))}
      </fieldset>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink">
          Length
          <select
            className={fieldClass}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {[30, 45, 60, 90].map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          From date
          <input
            type="date"
            className={fieldClass}
            value={from}
            onChange={(e) => setFrom(e.target.value as DateOnly)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          To date
          <input
            type="date"
            className={fieldClass}
            value={to}
            onChange={(e) => setTo(e.target.value as DateOnly)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Earliest start
          <input
            type="time"
            className={fieldClass}
            value={wFrom}
            onChange={(e) => setWFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink">
          Latest finish
          <input
            type="time"
            className={fieldClass}
            value={wTo}
            onChange={(e) => setWTo(e.target.value)}
          />
        </label>
      </div>
      <label className="mb-3 flex min-h-9 items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4"
          checked={needRoom}
          onChange={(e) => setNeedRoom(e.target.checked)}
        />
        {realTeam
          ? 'Hold a campus room through Classrooms'
          : anyDemo
            ? `Hold ${DEMO_ROOM.label} (${DEMO_ROOM.seats} seats, ${DEMO_ROOM.from}–${DEMO_ROOM.to}, a fictional room in the inventory)`
            : 'Hold a room'}
      </label>
      <Button type="button" className="min-h-11" disabled={busy} onClick={() => void search()}>
        Find times
      </Button>

      {result ? (
        <section className="mt-4" aria-label="Suggested times">
          {result.suggestions.length ? (
            <>
              <h3 className="mb-1 font-semibold text-ink">Everyone required is free</h3>
              <ul className="flex flex-col gap-2">
                {result.suggestions.map((c) => row(c, false))}
              </ul>
            </>
          ) : result.needsConfirmation.length ? (
            <>
              <h3 className="mb-1 font-semibold text-ink">
                No time is confirmed free for everyone
              </h3>
              <p className="mb-1 text-sm text-ink-muted">
                These times fit everyone with recorded availability, but at least one required
                person has none recorded, so they are unconfirmed.
              </p>
              <ul className="flex flex-col gap-2">
                {result.needsConfirmation.map((c) => row(c, true))}
              </ul>
            </>
          ) : (
            <div className="rounded-md bg-mist p-3 text-sm">
              <p className="font-medium text-ink">No common time found.</p>
              <ul className="list-disc pl-5 text-ink-muted">
                {result.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <p className="mt-1 text-ink-muted">
                Try a shorter meeting, a wider time window, more dates, or make someone optional.
              </p>
            </div>
          )}
          {all.length >= 2 ? (
            <div className="mt-3 rounded-md border border-border p-2 text-sm">
              <p className="text-ink-muted">
                Not sure which suits everyone? Let the team vote. A poll is a preference, not a
                booking: you confirm the winner afterwards.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-1 min-h-11"
                onClick={() => void openPoll(all)}
              >
                Open a poll with these {Math.min(all.length, 5)} times
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}

      {choice ? (
        <form
          className="mt-4 flex flex-col gap-3 rounded-lg border border-border-strong p-3"
          aria-label="Review the meeting"
          onSubmit={(e) => {
            e.preventDefault()
            void confirm()
          }}
        >
          <p className="font-medium text-ink">
            Review: {formatDateLong(choice.date)}, {formatTimeRange(choice.start, choice.end)}
          </p>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Meeting title
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          {needRoom && realTeam ? (
            options.length ? (
              <label className="flex flex-col gap-1 text-sm text-ink">
                Campus room
                <select
                  className={fieldClass}
                  value={room?.room.id ?? ''}
                  onChange={(e) => setRoomId(e.target.value)}
                >
                  {options.map((o) => (
                    <option key={o.room.id} value={o.room.id}>
                      {o.text}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="text-sm text-danger">
                No campus room is free or requestable then. Untick “Hold a campus room” to book the
                meeting without one.
              </p>
            )
          ) : needRoom && anyDemo ? (
            <p className="text-sm text-ink-muted">{DEMO_ROOM.label} (inventory) will be held.</p>
          ) : null}
          <p className="text-xs text-ink-muted">
            {chosen.length} people. They are checked again when you confirm.{' '}
            {realTeam
              ? 'The meeting is also created in the main Calendar for each person.'
              : 'Invitations show on this team’s calendar only.'}{' '}
            Nothing is emailed.
            {people.some((p) => p.coverage === 'unknown' && !requiredOf(p.id))
              ? ' Optional people with no recorded availability may not be free.'
              : ''}
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="min-h-11"
              disabled={busy || (needRoom && realTeam && !room)}
            >
              Confirm meeting
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setChoice(null)}
            >
              Choose another time
            </Button>
          </div>
        </form>
      ) : null}
    </WsCard>
  )
}
