import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import { cancelMeeting, respondMeeting } from '@/domain/workspace-logic'
import { FindTeamTime } from './find-team-time'
import { PollsPanel } from './polls-panel'
import type { Project, WsMeeting } from '@/domain/workspace'
import { DEMO_AVAILABILITY_DATE } from '@/data/seeds/demo/workspace-demo'
import {
  addDays,
  formatDateLong,
  formatDayMonth,
  formatTimeRange,
  startOfWeek,
  type DateOnly,
} from '@/lib/time'
import type { WorkspaceApi } from './use-workspace'
import { Empty, Pill } from './ws-ui'

type Layer = 'meetings' | 'deadlines' | 'milestones'
interface Item {
  key: string
  date: DateOnly
  sort: string
  kind: Layer
  node: React.ReactNode
}

export function CalendarTab({ w, project }: { w: WorkspaceApi; project: Project }) {
  const { ws, actor, now } = w
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    meetings: true,
    deadlines: true,
    milestones: true,
  })
  const [view, setView] = useState<'agenda' | 'week'>('agenda')
  const [week, setWeek] = useState<DateOnly>(() =>
    startOfWeek(
      ws.members.some(
        (m) => m.spaceId === project.spaceId && ws.people.some((p) => p.id === m.userId),
      )
        ? DEMO_AVAILABILITY_DATE
        : now.today,
    ),
  )
  const role = roleOf(ws, project.spaceId, actor)

  const items: Item[] = []
  for (const m of ws.meetings.filter((x) => x.projectId === project.id && x.status === 'confirmed'))
    items.push({
      key: m.id,
      date: m.date,
      sort: m.start,
      kind: 'meetings',
      node: <MeetingRow w={w} m={m} />,
    })
  for (const t of ws.tasks.filter(
    (x) =>
      x.projectId === project.id && x.dueDate && x.status !== 'canceled' && x.status !== 'done',
  ))
    items.push({
      key: t.id,
      date: t.dueDate!,
      sort: '99:99',
      kind: 'deadlines',
      node: (
        <p className="text-sm">
          <Pill>Task due</Pill> {t.title}{' '}
          <span className="text-ink-muted">
            · {t.assigneeId ? w.name(t.assigneeId) : 'unassigned'} · date only, not a busy block
          </span>
        </p>
      ),
    })
  if (project.targetDate)
    items.push({
      key: 'target',
      date: project.targetDate,
      sort: '99:98',
      kind: 'milestones',
      node: (
        <p className="text-sm">
          <Pill tone="teal">Team target</Pill> {project.title}{' '}
          <span className="text-ink-muted">· the team’s own date, not a professor’s deadline</span>
        </p>
      ),
    })
  if (project.deadline)
    items.push({
      key: 'deadline',
      date: project.deadline.date,
      sort: '99:97',
      kind: 'milestones',
      node: (
        <p className="text-sm">
          <Pill tone="warn">Deadline</Pill> {project.title}{' '}
          <span className="text-ink-muted">· source: {project.deadline.source}</span>
        </p>
      ),
    })

  const visible = items
    .filter((i) => layers[i.kind])
    .sort((a, b) => a.date.localeCompare(b.date) || a.sort.localeCompare(b.sort))
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const shown =
    view === 'week'
      ? visible.filter((i) => i.date >= week && i.date <= addDays(week, 6))
      : visible.filter((i) => i.date >= now.today).slice(0, 40)
  const byDate = new Map<DateOnly, Item[]>()
  for (const i of shown) byDate.set(i.date, [...(byDate.get(i.date) ?? []), i])
  const dates = view === 'week' ? days : [...byDate.keys()]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex flex-wrap items-center gap-3">
          <legend className="sr-only">Calendar layers</legend>
          {(
            [
              ['meetings', 'Meetings'],
              ['deadlines', 'Task deadlines'],
              ['milestones', 'Milestones'],
            ] as [Layer, string][]
          ).map(([id, label]) => (
            <label key={id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4"
                checked={layers[id]}
                onChange={(e) => setLayers({ ...layers, [id]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </fieldset>
        <fieldset className="ml-auto flex gap-1">
          <legend className="sr-only">View</legend>
          {(['agenda', 'week'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-9 rounded-md px-3 text-sm text-ink ${view === v ? 'bg-teal-tint font-semibold' : 'hover:bg-mist'}`}
            >
              {v === 'agenda' ? 'Agenda' : 'Week'}
            </button>
          ))}
        </fieldset>
      </div>
      {view === 'week' ? (
        <div className="flex items-center gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => setWeek(addDays(week, -7))}
          >
            Previous week
          </Button>
          <strong>
            {formatDayMonth(week)} – {formatDayMonth(addDays(week, 6))}
          </strong>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => setWeek(addDays(week, 7))}
          >
            Next week
          </Button>
        </div>
      ) : null}

      {dates.length ? (
        <ul className={view === 'week' ? 'grid gap-2 md:grid-cols-7' : 'flex flex-col gap-3'}>
          {dates.map((d) => (
            <li key={d} className="rounded-md border border-border p-2">
              <h3 className="text-sm font-semibold text-ink">
                {view === 'week' ? formatDayMonth(d) : formatDateLong(d)}
              </h3>
              {byDate.get(d)?.length ? (
                <ul className="mt-1 flex flex-col gap-2">
                  {byDate.get(d)!.map((i) => (
                    <li key={i.key}>{i.node}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-ink-muted">Nothing booked.</p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          Nothing upcoming with these layers on. Use “Find a team time” below to book a meeting.
        </Empty>
      )}

      <PollsPanel w={w} project={project} />
      {can(role, 'edit') ? (
        <FindTeamTime w={w} project={project} />
      ) : (
        <p className="text-sm text-ink-muted">
          Only editors and owners can schedule meetings. You can answer invitations.
        </p>
      )}
      <p className="text-xs text-ink-muted">
        This is the team’s view inside Workspace. Meetings between real CampusOS profiles are also
        in each person’s main{' '}
        <Link to="/calendar" className="underline">
          Calendar
        </Link>{' '}
        with the room held; team tasks with a due date appear there as deadlines. Nobody is emailed.
      </p>
    </div>
  )
}

function MeetingRow({ w, m }: { w: WorkspaceApi; m: WsMeeting }) {
  const { ws, actor, act } = w
  const me = m.attendees.find((a) => a.userId === actor)
  const counts = { YES: 0, NO: 0, MAYBE: 0, INVITED: 0 }
  m.attendees.forEach((a) => counts[a.rsvp]++)
  const project = ws.projects.find((p) => p.id === m.projectId)
  const mayCancel =
    m.organizerId === actor || (project && can(roleOf(ws, project.spaceId, actor), 'manage'))
  return (
    <div className="text-sm">
      <p>
        <Pill tone="teal">Meeting</Pill> <strong>{m.title}</strong> ·{' '}
        {formatTimeRange(m.start, m.end)}
        {m.roomLabel ? ` · ${m.roomLabel}` : ''}
      </p>
      <p className="text-xs text-ink-muted">
        {counts.YES} yes · {counts.MAYBE} maybe · {counts.NO} no · {counts.INVITED} not answered.
        Organiser: {w.name(m.organizerId)}.
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {me ? (
          <fieldset className="flex gap-1">
            <legend className="sr-only">Your answer to {m.title}</legend>
            {(['YES', 'MAYBE', 'NO'] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={me.rsvp === r}
                onClick={() => void act((s, c) => respondMeeting(s, c, actor, m.id, r))}
                className={`min-h-9 rounded-md border border-border px-2 text-xs text-ink ${me.rsvp === r ? 'bg-teal-tint font-semibold' : 'hover:bg-mist'}`}
              >
                {r === 'YES' ? 'Going' : r === 'MAYBE' ? 'Maybe' : "Can't go"}
              </button>
            ))}
          </fieldset>
        ) : null}
        {mayCancel ? (
          <button
            type="button"
            className="min-h-9 text-xs text-coffee underline"
            onClick={() =>
              void act((s, c) => cancelMeeting(s, c, actor, m.id), 'Meeting cancelled.')
            }
          >
            Cancel meeting
          </button>
        ) : null}
      </div>
    </div>
  )
}
