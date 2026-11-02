import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AppProviders } from '@/app/providers'
import { appRoutes } from '@/app/router'
import { createServices, type Services } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixedClock } from '@/lib/time'
import { createMemoryStorage } from './memory-storage'

export function makeServices(
  overrides: Partial<Pick<Services, 'storage'>> & {
    demoExamples?: boolean
    sourceData?: boolean
  } = {},
) {
  const memory = createMemoryStorage()
  const storage = overrides.storage ?? createStorageAdapter({ backend: memory.storage })
  return {
    services: createServices({
      storage,
      clock: fixedClock('2026-11-02T04:30:00Z'),
      demoExamples: overrides.demoExamples ?? false,
      sourceData: overrides.sourceData ?? false,
    }),
    data: memory.data,
  }
}

/** Renders the real route table (or a custom one) inside real providers with in-memory storage. */
export function renderApp(
  path = '/',
  options: { routes?: RouteObject[]; services?: Services } = {},
) {
  const services = options.services ?? makeServices().services
  const router = createMemoryRouter(options.routes ?? appRoutes, { initialEntries: [path] })
  const utils = render(
    <AppProviders services={services}>
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...utils, router, services }
}
