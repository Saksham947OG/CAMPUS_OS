import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { EssStore } from '@/domain/ess'
import type { Services } from './services'

export interface EssStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Campus Essentials snapshot. Student views read their own records through the selectors. */
  ess: EssStore | null
  error?: string
  refresh(): Promise<void>
}

export type EssStateStore = StoreApi<EssStoreState>

export function createEssStateStore(services: Services): EssStateStore {
  let requestId = 0
  const store = createStore<EssStoreState>((set) => ({
    status: 'loading',
    ess: null,
    async refresh() {
      const mine = ++requestId
      try {
        const ess = await services.ess.load()
        if (mine === requestId) set({ status: 'ready', ess, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load services.',
          })
      }
    },
  }))
  services.ess.subscribe(() => void store.getState().refresh())
  return store
}

export const EssStateContext = createContext<EssStateStore | null>(null)

export function useEssState<T>(selector: (s: EssStoreState) => T): T {
  const store = useContext(EssStateContext)
  if (!store) throw new Error('useEssState must be used inside <AppProviders>')
  return useStore(store, selector)
}
