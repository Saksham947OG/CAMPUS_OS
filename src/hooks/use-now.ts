import { useEffect, useState } from 'react'
import { useServices } from '@/app/services'
import { makeNow, type Now } from '@/selectors/now'

/**
 * "Now" in the campus timezone, re-read from the injected Clock every `intervalMs` and when the tab
 * becomes visible again. This is a plain clock tick: it is the only timer in the UI and it never
 * fabricates server or operator events. Today, Up Next and countdowns recompute from it, including
 * across IST midnight.
 */
export function useNow(intervalMs = 30_000): Now {
  const { clock } = useServices()
  const [now, setNow] = useState(() => makeNow(clock))

  useEffect(() => {
    const tick = () => setNow(makeNow(clock))
    tick()
    const id = setInterval(tick, intervalMs)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [clock, intervalMs])

  return now
}
