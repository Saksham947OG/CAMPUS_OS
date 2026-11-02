import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { CommunityStore } from '@/domain/community'
import type { Services } from './services'

export interface CommunityStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Community snapshot. Student views read their own records through the selectors. */
  community: CommunityStore | null
  error?: string
  refresh(): Promise<void>
}

export type CommunityStateStore = StoreApi<CommunityStoreState>

export function createCommunityStateStore(services: Services): CommunityStateStore {
  let requestId = 0
  const store = createStore<CommunityStoreState>((set) => ({
    status: 'loading',
    community: null,
    async refresh() {
      const mine = ++requestId
      try {
        const community = await services.community.load()
        if (mine === requestId) set({ status: 'ready', community, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load community data.',
          })
      }
    },
  }))
  services.community.subscribe(() => void store.getState().refresh())
  return store
}

export const CommunityStateContext = createContext<CommunityStateStore | null>(null)

export function useCommunityState<T>(selector: (s: CommunityStoreState) => T): T {
  const store = useContext(CommunityStateContext)
  if (!store) throw new Error('useCommunityState must be used inside <AppProviders>')
  return useStore(store, selector)
}
