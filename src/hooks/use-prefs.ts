import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import type { PrefsRepositories } from '@/data/prefs/prefs'
import type { PreferencesLoad } from '@/data/repositories/preferences-repository'
import type { WriteResult } from '@/data/storage/storage-adapter'

type Source = PreferencesLoad<unknown>['source']

export interface PrefsHandle<T> {
  value: T
  /** False until the active profile's stored value has been read (avoid flashing defaults). */
  ready: boolean
  source: Source
  /** True when the last save could not be persisted to browser storage. */
  unsaved: boolean
  update(fn: (prev: T) => T): Promise<WriteResult>
  reset(): Promise<void>
}

/**
 * Profile-scoped preferences with live sync between every component that uses the same repository
 * (Home and Calendar both read the shared planning window, for example).
 */
export function usePrefs<K extends keyof PrefsRepositories>(
  key: K,
): PrefsHandle<ReturnType<PrefsRepositories[K]['defaults']>> {
  type T = ReturnType<PrefsRepositories[K]['defaults']>
  const { prefs } = useServices()
  const repo = prefs[
    key
  ] as unknown as import('@/data/repositories/preferences-repository').PreferencesRepository<T>
  const profileId = useAppStore((s) => s.activeProfileId)

  const [state, setState] = useState<{
    value: T
    source: Source
    loadedFor: string | null
    unsaved: boolean
  }>(() => ({
    value: repo.defaults(profileId),
    source: 'default',
    loadedFor: null,
    unsaved: false,
  }))
  const latest = useRef(state.value)

  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const loaded = await repo.load(profileId)
      if (cancelled) return
      latest.current = loaded.value
      setState((s) => ({
        value: loaded.value,
        source: loaded.source,
        loadedFor: profileId,
        unsaved: s.unsaved,
      }))
    }
    void read()
    const off = repo.subscribe((id) => id === profileId && void read())
    return () => {
      cancelled = true
      off()
    }
  }, [repo, profileId])

  const update = useCallback(
    async (fn: (prev: T) => T) => {
      const next = fn(latest.current)
      latest.current = next
      setState((s) => ({ ...s, value: next, source: 'stored' }))
      const result = await repo.save(profileId, next)
      setState((s) => ({ ...s, unsaved: !result.ok }))
      return result
    },
    [repo, profileId],
  )

  const reset = useCallback(async () => {
    await repo.reset(profileId)
  }, [repo, profileId])

  return {
    value: state.value,
    ready: state.loadedFor === profileId,
    source: state.source,
    unsaved: state.unsaved,
    update,
    reset,
  }
}
