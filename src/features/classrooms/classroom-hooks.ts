import { useAppStore } from '@/app/app-store'
import { useClassroomState } from '@/app/classrooms-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in persona's view of classrooms. Other students' bookings arrive only as busy intervals. */
export function useClassrooms() {
  const classrooms = useClassroomState((s) => s.classrooms)
  const status = useClassroomState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { classrooms: repo, newId } = useServices()
  return { classrooms, status, profileId, showDemoOps, now, repo, newId }
}
