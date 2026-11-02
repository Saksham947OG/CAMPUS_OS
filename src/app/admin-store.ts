import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { AdminStore } from '@/domain/admin'
import type { Services } from './services'

export interface AdminStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Administration snapshot. Student views read their own records through the selectors. */
  admin: AdminStore | null
  error?: string
  refresh(): Promise<void>
}

export type AdminStateStore = StoreApi<AdminStoreState>

export function createAdminStateStore(services: Services): AdminStateStore {
  let requestId = 0
  const store = createStore<AdminStoreState>((set) => ({
    status: 'loading',
    admin: null,
    async refresh() {
      const mine = ++requestId
      try {
        const admin = await services.admin.load()
        if (mine === requestId) set({ status: 'ready', admin, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load requests.',
          })
      }
    },
  }))
  services.admin.subscribe(() => void store.getState().refresh())
  return store
}

export const AdminStateContext = createContext<AdminStateStore | null>(null)

export function useAdminState<T>(selector: (s: AdminStoreState) => T): T {
  const store = useContext(AdminStateContext)
  if (!store) throw new Error('useAdminState must be used inside <AppProviders>')
  return useStore(store, selector)
}
