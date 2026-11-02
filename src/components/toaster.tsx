import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ToastContext, type ToastApi, type ToastKind } from './toast-context'

const icon = { success: CircleCheck, error: CircleAlert, info: Info } as const

/**
 * One transient status message at a time, announced politely. Messages never claim more than
 * happened: a local change is "Saved on this device", never "Synced" (COS-HOME-001 §6.1).
 * Auto-dismiss is a UI timer only; errors stay until dismissed.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; kind: ToastKind; message: string } | null>(null)
  const counter = useRef(0)

  const notify = useCallback((kind: ToastKind, message: string) => {
    setToast({ id: ++counter.current, kind, message })
  }, [])

  useEffect(() => {
    if (!toast || toast.kind === 'error') return
    const id = setTimeout(() => setToast((t) => (t?.id === toast.id ? null : t)), 4000)
    return () => clearTimeout(id)
  }, [toast])

  const api = useMemo<ToastApi>(
    () => ({
      notify,
      saved: (persisted, what) =>
        persisted
          ? notify('success', `${what ?? 'Changes'} saved on this device`)
          : notify(
              'info',
              `${what ?? 'Changes'} kept for this session only (browser storage is unavailable)`,
            ),
      savedResult: (result, what) =>
        result.ok
          ? notify('success', `${what ?? 'Changes'} saved on this device`)
          : notify(
              'info',
              `${what ?? 'Changes'} kept for this session only (browser storage is unavailable)`,
            ),
    }),
    [notify],
  )

  const Icon = toast ? icon[toast.kind] : null
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 md:bottom-6"
        aria-live="polite"
      >
        {toast && Icon ? (
          <output className="pointer-events-auto flex max-w-md items-start gap-2 rounded-md border border-border-strong bg-surface px-3 py-2.5 text-sm text-ink shadow-overlay">
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{toast.message}</span>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss message"
              className="-my-1 -mr-1 inline-flex size-8 items-center justify-center rounded hover:bg-mist"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </output>
        ) : null}
      </div>
    </ToastContext.Provider>
  )
}
