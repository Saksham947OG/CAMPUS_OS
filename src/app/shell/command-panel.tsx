import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { Dialog } from 'radix-ui'
import { useNavigate } from 'react-router'
import { useWorkspaceState } from '@/app/workspace-store'
import { cn } from '@/lib/utils'
import { useAppStore } from '../app-store'
import { commandEntries, type Entry } from './command-entries'

/**
 * The floating command panel (design spec §14.1): ordinary search first, explicit actions beside the results.
 * Opens with Ctrl/⌘ K or the sidebar search. It searches destinations and, for the active person, Workspace
 * records they can open. There is no natural-language guessing.
 */
export function CommandPanel() {
  const open = useAppStore((s) => s.commandOpen)
  const setOpen = useAppStore((s) => s.setCommandOpen)
  const actor = useAppStore((s) => s.activeProfileId)
  const ws = useWorkspaceState((s) => s.workspace)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(!open)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, setOpen])

  const entries = useMemo<Entry[]>(() => commandEntries(q, ws, actor), [q, ws, actor])

  const go = (e: Entry | undefined) => {
    if (!e) return
    setOpen(false)
    setQ('')
    void navigate(e.to)
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      setI((n) =>
        entries.length
          ? (n + (e.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length
          : 0,
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      go(entries[Math.min(i, entries.length - 1)])
    }
  }
  const groups = (['Actions', 'Workspace', 'Go to'] as const)
    .map((g) => ({ g, items: entries.filter((x) => x.group === g) }))
    .filter((x) => x.items.length)

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQ('')
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[var(--z-modal)] bg-ink/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="glass fixed top-[12vh] left-1/2 z-[var(--z-modal)] w-[min(40rem,calc(100vw-1.5rem))] -translate-x-1/2 overflow-hidden rounded-[22px] bg-surface/95 text-ink data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Search CampusOS</Dialog.Title>
          <div className="flex items-center gap-2 border-b border-border px-4">
            <Search className="size-4 text-ink-muted" aria-hidden="true" />
            <label htmlFor="cmd-input" className="sr-only">
              Search destinations, records and actions
            </label>
            <input
              id="cmd-input"
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setI(0)
              }}
              onKeyDown={onKey}
              placeholder="Open laundry, find a booking, search your notes…"
              className="min-h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-muted"
            />
            <kbd className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-ink-muted">
              Esc
            </kbd>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2">
            {groups.length ? (
              groups.map(({ g, items }) => (
                <section key={g} aria-label={g} className="mb-1">
                  <h2 className="px-3 py-1 text-[11px] font-semibold tracking-wide text-ink-muted uppercase">
                    {g}
                  </h2>
                  <ul>
                    {items.map((e) => {
                      const selected = entries[Math.min(i, entries.length - 1)] === e
                      return (
                        <li key={e.key}>
                          <button
                            type="button"
                            onClick={() => go(e)}
                            onMouseEnter={() => setI(entries.indexOf(e))}
                            aria-current={selected ? 'true' : undefined}
                            className={cn(
                              'flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left',
                              selected && 'bg-teal-tint',
                            )}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium">{e.label}</span>
                              <span className="block truncate text-xs text-ink-muted">
                                {e.detail}
                              </span>
                            </span>
                            {selected ? (
                              <CornerDownLeft
                                className="size-4 text-ink-muted"
                                aria-hidden="true"
                              />
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))
            ) : (
              <p className="p-4 text-sm text-ink-muted">
                Nothing matches “{q}”. Private notes of other people are never searched.
              </p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
