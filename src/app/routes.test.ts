import { appRoutes } from './router'
import {
  mobileMoreRoutes,
  mobilePrimaryRoutes,
  quickActionRoutes,
  routes,
  sidebarRoutes,
  utilityRoutes,
} from './routes'

describe('route registry', () => {
  it('has unique ids and paths, each starting with "/"', () => {
    expect(new Set(routes.map((r) => r.id)).size).toBe(routes.length)
    expect(new Set(routes.map((r) => r.path)).size).toBe(routes.length)
    for (const r of routes) expect(r.path.startsWith('/')).toBe(true)
  })

  it('marks exactly the built routes live; everything else is an honest "coming later" page', () => {
    expect(
      routes
        .filter((r) => r.status === 'live')
        .map((r) => r.id)
        .sort(),
    ).toEqual(
      [
        'administration',
        'administration-complaint-detail',
        'administration-complaints',
        'administration-complaints-new',
        'administration-leave',
        'administration-leave-detail',
        'administration-leave-new',
        'administration-request-link',
        'administration-requests',
        'administration-teaching',
        'administration-teaching-detail',
        'administration-teaching-new',
        'academics',
        'academics-courses',
        'academics-course',
        'academics-course-tab',
        'academics-faculty',
        'academics-faculty-meetings',
        'academics-faculty-new',
        'academics-faculty-profile',
        'academics-mentorship',
        'academics-group',
        'academics-office',
        'academics-office-meetings',
        'academics-office-new',
        'academics-meeting',
        'community',
        'community-lost-found',
        'community-lost-found-new',
        'community-claim',
        'community-report',
        'community-clubs',
        'community-club-requests',
        'community-club',
        'community-sports',
        'community-participation',
        'community-team',
        'community-fixture',
        'academics-exam-detail',
        'academics-grades',
        'academics-attendance',
        'academics-exams',
        'best-time',
        'bookings',
        'bookings-badminton',
        'bookings-chill',
        'bookings-classrooms',
        'bookings-classroom-booking',
        'bookings-gym',
        'bookings-library',
        'bookings-library-books',
        'bookings-library-loans',
        'bookings-library-space',
        'bookings-music',
        'bookings-my',
        'bookings-my-detail',
        'bookings-resource',
        'bookings-sports',
        'bookings-waitlist',
        'calendar',
        'calendar-find-a-time',
        'calendar-meeting',
        'calendar-polls',
        'calendar-poll',
        'chill-order',
        'chill-spot',
        'help-report',
        'home',
        'laundry',
        'mail',
        'mail-detail',
        'laundry-load',
        'laundry-machines',
        'laundry-ss',
        'mess',
        'mess-fees',
        'notification-prefs',
        'notifications',
        'parcel-detail',
        'parcels',
        'services',
        'settings',
        'sources',
        'time-tax',
        'time-tax-observations',
        'time-tax-scenarios',
      ].sort(),
    )
    expect(routes.filter((r) => r.status === 'devStub')).toEqual([])
    for (const r of routes.filter((x) => x.status !== 'live')) expect(r.status).toBe('comingLater')
  })

  it('links every approved feature route to a registry entry', () => {
    for (const r of routes) expect(r.registryRefs.length).toBeGreaterThan(0)
    expect(routes.find((r) => r.id === 'home')?.registryRefs).toContain('COS-HOME-001')
    expect(routes.find((r) => r.id === 'calendar')?.registryRefs).toContain('COS-CAL-001')
  })

  it('uses the Home spec bottom nav: Home, Calendar, Services + More (DEC-019)', () => {
    expect(mobilePrimaryRoutes.map((r) => r.id)).toEqual(['home', 'calendar', 'services'])
    expect(mobileMoreRoutes.map((r) => r.id)).toEqual(
      expect.arrayContaining(['bookings', 'academics', 'administration', 'community', 'time-tax']),
    )
  })

  it('offers real destinations as quick actions, including the spec defaults (COS-HOME-001 §5.5)', () => {
    const ids = quickActionRoutes.map((r) => r.id)
    expect(ids).toEqual(expect.arrayContaining(['chill-spot', 'laundry', 'bookings', 'mess']))
    for (const r of quickActionRoutes) expect(r.path.startsWith('/')).toBe(true)
  })

  it('places every route in exactly one navigation group', () => {
    const hidden = routes.filter((r) => r.slot === 'hidden')
    const grouped = [...sidebarRoutes, ...utilityRoutes, ...hidden].map((r) => r.id)
    expect(grouped.sort()).toEqual(routes.map((r) => r.id).sort())
    expect(hidden.length).toBeGreaterThan(0)
  })

  it('produces a router entry for every registry route plus a catch-all', () => {
    const shell = appRoutes[0]!
    const boundary = shell.children![0]!
    const children = boundary.children!
    expect(children).toHaveLength(routes.length + 1)
    expect(children.at(-1)?.path).toBe('*')
  })
})
