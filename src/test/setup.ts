import '@testing-library/jest-dom/vitest'
import { configure } from '@testing-library/react'

// Lazy route chunks plus a loaded CI/laptop CPU can exceed the 1s default; correctness is unaffected.
configure({ asyncUtilTimeout: 4000 })

// jsdom lacks several browser APIs that Radix UI primitives rely on.
if (typeof window !== 'undefined') {
  const proto = window.HTMLElement.prototype
  proto.hasPointerCapture ??= () => false
  proto.setPointerCapture ??= () => {}
  proto.releasePointerCapture ??= () => {}
  proto.scrollIntoView ??= () => {}
  window.scrollTo = () => {}
  window.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}
