import { useAppStore } from '@/app/app-store'
import { useCommunityState } from '@/app/community-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in demo profile's view of Community. Other profiles' private fields never come through here. */
export function useCommunity() {
  const community = useCommunityState((s) => s.community)
  const status = useCommunityState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { community: repo, academics, newId } = useServices()
  return { community, status, profileId, showDemoOps, now, repo, academics, newId }
}
