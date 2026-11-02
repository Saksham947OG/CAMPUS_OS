import { useAppStore } from '@/app/app-store'
import { useAdminState } from '@/app/admin-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in persona's view of Administration. Other profiles' requests never come through here. */
export function useAdmin() {
  const admin = useAdminState((s) => s.admin)
  const status = useAdminState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { admin: repo, newId } = useServices()
  return { admin, status, profileId, showDemoOps, now, repo, newId }
}
