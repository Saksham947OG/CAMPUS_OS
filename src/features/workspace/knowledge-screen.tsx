import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { blockLinks, unresolvedTitles } from '@/domain/workspace-links'
import { backlinks, readablePages, searchWorkspace, spaceTitle } from '@/selectors/workspace'
import { useWorkspace } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { Empty, Pill, WsCard, fieldClass } from './ws-ui'

export function KnowledgeScreen() {
  return (
    <article>
      <PageHeader
        title="Knowledge"
        description="Search everything you can open, and see how your notes connect."
      />
      <WorkspaceShell>
        <Knowledge />
      </WorkspaceShell>
    </article>
  )
}

const KIND = { page: 'Note', task: 'Task', decision: 'Decision', source: 'Evidence' } as const

function Knowledge() {
  const w = useWorkspace()
  const { ws, actor } = w
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const hits = searchWorkspace(ws, actor, params.get('q') ?? '')
  const pages = readablePages(ws, actor)
  const rows = pages
    .map((p) => ({
      p,
      out: blockLinks(p.blocks).length,
      back: backlinks(ws, actor, p.id).length,
      missing: unresolvedTitles(p.blocks).length,
    }))
    .sort((a, b) => b.out + b.back - (a.out + a.back))
  const submitted = params.get('q') ?? ''
  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          setParams(q.trim() ? { q: q.trim() } : {}, { replace: true })
        }}
        className="flex items-end gap-2"
      >
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
          Search notes, tasks, decisions and evidence
          <input
            type="search"
            className={fieldClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>
      {submitted ? (
        <WsCard title={`Results for “${submitted}”`} id="kn-results">
          {hits.length ? (
            <ul className="flex flex-col gap-2">
              {hits.map((h) => (
                <li key={`${h.kind}-${h.id}`}>
                  <Pill>{KIND[h.kind]}</Pill>{' '}
                  <Link to={h.href} className="font-medium text-ink underline">
                    {h.title}
                  </Link>
                  <p className="text-xs text-ink-muted">{h.detail}</p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              Nothing you can open matches “{submitted}”. Private notes of other people are never
              searched.
            </Empty>
          )}
        </WsCard>
      ) : null}
      <WsCard title="How your notes connect" id="kn-map">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-left text-sm">
              <caption className="sr-only">Notes and their links</caption>
              <thead>
                <tr className="border-b border-border text-ink-muted">
                  <th scope="col" className="py-1">
                    Note
                  </th>
                  <th scope="col">Space</th>
                  <th scope="col">Links out</th>
                  <th scope="col">Backlinks</th>
                  <th scope="col">Not created</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ p, out, back, missing }) => (
                  <tr key={p.id} className="border-b border-border">
                    <th scope="row" className="py-1 font-medium">
                      <Link
                        to={`/workspace/pages/${p.id}`}
                        className="inline-flex min-h-9 items-center underline"
                      >
                        {p.title || 'Untitled'}
                      </Link>
                    </th>
                    <td>{spaceTitle(ws, p.spaceId)}</td>
                    <td>{out}</td>
                    <td>{back}</td>
                    <td>{missing || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No notes yet. Links appear here once a note mentions another with [[ ]].</Empty>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Only links you actually wrote are shown. Open a note to see its local graph. Suggestions
          are not generated.
        </p>
      </WsCard>
    </div>
  )
}
