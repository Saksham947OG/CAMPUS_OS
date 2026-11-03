import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router'
import { useDataStore } from '@/app/data-store'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { canEditPage, canReadPage, can, roleOf } from '@/domain/workspace-access'
import { toStored } from '@/domain/workspace-links'
import {
  blockToWorkTask,
  deletePageForever,
  linkBlockToTask,
  restorePage,
  savePage,
  setAudience,
  setLifecycle,
  trashPage,
} from '@/domain/workspace-logic'
import { LIFECYCLES, LIFECYCLE_LABEL, NOTE_TYPES, type Block, type Page } from '@/domain/workspace'
import { formatDayMonth, formatInstant } from '@/lib/time'
import { displayText, pageToMarkdown, readablePages, titleResolver } from '@/selectors/workspace'
import { BlockEditor } from './block-editor'
import { downloadText } from './download'
import { AssistPanel } from './assist-panel'
import { FilesPanel } from './files-panel'
import { CommentsPanel, HistoryPanel, LinksPanel, OutlinePanel, ReviewPanel } from './page-panels'
import { useWorkspace, type WorkspaceApi } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { AudiencePill, LifecyclePill, Pill, WsCard, fieldClass } from './ws-ui'

export function PageScreen() {
  const { pageId: id = '' } = useParams()
  return (
    <WorkspaceShell>
      <Resolve id={id} />
    </WorkspaceShell>
  )
}

function Resolve({ id }: { id: string }) {
  const w = useWorkspace()
  const page = w.ws.pages.find((p) => p.id === id)
  // A page the reader may not open looks exactly like a page that does not exist: no title, no hint.
  if (!page || !canReadPage(w.ws, page, w.actor))
    return (
      <article>
        <PageHeader
          title="Page not available"
          description="This page does not exist, or you do not have access to it."
        />
        <Link to="/workspace" className="font-medium underline">
          Back to Workspace
        </Link>
      </article>
    )
  return <PageView key={page.id} page={page} w={w} />
}

type SaveState = 'saved' | 'unsaved' | 'saving' | 'failed'

