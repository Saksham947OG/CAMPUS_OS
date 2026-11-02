import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppStore } from '@/app/app-store'
import { useChillState } from '@/app/chill-store'
import { useServices } from '@/app/services'
import { emptyCart, type Cart } from '@/domain/chill'
import { ownOrders } from '@/selectors/chill'

/** The signed-in persona's view of Chill Spot. Other profiles' orders are never exposed here. */
export function useChill() {
  const café = useChillState((s) => s.café)
  const status = useChillState((s) => s.status)
  const error = useChillState((s) => s.error)
  const profileId = useAppStore((s) => s.activeProfileId)
  return { café, status, error, profileId, myOrders: café ? ownOrders(café, profileId) : [] }
}

/** The profile's persisted cart. Changes are written through the repository on every edit. */
export function useCart() {
  const { chill, newId } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const [state, setState] = useState<{ cart: Cart; loadedFor: string | null; persisted: boolean }>({
    cart: emptyCart(),
    loadedFor: null,
    persisted: true,
  })
  const latest = useRef(state.cart)

  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const cart = await chill.loadCart(profileId)
      if (cancelled) return
      latest.current = cart
      setState((s) => ({ ...s, cart, loadedFor: profileId }))
    }
    void read()
    const off = chill.subscribe(() => void read())
    return () => {
      cancelled = true
      off()
    }
  }, [chill, profileId])

  const update = useCallback(
    async (fn: (c: Cart) => Cart) => {
      const next = fn(latest.current)
      latest.current = next
      setState((s) => ({ ...s, cart: next }))
      const r = await chill.saveCart(profileId, next)
      setState((s) => ({ ...s, persisted: r.ok && r.value.persisted }))
    },
    [chill, profileId],
  )

  return {
    cart: state.cart,
    ready: state.loadedFor === profileId,
    persisted: state.persisted,
    update,
    newId,
  }
}

/** The profile's favourite item ids. A favourite that left the menu or became unavailable stays listed but cannot be ordered. */
export function useFavorites() {
  const { chill } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const [state, setState] = useState<{ ids: string[]; loadedFor: string | null }>({
    ids: [],
    loadedFor: null,
  })
  useEffect(() => {
    let cancelled = false
    const read = async () => {
      const ids = await chill.loadFavorites(profileId)
      if (!cancelled) setState({ ids, loadedFor: profileId })
    }
    void read()
    const off = chill.subscribe(() => void read())
    return () => {
      cancelled = true
      off()
    }
  }, [chill, profileId])
  const toggle = useCallback(
    (menuItemId: string) => chill.toggleFavorite(profileId, menuItemId),
    [chill, profileId],
  )
  return { favorites: state.loadedFor === profileId ? state.ids : [], toggle }
}
