import { useAppStore } from '@/app/app-store'
import { useEssState } from '@/app/ess-store'
import { useServices } from '@/app/services'
import { useSportsState } from '@/app/sports-store'
import { useNow } from '@/hooks/use-now'

/** The signed-in demo profile's view of Sports. Other profiles' records never come through here. */
export function useSports() {
  const sports = useSportsState((s) => s.sports)
  const status = useSportsState((s) => s.status)
  const ess = useEssState((s) => s.ess)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { sports: repo, newId } = useServices()
  return { sports, ess, status, profileId, showDemoOps, now, repo, newId }
}
