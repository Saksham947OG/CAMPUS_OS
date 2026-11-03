import { BellRing, X } from 'lucide-react'
import { Link } from 'react-router'
import { useLiveAlerts } from './use-live-alerts'

/** Floating alert cards under the top bar. Reading and dismissing never move other content. */
export function AlertStack() {
  const { visible, dismiss } = useLiveAlerts()
  if (!visible.length) return null
  return (
    <aside
      aria-label="Live alerts"
      className="pointer-events-none fixed top-[calc(var(--topbar-height)+0.5rem)] right-3 z-[var(--z-notice)] flex w-[min(24rem,calc(100vw-1.5rem))] flex-col gap-2"
    >
      {visible.map((a) => (
        <output
          key={a.key}
          className="glass pointer-events-auto flex items-start gap-3 rounded-2xl p-3 text-sm text-ink"
        >
          <BellRing className="mt-0.5 size-5 shrink-0 text-teal-strong" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{a.title}</span>
            <span className="block text-xs text-ink-muted">{a.body}</span>
            <Link
              to={a.href}
              className="mt-1 inline-flex min-h-9 items-center text-sm font-medium text-coffee underline"
            >
              Open
            </Link>
          </span>
          <button
            type="button"
            aria-label={`Dismiss alert: ${a.title}`}
            onClick={() => dismiss(a.key)}
            className="press grid size-9 shrink-0 place-items-center rounded-lg hover:bg-mist"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </output>
      ))}
    </aside>
  )
}
