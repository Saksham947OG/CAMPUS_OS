import { useAcademicsState } from '@/app/academics-store'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in demo profile's view of Academics. Other profiles' meetings and groups never come through here. */
export function useAcademics() {
  const academics = useAcademicsState((s) => s.academics)
  const status = useAcademicsState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { academics: repo, newId } = useServices()
  return { academics, status, profileId, showDemoOps, now, repo, newId }
}
