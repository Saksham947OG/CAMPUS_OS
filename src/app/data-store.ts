import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import { emptyProfileData, type ProfileData } from '@/domain/records'
import type { Services } from './services'

export type DataStatus = 'loading' | 'ready' | 'error'

export interface DataStoreState {
  status: DataStatus
  profileId: string | null
  data: ProfileData
  error?: string
  /** (Re)load records for a profile. Safe to call repeatedly; the latest call wins. */
  load(profileId: string): Promise<void>
}

export type DataStore = StoreApi<DataStoreState>

/**
 * Holds the active profile's merged records. Selectors are pure functions of `data`; components
 * never read repositories directly. Repository changes trigger a reload for the active profile.
 */
export function createDataStore(services: Services): DataStore {
  let requestId = 0

  const store = createStore<DataStoreState>((set) => ({
    status: 'loading',
    profileId: null,
    data: emptyProfileData(''),

    async load(profileId) {
      const mine = ++requestId
      set((s) =>
        s.profileId === profileId
          ? s
          : { status: 'loading', profileId, data: emptyProfileData(profileId) },
      )
      try {
        const data = await services.campus.load(profileId)
        if (mine !== requestId) return // a newer load superseded this one (profile switch)
        set({ status: 'ready', profileId, data, error: undefined })
      } catch (error) {
        if (mine !== requestId) return
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Could not load records.',
        })
      }
    },
  }))

  services.campus.subscribe((profileId) => {
    if (store.getState().profileId === profileId) void store.getState().load(profileId)
  })

  // Machine reservations flow into the same booking projection Calendar and Home already read.
  const reloadActive = () => {
    const { profileId } = store.getState()
    if (profileId) void store.getState().load(profileId)
  }
  services.ess.subscribe(reloadActive)
  services.sports.subscribe(reloadActive)
  services.academics.subscribe(reloadActive)
  services.community.subscribe(reloadActive)
  services.classrooms.subscribe(reloadActive)
  services.meetings.subscribe(reloadActive)

  return store
}

export const DataStoreContext = createContext<DataStore | null>(null)

export function useDataStore<T>(selector: (state: DataStoreState) => T): T {
  const store = useContext(DataStoreContext)
  if (!store) throw new Error('useDataStore must be used inside <AppProviders>')
  return useStore(store, selector)
}
