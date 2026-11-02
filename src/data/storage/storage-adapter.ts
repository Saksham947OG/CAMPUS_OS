import type { ZodType } from 'zod'

/**
 * The ONLY module allowed to touch browser storage (enforced by src/test/architecture.test.ts).
 * It never throws: unavailable storage, quota errors and corrupt data all become explicit results
 * so the UI can degrade honestly instead of crashing or faking a "Saved" message.
 */

export type StorageMode = 'persistent' | 'memory'

export type ReadResult<T> =
  | { status: 'ok'; value: T }
  | { status: 'missing' }
  | { status: 'invalid'; reason: 'parse-error' | 'schema-mismatch'; detail: string }

export type WriteResult =
  { ok: true } | { ok: false; reason: 'quota' | 'unavailable' | 'unserializable' }

export interface StorageKeyParts {
  area: string
  version: number
  /** Omit for app-global state. */
  profileId?: string
}

/** e.g. `campusos:home:v1:demo-student-a` — matches COS-HOME-001 §6.5. */
export function storageKey({ area, version, profileId }: StorageKeyParts): string {
  const base = `campusos:${area}:v${version}`
  return profileId ? `${base}:${profileId}` : base
}

export interface StorageAdapter {
  /** 'memory' means changes will NOT survive a reload; the shell surfaces this to the user. */
  readonly mode: StorageMode
  read<T>(key: string, schema: ZodType<T>): ReadResult<T>
  write(key: string, value: unknown): WriteResult
  remove(key: string): void
  onModeChange(listener: (mode: StorageMode) => void): () => void
}

export interface CreateStorageAdapterOptions {
  /** Inject a Storage (tests) or `null` to force memory mode. Default: window.localStorage. */
  backend?: Storage | null
}

function probe(candidate: () => Storage): Storage | null {
  try {
    const storage = candidate()
    const probeKey = '__campusos_probe__'
    storage.setItem(probeKey, '1')
    storage.removeItem(probeKey)
    return storage
  } catch {
    return null
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}

export function createStorageAdapter(options: CreateStorageAdapterOptions = {}): StorageAdapter {
  let backend: Storage | null =
    options.backend !== undefined ? options.backend : probe(() => window.localStorage)
  const memory = new Map<string, string>()
  const listeners = new Set<(mode: StorageMode) => void>()
  let mode: StorageMode = backend ? 'persistent' : 'memory'

  const degrade = () => {
    if (mode === 'memory') return
    mode = 'memory'
    listeners.forEach((l) => l(mode))
  }

  const readRaw = (key: string): string | null => {
    if (backend) {
      try {
        const raw = backend.getItem(key)
        if (raw !== null) return raw
      } catch {
        backend = null
        degrade()
      }
    }
    return memory.get(key) ?? null
  }

  return {
    get mode() {
      return mode
    },

    read<T>(key: string, schema: ZodType<T>): ReadResult<T> {
      const raw = readRaw(key)
      if (raw === null) return { status: 'missing' }
      let json: unknown
      try {
        json = JSON.parse(raw)
      } catch (error) {
        return { status: 'invalid', reason: 'parse-error', detail: String(error) }
      }
      const parsed = schema.safeParse(json)
      if (!parsed.success) {
        return { status: 'invalid', reason: 'schema-mismatch', detail: parsed.error.message }
      }
      return { status: 'ok', value: parsed.data }
    },

    write(key: string, value: unknown): WriteResult {
      let serialized: string
      try {
        serialized = JSON.stringify(value)
      } catch {
        return { ok: false, reason: 'unserializable' }
      }
      if (serialized === undefined) return { ok: false, reason: 'unserializable' }

      if (backend) {
        try {
          backend.setItem(key, serialized)
          memory.delete(key)
          return { ok: true }
        } catch (error) {
          // Keep the value for this session so the app keeps working, but report honestly.
          memory.set(key, serialized)
          if (!isQuotaError(error)) backend = null
          degrade()
          return { ok: false, reason: isQuotaError(error) ? 'quota' : 'unavailable' }
        }
      }
      memory.set(key, serialized)
      return { ok: false, reason: 'unavailable' }
    },

    remove(key: string) {
      memory.delete(key)
      try {
        backend?.removeItem(key)
      } catch {
        /* nothing useful to do: key is already gone from memory */
      }
    },

    onModeChange(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
