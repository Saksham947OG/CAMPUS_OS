import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { ClassroomStore } from '@/domain/classrooms'
import type { Services } from './services'

export interface ClassroomStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Classroom snapshot. Student views read their own records through the selectors. */
  classrooms: ClassroomStore | null
  error?: string
  refresh(): Promise<void>
}

export type ClassroomStateStore = StoreApi<ClassroomStoreState>

export function createClassroomStateStore(services: Services): ClassroomStateStore {
  let requestId = 0
  const store = createStore<ClassroomStoreState>((set) => ({
    status: 'loading',
    classrooms: null,
    async refresh() {
      const mine = ++requestId
      try {
        const classrooms = await services.classrooms.load()
        if (mine === requestId) set({ status: 'ready', classrooms, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load classrooms data.',
          })
      }
    },
  }))
  services.classrooms.subscribe(() => void store.getState().refresh())
  return store
}

export const ClassroomStateContext = createContext<ClassroomStateStore | null>(null)

export function useClassroomState<T>(selector: (s: ClassroomStoreState) => T): T {
  const store = useContext(ClassroomStateContext)
  if (!store) throw new Error('useClassroomState must be used inside <AppProviders>')
  return useStore(store, selector)
}
