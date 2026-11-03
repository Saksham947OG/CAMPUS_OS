import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { Result } from '@/data/repositories/types'
import type { Change, Ctx } from '@/domain/service-core'
import { emptyWorkspace, type WorkspaceStore } from '@/domain/workspace'
import type { Services } from './services'

export interface WorkspaceStoreState {
  status: 'loading' | 'ready' | 'error'
  workspace: WorkspaceStore
  error?: string
  refresh(): Promise<void>
  run<T>(rule: (s: WorkspaceStore, c: Ctx) => Change<WorkspaceStore, T>): Promise<Result<T>>
}

export type WorkspaceStateStore = StoreApi<WorkspaceStoreState>

export function createWorkspaceStateStore(services: Services): WorkspaceStateStore {
  let requestId = 0
  const store = createStore<WorkspaceStoreState>((set) => ({
    status: 'loading',
    workspace: emptyWorkspace(),
    async refresh() {
      const mine = ++requestId
      try {
        const workspace = await services.workspace.load()
        if (mine === requestId) set({ status: 'ready', workspace, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load Workspace.',
          })
      }
    },
    run: (rule) => services.workspace.mutate(rule),
  }))
  services.workspace.subscribe(() => void store.getState().refresh())
  return store
}

export const WorkspaceStateContext = createContext<WorkspaceStateStore | null>(null)

export function useWorkspaceState<T>(selector: (s: WorkspaceStoreState) => T): T {
  const store = useContext(WorkspaceStateContext)
  if (!store) throw new Error('useWorkspaceState must be used inside <AppProviders>')
  return useStore(store, selector)
}
