import type { ZodType } from 'zod'
import { storageKey, type StorageAdapter, type WriteResult } from '../storage/storage-adapter'
import type { Unsubscribe } from './types'

export type PreferencesLoad<T> =
  | { source: 'stored'; value: T }
  | { source: 'default'; value: T }
  /** Stored data existed but failed validation; defaults are used and the stored value is left untouched. */
  | { source: 'recovered'; value: T; detail: string }

export interface PreferencesRepository<T> {
  /** Fresh defaults for a profile (synchronous, so UI can render before the first load resolves). */
  defaults(profileId: string): T
  load(profileId: string): Promise<PreferencesLoad<T>>
  save(profileId: string, value: T): Promise<WriteResult>
  /** Removes stored preferences for the profile only. Domain records live under other keys. */
  reset(profileId: string): Promise<void>
  subscribe(listener: (profileId: string) => void): Unsubscribe
}

export interface LocalPreferencesOptions<T> {
  storage: StorageAdapter
  /** Storage area, e.g. 'home' → `campusos:home:v1:{profileId}`. */
  area: string
  version: number
  schema: ZodType<T>
  defaults: (profileId: string) => T
}

/**
 * Profile-scoped, schema-validated preferences on top of the StorageAdapter. Corrupt or outdated
 * data never throws and never deletes anything: callers get defaults plus a `recovered` marker so
 * the UI can show a quiet notice (COS-HOME-001 §6.5, H-T19).
 */
export function createLocalPreferencesRepository<T>(
  options: LocalPreferencesOptions<T>,
): PreferencesRepository<T> {
  const { storage, area, version, schema, defaults } = options
  const listeners = new Set<(profileId: string) => void>()
  const keyFor = (profileId: string) => storageKey({ area, version, profileId })
  const notify = (profileId: string) => listeners.forEach((l) => l(profileId))

  return {
    defaults,

    async load(profileId) {
      const result = storage.read(keyFor(profileId), schema)
      switch (result.status) {
        case 'ok':
          return { source: 'stored', value: result.value }
        case 'missing':
          return { source: 'default', value: defaults(profileId) }
        case 'invalid':
          return {
            source: 'recovered',
            value: defaults(profileId),
            detail: `${result.reason}: ${result.detail}`,
          }
      }
    },

    async save(profileId, value) {
      const parsed = schema.safeParse(value)
      if (!parsed.success) return { ok: false, reason: 'unserializable' }
      const result = storage.write(keyFor(profileId), parsed.data)
      notify(profileId)
      return result
    },

    async reset(profileId) {
      storage.remove(keyFor(profileId))
      notify(profileId)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
