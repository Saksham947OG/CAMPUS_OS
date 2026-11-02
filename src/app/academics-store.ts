import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { AcademicsStore } from '@/domain/academics'
import type { Services } from './services'

export interface AcademicsStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Academics snapshot. Student views read their own records through the selectors. */
  academics: AcademicsStore | null
  error?: string
  refresh(): Promise<void>
}

export type AcademicsStateStore = StoreApi<AcademicsStoreState>

export function createAcademicsStateStore(services: Services): AcademicsStateStore {
  let requestId = 0
  const store = createStore<AcademicsStoreState>((set) => ({
    status: 'loading',
    academics: null,
    async refresh() {
      const mine = ++requestId
      try {
        const academics = await services.academics.load()
        if (mine === requestId) set({ status: 'ready', academics, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load academics data.',
          })
      }
    },
  }))
  services.academics.subscribe(() => void store.getState().refresh())
  return store
}

export const AcademicsStateContext = createContext<AcademicsStateStore | null>(null)

export function useAcademicsState<T>(selector: (s: AcademicsStoreState) => T): T {
  const store = useContext(AcademicsStateContext)
  if (!store) throw new Error('useAcademicsState must be used inside <AppProviders>')
  return useStore(store, selector)
}
