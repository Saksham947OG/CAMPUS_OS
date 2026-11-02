import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NotFoundPage } from '@/app/pages/not-found-page'
import { RouteErrorPage } from '@/app/pages/route-error-page'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { makeServices, renderApp } from '@/test/render-app'
import { routes, statusLabel } from '../routes'
import { AppShell } from './app-shell'

const GREETING = /^Good (morning|afternoon|evening)/

describe('app shell', () => {
  it('renders landmarks, a single h1, and the always-visible demo badge', async () => {
    renderApp('/')
    expect(await screen.findByRole('heading', { level: 1, name: GREETING })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation, mobile' })).toBeInTheDocument()

    const badge = screen.getByRole('link', { name: /Campus data/i })
    expect(badge).toHaveAttribute('href', '/sources')
  })

  it('makes the skip link the first tab stop', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1 })
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus()
  })

  it.each(routes.filter((r) => !r.path.includes(':')).map((r) => [r.label, r] as const))(
    '%s resolves to a page that states its availability honestly',
    async (_label, route) => {
      renderApp(route.path)
      const h1 = await screen.findByRole('heading', {
        level: 1,
        name: route.id === 'home' ? GREETING : route.label,
      })
      expect(h1).toBeInTheDocument()
      const main = screen.getByRole('main')
      // Anything not built must say so on the page itself; built pages must not claim to be placeholders.
      if (route.status === 'live')
        expect(within(main).queryByText(/^In development$/)).not.toBeInTheDocument()
      else expect(within(main).getAllByText(statusLabel[route.status]).length).toBeGreaterThan(0)
      expect(document.title).toBe(`${route.label} · CampusOS`)
    },
  )

  it('shows a not-found page inside the shell for unknown addresses', async () => {
    renderApp('/does-not-exist')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page not found' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    expect(document.title).toBe('Page not found · CampusOS')
  })

  it('navigates client-side from the sidebar and moves focus to main', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1, name: GREETING })
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    await userEvent.click(within(nav).getByRole('link', { name: /^Calendar/ }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Calendar' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveFocus()
  })

  it('keeps the shell on screen when a page throws', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    function Boom(): never {
      throw new Error('kaboom')
    }
    renderApp('/boom', {
      routes: [
        {
          path: '/',
          element: <AppShell />,
          children: [
            {
              ErrorBoundary: RouteErrorPage,
              children: [
                { path: 'boom', element: <Boom /> },
                { path: '*', element: <NotFoundPage /> },
              ],
            },
          ],
        },
      ],
    })
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong on this page' }),
    ).toBeInTheDocument()
    expect(screen.getByText('kaboom')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
    spy.mockRestore()
  })
})

describe('personas', () => {
  it('switches profile from the menu, persists the choice, and reflects it in Settings', async () => {
    const { services, data } = makeServices()
    const { router } = renderApp('/settings', { services })
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByText('Reference Student A', { selector: 'strong' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^Persona:/i }))
    await userEvent.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))

    expect(
      await screen.findByText('Reference Student B', { selector: 'strong' }),
    ).toBeInTheDocument()
    expect(JSON.parse(data.get('campusos:app:v1')!)).toMatchObject({
      activeProfileId: 'demo-student-b',
    })
    expect(router.state.location.pathname).toBe('/settings')
  })

  it('restores the stored profile on start and ignores unknown stored ids', async () => {
    const memory = createMemoryStorage({
      'campusos:app:v1': '{"activeProfileId":"demo-student-empty"}',
    })
    const stored = makeServices({ storage: createStorageAdapter({ backend: memory.storage }) })
    renderApp('/settings', { services: stored.services })
    expect(
      await screen.findByText('Reference Student (no schedule)', { selector: 'strong' }),
    ).toBeInTheDocument()

    const bad = createMemoryStorage({ 'campusos:app:v1': '{"activeProfileId":"someone-else"}' })
    const fallback = makeServices({ storage: createStorageAdapter({ backend: bad.storage }) })
    renderApp('/settings', { services: fallback.services })
    expect(
      await screen.findAllByText('Reference Student A', { selector: 'strong' }),
    ).not.toHaveLength(0)
  })
})

describe('storage honesty', () => {
  it('warns that changes will not persist when browser storage is unavailable', async () => {
    const services = makeServices({ storage: createStorageAdapter({ backend: null }) }).services
    renderApp('/', { services })
    const notice = await screen.findByText(/Browser storage is unavailable/)
    expect(notice.closest('output')).toBeInTheDocument()
  })

  it('shows no storage warning when storage works', async () => {
    renderApp('/')
    await screen.findByRole('heading', { level: 1, name: GREETING })
    expect(screen.queryByText(/Browser storage is unavailable/)).not.toBeInTheDocument()
  })
})
