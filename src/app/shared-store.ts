import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { SharedStore } from '@/domain/shared'
import type { Services } from './services'

export interface SharedStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Shared snapshot. Student views read their own records through the selectors. */
  shared: SharedStore | null
  error?: string
  refresh(): Promise<void>
}

export type SharedStateStore = StoreApi<SharedStoreState>

export function createSharedStateStore(services: Services): SharedStateStore {
  let requestId = 0
  const store = createStore<SharedStoreState>((set) => ({
    status: 'loading',
    shared: null,
    async refresh() {
      const mine = ++requestId
      try {
        const shared = await services.shared.load()
        if (mine === requestId) set({ status: 'ready', shared, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load shared data.',
          })
      }
    },
  }))
  services.shared.subscribe(() => void store.getState().refresh())
  return store
}

export const SharedStateContext = createContext<SharedStateStore | null>(null)

export function useSharedState<T>(selector: (s: SharedStoreState) => T): T {
  const store = useContext(SharedStateContext)
  if (!store) throw new Error('useSharedState must be used inside <AppProviders>')
  return useStore(store, selector)
}
