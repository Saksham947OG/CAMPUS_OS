import { useAppStore } from '@/app/app-store'
import { useMailState } from '@/app/mail-store'
import { useServices } from '@/app/services'
import { useNow } from '@/hooks/use-now'

/** The signed-in demo profile's view of Campus Mail: its own simulated mailbox and the broadcast feed. */
export function useMail() {
  const mail = useMailState((s) => s.mail)
  const status = useMailState((s) => s.status)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { mail: repo } = useServices()
  return { mail, status, profileId, showDemoOps, now, repo }
}
