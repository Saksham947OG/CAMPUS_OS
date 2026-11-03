import { useState } from 'react'
import { useClassroomState } from '@/app/classrooms-store'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import { closePoll, tally, votePoll } from '@/domain/workspace-ext'
import type { Project, WsPoll } from '@/domain/workspace'
import { DEMO_ROOM } from '@/data/seeds/demo/workspace-demo'
import { formatDateLong, formatTimeRange } from '@/lib/time'
import { clashing, isDemoMember, loadParticipants, roomOptions } from './team-helpers'
import type { WorkspaceApi } from './use-workspace'
import { Pill, WsCard, fieldClass } from './ws-ui'

const LABEL = { yes: 'Can do', maybe: 'Maybe', no: "Can't" } as const

/** Team time polls. Votes are preferences; the organiser closes the poll and confirms a time, which is checked again. */
export function PollsPanel({ w, project }: { w: WorkspaceApi; project: Project }) {
  const polls = w.ws.polls.filter((p) => p.projectId === project.id)
  if (!polls.length) return null
  return (
    <WsCard title="Time polls" id="tc-polls">
      <ul className="flex flex-col gap-3">
        {polls.map((p) => (
          <Poll key={p.id} w={w} p={p} project={project} />
        ))}
      </ul>
    </WsCard>
  )
}