function PageView({ page, w }: { page: Page; w: WorkspaceApi }) {
  const { ws, actor, act, name } = w
  const tasks = useDataStore((s) => s.data.tasks)
  const editable = canEditPage(ws, page, actor) && !page.trashedAt
  const role = roleOf(ws, page.spaceId, actor)
  const toDisplay = (t: string) => displayText(ws, actor, t)

  const [title, setTitle] = useState(page.title)
  const [blocks, setBlocksState] = useState<Block[]>(() =>
    page.blocks.map((b) => ({ ...b, text: toDisplay(b.text) })),
  )
  const [save, setSave] = useState<SaveState>('saved')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [taskFor, setTaskFor] = useState<Block | null>(null)
  const draft = useRef({ title: page.title, blocks })
  const dirty = useRef(false)
  const base = useRef(page.revision)
  const chosen = useRef(new Map<string, string>())
  const chain = useRef<Promise<void>>(Promise.resolve())

  const setBlocks = (next: Block[]) => {
    draft.current.blocks = next
    dirty.current = true
    setBlocksState(next)
    setSave('unsaved')
  }
  const onTitle = (v: string) => {
    draft.current.title = v
    dirty.current = true
    setTitle(v)
    setSave('unsaved')
  }

  /** Persist the draft. Saves are queued so two quick blurs never race each other. */
  const commit = (override?: Block[]) => {
    if (override) draft.current.blocks = override
    chain.current = chain.current.then(async () => {
      if (!dirty.current) return
      const snapshot = { title: draft.current.title, blocks: draft.current.blocks }
      const resolve = titleResolver(ws, actor, page.spaceId)
      const idOf = (t: string) => chosen.current.get(t.toLowerCase()) ?? resolve(t)
      const stored = snapshot.blocks.map((b) => ({ ...b, text: toStored(b.text, idOf) }))
      setSave('saving')
      const expected = base.current
      const r = await w.services.workspace.mutate((s, c) =>
        savePage(s, c, actor, page.id, expected, { title: snapshot.title, blocks: stored }),
      )
      if (r.ok) {
        const merged = r.value.revision !== expected + 1
        const unchanged =
          draft.current.title === snapshot.title && draft.current.blocks === snapshot.blocks
        if (merged && unchanged) {
          // Somebody saved while this editor was open: show the merged page, which keeps both people's changes.
          const next = r.value.blocks.map((b) => ({ ...b, text: displayText(ws, actor, b.text) }))
          draft.current = { title: r.value.title, blocks: next }
          setTitle(r.value.title)
          setBlocksState(next)
          setNotice(
            'Saved. Another session had changed this page, so the two sets of changes were merged.',
          )
        } else setNotice('')
        // If you kept typing while a merge happened, merge again from the original base on the next save.
        base.current = merged && !unchanged ? expected : r.value.revision
        if (unchanged) dirty.current = false
        setSave(dirty.current ? 'unsaved' : 'saved')
        setError('')
      } else {
        setSave('failed')
        setError(r.error.message)
      }
    })
  }

  // Pick up a change made elsewhere (another tab, a restore) when there is nothing unsaved here.
  useEffect(() => {
    if (page.revision !== base.current && !dirty.current) {
      base.current = page.revision
      const next = page.blocks.map((b) => ({ ...b, text: displayText(ws, actor, b.text) }))
      draft.current = { title: page.title, blocks: next }
      setTitle(page.title)
      setBlocksState(next)
    }
  }, [page, ws, actor])

  const linkable = readablePages(ws, actor)
    .filter((p) => p.id !== page.id)
    .map((p) => ({ id: p.id, title: p.title }))
  const titleOf = (pid: string) => {
    const p = ws.pages.find((x) => x.id === pid)
    return p && !p.trashedAt && canReadPage(ws, p, actor) ? p.title : undefined
  }
  const commentCount = (bid: string) =>
    ws.comments.filter(
      (c) => c.pageId === page.id && c.blockId === bid && !c.resolvedAt && !c.parentId,
    ).length
  const space = ws.spaces.find((s) => s.id === page.spaceId)
  const project = page.projectId ? ws.projects.find((p) => p.id === page.projectId) : undefined

  const taskBadge = (b: Block) => {
    if (b.taskId) {
      const t = tasks.find((x) => x.id === b.taskId)
      return t ? (
        <span>
          CampusOS task ·{' '}
          <Link className="underline" to="/calendar">
            {t.state === 'personallyCompleted'
              ? 'done'
              : t.state === 'inProgress'
                ? 'in progress'
                : 'not started'}
            {t.dueDate ? `, due ${formatDayMonth(t.dueDate)}` : ''}
          </Link>
        </span>
      ) : null
    }
    const wt = ws.tasks.find((x) => x.id === b.workTaskId)
    return wt ? (
      <span>
        Team task ·{' '}
        <Link className="underline" to={`/workspace/projects/${wt.projectId}`}>
          {wt.status === 'done' ? 'done' : wt.status}
          {wt.assigneeId ? `, ${name(wt.assigneeId)}` : ''}
          {wt.dueDate ? `, due ${formatDayMonth(wt.dueDate)}` : ''}
        </Link>
      </span>
    ) : null
  }

  const exportMd = () =>
    downloadText(
      `${(page.title || 'note').replace(/[^\w-]+/g, '-').toLowerCase()}.md`,
      pageToMarkdown(ws, actor, page),
      'text/markdown',
    )

  return (
    <article className="flex flex-col gap-4">
      <nav aria-label="Breadcrumb" className="text-sm text-ink-muted">
        <Link to="/workspace" className="underline">
          Workspace
        </Link>{' '}
        /{' '}
        <Link to={`/workspace/spaces/${page.spaceId}`} className="underline">
          {space?.title}
        </Link>
        {project && project.title !== space?.title ? (
          <>
            {' '}
            /{' '}
            <Link to={`/workspace/projects/${project.id}`} className="underline">
              {project.title}
            </Link>
          </>
        ) : null}
      </nav>

      {page.trashedAt ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-warning bg-warning/10 p-3 text-sm">
          This page is in the bin.
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void act((s, c) => restorePage(s, c, actor, page.id), 'Page restored.')}
          >
            Restore
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              void act((s, c) => deletePageForever(s, c, actor, page.id), 'Page removed for good.')
            }
          >
            Remove for good
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0">
          <label htmlFor="pg-title" className="sr-only">
            Page title
          </label>
          <input
            id="pg-title"
            value={title}
            readOnly={!editable}
            placeholder="Untitled"
            onChange={(e) => onTitle(e.target.value)}
            onBlur={() => commit()}
            className="mb-2 w-full bg-transparent font-display text-3xl font-semibold text-ink outline-none placeholder:text-ink-muted focus-visible:ring-2 focus-visible:ring-ring/50 md:text-4xl"
          />
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <AudiencePill audience={page.audience} />
            <LifecyclePill lifecycle={page.lifecycle} />
            {role ? (
              <Pill>{role === 'owner' ? 'You own this space' : `Your role: ${role}`}</Pill>
            ) : null}
            <output aria-live="polite" className="ml-auto text-xs text-ink-muted">
              {save === 'saved'
                ? `Saved on this device · ${formatInstant(page.updatedAt)}`
                : save === 'saving'
                  ? 'Saving…'
                  : save === 'unsaved'
                    ? 'Unsaved changes · saves when you leave a block (Ctrl/⌘ S saves now)'
                    : 'Not saved'}
            </output>
          </div>
          {notice ? (
            <p className="mb-3 rounded-md bg-teal-tint p-3 text-sm text-ink">{notice}</p>
          ) : null}
          {save === 'failed' ? (
            <div
              role="alert"
              className="mb-3 rounded-md border border-danger bg-danger/10 p-3 text-sm text-ink"
            >
              {error} Your text is still here.{' '}
              <button type="button" className="font-medium underline" onClick={() => commit()}>
                Try again
              </button>
            </div>
          ) : null}

          <BlockEditor
            blocks={blocks}
            onChange={setBlocks}
            onCommit={commit}
            editable={editable}
            linkable={linkable}
            newId={w.services.newId}
            onChooseLink={(t, id) => chosen.current.set(t.toLowerCase(), id)}
            onComment={(bid) => {
              setAnchor(bid)
              document.getElementById('ws-comment-input')?.focus()
            }}
            commentCount={commentCount}
            taskBadge={taskBadge}
            onMakeTask={editable ? setTaskFor : undefined}
            titleOf={titleOf}
            displayOf={toDisplay}
          />
          {taskFor ? (
            <MakeTask
              w={w}
              page={page}
              block={taskFor}
              done={() => setTaskFor(null)}
              commit={() => commit()}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-4" aria-label="About this page">
          <PageMeta w={w} page={page} editable={editable} exportMd={exportMd} />
          <OutlinePanel page={page} />
          <LinksPanel
            w={w}
            page={page}
            onLinked={(t, id) => {
              chosen.current.set(t.toLowerCase(), id)
              dirty.current = true
              commit()
            }}
          />
          <CommentsPanel w={w} page={page} anchor={anchor} clearAnchor={() => setAnchor(null)} />
          <ReviewPanel w={w} page={page} />
          <WsCard title="Files on this page" id="pg-files">
            <FilesPanel
              w={w}
              spaceId={page.spaceId}
              pageId={page.id}
              {...(page.projectId ? { projectId: page.projectId } : {})}
              audience={page.audience}
            />
          </WsCard>
          <AssistPanel w={w} page={page} />
          <HistoryPanel w={w} page={page} />
        </aside>
      </div>
    </article>
  )
}

function PageMeta({
  w,
  page,
  editable,
  exportMd,
}: {
  w: WorkspaceApi
  page: Page
  editable: boolean
  exportMd: () => void
}) {
  const { ws, actor, act } = w
  const [tags, setTags] = useState(page.tags.join(', '))
  const space = ws.spaces.find((s) => s.id === page.spaceId)
  const author = page.authorId === actor
  const members = ws.members.filter((m) => m.spaceId === page.spaceId)
  return (
    <section
      aria-labelledby="pg-details"
      className="rounded-lg border border-border bg-surface p-4 shadow-card"
    >
      <h2 id="pg-details" className="mb-2 font-display text-lg font-semibold text-ink">
        Details
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm">
        <dt className="text-ink-muted">Author</dt>
        <dd>{w.name(page.authorId)}</dd>
        <dt className="text-ink-muted">Space</dt>
        <dd>{space?.title}</dd>
        <dt className="text-ink-muted">Who can see</dt>
        <dd>
          {page.audience === 'private'
            ? 'Only the author'
            : `${members.length} ${members.length === 1 ? 'person' : 'people'} in the space: ${members.map((m) => `${w.name(m.userId)} (${m.role})`).join(', ')}`}
        </dd>
        <dt className="text-ink-muted">Type</dt>
        <dd>
          <label className="sr-only" htmlFor="pg-type">
            Note type
          </label>
          <select
            id="pg-type"
            disabled={!editable}
            className={fieldClass}
            value={page.noteType}
            onChange={(e) =>
              void act((s, c) =>
                savePage(s, c, w.actor, page.id, page.revision, {
                  noteType: e.target.value as Page['noteType'],
                }),
              )
            }
          >
            {NOTE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t[0]!.toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-ink-muted">Status</dt>
        <dd>
          <label className="sr-only" htmlFor="pg-life">
            Status
          </label>
          <select
            id="pg-life"
            disabled={!editable}
            className={fieldClass}
            value={page.lifecycle}
            onChange={(e) =>
              void act((s, c) =>
                setLifecycle(s, c, actor, page.id, e.target.value as Page['lifecycle']),
              )
            }
          >
            {LIFECYCLES.map((l) => (
              <option key={l} value={l}>
                {LIFECYCLE_LABEL[l]}
              </option>
            ))}
          </select>
        </dd>
        <dt className="text-ink-muted">Tags</dt>
        <dd>
          <label className="sr-only" htmlFor="pg-tags">
            Tags, separated by commas
          </label>
          <input
            id="pg-tags"
            className={fieldClass}
            readOnly={!editable}
            value={tags}
            placeholder="theory, queue"
            onChange={(e) => setTags(e.target.value)}
            onBlur={() => {
              const next = tags
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
              if (next.join('|') !== page.tags.join('|'))
                void act((s, c) => savePage(s, c, actor, page.id, page.revision, { tags: next }))
            }}
          />
        </dd>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {author && space?.type !== 'personal' ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              void act(
                (s, c) =>
                  setAudience(
                    s,
                    c,
                    actor,
                    page.id,
                    page.audience === 'private' ? 'space' : 'private',
                  ),
                page.audience === 'private'
                  ? 'Now shared with everyone in the space.'
                  : 'Now private to you.',
              )
            }
          >
            {page.audience === 'private' ? 'Share with the space' : 'Make private'}
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="min-h-11" onClick={exportMd}>
          Export Markdown
        </Button>
        {editable && can(roleOf(ws, page.spaceId, actor), 'edit') ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              void act(
                (s, c) => trashPage(s, c, actor, page.id),
                'Moved to the bin. You can restore it from the space.',
              )
            }
          >
            Move to bin
          </Button>
        ) : null}
      </div>
    </section>
  )
}

