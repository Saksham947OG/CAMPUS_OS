import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { canReadPage, can, roleOf } from '@/domain/workspace-access'
import { canReadCanvas, deleteCanvas, saveCanvas } from '@/domain/workspace-ext'
import type { Canvas } from '@/domain/workspace'
import { readablePages } from '@/selectors/workspace'
import { useWorkspace, type WorkspaceApi } from './use-workspace'
import { WorkspaceShell } from './workspace-shell'
import { Empty, Pill, WsCard, fieldClass } from './ws-ui'

type Card = Canvas['cards'][number]
type Edge = Canvas['edges'][number]
const W = 176
const H = 64
const STEP = 16

export function CanvasScreen() {
  const { canvasId = '' } = useParams()
  return (
    <WorkspaceShell>
      <Resolve id={canvasId} />
    </WorkspaceShell>
  )
}

function Resolve({ id }: { id: string }) {
  const w = useWorkspace()
  const cv = w.ws.canvases.find((c) => c.id === id)
  if (!cv || !canReadCanvas(w.ws, cv, w.actor))
    return (
      <article>
        <PageHeader
          title="Canvas not available"
          description="This canvas does not exist, or you do not have access to it."
        />
        <Link to="/workspace" className="font-medium underline">
          Back to Workspace
        </Link>
      </article>
    )
  return <CanvasView key={cv.id} cv={cv} w={w} />
}

