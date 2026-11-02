import { useSyncExternalStore } from 'react'

/** Subscribes to a CSS media query. Returns `fallback` where matchMedia is unavailable (SSR, jsdom). */
export function useMediaQuery(query: string, fallback = false): boolean {
  return useSyncExternalStore(
    (notify) => {
      if (typeof window.matchMedia !== 'function') return () => {}
      const mql = window.matchMedia(query)
      mql.addEventListener('change', notify)
      return () => mql.removeEventListener('change', notify)
    },
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : fallback),
    () => fallback,
  )
}
