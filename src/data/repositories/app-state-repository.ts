import { z } from 'zod'
import { storageKey, type StorageAdapter, type WriteResult } from '../storage/storage-adapter'

export const appStateSchema = z.object({
  activeProfileId: z.string().min(1),
  /** Explicit, per-device switch for the local Chill Spot simulator panel (DEC-046). Not a security control. */
  showDemoOps: z.boolean().optional(),
  /** Appearance choice. Missing means "system". Presentation only: it never changes data. */
  theme: z.enum(['system', 'light', 'dark']).optional(),
})
export type AppState = z.infer<typeof appStateSchema>

const KEY = storageKey({ area: 'app', version: 1 })

/** App-global (not profile-scoped) state: currently only which demo profile is active. */
export interface AppStateRepository {
  load(): AppState | undefined
  save(state: AppState): WriteResult
}

export function createAppStateRepository(storage: StorageAdapter): AppStateRepository {
  return {
    load() {
      const result = storage.read(KEY, appStateSchema)
      return result.status === 'ok' ? result.value : undefined
    },
    save(state) {
      return storage.write(KEY, state)
    },
  }
}