function CanvasView({ cv, w }: { cv: Canvas; w: WorkspaceApi }) {
  const { ws, actor, act } = w
  const navigate = useNavigate()
  const edit = can(roleOf(ws, cv.spaceId, actor), 'edit')
  const [cards, setCards] = useState<Card[]>(cv.cards)
  const [edges, setEdges] = useState<Edge[]>(cv.edges)
  const [selected, setSelected] = useState<string | null>(null)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [zoom, setZoom] = useState(1)
  const [history, setHistory] = useState<{ cards: Card[]; edges: Edge[] }[]>([])
  const [text, setText] = useState('')
  const [pageId, setPageId] = useState('')
  const [link, setLink] = useState({ from: '', to: '', label: '' })
  const rev = useRef(cv.layoutRevision)
  const drag = useRef<{ id: string; dx: number; dy: number; start: Card[] } | null>(null)
  const dirty = useRef(false)

  // Pick up a layout saved by another session when nothing here is unsaved.
  useEffect(() => {
    if (cv.layoutRevision !== rev.current && !dirty.current) {
      rev.current = cv.layoutRevision
      setCards(cv.cards)
      setEdges(cv.edges)
    }
  }, [cv])

  const pages = readablePages(ws, actor, { spaceId: cv.spaceId })
  const titleOf = (card: Card) => {
    if (card.kind === 'text') return card.text ?? ''
    const p = ws.pages.find((x) => x.id === card.pageId)
    return p && !p.trashedAt && canReadPage(ws, p, actor)
      ? p.title || 'Untitled'
      : 'a page you cannot open'
  }
  const label = (id: string) => {
    const c = cards.find((x) => x.id === id)
    return c ? titleOf(c) : 'a removed card'
  }

  /** Saves a layout. On a refusal the screen goes back to what was saved, so it never shows a layout that was not kept. */
  const commit = async (
    nextCards: Card[],
    nextEdges: Edge[],
    before: { cards: Card[]; edges: Edge[] },
  ) => {
    setCards(nextCards)
    setEdges(nextEdges)
    dirty.current = true
    const r = await act((s, c) =>
      saveCanvas(s, c, actor, cv.id, rev.current, { cards: nextCards, edges: nextEdges }),
    )
    dirty.current = false
    if (r.ok) {
      rev.current = r.value.layoutRevision
      setHistory((h) => [...h.slice(-30), before])
    } else {
      setCards(before.cards)
      setEdges(before.edges)
    }
  }
  const snapshot = () => ({ cards, edges })

  const undo = () => {
    const prev = history.at(-1)
    if (!prev) return
    setHistory((h) => h.slice(0, -1))
    dirty.current = true
    setCards(prev.cards)
    setEdges(prev.edges)
    void act((s, c) => saveCanvas(s, c, actor, cv.id, rev.current, prev)).then((r) => {
      dirty.current = false
      if (r.ok) rev.current = r.value.layoutRevision
    })
  }

  const move = (id: string, dx: number, dy: number) => {
    const before = snapshot()
    void commit(
      cards.map((c) =>
        c.id === id
          ? {
              ...c,
              x: Math.max(-4000, Math.min(4000, c.x + dx)),
              y: Math.max(-4000, Math.min(4000, c.y + dy)),
            }
          : c,
      ),
      edges,
      before,
    )
  }

  const onKey = (e: KeyboardEvent, c: Card) => {
    if (!edit) return
    const d = e.shiftKey ? STEP * 4 : STEP
    const keys: Record<string, [number, number]> = {
      ArrowLeft: [-d, 0],
      ArrowRight: [d, 0],
      ArrowUp: [0, -d],
      ArrowDown: [0, d],
    }
    if (keys[e.key]) {
      e.preventDefault()
      move(c.id, ...keys[e.key]!)
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      removeCard(c.id)
    }
  }
  const down = (e: PointerEvent, c: Card) => {
    setSelected(c.id)
    if (!edit) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = {
      id: c.id,
      dx: e.clientX / zoom - c.x,
      dy: e.clientY / zoom - c.y,
      start: cards,
    }
  }
  const dragMove = (e: PointerEvent) => {
    const d = drag.current
    if (!d) return
    setCards((cs) =>
      cs.map((c) =>
        c.id === d.id
          ? { ...c, x: Math.round(e.clientX / zoom - d.dx), y: Math.round(e.clientY / zoom - d.dy) }
          : c,
      ),
    )
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    if (!d) return
    const moved = cards.find((c) => c.id === d.id)
    const was = d.start.find((c) => c.id === d.id)
    if (moved && was && (moved.x !== was.x || moved.y !== was.y))
      void commit(cards, edges, { cards: d.start, edges })
  }

  const newCardId = () => w.services.newId('card')
  const spot = () => ({
    x: 40 + (cards.length % 3) * 230,
    y: 40 + Math.floor(cards.length / 3) * 110,
  })
  const addText = () => {
    if (!text.trim()) return
    const c: Card = { id: newCardId(), kind: 'text', text: text.trim().slice(0, 400), ...spot() }
    void commit([...cards, c], edges, snapshot())
    setText('')
  }
  const addPage = () => {
    if (!pageId) return
    if (cards.some((c) => c.pageId === pageId))
      return w.toast.notify('info', 'That note is already on the canvas.')
    const c: Card = { id: newCardId(), kind: 'page', pageId, ...spot() }
    void commit([...cards, c], edges, snapshot())
  }
  const removeCard = (id: string) => {
    void commit(
      cards.filter((c) => c.id !== id),
      edges.filter((e) => e.from !== id && e.to !== id),
      snapshot(),
    )
    setSelected(null)
  }
  const connect = () => {
    if (!link.from || !link.to || link.from === link.to)
      return w.toast.notify('error', 'Choose two different cards to connect.')
    const e: Edge = {
      id: w.services.newId('edge'),
      from: link.from,
      to: link.to,
      label: link.label.trim().slice(0, 60),
    }
    void commit(cards, [...edges, e], snapshot())
    setLink({ from: '', to: '', label: '' })
  }

  const center = (id: string) => {
    const c = cards.find((x) => x.id === id)
    return c ? { x: c.x + W / 2, y: c.y + H / 2 } : { x: 0, y: 0 }
  }

  return (
    <article className="flex max-w-6xl flex-col gap-4">
      <PageHeader
        title={cv.title}
        description="Arrange notes and ideas, and draw labelled connections. A note card points at the real note; the layout is saved apart from the note text."
        badge={<Pill>{cv.audience === 'private' ? 'Only you' : 'Shared with the space'}</Pill>}
      />
      <nav aria-label="Breadcrumb" className="-mt-4 text-sm text-ink-muted">
        <Link to={`/workspace/spaces/${cv.spaceId}`} className="underline">
          Back to the space
        </Link>
      </nav>

      <div className="flex flex-wrap items-center gap-2" role="toolbar" aria-label="Canvas tools">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.2).toFixed(1)))}
        >
          Zoom in
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9"
          onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.2).toFixed(1)))}
        >
          Zoom out
        </Button>
        {(
          [
            ['Pan left', -80, 0],
            ['Pan right', 80, 0],
            ['Pan up', 0, -80],
            ['Pan down', 0, 80],
          ] as const
        ).map(([name, dx, dy]) => (
          <Button
            key={name}
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={() => setPan((p) => ({ x: p.x - dx, y: p.y - dy }))}
          >
            {name}
          </Button>
        ))}
        {edit ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              disabled={!history.length}
              onClick={undo}
            >
              Undo
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-9"
              disabled={!selected}
              onClick={() => selected && removeCard(selected)}
            >
              Delete selected card
            </Button>
          </>
        ) : null}
        <span className="text-xs text-ink-muted">
          Select a card, then use the arrow keys to move it (Shift for bigger steps). Drag with a
          pointer if you like.
        </span>
      </div>

      <div className="relative h-[28rem] overflow-hidden rounded-lg border border-border-strong bg-mist/40">
        <div
          className="absolute top-0 left-0 origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          <svg
            className="pointer-events-none absolute top-0 left-0 overflow-visible"
            width="1"
            height="1"
            aria-hidden="true"
          >
            {edges.map((e) => {
              const a = center(e.from)
              const b = center(e.to)
              return (
                <g key={e.id}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    className="stroke-ink-muted"
                    strokeWidth={2}
                  />
                  {e.label ? (
                    <text
                      x={(a.x + b.x) / 2}
                      y={(a.y + b.y) / 2 - 4}
                      textAnchor="middle"
                      className="fill-ink text-xs"
                    >
                      {e.label}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
          {cards.map((c) => (
            <button
              type="button"
              key={c.id}
              aria-label={`${c.kind === 'page' ? 'Note' : 'Text'} card: ${titleOf(c)}. Position ${c.x}, ${c.y}.`}
              aria-current={selected === c.id ? true : undefined}
              onKeyDown={(e) => onKey(e, c)}
              onFocus={() => setSelected(c.id)}
              onPointerDown={(e) => down(e, c)}
              onPointerMove={dragMove}
              onPointerUp={up}
              style={{ left: c.x, top: c.y, width: W, minHeight: H, touchAction: 'none' }}
              className={`absolute cursor-grab rounded-md border bg-surface p-2 text-left text-sm text-ink shadow-card outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected === c.id ? 'border-teal-strong' : 'border-border'}`}
            >
              <span className="block text-xs text-ink-muted">
                {c.kind === 'page' ? 'Note' : 'Text'}
              </span>
              <span className="block font-medium wrap-break-word">{titleOf(c)}</span>
            </button>
          ))}
        </div>
        {!cards.length ? (
          <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
            An empty canvas. Add a note card or a text card below.
          </p>
        ) : null}
      </div>

      {edit ? (
        <div className="grid gap-4 md:grid-cols-3">
          <WsCard title="Add a note card" id="cv-note">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Note
              <select
                className={fieldClass}
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
              >
                <option value="">Choose a note…</option>
                {pages.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || 'Untitled'}
                  </option>
                ))}
              </select>
            </label>
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11"
              disabled={!pageId}
              onClick={addPage}
            >
              Add note card
            </Button>
          </WsCard>
          <WsCard title="Add a text card" id="cv-text">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Text
              <input
                className={fieldClass}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="outline"
              className="mt-2 min-h-11"
              disabled={!text.trim()}
              onClick={addText}
            >
              Add text card
            </Button>
            <p className="mt-1 text-xs text-ink-muted">
              A text card lives only on this canvas. It is not a note.
            </p>
          </WsCard>
          <WsCard title="Connect two cards" id="cv-edge">
            {(['from', 'to'] as const).map((k) => (
              <label key={k} className="mb-1 flex flex-col gap-1 text-sm text-ink">
                {k === 'from' ? 'From' : 'To'}
                <select
                  className={fieldClass}
                  value={link[k]}
                  onChange={(e) => setLink({ ...link, [k]: e.target.value })}
                >
                  <option value="">Choose a card…</option>
                  {cards.map((c) => (
                    <option key={c.id} value={c.id}>
                      {titleOf(c).slice(0, 40)}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className="mb-1 flex flex-col gap-1 text-sm text-ink">
              Label (optional)
              <input
                className={fieldClass}
                value={link.label}
                onChange={(e) => setLink({ ...link, label: e.target.value })}
              />
            </label>
            <Button type="button" variant="outline" className="min-h-11" onClick={connect}>
              Connect
            </Button>
          </WsCard>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">You can look at this canvas but not change it.</p>
      )}

      <WsCard title="Everything on this canvas, as a list" id="cv-list">
        {cards.length ? (
          <ul className="flex flex-col gap-1 text-sm">
            {cards.map((c) => (
              <li key={c.id}>
                {c.kind === 'page' &&
                c.pageId &&
                ws.pages.some((p) => p.id === c.pageId && canReadPage(ws, p, actor)) ? (
                  <Link to={`/workspace/pages/${c.pageId}`} className="underline">
                    {titleOf(c)}
                  </Link>
                ) : (
                  titleOf(c)
                )}
                <span className="text-ink-muted">
                  {' '}
                  · {c.kind === 'page' ? 'note' : 'text'} card
                </span>
              </li>
            ))}
            {edges.map((e) => (
              <li key={e.id} className="text-ink-muted">
                {label(e.from)} → {label(e.to)}
                {e.label ? `: ${e.label}` : ''}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nothing on the canvas yet.</Empty>
        )}
      </WsCard>
      {edit ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          onClick={() =>
            void act(
              (s, c) => deleteCanvas(s, c, actor, cv.id),
              'Canvas removed. The notes on it are untouched.',
            ).then((r) => r.ok && navigate(`/workspace/spaces/${cv.spaceId}`))
          }
        >
          Remove this canvas
        </Button>
      ) : null}
    </article>
  )
}
