import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { SportsStore } from '@/domain/sports'
import type { Services } from './services'

export interface SportsStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Sports snapshot. Student views read their own records through the selectors. */
  sports: SportsStore | null
  error?: string
  refresh(): Promise<void>
}

export type SportsStateStore = StoreApi<SportsStoreState>

export function createSportsStateStore(services: Services): SportsStateStore {
  let requestId = 0
  const store = createStore<SportsStoreState>((set) => ({
    status: 'loading',
    sports: null,
    async refresh() {
      const mine = ++requestId
      try {
        const sports = await services.sports.load()
        if (mine === requestId) set({ status: 'ready', sports, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load bookings.',
          })
      }
    },
  }))
  services.sports.subscribe(() => void store.getState().refresh())
  return store
}

export const SportsStateContext = createContext<SportsStateStore | null>(null)

export function useSportsState<T>(selector: (s: SportsStoreState) => T): T {
  const store = useContext(SportsStateContext)
  if (!store) throw new Error('useSportsState must be used inside <AppProviders>')
  return useStore(store, selector)
}
