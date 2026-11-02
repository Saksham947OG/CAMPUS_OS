import { useMemo } from 'react'
import { useAppStore } from '@/app/app-store'
import { useDataStore } from '@/app/data-store'
import { useServices } from '@/app/services'
import type { CampusDataRepository } from '@/data/domain/campus-repository'

/** The active profile's records (already audience-filtered) plus loading state. */
export function useCampusData() {
  const data = useDataStore((s) => s.data)
  const status = useDataStore((s) => s.status)
  const loadedFor = useDataStore((s) => s.profileId)
  const activeProfileId = useAppStore((s) => s.activeProfileId)
  return {
    data,
    error: useDataStore((s) => s.error),
    // Treat a mismatched profile as loading so one profile's records are never shown under another.
    status: loadedFor === activeProfileId ? status : ('loading' as const),
    profileId: activeProfileId,
  }
}

type Commands = Omit<CampusDataRepository, 'load' | 'subscribe'>

/** Write commands bound to the active profile. Reads refresh automatically through the data store. */
export function useCampusCommands(): {
  [K in keyof Commands]: (...args: DropFirst<Parameters<Commands[K]>>) => ReturnType<Commands[K]>
} {
  const { campus } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  return useMemo(() => {
    const bound: Record<string, unknown> = {}
    for (const name of Object.keys(campus) as (keyof CampusDataRepository)[]) {
      if (name === 'load' || name === 'subscribe') continue
      bound[name] = (...args: unknown[]) =>
        (campus[name] as (...a: unknown[]) => unknown)(profileId, ...args)
    }
    return bound as never
  }, [campus, profileId])
}

type DropFirst<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never
