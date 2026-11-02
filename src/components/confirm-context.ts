import { createContext, useContext, type ReactNode } from 'react'

export interface ConfirmOptions {
  title: string
  description?: ReactNode
  confirmLabel: string
  /** A second affirmative choice (e.g. "Entire series" next to "This occurrence"). */
  extraLabel?: string
  cancelLabel?: string
  danger?: boolean
}

export type ConfirmResult = 'confirm' | 'extra' | 'cancel'

export type ConfirmFn = (options: ConfirmOptions) => Promise<ConfirmResult>

export const ConfirmContext = createContext<ConfirmFn | null>(null)

/** Promise-based confirmation. Outside the provider (isolated tests) it auto-confirms. */
export function useConfirm(): ConfirmFn {
  return useContext(ConfirmContext) ?? (async () => 'confirm')
}
