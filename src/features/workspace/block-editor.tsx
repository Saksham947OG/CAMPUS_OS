import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowDown, ArrowUp, Copy, MessageSquare, Trash2 } from 'lucide-react'
import { PAGE_ID } from '@/domain/workspace-links'
import { BLOCK_TYPES, type Block, type BlockType } from '@/domain/workspace'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<BlockType, string> = {
  paragraph: 'Text',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'Bulleted list',
  numbered: 'Numbered list',
  todo: 'Checklist',
  quote: 'Quote',
  callout: 'Callout',
  divider: 'Divider',
  code: 'Code',
}

const STYLE: Record<BlockType, string> = {
  paragraph: 'text-base',
  h1: 'font-display text-3xl font-semibold',
  h2: 'font-display text-2xl font-semibold',
  h3: 'font-display text-xl font-semibold',
  bullet: 'text-base',
  numbered: 'text-base',
  todo: 'text-base',
  quote: 'border-l-4 border-border-strong pl-3 text-base italic',
  callout: 'rounded-md bg-teal-tint p-2 text-base',
  divider: '',
  code: 'rounded-md bg-mist p-2 font-mono text-sm',
}

const TOKEN = /\[\[([^\]\n]+)\]\]/g

/** Read-only text: `[[pageId]]` becomes a link when the reader may open that page. */
export function RichText({
  text,
  titleOf,
}: {
  text: string
  titleOf: (id: string) => string | undefined
}) {
  const out: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(TOKEN)) {
    out.push(text.slice(last, m.index))
    const inner = m[1]!
    if (PAGE_ID.test(inner)) {
      const title = titleOf(inner)
      out.push(
        title !== undefined ? (
          <Link
            key={m.index}
            to={`/workspace/pages/${inner}`}
            className="font-medium text-coffee underline"
          >
            {title || 'Untitled'}
          </Link>
        ) : (
          <span key={m.index} className="text-ink-muted italic">
            a page you cannot open
          </span>
        ),
      )
    } else out.push(m[0])
    last = m.index + m[0].length
  }
  out.push(text.slice(last))
  return <>{out}</>
}

interface MenuState {
  blockId: string
  kind: 'slash' | 'link'
  query: string
  index: number
}

export interface BlockEditorProps {
  blocks: Block[]
  onChange: (blocks: Block[]) => void
  /** Persist now. Called when a block loses focus, after structural changes and on Ctrl/⌘ S. */
  onCommit: (blocks?: Block[]) => void
  editable: boolean
  /** Pages that `[[` can link to, for this reader. */
  linkable: { id: string; title: string }[]
  newId: (prefix: string) => string
  onChooseLink: (title: string, id: string) => void
  onComment?: (blockId: string) => void
  commentCount: (blockId: string) => number
  /** What to show beside a checklist item that is already a task. */
  taskBadge: (b: Block) => ReactNode
  onMakeTask?: (b: Block) => void
  titleOf: (id: string) => string | undefined
  /** Stored text shown in read-only mode (links as anchors). */
  displayOf: (stored: string) => string
}

