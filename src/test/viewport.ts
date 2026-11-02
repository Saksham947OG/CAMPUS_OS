/**
 * jsdom has no layout, so responsive branches are driven through matchMedia. `setViewport(1400)`
 * makes every `(min-width: N)` query with N ≤ 1400 match. Call `clearViewport()` in afterEach.
 */
export function setViewport(width: number) {
  window.matchMedia = ((query: string) => {
    const m = /min-width:\s*(\d+)px/.exec(query)
    const matches = m ? width >= Number(m[1]) : false
    return {
      matches,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }
  }) as unknown as typeof window.matchMedia
}

export function clearViewport() {
  ;(window as { matchMedia?: unknown }).matchMedia = undefined
}
