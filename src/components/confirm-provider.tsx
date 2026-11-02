import { Dialog } from 'radix-ui'
import { useCallback, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmContext, type ConfirmOptions, type ConfirmResult } from './confirm-context'

/**
 * Accessible modal confirmation (focus trapped, Escape = cancel, focus restored by Radix).
 * Used for deletes, "this occurrence / entire series" and other choices that must not be accidental.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((r: ConfirmResult) => void) | null>(null)

  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        resolver.current?.('cancel')
        resolver.current = resolve
        setOptions(o)
      }),
    [],
  )

  const close = (result: ConfirmResult) => {
    resolver.current?.(result)
    resolver.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root open={options !== null} onOpenChange={(open) => !open && close('cancel')}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[70] bg-ink/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[71] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-surface p-5 shadow-overlay">
            <Dialog.Title className="text-lg font-semibold text-ink">{options?.title}</Dialog.Title>
            <Dialog.Description asChild>
              <div className="mt-2 text-sm text-ink-muted">{options?.description}</div>
            </Dialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => close('cancel')}>
                {options?.cancelLabel ?? 'Cancel'}
              </Button>
              {options?.extraLabel ? (
                <Button variant="outline" className="min-h-11" onClick={() => close('extra')}>
                  {options.extraLabel}
                </Button>
              ) : null}
              <Button
                className={
                  options?.danger
                    ? 'min-h-11 bg-danger text-surface hover:bg-danger/90'
                    : 'min-h-11'
                }
                onClick={() => close('confirm')}
              >
                {options?.confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  )
}
