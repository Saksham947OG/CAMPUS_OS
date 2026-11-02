import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TabDef<Id extends string> {
  id: Id
  label: string
  content: ReactNode
}

/** Accessible tabs (WAI-ARIA tabs pattern: arrow keys move between tabs, Home/End jump). */
export function Tabs<Id extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly TabDef<Id>[]
  value: Id
  onChange: (id: Id) => void
  label: string
  idPrefix: string
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({})
  const active = tabs.find((t) => t.id === value) ?? tabs[0]!

  const onKeyDown = (e: KeyboardEvent) => {
    const i = tabs.findIndex((t) => t.id === active.id)
    let next = -1
    if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
    else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = tabs.length - 1
    if (next >= 0) {
      e.preventDefault()
      const id = tabs[next]!.id
      onChange(id)
      refs.current[id]?.focus()
    }
  }

  return (
    <div>
      <div
        role="tablist"
        tabIndex={-1}
        aria-label={label}
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-border"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[t.id] = el
            }}
            role="tab"
            type="button"
            id={`${idPrefix}-tab-${t.id}`}
            aria-selected={t.id === active.id}
            aria-controls={`${idPrefix}-panel-${t.id}`}
            tabIndex={t.id === active.id ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              'min-h-11 flex-1 border-b-4 px-2 text-sm font-medium text-ink',
              t.id === active.id ? 'border-teal font-semibold' : 'border-transparent hover:bg-mist',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`${idPrefix}-panel-${active.id}`}
        aria-labelledby={`${idPrefix}-tab-${active.id}`}
        tabIndex={0}
        className="pt-4"
      >
        {active.content}
      </div>
    </div>
  )
}
