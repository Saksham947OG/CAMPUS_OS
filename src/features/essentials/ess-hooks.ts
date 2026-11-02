import { useState } from 'react'
import { useAppStore } from '@/app/app-store'
import { useEssState } from '@/app/ess-store'
import { useServices } from '@/app/services'
import { useToast } from '@/components/toast-context'
import type { Result } from '@/data/repositories/types'
import { useNow } from '@/hooks/use-now'

/** The signed-in demo profile's view of Campus Essentials. Other profiles' records never come through here. */
export function useEss() {
  const ess = useEssState((s) => s.ess)
  const status = useEssState((s) => s.status)
  const error = useEssState((s) => s.error)
  const profileId = useAppStore((s) => s.activeProfileId)
  const showDemoOps = useAppStore((s) => s.showDemoOps)
  const now = useNow()
  const { ess: repo, newId, clock } = useServices()
  return { ess, status, error, profileId, showDemoOps, now, repo, newId, clock }
}

/** One repository call with a visible, honest result message. */
export function useAction() {
  const toast = useToast()
  const [message, setMessage] = useState('')
  const act = async <T>(fn: () => Promise<Result<T>>, done: string): Promise<Result<T>> => {
    const r = await fn()
    if (r.ok) {
      setMessage(done)
      toast.notify('success', done)
    } else {
      setMessage(r.error.message)
      toast.notify('error', r.error.message)
    }
    return r
  }
  return { act, message, setMessage }
}