function MakeTask({
  w,
  page,
  block,
  done,
  commit,
}: {
  w: WorkspaceApi
  page: Page
  block: Block
  done: () => void
  commit: () => void
}) {
  const { ws, actor, act } = w
  const space = ws.spaces.find((s) => s.id === page.spaceId)
  const personal = space?.type === 'personal'
  const projects = ws.projects.filter((p) => p.spaceId === page.spaceId)
  const [projectId, setProjectId] = useState(page.projectId ?? projects[0]?.id ?? '')
  const [assignee, setAssignee] = useState(actor)
  const [due, setDue] = useState('')
  const [op] = useState(() => w.services.newId('op'))
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => formRef.current?.scrollIntoView({ block: 'nearest' }), [])
  const members = ws.members.filter((m) => m.spaceId === page.spaceId && can(m.role, 'edit'))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    commit()
    if (personal) {
      if (!w.isRealProfile)
        return w.toast.notify(
          'error',
          'CampusOS tasks belong to a real CampusOS profile. Switch “Viewing as” back to yourself.',
        )
      const saved = await w.services.campus.saveTask(actor, {
        title:
          block.text
            .replace(/\[\[[^\]]*\]\]/g, '')
            .trim()
            .slice(0, 120) || 'Task from a note',
        state: 'notStarted',
        subtasks: [],
        priority: 'normal',
        ...(due ? { dueDate: due as never } : {}),
      })
      if (!saved.ok) return w.toast.notify('error', saved.error.message)
      const r = await act(
        (s, c) => linkBlockToTask(s, c, actor, page.id, block.id, saved.value.value.id),
        'Added to your CampusOS tasks. It also shows in Home and Calendar.',
      )
      if (r.ok) done()
      return
    }
    const r = await act(
      (s, c) =>
        blockToWorkTask(s, c, actor, page.id, block.id, {
          projectId,
          ...(assignee ? { assigneeId: assignee } : {}),
          ...(due ? { dueDate: due as never } : {}),
          opId: op,
        }),
      'Task added to the project board.',
    )
    if (r.ok) done()
  }
  return (
    <form
      ref={formRef}
      onSubmit={(e) => void submit(e)}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-border-strong bg-surface p-3"
      aria-label="Make this item a task"
    >
      <p className="text-sm font-medium text-ink">Make “{block.text.slice(0, 60)}” a task</p>
      {personal ? (
        <p className="text-sm text-ink-muted">
          This becomes one of your own CampusOS tasks, so it appears in Home and Calendar.
          Completing it there updates this note.
        </p>
      ) : projects.length ? (
        <>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Project
            <select
              className={fieldClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-ink">
            Assign to
            <select
              className={fieldClass}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
            >
              <option value="">Nobody yet</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {w.name(m.userId)}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="text-sm text-danger">
          This space has no project yet, so there is nowhere to put a team task.
        </p>
      )}
      <label className="flex flex-col gap-1 text-sm text-ink">
        Due date (optional)
        <input
          type="date"
          className={fieldClass}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </label>
      <div className="flex gap-2">
        <Button type="submit" className="min-h-11" disabled={!personal && !projects.length}>
          Create task
        </Button>
        <Button type="button" variant="outline" className="min-h-11" onClick={done}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
