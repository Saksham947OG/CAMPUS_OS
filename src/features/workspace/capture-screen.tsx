import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { can, roleOf } from '@/domain/workspace-access'
import { addCapture, deleteCapture, fileCapture } from '@/domain/workspace-logic'
import { formatInstant } from '@/lib/time'
import { spacesFor } from '@/selectors/workspace'
import { Link } from 'react-router'
import { useWorkspace } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { Empty, fieldClass } from './ws-ui'

export function CaptureScreen() {
  return (
    <article>
      <PageHeader
        title="Capture"
        description="Unfiled ideas and quick notes. Put each one somewhere when you are ready."
      />
      <WorkspaceShell>
        <Inbox />
      </WorkspaceShell>
    </article>
  )
}

function Inbox() {
  const w = useWorkspace()
  const { ws, actor, act } = w
  const [text, setText] = useState('')
  const [dest, setDest] = useState<Record<string, string>>({})
  const mine = ws.captures.filter((c) => c.ownerId === actor)
  const writable = spacesFor(ws, actor).filter((s) => can(roleOf(ws, s.id, actor), 'edit'))
  const personal = writable.find((s) => s.type === 'personal')
  const add = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act((s, c) => addCapture(s, c, actor, text), 'Captured.')
    if (r.ok) setText('')
  }
  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <form onSubmit={(e) => void add(e)} className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-60 flex-1 flex-col gap-1 text-sm font-medium text-ink">
          New capture
          <textarea
            rows={2}
            className={`${fieldClass} py-2`}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <Button type="submit" className="min-h-11">
          Capture
        </Button>
      </form>
      {mine.length ? (
        <ul className="flex flex-col gap-3">
          {mine.map((c) => {
            const to = dest[c.id] ?? personal?.id ?? ''
            return (
              <li key={c.id} className="rounded-lg border border-border bg-surface p-3 shadow-card">
                <p className="whitespace-pre-wrap text-ink">{c.text}</p>
                <p className="text-xs text-ink-muted">{formatInstant(c.createdAt)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    File into
                    <select
                      className={fieldClass}
                      value={to}
                      onChange={(e) => setDest({ ...dest, [c.id]: e.target.value })}
                    >
                      {writable.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={!to}
                    onClick={() =>
                      void act(
                        (s, cx) => fileCapture(s, cx, actor, c.id, to),
                        'Filed as a private note.',
                      )
                    }
                  >
                    Make a note
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => void act((s, cx) => deleteCapture(s, cx, actor, c.id))}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty>Nothing waiting. Use the box above, or “Quick capture” on Workspace home.</Empty>
      )}
      <p className="text-sm text-ink-muted">
        A filed capture becomes a private note you can then share or turn into tasks.{' '}
        <Link to="/workspace" className="underline">
          Back to Workspace
        </Link>
      </p>
    </div>
  )
}
