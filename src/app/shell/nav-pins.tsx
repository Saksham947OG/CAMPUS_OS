import { ArrowDown, ArrowUp, Pin, X } from 'lucide-react'
import { useState } from 'react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { useAppStore } from '../app-store'
import { routeById } from '../routes'
import { pinCandidates } from './nav-groups'

/** Reorder, add and reset pinned shortcuts. Every move has a button, so nothing depends on dragging (spec §6.2). */
export function PinsEditor() {
  const pins = useAppStore((s) => s.pins)
  const setPins = useAppStore((s) => s.setPins)
  const [add, setAdd] = useState('')
  const candidates = pinCandidates().filter((r) => !pins.includes(r.id))
  const move = (i: number, d: -1 | 1) => {
    const next = [...pins]
    const j = i + d
    if (j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j]!, next[i]!]
    setPins(next)
  }
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Edit pinned shortcuts"
          className="press grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-mist hover:text-ink"
        >
          <Pin className="size-4" aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="right"
          align="start"
          sideOffset={12}
          collisionPadding={12}
          className="z-[var(--z-popover)] w-72 rounded-2xl border border-border bg-surface p-4 text-sm text-ink shadow-[var(--shadow-overlay)]"
        >
          <p className="font-semibold">Pinned shortcuts</p>
          <p className="mb-2 text-xs text-ink-muted">
            Up to six places you open often. The order is yours.
          </p>
          {pins.length ? (
            <ul className="mb-3 flex flex-col gap-1">
              {pins.map((id, i) => {
                const r = routeById(id)
                if (!r) return null
                return (
                  <li key={id} className="flex items-center gap-1">
                    <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    <button
                      type="button"
                      aria-label={`Move ${r.label} up`}
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="grid size-9 place-items-center rounded-lg hover:bg-mist disabled:opacity-40"
                    >
                      <ArrowUp className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${r.label} down`}
                      disabled={i === pins.length - 1}
                      onClick={() => move(i, 1)}
                      className="grid size-9 place-items-center rounded-lg hover:bg-mist disabled:opacity-40"
                    >
                      <ArrowDown className="size-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Unpin ${r.label}`}
                      onClick={() => setPins(pins.filter((p) => p !== id))}
                      className="grid size-9 place-items-center rounded-lg hover:bg-mist"
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mb-3 text-ink-muted">Nothing pinned yet.</p>
          )}
          {pins.length < 6 && candidates.length ? (
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1 text-xs font-medium">
                Add a pin
                <select
                  value={add}
                  onChange={(e) => setAdd(e.target.value)}
                  className="min-h-11 rounded-md border border-border-strong bg-surface px-2 text-sm"
                >
                  <option value="">Choose…</option>
                  {candidates.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={!add}
                onClick={() => {
                  setPins([...pins, add])
                  setAdd('')
                }}
              >
                Pin
              </Button>
            </div>
          ) : null}
          {pins.length ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 min-h-9"
              onClick={() => setPins([])}
            >
              Clear all pins
            </Button>
          ) : null}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
