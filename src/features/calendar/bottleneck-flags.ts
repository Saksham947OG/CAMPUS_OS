import { createContext, useContext, useMemo } from 'react'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { personaEvidence } from '@/data/campus/evidence'
import { useCampusWorld } from '@/features/presence/use-campus-world'
import { useNow } from '@/hooks/use-now'
import type { CalendarItem } from '@/selectors/items'
import { flagItems, type ProcessFlag } from '@/selectors/process-bottleneck'

const EMPTY: ReadonlyMap<string, ProcessFlag> = new Map()
const FlagsContext = createContext<ReadonlyMap<string, ProcessFlag>>(EMPTY)
export const BottleneckFlagsProvider = FlagsContext.Provider
export const useFlags = () => useContext(FlagsContext)
export const useFlag = (key: string): ProcessFlag | undefined => useContext(FlagsContext).get(key)

/**
 * Process bottleneck flags for the items on screen. They need the persona's Time Tax baselines, which exist
 * only for the source-backed profiles, so the demo fixtures get none rather than invented ones.
 */
export function useBottleneckFlags(
  items: readonly CalendarItem[],
): ReadonlyMap<string, ProcessFlag> {
  const { sourceData } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const world = useCampusWorld()
  const now = useNow()
  const loads = world?.loads
  return useMemo(
    () =>
      sourceData
        ? flagItems(items, {
            evidence: personaEvidence(profileId),
            loads: loads ?? null,
            today: now.today,
            nowMinutes: now.minutes,
          })
        : EMPTY,
    [sourceData, items, profileId, loads, now.today, now.minutes],
  )
}
