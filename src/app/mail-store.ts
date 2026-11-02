import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { MailStore } from '@/domain/mail'
import type { Services } from './services'

export interface MailStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Mail snapshot. Student views read their own records through the selectors. */
  mail: MailStore | null
  error?: string
  refresh(): Promise<void>
}

export type MailStateStore = StoreApi<MailStoreState>

export function createMailStateStore(services: Services): MailStateStore {
  let requestId = 0
  const store = createStore<MailStoreState>((set) => ({
    status: 'loading',
    mail: null,
    async refresh() {
      const mine = ++requestId
      try {
        const mail = await services.mail.load()
        if (mine === requestId) set({ status: 'ready', mail, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load mail data.',
          })
      }
    },
  }))
  services.mail.subscribe(() => void store.getState().refresh())
  return store
}

export const MailStateContext = createContext<MailStateStore | null>(null)

export function useMailState<T>(selector: (s: MailStoreState) => T): T {
  const store = useContext(MailStateContext)
  if (!store) throw new Error('useMailState must be used inside <AppProviders>')
  return useStore(store, selector)
}