export function BlockEditor(p: BlockEditorProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const pendingFocus = useRef<string | null>(null)
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  // Focus moves after the render that created or changed the block, without extra state.
  useEffect(() => {
    if (pendingFocus.current) {
      refs.current[pendingFocus.current]?.focus()
      pendingFocus.current = null
    }
  })
  const setFocusId = (id: string) => {
    pendingFocus.current = id
  }

  const set = (id: string, patch: Partial<Block>) =>
    p.onChange(p.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const commit = (next: Block[]) => {
    p.onChange(next)
    p.onCommit(next)
  }

  const slashItems = (q: string) =>
    BLOCK_TYPES.filter(
      (t) => TYPE_LABEL[t].toLowerCase().includes(q.toLowerCase()) || t.includes(q.toLowerCase()),
    )
  const linkItems = (q: string) =>
    p.linkable
      .filter((x) => (x.title || 'Untitled').toLowerCase().includes(q.toLowerCase()))
      .slice(0, 6)

  const detect = (b: Block, text: string, caret: number) => {
    if (b.type === 'code') return setMenu(null)
    const before = text.slice(0, caret)
    const link = /\[\[([^\]\n]*)$/.exec(before)
    if (link) return setMenu({ blockId: b.id, kind: 'link', query: link[1]!, index: 0 })
    if (/^\/[\w ]*$/.test(text) && !text.includes('\n'))
      return setMenu({ blockId: b.id, kind: 'slash', query: text.slice(1), index: 0 })
    setMenu(null)
  }

  const applySlash = (b: Block, type: BlockType) => {
    setMenu(null)
    const next = p.blocks.map((x) =>
      x.id === b.id ? { ...x, type, text: '', ...(type === 'todo' ? { checked: false } : {}) } : x,
    )
    commit(next)
    setFocusId(b.id)
  }
  const applyLink = (b: Block, target: { id: string; title: string }) => {
    const el = refs.current[b.id]
    const caret = el?.selectionStart ?? b.text.length
    const before = b.text.slice(0, caret).replace(/\[\[([^\]\n]*)$/, '')
    const label = target.title || 'Untitled'
    const text = `${before}[[${label}]]${b.text.slice(caret)}`
    p.onChooseLink(label, target.id)
    setMenu(null)
    set(b.id, { text })
    setFocusId(b.id)
  }

  const insertAfter = (b: Block, i: number) => {
    const keep = b.type === 'bullet' || b.type === 'numbered' || b.type === 'todo'
    const fresh: Block = {
      id: p.newId('b'),
      type: keep ? b.type : 'paragraph',
      text: '',
      ...(b.type === 'todo' ? { checked: false } : {}),
    }
    const next = [...p.blocks.slice(0, i + 1), fresh, ...p.blocks.slice(i + 1)]
    commit(next)
    setFocusId(fresh.id)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>, b: Block, i: number) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      return p.onCommit()
    }
    const open = menu && menu.blockId === b.id ? menu : null
    if (open) {
      const items = open.kind === 'slash' ? slashItems(open.query) : linkItems(open.query)
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const d = e.key === 'ArrowDown' ? 1 : -1
        return setMenu({
          ...open,
          index: items.length ? (open.index + d + items.length) % items.length : 0,
        })
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        return setMenu(null)
      }
      if (e.key === 'Enter' && items.length) {
        e.preventDefault()
        const pick = items[Math.min(open.index, items.length - 1)]!
        return open.kind === 'slash'
          ? applySlash(b, pick as BlockType)
          : applyLink(b, pick as { id: string; title: string })
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && b.type !== 'code') {
      e.preventDefault()
      if (!b.text && (b.type === 'bullet' || b.type === 'numbered' || b.type === 'todo'))
        return commit(p.blocks.map((x) => (x.id === b.id ? { ...x, type: 'paragraph' } : x)))
      return insertAfter(b, i)
    }
    if (e.key === 'Backspace' && !b.text) {
      e.preventDefault()
      if (b.type !== 'paragraph')
        return commit(p.blocks.map((x) => (x.id === b.id ? { ...x, type: 'paragraph' } : x)))
      if (p.blocks.length > 1) {
        commit(p.blocks.filter((x) => x.id !== b.id))
        const prev = p.blocks[i - 1] ?? p.blocks[i + 1]
        if (prev) setFocusId(prev.id)
      }
    }
  }

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= p.blocks.length) return
    const next = [...p.blocks]
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    commit(next)
  }
  const dup = (b: Block, i: number) => {
    const { workTaskId: _w, taskId: _t, ...rest } = b
    void [_w, _t]
    commit([...p.blocks.slice(0, i + 1), { ...rest, id: p.newId('b') }, ...p.blocks.slice(i + 1)])
  }
  const remove = (b: Block) =>
    commit(
      p.blocks.length > 1
        ? p.blocks.filter((x) => x.id !== b.id)
        : [{ ...b, text: '', type: 'paragraph' }],
    )

  const numbers = p.blocks.reduce<number[]>((acc, b, i) => {
    acc.push(
      b.type === 'numbered' ? (p.blocks[i - 1]?.type === 'numbered' ? acc[i - 1]! + 1 : 1) : 0,
    )
    return acc
  }, [])
  return (
    <div className="flex flex-col gap-1">
      {p.blocks.map((b, i) => {
        const comments = p.commentCount(b.id)
        const open = menu && menu.blockId === b.id ? menu : null
        const listId = `menu-${b.id}`
        const items = open
          ? open.kind === 'slash'
            ? slashItems(open.query)
            : linkItems(open.query)
          : []
        return (
          <div
            key={b.id}
            id={`blk-${b.id}`}
            className="group relative flex items-start gap-2 rounded-md py-0.5 focus-within:bg-mist/50 hover:bg-mist/50"
          >
            <div
              className="flex w-7 shrink-0 justify-end pt-1.5 text-ink-muted"
              aria-hidden={b.type !== 'todo'}
            >
              {b.type === 'bullet' ? '•' : b.type === 'numbered' ? `${numbers[i]}.` : null}
              {b.type === 'todo' ? (
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--accent-teal)]"
                  aria-label="Done"
                  checked={Boolean(b.checked)}
                  disabled={!p.editable}
                  onChange={(e) =>
                    commit(
                      p.blocks.map((x) =>
                        x.id === b.id ? { ...x, checked: e.target.checked } : x,
                      ),
                    )
                  }
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              {b.type === 'divider' ? (
                <hr className="my-3 border-border" />
              ) : p.editable ? (
                <>
                  <textarea
                    ref={(el) => {
                      refs.current[b.id] = el
                    }}
                    aria-label={`${TYPE_LABEL[b.type]} block ${i + 1}`}
                    rows={1}
                    value={b.text}
                    placeholder={
                      i === 0 && p.blocks.length === 1
                        ? "Write, or type '/' for blocks and '[[' to link a note"
                        : ''
                    }
                    onChange={(e) => {
                      set(b.id, { text: e.target.value })
                      detect(b, e.target.value, e.target.selectionStart)
                    }}
                    onKeyDown={(e) => onKey(e, b, i)}
                    onBlur={() => {
                      setMenu((m) => (m?.blockId === b.id ? null : m))
                      p.onCommit()
                    }}
                    className={cn(
                      'field-sizing-content w-full resize-none rounded-md bg-transparent px-1 py-1 text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                      STYLE[b.type],
                      b.type === 'todo' && b.checked && 'text-ink-muted line-through',
                    )}
                  />
                  {open ? (
                    <ul
                      id={listId}
                      aria-label={open.kind === 'slash' ? 'Block types' : 'Link to a note'}
                      className="absolute z-10 mt-1 w-64 rounded-md border border-border bg-surface p-1 shadow-card"
                    >
                      {items.length ? (
                        items.map((it, k) => {
                          const label =
                            open.kind === 'slash'
                              ? TYPE_LABEL[it as BlockType]
                              : (it as { title: string }).title || 'Untitled'
                          return (
                            <li
                              key={
                                open.kind === 'slash' ? (it as string) : (it as { id: string }).id
                              }
                              aria-current={k === open.index ? true : undefined}
                            >
                              <button
                                type="button"
                                tabIndex={-1}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() =>
                                  open.kind === 'slash'
                                    ? applySlash(b, it as BlockType)
                                    : applyLink(b, it as { id: string; title: string })
                                }
                                className={cn(
                                  'min-h-11 w-full rounded px-2 text-left text-sm text-ink',
                                  k === open.index && 'bg-teal-tint',
                                )}
                              >
                                {label}
                              </button>
                            </li>
                          )
                        })
                      ) : (
                        <li className="p-2 text-sm text-ink-muted">
                          {open.kind === 'link'
                            ? 'No note with that name. Keep typing and finish with ]] to link it later.'
                            : 'No block type matches.'}
                        </li>
                      )}
                    </ul>
                  ) : null}
                </>
              ) : (
                <p
                  className={cn(
                    'whitespace-pre-wrap px-1 py-1 text-ink',
                    STYLE[b.type],
                    b.type === 'todo' && b.checked && 'text-ink-muted line-through',
                  )}
                >
                  <RichText text={b.text} titleOf={p.titleOf} />
                </p>
              )}
              {(b.taskId || b.workTaskId) && p.taskBadge(b) ? (
                <div className="px-1 pb-1 text-xs">{p.taskBadge(b)}</div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100">
              {p.onComment ? (
                <button
                  type="button"
                  className="flex min-h-9 min-w-9 items-center justify-center gap-1 rounded text-xs text-ink hover:bg-mist"
                  aria-label={`Comment on block ${i + 1}`}
                  onClick={() => p.onComment!(b.id)}
                >
                  <MessageSquare className="size-4" aria-hidden="true" />
                  {comments ? comments : null}
                </button>
              ) : null}
              {p.editable ? (
                <>
                  {b.type === 'todo' && !b.taskId && !b.workTaskId && p.onMakeTask ? (
                    <button
                      type="button"
                      className="min-h-9 rounded px-2 text-xs font-medium text-coffee underline"
                      onClick={() => p.onMakeTask!(b)}
                    >
                      Make task
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded text-ink hover:bg-mist"
                    aria-label={`Move block ${i + 1} up`}
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                  >
                    <ArrowUp className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded text-ink hover:bg-mist"
                    aria-label={`Move block ${i + 1} down`}
                    onClick={() => move(i, 1)}
                    disabled={i === p.blocks.length - 1}
                  >
                    <ArrowDown className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded text-ink hover:bg-mist"
                    aria-label={`Duplicate block ${i + 1}`}
                    onClick={() => dup(b, i)}
                  >
                    <Copy className="size-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded text-ink hover:bg-mist"
                    aria-label={`Delete block ${i + 1}`}
                    onClick={() => remove(b)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </>
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}
