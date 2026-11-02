import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { ChillStore } from '@/domain/chill'
import type { Services } from './services'

export interface ChillStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared café snapshot. Student views must read their own orders via `ownOrders`. */
  café: ChillStore | null
  error?: string
  refresh(): Promise<void>
}

export type ChillStateStore = StoreApi<ChillStoreState>

/** Holds the latest café snapshot and refreshes whenever the repository reports a change. */
export function createChillStateStore(services: Services): ChillStateStore {
  let requestId = 0
  const store = createStore<ChillStoreState>((set) => ({
    status: 'loading',
    café: null,
    async refresh() {
      const mine = ++requestId
      try {
        const café = await services.chill.load()
        if (mine === requestId) set({ status: 'ready', café, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load Chill Spot.',
          })
      }
    },
  }))
  services.chill.subscribe(() => void store.getState().refresh())
  return store
}

export const ChillStateContext = createContext<ChillStateStore | null>(null)

export function useChillState<T>(selector: (s: ChillStoreState) => T): T {
  const store = useContext(ChillStateContext)
  if (!store) throw new Error('useChillState must be used inside <AppProviders>')
  return useStore(store, selector)
}
