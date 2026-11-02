import { createContext, useContext } from 'react'
import type { WriteResult } from '@/data/storage/storage-adapter'

export type ToastKind = 'success' | 'error' | 'info'

export interface ToastApi {
  notify(kind: ToastKind, message: string): void
  /** "Saved on this device" only when it really persisted; otherwise an honest session-only message. */
  saved(persisted: boolean, what?: string): void
  savedResult(result: WriteResult, what?: string): void
}

export const ToastContext = createContext<ToastApi | null>(null)

const noop: ToastApi = { notify: () => {}, saved: () => {}, savedResult: () => {} }

/** Falls back to a no-op outside the provider so isolated component tests keep working. */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? noop
}
