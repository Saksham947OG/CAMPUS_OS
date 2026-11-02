import { useAppStore } from '@/app/app-store'
import { useClassroomState } from '@/app/classrooms-store'
import { useMeetingState } from '@/app/meetings-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in persona's view of meetings and polls, with the room records they depend on. */
export function useMeetings() {
  const meetings = useMeetingState((s) => s.meetings)
  const status = useMeetingState((s) => s.status)
  const rooms = useClassroomState((s) => s.classrooms)
  const profileId = useAppStore((s) => s.activeProfileId)
  const profiles = useAppStore((s) => s.profiles)
  const now = useNow()
  const { meetings: repo, newId } = useServices()
  return { meetings, rooms, status, profileId, profiles, now, repo, newId }
}
