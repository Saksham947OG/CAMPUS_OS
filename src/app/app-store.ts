import { createContext, useContext } from 'react'
import { createStore, useStore, type StoreApi } from 'zustand'
import { DEFAULT_PROFILE_ID } from '@/data/seeds/demo/profiles'
import type { StorageMode } from '@/data/storage/storage-adapter'
import type { Profile } from '@/domain/profile'
import type { Services } from './services'

export type ThemeChoice = 'system' | 'light' | 'dark'

/** Writes the choice to the document so the CSS tokens switch. `system` removes it and follows the device. */
function applyTheme(theme: ThemeChoice) {
  if (typeof document === 'undefined') return
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

/** Applies the motion choice to the document so the CSS can calm decorative movement. */
function applyMotion(motion: 'system' | 'reduced') {
  if (typeof document === 'undefined') return
  if (motion === 'system') delete document.documentElement.dataset.motion
  else document.documentElement.dataset.motion = 'reduced'
}

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
  /** Appearance only. Persisted on this device. */
  theme: ThemeChoice
  setTheme(theme: ThemeChoice): void
  /** Reduce decorative movement (hover lift, drifting illustrations) even when the device allows it. */
  motion: 'system' | 'reduced'
  setMotion(motion: 'system' | 'reduced'): void
  sidebarCompact: boolean
  setSidebarCompact(compact: boolean): void
  /** Route ids pinned in the sidebar. Their order is the person's, never inferred. */
  pins: readonly string[]
  setPins(pins: readonly string[]): void
  /** Workspace focus mode: the shell recedes so the page fills the window. Not remembered between visits. */
  focusMode: boolean
  setFocusMode(on: boolean): void
  /** The floating command panel (Ctrl/⌘ K). */
  commandOpen: boolean
  setCommandOpen(on: boolean): void
  init(): Promise<void>
  /** Switches the active persona. Returns false if the id is unknown. */
  setActiveProfile(id: string): boolean
}

export type AppStore = StoreApi<AppStoreState>

/** Session/app-level state only. Domain records are NOT held here (they come from repositories). */
export function createAppStore(services: Services): AppStore {
  let initStarted = false

  // One place writes the app state, so a new field is never dropped by an older save call.
  const persist = () => {
    const s = store.getState()
    services.appState.save({
      activeProfileId: s.activeProfileId,
      showDemoOps: s.showDemoOps,
      theme: s.theme,
      motion: s.motion,
      sidebarCompact: s.sidebarCompact,
      pins: [...s.pins],
    })
  }

  const store = createStore<AppStoreState>((set, get) => ({
    status: 'loading',
    profiles: [],
    activeProfileId: DEFAULT_PROFILE_ID,
    storageMode: services.storage.mode,
    showDemoOps: false,
    theme: 'system',
    motion: 'system',
    sidebarCompact: false,
    pins: [],
    focusMode: false,
    commandOpen: false,
    setCommandOpen(commandOpen) {
      set({ commandOpen })
    },

    setMotion(motion) {
      set({ motion })
      applyMotion(motion)
      persist()
    },
    setSidebarCompact(sidebarCompact) {
      set({ sidebarCompact })
      persist()
    },
    setPins(pins) {
      set({ pins: pins.slice(0, 6) })
      persist()
    },
    setFocusMode(focusMode) {
      set({ focusMode })
    },

    setShowDemoOps(on) {
      set({ showDemoOps: on })
      persist()
    },

    setTheme(theme) {
      set({ theme })
      applyTheme(theme)
      persist()
    },

    async init() {
      if (initStarted) return
      initStarted = true
      try {
        const profiles = await services.profiles.list()
        if (profiles.length === 0) {
          set({ status: 'error', error: 'No personas are available.' })
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
          theme: saved?.theme ?? 'system',
          motion: saved?.motion ?? 'system',
          sidebarCompact: saved?.sidebarCompact === true,
          pins: saved?.pins ?? [],
          storageMode: services.storage.mode,
        })
        applyTheme(saved?.theme ?? 'system')
        applyMotion(saved?.motion ?? 'system')
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
      persist()
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
