import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router'
import { Search } from 'lucide-react'
import { useAppStore } from '@/app/app-store'
import { ensurePersonalSpace } from '@/domain/workspace-logic'
import { runDueReminders } from '@/domain/workspace-ext'
import { cn } from '@/lib/utils'
import { fieldClass } from './ws-ui'
import { useWorkspace } from './use-workspace'

const NAV = [
  { to: '/workspace', label: 'Home', end: true },
  { to: '/workspace/capture', label: 'Capture', end: false },
  { to: '/workspace/knowledge', label: 'Knowledge', end: false },
]

/**
 * Frame shared by every Workspace screen: sub-navigation, search (Ctrl/Cmd+K), the honest
 * "this device only" notice, and the labelled role simulator for the demonstration team.
 */
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const w = useWorkspace()
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const { status, ws, actor, name, act } = w
  const setFocusMode = useAppStore((s) => s.setFocusMode)

  const hasPersonal = ws.spaces.some((s) => s.type === 'personal' && s.ownerId === actor)
  useEffect(() => {
    if (status === 'ready' && !hasPersonal)
      void act((s, c) => ensurePersonalSpace(s, c, actor, name(actor)))
  }, [status, hasPersonal, actor, act, name])

  // Due-date reminders are checked when a real profile opens Workspace; there is no background process.
  const hasTasks = ws.tasks.some((t) => t.assigneeId === actor)
  useEffect(() => {
    if (status === 'ready' && w.isRealProfile && hasTasks)
      void act((s, c) => runDueReminders(s, c, actor))
  }, [status, w.isRealProfile, hasTasks, actor, act])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    void navigate(`/workspace/knowledge?q=${encodeURIComponent(q.trim())}`)
  }

  if (status === 'loading')
    return <output className="block text-ink-muted">Loading Workspace…</output>
  if (status === 'error')
    return (
      <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-ink">
        Workspace could not be loaded on this device. Reload the page; your saved notes were not
        changed.
      </p>
    )

  return (
    <div className="flex max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Workspace" className="flex gap-1">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-ink hover:bg-mist',
                  isActive && 'bg-teal-tint font-semibold',
                )
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setFocusMode(true)}
          className="press ml-auto min-h-11 rounded-md px-3 text-sm font-medium text-ink hover:bg-mist"
        >
          Focus mode
        </button>
        <form onSubmit={submit} className="flex items-center gap-2">
          <label htmlFor="ws-search" className="sr-only">
            Search Workspace
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-3.5 left-3 size-4 text-ink-muted"
              aria-hidden="true"
            />
            <input
              id="ws-search"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search notes, tasks, decisions"
              className={cn(fieldClass, 'w-64 pl-9 sm:w-80')}
            />
          </div>
        </form>
      </div>

      {ws.people.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          <label htmlFor="ws-viewas" className="font-medium text-ink">
            Viewing as
          </label>
          <select
            id="ws-viewas"
            className={fieldClass}
            value={w.simulating ? actor : ''}
            onChange={(e) => w.setActAs(e.target.value || null)}
          >
            <option value="">Me ({w.name(w.profileId)})</option>
            {ws.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (demo member)
              </option>
            ))}
          </select>
          <span className="text-ink-muted">
            A simulation on this device to show roles and privacy. Demo members are fictional; this
            is not a second signed-in person.
          </span>
        </div>
      ) : null}

      {children}

      <p className="text-xs text-ink-muted">
        Notes, tasks and meetings are saved in this browser. Sharing between devices arrives with
        sign-in, and no reminder or email is sent.{' '}
        <Link to="/workspace" className="underline">
          Workspace home
        </Link>
      </p>
    </div>
  )
}
