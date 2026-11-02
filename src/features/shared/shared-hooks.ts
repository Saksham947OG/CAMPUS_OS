import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { useSharedState } from '@/app/shared-store'
import { useNow } from '@/hooks/use-now'

/** The signed-in persona's view of the Shared module. Seats of other profiles never come through here. */
export function useShared() {
  const shared = useSharedState((s) => s.shared)
  const status = useSharedState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { shared: repo, newId } = useServices()
  return { shared, status, profileId, showDemoOps, now, repo, newId }
}
