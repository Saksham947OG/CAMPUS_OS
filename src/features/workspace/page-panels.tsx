/* The graph is an SVG with a text equivalent listed beneath it. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { can, canEditPage, canReadPage, roleOf } from '@/domain/workspace-access'
import {
  addComment,
  createPage,
  deleteComment,
  requestReview,
  restoreRevision,
  setCommentResolved,
  setLifecycle,
  submitReview,
} from '@/domain/workspace-logic'
import { unresolvedTitles } from '@/domain/workspace-links'
import type { Page } from '@/domain/workspace'
import { formatInstant } from '@/lib/time'
import { backlinks, localGraph, outgoing, threadsFor } from '@/selectors/workspace'
import type { WorkspaceApi } from './use-workspace'
import { Empty, fieldClass, Pill, WsCard } from './ws-ui'

export function OutlinePanel({ page }: { page: Page }) {
  const heads = page.blocks.filter(
    (b) => (b.type === 'h1' || b.type === 'h2' || b.type === 'h3') && b.text.trim(),
  )
  if (heads.length < 2) return null
  return (
    <WsCard title="Outline" id="pg-outline">
      <ul className="flex flex-col">
        {heads.map((b) => (
          <li key={b.id} className={b.type === 'h3' ? 'pl-4' : b.type === 'h2' ? 'pl-2' : ''}>
            <button
              type="button"
              className="min-h-9 text-left text-sm text-ink underline"
              onClick={() =>
                document.getElementById(`blk-${b.id}`)?.scrollIntoView({ block: 'center' })
              }
            >
              {b.text}
            </button>
          </li>
        ))}
      </ul>
    </WsCard>
  )
}

export function LinksPanel({
  w,
  page,
  onLinked,
}: {
  w: WorkspaceApi
  page: Page
  onLinked: (title: string, id: string) => void
}) {
  const { ws, actor, act } = w
  const back = backlinks(ws, actor, page.id)
  const out = outgoing(ws, actor, page)
  const missing = unresolvedTitles(page.blocks)
  const graph = localGraph(ws, actor, page)
  const editable = canEditPage(ws, page, actor)
  const make = async (title: string) => {
    const r = await act(
      (s, c) =>
        createPage(s, c, actor, {
          spaceId: page.spaceId,
          title,
          audience: page.audience,
          ...(page.projectId ? { projectId: page.projectId } : {}),
        }),
      `Created “${title}”.`,
    )
    if (r.ok) onLinked(title, r.value.id)
  }
  return (
    <WsCard title="Connected notes" id="pg-links">
      <h3 className="text-sm font-semibold text-ink">Linked from here</h3>
      {out.length ? (
        <ul className="mb-2">
          {out.map((p) => (
            <li key={p.id}>
              <Link
                className="inline-block min-h-9 py-1 text-sm text-ink underline"
                to={`/workspace/pages/${p.id}`}
              >
                {p.title || 'Untitled'}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-ink-muted">
          This note does not link to another note yet. Type [[ to link one.
        </p>
      )}
      <h3 className="text-sm font-semibold text-ink">Backlinks</h3>
      {back.length ? (
        <ul className="mb-2">
          {back.map((p) => (
            <li key={p.id}>
              <Link
                className="inline-block min-h-9 py-1 text-sm text-ink underline"
                to={`/workspace/pages/${p.id}`}
              >
                {p.title || 'Untitled'}
              </Link>
              {p.audience === 'private' ? <Pill tone="warn">only you</Pill> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-2 text-sm text-ink-muted">No note you can open links here yet.</p>
      )}
      {missing.length ? (
        <>
          <h3 className="text-sm font-semibold text-ink">Not created yet</h3>
          <ul>
            {missing.map((t) => (
              <li key={t} className="flex items-center justify-between gap-2 text-sm">
                <span>[[{t}]]</span>
                {editable ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() => void make(t)}
                  >
                    Create page
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {graph.length > 1 ? (
        <details className="mt-2">
          <summary className="min-h-9 cursor-pointer text-sm font-medium text-ink">
            Local graph (explicit links only)
          </summary>
          <LocalGraph nodes={graph} />
        </details>
      ) : null}
    </WsCard>
  )
}

function LocalGraph({ nodes }: { nodes: ReturnType<typeof localGraph> }) {
  const others = nodes.slice(1)
  const R = 78
  return (
    <div className="mt-2">
      <svg
        viewBox="-110 -100 220 200"
        role="img"
        aria-label={`Graph: this note and ${others.length} connected notes. The list below has the same information.`}
        className="w-full max-w-xs"
      >
        {others.map((n, i) => {
          const a = (2 * Math.PI * i) / others.length - Math.PI / 2
          return (
            <line
              key={n.id}
              x1={0}
              y1={0}
              x2={R * Math.cos(a)}
              y2={R * Math.sin(a)}
              stroke="currentColor"
              strokeWidth={1}
              className="text-border-strong"
              strokeDasharray={n.relation === 'linked-from' ? '4 3' : undefined}
            />
          )
        })}
        <circle r={14} className="fill-teal" />
        {others.map((n, i) => {
          const a = (2 * Math.PI * i) / others.length - Math.PI / 2
          return (
            <g key={n.id} transform={`translate(${R * Math.cos(a)} ${R * Math.sin(a)})`}>
              <circle
                r={9}
                className={n.relation === 'links-to' ? 'fill-coffee' : 'fill-ink-muted'}
              />
            </g>
          )
        })}
      </svg>
      <ul className="text-xs text-ink-muted">
        {others.map((n) => (
          <li key={n.id}>
            <Link to={`/workspace/pages/${n.id}`} className="underline">
              {n.title}
            </Link>{' '}
            · {n.relation === 'links-to' ? 'this note links to it' : 'it links to this note'}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CommentsPanel({
  w,
  page,
  anchor,
  clearAnchor,
}: {
  w: WorkspaceApi
  page: Page
  anchor: string | null
  clearAnchor: () => void
}) {
  const { ws, actor, act, name } = w
  const [filter, setFilter] = useState<'open' | 'resolved' | 'mine'>('open')
  const [body, setBody] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [reply, setReply] = useState<Record<string, string>>({})
  const role = roleOf(ws, page.spaceId, actor)
  const mayComment = can(role, 'comment')
  const threads = threadsFor(ws, page).filter((t) =>
    filter === 'open'
      ? !t.root.resolvedAt
      : filter === 'resolved'
        ? !!t.root.resolvedAt
        : t.root.authorId === actor || t.replies.some((r) => r.authorId === actor),
  )
  const mentionable = ws.members.filter(
    (m) =>
      m.spaceId === page.spaceId &&
      m.userId !== actor &&
      !m.invitation &&
      canReadPage(ws, page, m.userId),
  )
  const anchored = anchor ? page.blocks.find((b) => b.id === anchor) : undefined
  const post = async (e: FormEvent) => {
    e.preventDefault()
    const r = await act((s, c) =>
      addComment(
        s,
        c,
        actor,
        page.id,
        body,
        anchored ? { blockId: anchored.id } : undefined,
        undefined,
        mentions,
      ),
    )
    if (r.ok) {
      setBody('')
      setMentions([])
      clearAnchor()
    }
  }
  return (
    <WsCard title="Comments" id="pg-comments">
      <fieldset className="mb-2 flex gap-1">
        <legend className="sr-only">Show comments</legend>
        {(['open', 'resolved', 'mine'] as const).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-9 rounded-md px-3 text-sm ${filter === f ? 'bg-teal-tint font-semibold' : 'hover:bg-mist'} text-ink`}
          >
            {f === 'open' ? 'Open' : f === 'resolved' ? 'Resolved' : 'Mine'}
          </button>
        ))}
      </fieldset>
      {threads.length ? (
        <ul className="mb-3 flex flex-col gap-3">
          {threads.map((t) => (
            <li key={t.root.id} className="rounded-md border border-border p-2 text-sm">
              {t.anchor !== 'page' ? (
                <p className="mb-1 text-xs text-ink-muted">
                  {t.anchor === 'ok' ? (
                    <>On: “{(t.root.quote ?? '').slice(0, 70)}”</>
                  ) : (
                    <>Original selection changed. It said: “{(t.root.quote ?? '').slice(0, 70)}”</>
                  )}
                </p>
              ) : null}
              {[t.root, ...t.replies].map((c) => (
                <div key={c.id} className="mb-1">
                  <strong>{name(c.authorId)}</strong>{' '}
                  <span className="text-xs text-ink-muted">{formatInstant(c.createdAt)}</span>
                  <p className="whitespace-pre-wrap">{c.body}</p>
                  {c.authorId === actor ? (
                    <button
                      type="button"
                      className="min-h-9 text-xs text-coffee underline"
                      onClick={() => void act((s, cx) => deleteComment(s, cx, actor, c.id))}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              ))}
              {mayComment ? (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`reply-${t.root.id}`}>
                    Reply
                  </label>
                  <input
                    id={`reply-${t.root.id}`}
                    className={`${fieldClass} min-w-0 flex-1`}
                    placeholder="Reply"
                    value={reply[t.root.id] ?? ''}
                    onChange={(e) => setReply({ ...reply, [t.root.id]: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && (reply[t.root.id] ?? '').trim()) {
                        e.preventDefault()
                        void act((s, c) =>
                          addComment(s, c, actor, page.id, reply[t.root.id]!, undefined, t.root.id),
                        ).then((r) => r.ok && setReply({ ...reply, [t.root.id]: '' }))
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="min-h-9"
                    onClick={() =>
                      void act((s, c) =>
                        setCommentResolved(s, c, actor, t.root.id, !t.root.resolvedAt),
                      )
                    }
                  >
                    {t.root.resolvedAt ? 'Reopen' : 'Resolve'}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>
          {filter === 'open'
            ? 'No open comments.'
            : filter === 'resolved'
              ? 'Nothing resolved yet.'
              : 'You have not commented here.'}
        </Empty>
      )}
      {mayComment ? (
        <form onSubmit={(e) => void post(e)} className="mt-3 flex flex-col gap-2">
          <label htmlFor="ws-comment-input" className="text-sm font-medium text-ink">
            {anchored ? 'Comment on the selected block' : 'Comment on this page'}
          </label>
          {anchored ? (
            <p className="rounded bg-mist p-2 text-xs text-ink-muted">
              “{anchored.text.slice(0, 80) || 'empty block'}”{' '}
              <button type="button" className="underline" onClick={clearAnchor}>
                Comment on the page instead
              </button>
            </p>
          ) : null}
          <textarea
            id="ws-comment-input"
            rows={2}
            className={`${fieldClass} py-2`}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-ink">
              Mention
              <select
                className={fieldClass}
                value=""
                onChange={(e) => {
                  const id = e.target.value
                  if (!id) return
                  setBody((b) => `${b}${b && !b.endsWith(' ') ? ' ' : ''}@${w.name(id)} `)
                  setMentions((m) => (m.includes(id) ? m : [...m, id]))
                }}
              >
                <option value="">Choose a person…</option>
                {mentionable.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {w.name(m.userId)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-ink-muted">
            Only people who can already open this page are listed. A mention never gives access
            {page.audience === 'private'
              ? '; this page is private to you, so nobody else can be mentioned'
              : ''}
            .
          </p>
          <Button type="submit" className="min-h-11 self-start">
            Add comment
          </Button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">Viewers can read comments but not add them.</p>
      )}
    </WsCard>
  )
}

export function ReviewPanel({ w, page }: { w: WorkspaceApi; page: Page }) {
  const { ws, actor, act, name } = w
  const [pick, setPick] = useState<string[]>([])
  const [note, setNote] = useState('')
  const reviews = ws.reviews.filter((r) => r.pageId === page.id)
  const editor = canEditPage(ws, page, actor)
  const candidates = ws.members.filter(
    (m) => m.spaceId === page.spaceId && m.userId !== actor && can(m.role, 'comment'),
  )
  if (page.audience !== 'space' && !reviews.length) return null
  return (
    <WsCard title="Review" id="pg-review">
      {reviews.length ? (
        <ul className="mb-3 flex flex-col gap-2 text-sm">
          {reviews.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-2">
              <strong>{name(r.reviewerId)}</strong>:{' '}
              {r.state === 'requested'
                ? 'asked to review'
                : r.state === 'reviewed'
                  ? 'reviewed'
                  : 'asked for changes'}{' '}
              version {r.revision}
              {r.revision !== page.revision ? ` (this page is now version ${page.revision})` : ''}
              {r.dueDate ? `, due ${r.dueDate}` : ''}
              {r.note ? <p className="text-ink-muted">“{r.note}”</p> : null}
              {r.state === 'requested' && r.reviewerId === actor ? (
                <div className="mt-2 flex flex-col gap-2">
                  <label className="text-xs font-medium text-ink" htmlFor={`rn-${r.id}`}>
                    Note (optional)
                  </label>
                  <input
                    id={`rn-${r.id}`}
                    className={fieldClass}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-9"
                      onClick={() =>
                        void act(
                          (s, c) => submitReview(s, c, actor, r.id, 'reviewed', note),
                          'Review recorded.',
                        )
                      }
                    >
                      Mark reviewed
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-9"
                      onClick={() =>
                        void act(
                          (s, c) => submitReview(s, c, actor, r.id, 'changesRequested', note),
                          'Changes requested.',
                        )
                      }
                    >
                      Request changes
                    </Button>
                  </div>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {editor && page.audience === 'space' ? (
        <>
          <fieldset className="mb-2">
            <legend className="text-sm font-medium text-ink">Ask for a review</legend>
            {candidates.map((m) => (
              <label key={m.userId} className="flex min-h-9 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={pick.includes(m.userId)}
                  onChange={(e) =>
                    setPick(
                      e.target.checked ? [...pick, m.userId] : pick.filter((x) => x !== m.userId),
                    )
                  }
                />
                {name(m.userId)}
              </label>
            ))}
          </fieldset>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() =>
              void act(
                (s, c) => requestReview(s, c, actor, page.id, pick),
                'Review requested.',
              ).then((r) => r.ok && setPick([]))
            }
          >
            Request review
          </Button>
          {page.lifecycle !== 'approved' ? (
            <Button
              type="button"
              className="ml-2 min-h-11"
              onClick={() =>
                void act(
                  (s, c) => setLifecycle(s, c, actor, page.id, 'approved'),
                  'Marked as approved by the team.',
                )
              }
            >
              Approve for the team
            </Button>
          ) : null}
          <p className="mt-2 text-xs text-ink-muted">
            “Approved by the team” is a project label with your name and the time. It is not
            approval by the institution.
          </p>
        </>
      ) : null}
    </WsCard>
  )
}

export function HistoryPanel({ w, page }: { w: WorkspaceApi; page: Page }) {
  const { ws, actor, act, name } = w
  const revs = ws.revisions
    .filter((r) => r.pageId === page.id)
    .sort((a, b) => b.revision - a.revision)
  const editor = canEditPage(ws, page, actor)
  return (
    <WsCard title="Version history" id="pg-history">
      <p className="mb-2 text-sm text-ink-muted">
        Current version {page.revision}, saved {formatInstant(page.updatedAt)}.
      </p>
      {revs.length ? (
        <ul className="flex flex-col gap-1">
          {revs.slice(0, 8).map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                Version {r.revision} · {name(r.authorId)} · {formatInstant(r.at)}
                {r.restoredFrom ? ` · replaced by a restore of v${r.restoredFrom}` : ''}
              </span>
              {editor ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-9"
                  onClick={() =>
                    void act(
                      (s, c) => restoreRevision(s, c, actor, page.id, r.revision),
                      `Restored version ${r.revision} as a new version.`,
                    )
                  }
                >
                  Restore
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No earlier versions yet. One is kept each time you save a change.</Empty>
      )}
    </WsCard>
  )
}
