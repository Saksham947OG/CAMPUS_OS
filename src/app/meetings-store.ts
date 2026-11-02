import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import type { MeetingStore } from '@/domain/meetings'
import type { Services } from './services'

export interface MeetingStoreState {
  status: 'loading' | 'ready' | 'error'
  /** The shared Meeting snapshot. Student views read their own records through the selectors. */
  meetings: MeetingStore | null
  error?: string
  refresh(): Promise<void>
}

export type MeetingStateStore = StoreApi<MeetingStoreState>

export function createMeetingStateStore(services: Services): MeetingStateStore {
  let requestId = 0
  const store = createStore<MeetingStoreState>((set) => ({
    status: 'loading',
    meetings: null,
    async refresh() {
      const mine = ++requestId
      try {
        const meetings = await services.meetings.load()
        if (mine === requestId) set({ status: 'ready', meetings, error: undefined })
      } catch (error) {
        if (mine === requestId)
          set({
            status: 'error',
            error: error instanceof Error ? error.message : 'Could not load meetings data.',
          })
      }
    },
  }))
  services.meetings.subscribe(() => void store.getState().refresh())
  return store
}

export const MeetingStateContext = createContext<MeetingStateStore | null>(null)

export function useMeetingState<T>(selector: (s: MeetingStoreState) => T): T {
  const store = useContext(MeetingStateContext)
  if (!store) throw new Error('useMeetingState must be used inside <AppProviders>')
  return useStore(store, selector)
}
