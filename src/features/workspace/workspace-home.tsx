import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { FilePlus2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { useConfirm } from '@/components/confirm-context'
import { Button } from '@/components/ui/button'
import { TEMPLATES, instantiateTemplate } from '@/domain/workspace-templates'
import { addCapture, createPage, pendingInvites, respondInvite } from '@/domain/workspace-logic'
import { ImportNotes } from './import-cards'
import { formatDayMonth, formatInstant } from '@/lib/time'
import {
  accessibleBackup,
  assignedTo,
  continueWorking,
  projectsFor,
  recentActivity,
  spacesFor,
  taskCounts,
  upcomingMeetings,
} from '@/selectors/workspace'
import { downloadText } from './download'
import { useWorkspace } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { Empty, fieldClass, Pill, StatusPill, WsCard } from './ws-ui'

export function WorkspaceHomePage() {
  return (
    <article>
      <PageHeader
        title="Workspace"
        description="Capture an idea, develop it with a team, assign the work, find a time to meet and keep what you decided."
      />
      <WorkspaceShell>
        <Body />
      </WorkspaceShell>
    </article>
  )
}

function Body() {
  const w = useWorkspace()
  const { ws, actor, act, name } = w
  const navigate = useNavigate()
  const seeded = w.services.workspace.seeded
  const confirm = useConfirm()
  const [capture, setCapture] = useState('')
  const [opIds] = useState(() => new Map<string, string>())

  const personal = ws.spaces.find((s) => s.type === 'personal' && s.ownerId === actor)
  const spaces = spacesFor(ws, actor)
  const recent = continueWorking(ws, actor)
  const mine = assignedTo(ws, actor)
  const projects = projectsFor(ws, actor)
  const meetings = upcomingMeetings(ws, actor, w.now.today).slice(0, 4)
  const activity = recentActivity(ws, actor)
  const inbox = ws.captures.filter((c) => c.ownerId === actor)
  const invites = pendingInvites(ws, actor)
  const empty = !recent.length && !projects.length && !inbox.length

  const newNote = async () => {
    if (!personal) return
    const r = await act((s, c) => createPage(s, c, actor, { spaceId: personal.id, title: '' }))
    if (r.ok) void navigate(`/workspace/pages/${r.value.id}`)
  }
  const submitCapture = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act(
      (s, c) => addCapture(s, c, actor, capture),
      'Captured. File it from the Capture page when you are ready.',
    )
    if (r.ok) setCapture('')
  }
  const fromTemplate = async (id: string) => {
    const opId = opIds.get(id) ?? w.services.newId('op')
    opIds.set(id, opId)
    const r = await act((s, c) => instantiateTemplate(s, c, actor, id, { title: '', opId }))
    if (r.ok) void navigate(`/workspace/pages/${r.value.pageId}`)
  }
  const removeDemo = async () => {
    const choice = await confirm({
      title: ws.people.length ? 'Remove the demonstration team?' : 'Remove the starter content?',
      description:
        'This removes the starter spaces, notes, tasks and meetings built from your records (and the fictional demo team, if loaded), and anything added inside them. Notes in your own spaces that you created yourself are kept.',
      confirmLabel: ws.people.length ? 'Remove demo team' : 'Remove starter content',
      danger: true,
    })
    if (choice !== 'confirm') return
    w.setActAs(null)
    await w.services.workspace.removeDemo()
  }
  const loadDemo = async () => {
    const r = await w.services.workspace.loadDemo()
    if (r.ok) {
      w.toast.notify('success', 'Demo team loaded. You are now viewing as Aarav Mehta (fictional).')
    } else w.toast.notify('error', r.error.message)
  }
  const exportAll = () =>
    downloadText(
      'campusos-workspace-backup.json',
      JSON.stringify(accessibleBackup(ws, actor), null, 2),
      'application/json',
    )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Button
          type="button"
          className="min-h-11"
          onClick={() => void newNote()}
          disabled={!personal}
        >
          <FilePlus2 aria-hidden="true" /> New note
        </Button>
        <form
          onSubmit={(e) => void submitCapture(e)}
          className="flex min-w-0 flex-1 flex-wrap items-end gap-2"
        >
          <div className="flex min-w-60 flex-1 flex-col gap-1">
            <label htmlFor="ws-capture" className="text-sm font-medium text-ink">
              Quick capture
            </label>
            <input
              id="ws-capture"
              value={capture}
              onChange={(e) => setCapture(e.target.value)}
              placeholder="An idea, a to-do, a link. File it later."
              className={fieldClass}
            />
          </div>
          <Button type="submit" variant="outline" className="min-h-11">
            Capture
          </Button>
        </form>
      </div>

      {empty ? (
        <WsCard title="Start with a project, course notebook or quick note" id="ws-empty">
          <p className="mb-3 text-sm text-ink-muted">
            Pick a template below, or write a blank note.
            {seeded
              ? ''
              : ' Want to see how a team uses it? Load the fictional demonstration team.'}
          </p>
          {seeded ? null : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void loadDemo()}
            >
              Load the demo team
            </Button>
          )}
        </WsCard>
      ) : null}

      {invites.length ? (
        <WsCard title="Invitations" id="ws-invites">
          <ul className="flex flex-col gap-2">
            {invites.map((m) => {
              const sp = ws.spaces.find((s) => s.id === m.spaceId)
              return (
                <li
                  key={m.spaceId}
                  className="flex flex-wrap items-center justify-between gap-2 text-sm"
                >
                  <span>
                    <strong>{sp?.title ?? 'A space'}</strong>:{' '}
                    {m.invitedBy ? `${name(m.invitedBy)} invited you` : 'You were invited'} as{' '}
                    {m.role}.
                  </span>
                  <span className="flex gap-2">
                    <Button
                      type="button"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          (s, c) => respondInvite(s, c, actor, m.spaceId, true),
                          'You joined the space.',
                        )
                      }
                    >
                      Accept<span className="sr-only"> {sp?.title}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          (s, c) => respondInvite(s, c, actor, m.spaceId, false),
                          'Invitation declined.',
                        )
                      }
                    >
                      Decline<span className="sr-only"> {sp?.title}</span>
                    </Button>
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-xs text-ink-muted">
            Until you accept, the space and its notes are not visible to you.
          </p>
        </WsCard>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <WsCard title="Continue working" id="ws-continue">
          {recent.length ? (
            <ul className="flex flex-col gap-1">
              {recent.map((p) => (
                <li key={p.id} className="flex items-baseline justify-between gap-2">
                  <Link
                    to={`/workspace/pages/${p.id}`}
                    className="min-h-11 py-2 font-medium text-ink underline"
                  >
                    {p.icon ? `${p.icon} ` : ''}
                    {p.title || 'Untitled'}
                  </Link>
                  <span className="text-xs text-ink-muted">{formatInstant(p.updatedAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing opened yet. Your most recent notes appear here.</Empty>
          )}
        </WsCard>

        <WsCard title="Assigned to me" id="ws-assigned">
          {mine.length ? (
            <ul className="flex flex-col gap-1">
              {mine.slice(0, 6).map((t) => (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link
                    to={`/workspace/projects/${t.projectId}`}
                    className="min-h-11 py-2 text-ink underline"
                  >
                    {t.title}
                  </Link>
                  <span className="flex items-center gap-2 text-xs text-ink-muted">
                    {t.dueDate ? `due ${formatDayMonth(t.dueDate)}` : 'no date'}
                    <StatusPill status={t.status} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              No open team tasks are assigned to {actor === w.profileId ? 'you' : name(actor)}.
            </Empty>
          )}
        </WsCard>

        <WsCard title="My teams" id="ws-teams">
          {projects.length ? (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => {
                const n = taskCounts(ws, p.id)
                return (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={`/workspace/projects/${p.id}`}
                      className="font-medium text-ink underline"
                    >
                      {p.title}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {n.done} of {n.total} tasks done
                      {p.targetDate ? ` · team target ${formatDayMonth(p.targetDate)}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Empty>
              You are not in a team project yet. Start one from the “Team assignment” template.
            </Empty>
          )}
        </WsCard>

        <WsCard title="Coming up" id="ws-upcoming">
          {meetings.length ? (
            <ul className="flex flex-col gap-1">
              {meetings.map((m) => (
                <li key={m.id} className="text-sm">
                  <Link
                    to={`/workspace/projects/${m.projectId}?tab=calendar`}
                    className="font-medium text-ink underline"
                  >
                    {m.title}
                  </Link>{' '}
                  <span className="text-ink-muted">
                    {formatDayMonth(m.date)}, {m.start}–{m.end}
                    {m.roomLabel ? ` · ${m.roomLabel}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              No team meetings are booked. Open a project and choose “Find a team time”.
            </Empty>
          )}
        </WsCard>

        <WsCard title="Recent activity" id="ws-activity">
          {activity.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {activity.map((a) => (
                <li key={a.id}>
                  <strong>{name(a.actorId)}</strong>{' '}
                  {a.text.charAt(0).toLowerCase() + a.text.slice(1)}{' '}
                  <span className="text-xs text-ink-muted">{formatInstant(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Edits, decisions, comments and task changes in your shared spaces show up here.
            </Empty>
          )}
        </WsCard>

        <WsCard
          title="Capture inbox"
          id="ws-inbox"
          action={
            <Link to="/workspace/capture" className="text-sm font-medium text-coffee underline">
              Open inbox
            </Link>
          }
        >
          {inbox.length ? (
            <p className="text-sm">
              {inbox.length} unfiled {inbox.length === 1 ? 'item' : 'items'}, latest: “
              {inbox[0]!.text.slice(0, 60)}”
            </p>
          ) : (
            <Empty>Nothing waiting. Quick captures that you have not filed appear here.</Empty>
          )}
        </WsCard>
      </div>

      <WsCard title="Spaces" id="ws-spaces">
        <ul className="flex flex-wrap gap-2">
          {spaces.map((s) => (
            <li key={s.id}>
              <Link
                to={`/workspace/spaces/${s.id}`}
                className="flex min-h-11 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-ink hover:bg-mist"
              >
                {s.title}
                {s.type === 'personal' ? <Pill>Private</Pill> : null}
              </Link>
            </li>
          ))}
        </ul>
      </WsCard>

      <WsCard title="Start from a template" id="ws-templates">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 rounded-md border border-border p-3">
              <h3 className="font-semibold text-ink">
                <span aria-hidden="true">{t.icon}</span> {t.name}
              </h3>
              <p className="text-sm text-ink-muted">{t.blurb}</p>
              <Button
                type="button"
                variant="outline"
                className="mt-auto min-h-11"
                onClick={() => void fromTemplate(t.id)}
              >
                {t.kind === 'team' ? 'Create team space' : 'Create note'}
                <span className="sr-only"> from {t.name}</span>
              </Button>
            </li>
          ))}
        </ul>
      </WsCard>

      <ImportNotes w={w} />

      <WsCard
        title={seeded ? 'Backup and starter content' : 'Demonstration team and backup'}
        id="ws-tools"
      >
        <p className="mb-3 text-sm text-ink-muted">
          {seeded
            ? 'Your starter notes, tasks, meetings and shared projects were built from your own records. Remove them any time and restore them later; notes you wrote yourself are never touched.'
            : 'The demo team is five fictional students with invented tasks, notes and dates, so you can try roles, privacy, scheduling and review without real people. It is kept apart from your own notes.'}
        </p>
        <div className="flex flex-wrap gap-2">
          {ws.people.length || (ws.seedVersion && ws.seedVersion !== 'off') ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void removeDemo()}
            >
              {ws.people.length ? 'Remove demo team' : 'Remove starter content'}
            </Button>
          ) : seeded ? null : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void loadDemo()}
            >
              Load the demo team
            </Button>
          )}
          {w.services.workspace.seeded && ws.seedVersion === 'off' ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void w.services.workspace.restoreSamples()}
            >
              Restore the starter content
            </Button>
          ) : null}
          {w.isRealProfile && !ws.seedVersion && !ws.spaces.some((s) => s.id === 'sp-team3') ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void w.services.workspace
                  .loadTeamProject()
                  .then(
                    (r) =>
                      r.ok &&
                      w.toast.notify(
                        'success',
                        'Shared project added for Ananya, Abeer and Myra. Switch persona in the top bar to collaborate as each.',
                      ),
                  )
              }
            >
              Add a project shared by the 3 personas
            </Button>
          ) : null}
          <Button type="button" variant="outline" className="min-h-11" onClick={exportAll}>
            Export what I can open (JSON)
          </Button>
        </div>
      </WsCard>
    </div>
  )
}
