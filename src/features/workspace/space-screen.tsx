import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import {
  addMember,
  changeRole,
  createPage,
  createProject,
  removeMember,
  restorePage,
} from '@/domain/workspace-logic'
import { createCanvas, setRule } from '@/domain/workspace-ext'
import { RULES } from '@/domain/workspace-auto'
import { FilesPanel } from './files-panel'
import { ROLES, ROLE_LABEL, type Role } from '@/domain/workspace'
import type { DateOnly } from '@/lib/time'
import { formatDayMonth, formatInstant } from '@/lib/time'
import { pageTree, readablePages, taskCounts, type TreeNode } from '@/selectors/workspace'
import { useWorkspace, type WorkspaceApi } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { AudiencePill, Empty, LifecyclePill, Pill, RolePill, WsCard, fieldClass } from './ws-ui'

export function SpaceScreen() {
  const { spaceId: id = '' } = useParams()
  return (
    <WorkspaceShell>
      <Space id={id} />
    </WorkspaceShell>
  )
}

function Space({ id }: { id: string }) {
  const w = useWorkspace()
  const navigate = useNavigate()
  const { ws, actor } = w
  const space = ws.spaces.find((s) => s.id === id)
  const role = space ? roleOf(ws, id, actor) : null
  if (!space || !role)
    return (
      <article>
        <PageHeader
          title="Space not available"
          description="This space does not exist, or you are not a member of it."
        />
        <Link to="/workspace" className="font-medium underline">
          Back to Workspace
        </Link>
      </article>
    )
  const tree = pageTree(ws, actor, id)
  const bin = readablePages(ws, actor, { spaceId: id, trashed: true })
  const projects = ws.projects.filter((p) => p.spaceId === id)
  const edit = can(role, 'edit')
  const members = ws.members.filter((m) => m.spaceId === id)
  const activity = ws.activity.filter((a) => a.spaceId === id).slice(0, 6)

  const newPage = async (parentId?: string) => {
    const r = await w.act((s, c) =>
      createPage(s, c, actor, { spaceId: id, title: '', ...(parentId ? { parentId } : {}) }),
    )
    if (r.ok) void navigate(`/workspace/pages/${r.value.id}`)
  }

  return (
    <article>
      <PageHeader
        title={space.title}
        description={space.purpose}
        badge={<RolePill role={role} />}
      />
      <div className="grid max-w-6xl gap-4 lg:grid-cols-2">
        <WsCard
          title="Pages"
          id="sp-pages"
          action={
            edit ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => void newPage()}
              >
                New page
              </Button>
            ) : null
          }
        >
          {tree.length ? (
            <Tree nodes={tree} edit={edit} onAdd={(p) => void newPage(p)} />
          ) : (
            <Empty>No pages yet.</Empty>
          )}
        </WsCard>

        <WsCard title="Projects" id="sp-projects">
          {projects.length ? (
            <ul className="mb-3 flex flex-col gap-2">
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
            <Empty>No project in this space yet.</Empty>
          )}
          {edit && space.type !== 'personal' ? <NewProject w={w} spaceId={id} /> : null}
        </WsCard>

        {space.type !== 'personal' ? (
          <Members w={w} spaceId={id} members={members} manage={can(role, 'manage')} />
        ) : null}

        <Canvases w={w} spaceId={id} edit={edit} personal={space.type === 'personal'} />
        <WsCard title="Files" id="sp-files">
          <FilesPanel
            w={w}
            spaceId={id}
            audience={space.type === 'personal' ? 'private' : 'space'}
          />
        </WsCard>
        {space.type !== 'personal' ? (
          <Automations w={w} spaceId={id} manage={can(role, 'manage')} />
        ) : null}

        <WsCard title="Recent activity" id="sp-activity">
          {activity.length ? (
            <ul className="flex flex-col gap-1 text-sm">
              {activity.map((a) => (
                <li key={a.id}>
                  <strong>{w.name(a.actorId)}</strong>{' '}
                  {a.text.charAt(0).toLowerCase() + a.text.slice(1)}{' '}
                  <span className="text-xs text-ink-muted">{formatInstant(a.at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing yet.</Empty>
          )}
        </WsCard>

        {bin.length ? (
          <WsCard title="Bin" id="sp-bin">
            <ul className="flex flex-col gap-1">
              {bin.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                  <Link to={`/workspace/pages/${p.id}`} className="underline">
                    {p.title || 'Untitled'}
                  </Link>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() =>
                      void w.act((s, c) => restorePage(s, c, actor, p.id), 'Page restored.')
                    }
                  >
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          </WsCard>
        ) : null}
      </div>
    </article>
  )
}

function Tree({
  nodes,
  edit,
  onAdd,
}: {
  nodes: TreeNode[]
  edit: boolean
  onAdd: (parent: string) => void
}) {
  return (
    <ul className="flex flex-col">
      {nodes.map((n) => (
        <li key={n.page.id}>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/workspace/pages/${n.page.id}`}
              className="inline-flex min-h-11 items-center gap-1 font-medium text-ink underline"
            >
              {n.page.icon ? <span aria-hidden="true">{n.page.icon}</span> : null}
              {n.page.title || 'Untitled'}
            </Link>
            <AudiencePill audience={n.page.audience} />
            {n.page.lifecycle !== 'draft' ? <LifecyclePill lifecycle={n.page.lifecycle} /> : null}
            {edit ? (
              <button
                type="button"
                className="min-h-9 text-xs text-coffee underline"
                onClick={() => onAdd(n.page.id)}
              >
                Add subpage<span className="sr-only"> under {n.page.title || 'Untitled'}</span>
              </button>
            ) : null}
          </div>
          {n.children.length ? (
            <div className="ml-4 border-l border-border pl-3">
              <Tree nodes={n.children} edit={edit} onAdd={onAdd} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

function NewProject({ w, spaceId }: { w: WorkspaceApi; spaceId: string }) {
  const [title, setTitle] = useState('')
  const [target, setTarget] = useState('')
  const [op, setOp] = useState(() => w.services.newId('op'))
  const navigate = useNavigate()
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = await w.act((s, c) =>
      createProject(s, c, w.actor, {
        spaceId,
        title,
        ...(target ? { targetDate: target as DateOnly } : {}),
        opId: op,
      }),
    )
    if (r.ok) {
      setTitle('')
      setTarget('')
      setOp(w.services.newId('op'))
      void navigate(`/workspace/projects/${r.value.id}`)
    }
  }
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className="flex flex-wrap items-end gap-2"
      aria-label="Start a project"
    >
      <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-ink">
        New project
        <input
          className={fieldClass}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Project name"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-ink">
        Team target (optional)
        <input
          type="date"
          className={fieldClass}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <Button type="submit" variant="outline" className="min-h-11">
        Start project
      </Button>
    </form>
  )
}

function Members({
  w,
  spaceId,
  members,
  manage,
}: {
  w: WorkspaceApi
  spaceId: string
  members: { userId: string; role: Role; invitation?: 'pending' | 'declined' }[]
  manage: boolean
}) {
  const [add, setAdd] = useState('')
  const [role, setRole] = useState<Role>('editor')
  const candidates = [
    ...w.ws.people.map((p) => ({ id: p.id, name: `${p.name} (member)` })),
    ...w.profiles.map((p) => ({ id: p.id, name: p.displayName })),
  ].filter((c) => !members.some((m) => m.userId === c.id))
  return (
    <WsCard title="People and roles" id="sp-members">
      <ul className="flex flex-col gap-1">
        {members.map((m) => (
          <li key={m.userId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {w.name(m.userId)}
              {m.invitation === 'pending' ? (
                <Pill tone="warn">Invited, waiting for an answer</Pill>
              ) : null}
              {m.invitation === 'declined' ? <Pill tone="danger">Declined</Pill> : null}
            </span>
            {manage ? (
              <span className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`role-${m.userId}`}>
                  Role of {w.name(m.userId)}
                </label>
                <select
                  id={`role-${m.userId}`}
                  className={fieldClass}
                  value={m.role}
                  onChange={(e) =>
                    void w.act(
                      (s, c) =>
                        changeRole(s, c, w.actor, spaceId, m.userId, e.target.value as Role),
                      'Role changed.',
                    )
                  }
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABEL[r]}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  onClick={() =>
                    void w.act(
                      (s, c) => removeMember(s, c, w.actor, spaceId, m.userId),
                      'Removed from the space.',
                    )
                  }
                >
                  Remove<span className="sr-only"> {w.name(m.userId)}</span>
                </Button>
              </span>
            ) : (
              <RolePill role={m.role} />
            )}
          </li>
        ))}
      </ul>
      {manage && candidates.length ? (
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (add)
              void w
                .act((s, c) => addMember(s, c, w.actor, spaceId, add, role), 'Added to the space.')
                .then((r) => r.ok && setAdd(''))
          }}
        >
          <label className="flex flex-col gap-1 text-sm text-ink">
            Add a person
            <select className={fieldClass} value={add} onChange={(e) => setAdd(e.target.value)}>
              <option value="">Choose…</option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Role
            <select
              className={fieldClass}
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
            >
              {ROLES.filter((r) => r !== 'owner').map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="min-h-11" disabled={!add}>
            {add && !w.ws.people.some((p) => p.id === add) ? 'Invite' : 'Add'}
          </Button>
        </form>
      ) : null}
      <p className="mt-2 text-xs text-ink-muted">
        <Pill>Local only</Pill> Roles are enforced in this browser to show how sharing will work.
        They are not account security, and separate devices do not share these spaces yet.
      </p>
    </WsCard>
  )
}

function Canvases({
  w,
  spaceId,
  edit,
  personal,
}: {
  w: WorkspaceApi
  spaceId: string
  edit: boolean
  personal: boolean
}) {
  const [title, setTitle] = useState('')
  const navigate = useNavigate()
  const list = w.ws.canvases.filter(
    (c) => c.spaceId === spaceId && (c.audience === 'space' || c.authorId === w.actor),
  )
  return (
    <WsCard title="Canvases" id="sp-canvases">
      {list.length ? (
        <ul className="mb-3 flex flex-col gap-1">
          {list.map((c) => (
            <li key={c.id}>
              <Link
                to={`/workspace/canvases/${c.id}`}
                className="inline-flex min-h-9 items-center font-medium text-ink underline"
              >
                {c.title}
              </Link>{' '}
              <span className="text-xs text-ink-muted">{c.cards.length} cards</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No canvas yet. Use one to lay notes out and connect ideas.</Empty>
      )}
      {edit ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void w
              .act((s, c) =>
                createCanvas(s, c, w.actor, {
                  spaceId,
                  title,
                  audience: personal ? 'private' : 'space',
                }),
              )
              .then((r) => {
                if (r.ok) {
                  setTitle('')
                  void navigate(`/workspace/canvases/${r.value.id}`)
                }
              })
          }}
        >
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-ink">
            New canvas
            <input
              className={fieldClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Canvas name"
            />
          </label>
          <Button type="submit" variant="outline" className="min-h-11">
            Create canvas
          </Button>
        </form>
      ) : null}
    </WsCard>
  )
}

function Automations({
  w,
  spaceId,
  manage,
}: {
  w: WorkspaceApi
  spaceId: string
  manage: boolean
}) {
  const space = w.ws.spaces.find((s) => s.id === spaceId)!
  const log = w.ws.automationLog.filter((l) => l.spaceId === spaceId).slice(0, 6)
  return (
    <WsCard title="Automations" id="sp-auto">
      <p className="mb-2 text-sm text-ink-muted">
        Four fixed rules. They only post in-app notifications and create pages inside Workspace,
        never trigger each other, and never repeat for the same event. Nothing is emailed.
      </p>
      <ul className="flex flex-col gap-2">
        {RULES.map((r) => {
          const on = !space.automationsOff?.includes(r.id)
          return (
            <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 text-sm">
              <span>
                <strong>{r.label}</strong>
                <br />
                <span className="text-ink-muted">
                  When: {r.trigger}. Then: {r.action}.
                </span>
              </span>
              <label className="flex min-h-9 items-center gap-2 text-ink">
                <input
                  type="checkbox"
                  className="size-5"
                  disabled={!manage}
                  checked={on}
                  onChange={(e) =>
                    void w.act((s, c) => setRule(s, c, w.actor, spaceId, r.id, e.target.checked))
                  }
                />
                {on ? 'On' : 'Off'}
                <span className="sr-only"> for {r.label}</span>
              </label>
            </li>
          )
        })}
      </ul>
      <h3 className="mt-3 text-sm font-semibold text-ink">Recent results</h3>
      {log.length ? (
        <ul className="text-sm">
          {log.map((l) => (
            <li key={l.id}>
              {l.text} <span className="text-xs text-ink-muted">{formatInstant(l.at)}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-muted">Nothing has triggered yet.</p>
      )}
    </WsCard>
  )
}
