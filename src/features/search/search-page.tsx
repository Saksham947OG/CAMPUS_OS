import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { commandEntries } from '@/app/shell/command-entries'
import { useWorkspaceState } from '@/app/workspace-store'
import { PageHeader } from '@/components/page-header'
import { inputClass } from '@/components/form-kit'

/** Search across destinations, actions and the Workspace records the active person can open. */
export function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const actor = useAppStore((s) => s.activeProfileId)
  const ws = useWorkspaceState((s) => s.workspace)
  const term = params.get('q') ?? ''
  const entries = commandEntries(term, ws, actor)
  const groups = (['Actions', 'Workspace', 'Go to'] as const)
    .map((g) => ({ g, items: entries.filter((e) => e.group === g) }))
    .filter((x) => x.items.length)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Search"
        description="Find a page, a booking, a note, a task or an action."
      />
      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          setParams(q.trim() ? { q: q.trim() } : {}, { replace: true })
        }}
      >
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium text-ink">
          Search CampusOS
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={inputClass}
          />
        </label>
        <button
          type="submit"
          className="min-h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>
      {groups.length ? (
        groups.map(({ g, items }) => (
          <section key={g} aria-label={g} className="flex flex-col gap-2">
            <h2 className="font-display text-lg font-semibold text-ink">{g}</h2>
            <ul className="flex flex-col gap-2">
              {items.map((e) => (
                <li key={e.key}>
                  <Link
                    to={e.to}
                    className="lift flex flex-col rounded-2xl border border-border bg-surface p-3"
                  >
                    <span className="font-medium text-ink">{e.label}</span>
                    <span className="text-sm text-ink-muted">{e.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      ) : (
        <p className="rounded-2xl bg-mist p-4 text-sm text-ink-muted">
          Nothing matches “{term}”. Private notes of other people are never searched.
        </p>
      )}
    </article>
  )
}