function Poll({ w, p, project }: { w: WorkspaceApi; p: WsPoll; project: Project }) {
  const { ws, actor, act } = w
  const rooms = useClassroomState((s) => s.classrooms)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [roomId, setRoomId] = useState('')
  const [busy, setBusy] = useState(false)
  const t = tally(p)
  const mayVote = p.status === 'open' && p.voters.some((v) => v.userId === actor)
  const mayManage = p.createdBy === actor || can(roleOf(ws, project.spaceId, actor), 'manage')
  const realTeam = p.voters.every((v) => !isDemoMember(w, v.userId))
  const meeting = p.meetingId ? ws.meetings.find((m) => m.id === p.meetingId) : undefined
  const cand = p.candidates.find((c) => c.id === confirming)
  const options =
    cand && p.roomPlan === 'campus' && realTeam
      ? roomOptions(rooms, cand, actor, p.voters.length)
      : []
  const room = options.find((o) => o.room.id === roomId) ?? options[0]
  const mine = (cid: string) =>
    p.votes.find((v) => v.userId === actor && v.candidateId === cid)?.vote ?? ''

  /** The winning time is checked against everyone's schedule again before it becomes a meeting. */
  const book = async () => {
    if (!cand) return
    setBusy(true)
    const fresh = await loadParticipants(
      w,
      p.voters.map((v) => v.userId),
      (id) => Boolean(p.voters.find((v) => v.userId === id)?.required),
      cand.date,
      cand.date,
    )
    const now = clashing(fresh, cand)
    if (now.length) {
      setBusy(false)
      return w.toast.notify(
        'error',
        `${now.map((x) => x.label).join(', ')} now has something at that time. Pick another option.`,
      )
    }
    const r = await w.services.workspace.scheduleTeamMeeting(actor, {
      projectId: project.id,
      title: p.title,
      date: cand.date,
      start: cand.start,
      end: cand.end,
      attendees: p.voters
        .filter((v) => v.userId !== actor)
        .map((v) => ({ userId: v.userId, required: v.required })),
      ...(p.roomPlan === 'demo' ? { roomLabel: DEMO_ROOM.label } : {}),
      ...(p.roomPlan === 'campus' && room
        ? {
            room: {
              room: room.room,
              groupSize: p.voters.length,
              verification: room.kind === 'unknown',
            },
          }
        : {}),
      pollId: p.id,
      finalizePollId: p.id,
      opId: `poll-${p.id}`,
    })
    setBusy(false)
    if (!r.ok) return w.toast.notify('error', r.error.message)
    w.toast.notify('success', 'Meeting booked from the poll.')
    setConfirming(null)
  }

  return (
    <li className="rounded-md border border-border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-ink">{p.title}</h3>
        <Pill tone={p.status === 'open' ? 'warn' : 'teal'}>
          {p.status === 'open' ? 'Voting open' : p.status === 'closed' ? 'Voting closed' : 'Booked'}
        </Pill>
        <span className="text-xs text-ink-muted">Organiser: {w.name(p.createdBy)}</span>
      </div>
      <ul className="mt-2 flex flex-col gap-2">
        {p.candidates.map((c, i) => {
          const n = t[i]!
          return (
            <li key={c.id} className="rounded border border-border p-2">
              <p>
                <strong>{formatDateLong(c.date)}</strong>, {formatTimeRange(c.start, c.end)}
              </p>
              <p className="text-xs text-ink-muted">
                {n.yes} can do · {n.maybe} maybe · {n.no} can’t
                {n.requiredNo ? ` (${n.requiredNo} required)` : ''} · {n.unanswered} not answered
                yet
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {mayVote ? (
                  <label className="flex items-center gap-2 text-xs text-ink">
                    Your answer
                    <select
                      className={fieldClass}
                      value={mine(c.id)}
                      onChange={(e) =>
                        e.target.value &&
                        void act((s, cx) =>
                          votePoll(
                            s,
                            cx,
                            actor,
                            p.id,
                            c.id,
                            e.target.value as 'yes' | 'maybe' | 'no',
                          ),
                        )
                      }
                    >
                      <option value="">Not answered</option>
                      {(['yes', 'maybe', 'no'] as const).map((v) => (
                        <option key={v} value={v}>
                          {LABEL[v]}
                        </option>
                      ))}
                    </select>
                    <span className="sr-only">
                      {' '}
                      for {formatDateLong(c.date)} {formatTimeRange(c.start, c.end)}
                    </span>
                  </label>
                ) : null}
                {p.status === 'closed' && p.createdBy === actor ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() => setConfirming(c.id)}
                  >
                    Book this time
                  </Button>
                ) : null}
              </div>
            </li>
          )
        })}
      </ul>
      {p.status === 'open' && mayManage ? (
        <Button
          type="button"
          variant="outline"
          className="mt-2 min-h-11"
          onClick={() =>
            void act(
              (s, c) => closePoll(s, c, actor, p.id),
              'Voting closed. Pick the time to book.',
            )
          }
        >
          Close voting
        </Button>
      ) : null}
      {p.status === 'finalized' && meeting ? (
        <p className="mt-2 text-xs text-ink-muted">
          Booked: {formatDateLong(meeting.date)}, {formatTimeRange(meeting.start, meeting.end)}
          {meeting.roomLabel ? ` · ${meeting.roomLabel}` : ''}.
        </p>
      ) : null}
      {cand ? (
        <form
          className="mt-3 flex flex-col gap-2 rounded-lg border border-border-strong p-3"
          aria-label="Book the chosen time"
          onSubmit={(e) => {
            e.preventDefault()
            void book()
          }}
        >
          <p className="font-medium text-ink">
            Book {formatDateLong(cand.date)}, {formatTimeRange(cand.start, cand.end)}
          </p>
          {p.roomPlan === 'campus' && realTeam ? (
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
                No campus room is free then. Choose another option.
              </p>
            )
          ) : p.roomPlan === 'demo' ? (
            <p className="text-sm text-ink-muted">{DEMO_ROOM.label} (inventory) will be held.</p>
          ) : null}
          <p className="text-xs text-ink-muted">
            Everyone is checked against their schedule again now. Votes were a preference only.
          </p>
          <div className="flex gap-2">
            <Button
              type="submit"
              className="min-h-11"
              disabled={busy || (p.roomPlan === 'campus' && realTeam && !room)}
            >
              Confirm booking
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setConfirming(null)}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  )
}
