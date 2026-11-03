import { NotebookPen } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { addCapture, pendingInvites } from '@/domain/workspace-logic'
import { formatDayMonth } from '@/lib/time'
import { assignedTo, continueWorking, upcomingMeetings } from '@/selectors/workspace'
import { EmptyNote, HomeCard } from '../home/home-card'
import { useWorkspace } from './use-workspace'
import { fieldClass } from './ws-ui'

/** Home card for Workspace: what is assigned to you, what you were writing, and a quick capture. */
export function WorkspaceWidget() {
  const w = useWorkspace()
  const [text, setText] = useState('')
  const { ws, actor, now } = w
  const mine = assignedTo(ws, actor).slice(0, 3)
  const recent = continueWorking(ws, actor, 2)
  const next = upcomingMeetings(ws, actor, now.today)[0]
  const invites = pendingInvites(ws, actor).length
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const r = await w.act(
      (s, c) => addCapture(s, c, actor, text),
      'Captured. File it from Workspace → Capture.',
    )
    if (r.ok) setText('')
  }
  return (
    <HomeCard
      id="workspace"
      title="Workspace"
      icon={<NotebookPen className="size-4 text-teal-strong" aria-hidden="true" />}
      action={
        <Link to="/workspace" className="text-sm font-medium text-coffee underline">
          Open
        </Link>
      }
    >
      {w.status !== 'ready' ? (
        <output className="text-ink-muted">Loading…</output>
      ) : (
        <div className="flex flex-col gap-3">
          {invites ? (
            <p className="rounded-md bg-warning/15 p-2">
              <Link to="/workspace" className="font-medium underline">
                {invites} invitation{invites === 1 ? '' : 's'} to a shared space
              </Link>{' '}
              waiting for your answer.
            </p>
          ) : null}
          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink">Assigned to me</h3>
            {mine.length ? (
              <ul className="flex flex-col gap-1">
                {mine.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-2">
                    <Link
                      to={`/workspace/projects/${t.projectId}?tab=tasks`}
                      className="min-h-9 py-1.5 text-ink underline"
                    >
                      {t.title}
                    </Link>
                    <span className="text-xs text-ink-muted">
                      {t.dueDate ? `due ${formatDayMonth(t.dueDate)}` : 'no date'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyNote>No team tasks are assigned to you.</EmptyNote>
            )}
          </div>
          {next ? (
            <p>
              <strong>Next team meeting:</strong> {next.title}, {formatDayMonth(next.date)}{' '}
              {next.start}
            </p>
          ) : null}
          {recent.length ? (
            <div>
              <h3 className="mb-1 text-sm font-semibold text-ink">Continue working</h3>
              <ul>
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={`/workspace/pages/${p.id}`}
                      className="inline-block min-h-9 py-1.5 text-ink underline"
                    >
                      {p.title || 'Untitled'}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <form onSubmit={(e) => void submit(e)} className="flex items-end gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
              Quick capture
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="An idea or to-do"
                className={fieldClass}
              />
            </label>
            <Button type="submit" variant="outline" className="min-h-11">
              Capture
            </Button>
          </form>
        </div>
      )}
    </HomeCard>
  )
}
