import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import { DEFAULT_PROFILE_ID } from '@/data/seeds/demo/profiles'
import type { StorageMode } from '@/data/storage/storage-adapter'
import type { Profile } from '@/domain/profile'
import type { Services } from './services'

export type AppStatus = 'loading' | 'ready' | 'error'

export interface AppStoreState {
  status: AppStatus
  error?: string
  profiles: readonly Profile[]
  activeProfileId: string
  storageMode: StorageMode
  /** Local Chill Spot simulator visibility (off by default; an explicit Settings choice). */
  showDemoOps: boolean
  setShowDemoOps(on: boolean): void
  init(): Promise<void>
  /** Switches the active demo profile. Returns false if the id is unknown. */
  setActiveProfile(id: string): boolean
}

export type AppStore = StoreApi<AppStoreState>

/** Session/app-level state only. Domain records are NOT held here (they come from repositories). */
export function createAppStore(services: Services): AppStore {
  let initStarted = false

  const store = createStore<AppStoreState>((set, get) => ({
    status: 'loading',
    profiles: [],
    activeProfileId: DEFAULT_PROFILE_ID,
    storageMode: services.storage.mode,
    showDemoOps: false,

    setShowDemoOps(on) {
      set({ showDemoOps: on })
      services.appState.save({ activeProfileId: get().activeProfileId, showDemoOps: on })
    },

    async init() {
      if (initStarted) return
      initStarted = true
      try {
        const profiles = await services.profiles.list()
        if (profiles.length === 0) {
          set({ status: 'error', error: 'No demo profiles are available.' })
          return
        }
        const saved = services.appState.load()
        const stored = saved?.activeProfileId
        const active =
          profiles.find((p) => p.id === stored)?.id ??
          profiles.find((p) => p.id === DEFAULT_PROFILE_ID)?.id ??
          profiles[0]!.id
        set({
          status: 'ready',
          profiles,
          activeProfileId: active,
          showDemoOps: saved?.showDemoOps === true,
          storageMode: services.storage.mode,
        })
      } catch (error) {
        set({
          status: 'error',
          error: error instanceof Error ? error.message : 'Failed to load profiles.',
        })
      }
    },

    setActiveProfile(id) {
      if (!get().profiles.some((p) => p.id === id)) return false
      set({ activeProfileId: id })
      services.appState.save({ activeProfileId: id, showDemoOps: get().showDemoOps })
      set({ storageMode: services.storage.mode })
      return true
    },
  }))

  services.storage.onModeChange((storageMode) => store.setState({ storageMode }))
  return store
}

export const AppStoreContext = createContext<AppStore | null>(null)

export function useAppStore<T>(selector: (state: AppStoreState) => T): T {
  const store = useContext(AppStoreContext)
  if (!store) throw new Error('useAppStore must be used inside <AppProviders>')
  return useStore(store, selector)
}
