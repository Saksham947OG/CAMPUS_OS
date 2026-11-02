import { useEffect } from 'react'
import { useNow } from '@/hooks/use-now'
import { useServices } from './services'

/**
 * Looks for due in-app messages (an uncollected-parcel reminder, a reached wash-cycle estimate) each
 * time `useNow` re-reads the clock. It owns no timer of its own and cannot reach a closed app, so it
 * never claims background delivery. Each message is shown once.
 */
export function EssWatcher() {
  const { ess, sports } = useServices()
  const now = useNow()
  useEffect(() => {
    void ess.checkDue()
    void sports.checkDue()
  }, [ess, sports, now.ms])
  return null
}
