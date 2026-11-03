import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { canEditPage } from '@/domain/workspace-access'
import { blockToWorkTask, createPage } from '@/domain/workspace-logic'
import type { Page } from '@/domain/workspace'
import {
  draftAgenda,
  explainConcept,
  proposeActions,
  relatedNotes,
  revisionQuestions,
  summarize,
  type Draft,
} from '@/selectors/workspace-assist'
import { readablePages } from '@/selectors/workspace'
import type { WorkspaceApi } from './use-workspace'
import { WsCard, fieldClass } from './ws-ui'

/**
 * A local, rule-based helper (spec §17). No AI service is used and nothing leaves this device. It
 * only works from notes the active person can open, names them, and creates nothing by itself.
 */
export function AssistPanel({
  w,
  page,
  projectId,
}: {
  w: WorkspaceApi
  page?: Page
  projectId?: string
}) {
  const { ws, actor, act } = w
  const projId = projectId ?? page?.projectId
  const projectPages = projId ? readablePages(ws, actor).filter((p) => p.projectId === projId) : []
  const [chosen, setChosen] = useState<string[]>(page ? [page.id] : projectPages.map((p) => p.id))
  const [term, setTerm] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const pages = (page ? [page] : projectPages).filter((p) => chosen.includes(p.id))

  const makeTask = async (pageId: string, blockId: string) => {
    if (!projId) return
    await act(
      (s, c) =>
        blockToWorkTask(s, c, actor, pageId, blockId, {
          projectId: projId,
          opId: `assist-${blockId}`,
        }),
      'Task added to the project board.',
    )
  }
  const agendaPage = async () => {
    if (!draft || !projId) return
    const project = ws.projects.find((p) => p.id === projId)!
    await act(
      (s, c) =>
        createPage(s, c, actor, {
          spaceId: project.spaceId,
          title: 'Agenda (draft)',
          projectId: projId,
          noteType: 'meeting',
          blocks: [
            {
              id: c.newId('b'),
              type: 'callout',
              text: 'Draft made by the Workspace helper from open items. Edit before using.',
            },
            ...draft.lines.map((l) => ({
              id: c.newId('b'),
              type: 'bullet' as const,
              text: l.text,
            })),
          ],
        }),
      'Agenda page created as a draft.',
    )
  }

  return (
    <WsCard title="Workspace helper" id={`assist-${page?.id ?? projId}`}>
      <p className="mb-2 text-xs text-ink-muted">
        A local helper, not an AI service. It rearranges what your notes already say, only from
        notes you can open, and every result is a draft to check.
      </p>
      {!page && projectPages.length ? (
        <fieldset className="mb-2">
          <legend className="text-sm font-medium text-ink">Notes to use</legend>
          {projectPages.map((p) => (
            <label key={p.id} className="flex min-h-9 items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4"
                checked={chosen.includes(p.id)}
                onChange={(e) =>
                  setChosen(e.target.checked ? [...chosen, p.id] : chosen.filter((x) => x !== p.id))
                }
              />
              {p.title || 'Untitled'}
            </label>
          ))}
        </fieldset>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => setDraft(summarize(ws, actor, pages))}
        >
          Summarise
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => setDraft(proposeActions(ws, actor, pages))}
        >
          Possible actions
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => setDraft(revisionQuestions(ws, actor, pages))}
        >
          Revision questions
        </Button>
        {page ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => setDraft(relatedNotes(ws, actor, page))}
          >
            Related notes
          </Button>
        ) : null}
        {projId ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => setDraft(draftAgenda(ws, actor, projId))}
          >
            Draft an agenda
          </Button>
        ) : null}
      </div>
      <form
        className="mt-2 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setDraft(explainConcept(ws, actor, term))
        }}
      >
        <label className="flex min-w-40 flex-1 flex-col gap-1 text-sm text-ink">
          Look up a concept in your notes
          <input
            className={fieldClass}
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="e.g. bottleneck"
          />
        </label>
        <Button type="submit" variant="outline" className="min-h-11">
          Look up
        </Button>
      </form>

      {draft ? (
        <section
          aria-label={draft.heading}
          className="mt-3 rounded-md border border-border-strong bg-canvas p-3 text-sm"
        >
          <h3 className="font-semibold text-ink">{draft.heading}</h3>
          <p className="text-xs text-ink-muted">
            Draft generated on this device. Check it against the notes before relying on it.
          </p>
          {draft.lines.length ? (
            <ul className="mt-2 flex flex-col gap-1">
              {draft.lines.map((l, i) => (
                <li key={i} className="flex flex-wrap items-start justify-between gap-2">
                  <span>
                    {l.pageId ? (
                      <Link to={`/workspace/pages/${l.pageId}`} className="underline">
                        {l.text}
                      </Link>
                    ) : (
                      l.text
                    )}
                  </span>
                  {draft.kind === 'actions' &&
                  l.pageId &&
                  l.blockId &&
                  projId &&
                  canEditPage(
                    ws,
                    ws.pages.find((p) => p.id === l.pageId)!,
                    actor,
                  ) ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() => void makeTask(l.pageId!, l.blockId!)}
                    >
                      Create task
                      <span className="sr-only">: {l.text}</span>
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {draft.limitation ? <p className="mt-2 text-ink-muted">{draft.limitation}</p> : null}
          {draft.sources.length ? (
            <p className="mt-2 text-xs text-ink-muted">
              Sources:{' '}
              {draft.sources.map((s, i) => (
                <span key={s.id}>
                  {i ? ', ' : ''}
                  <Link to={`/workspace/pages/${s.id}`} className="underline">
                    {s.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          {draft.kind === 'agenda' && draft.lines.length && projId ? (
            <Button
              type="button"
              size="sm"
              className="mt-2 min-h-9"
              onClick={() => void agendaPage()}
            >
              Save as an agenda page
            </Button>
          ) : null}
        </section>
      ) : null}
    </WsCard>
  )
}
