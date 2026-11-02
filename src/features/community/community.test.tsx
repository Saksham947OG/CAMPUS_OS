import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
const A = 'demo-student-a'
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

async function enableOps(
  user: ReturnType<typeof userEvent.setup>,
  router: { navigate: (p: string) => Promise<void> },
  then: string,
) {
  await router.navigate('/settings')
  await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
  await router.navigate(then)
}

describe('Lost & Found', () => {
  it('CO-AT-01 / CO-AT-02 / CO-AT-06: the lists show only published reports with placeholder icons, and filters combine and reset', async () => {
    const user = userEvent.setup()
    renderApp('/community/lost-found')
    await heading('Lost & Found')
    expect(await screen.findByText('Black backpack')).toBeInTheDocument()
    expect(screen.getAllByText(/No picture\. Category:/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: 'Lost' }))
    expect(await screen.findByText(/There are no published reports here/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Found' }))
    await user.type(await within(screen.getByRole('main')).findByLabelText('Search'), 'zzz')
    expect(await screen.findByText(/No report matches these filters/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(await screen.findByText('Black backpack')).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/Blue keychain/) // private
  })

  it('CO-AT-03 / CO-AT-05 / CO-AT-12: a report is validated, a bad picture keeps the draft, and a duplicate needs confirmation', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/community/lost-found/new?type=lost')
    await heading('Report something lost')
    await user.click(screen.getByRole('button', { name: 'Publish locally' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/short title/)
    await user.type(screen.getByLabelText('Title (public)'), 'Grey umbrella')
    const file = new File(['x'], 'pic.gif', { type: 'image/gif' })
    fireEvent.change(screen.getByLabelText(/Picture \(optional\)/), { target: { files: [file] } })
    expect(await screen.findByText(/Only JPEG, PNG or WebP/)).toBeInTheDocument()
    expect(screen.getByLabelText('Title (public)')).toHaveValue('Grey umbrella') // draft kept
    await user.click(screen.getByRole('button', { name: 'Publish locally' }))
    await heading('Grey umbrella')
    expect(
      (await services.community.load()).reports.filter((r) => r.ownerProfileId === A),
    ).toHaveLength(1)
    await router.navigate('/community/lost-found/new?type=lost')
    await user.type(await screen.findByLabelText('Title (public)'), 'grey umbrella')
    expect(await screen.findByText(/You already have a similar open report/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Publish locally' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/similar open report/)
    await user.click(screen.getByRole('checkbox', { name: /different item/ }))
    await user.click(screen.getByRole('button', { name: 'Publish locally' }))
    await heading('grey umbrella')
  })

  it('CO-AT-07 / CO-AT-04: a possible match is labelled as such, and the owner’s private details stay on the owner’s page', async () => {
    const user = userEvent.setup()
    renderApp('/community/lost-found/new?type=lost')
    await heading('Report something lost')
    await user.type(screen.getByLabelText('Title (public)'), 'Black rucksack')
    await user.type(screen.getByLabelText('Colour (public, optional)'), 'black')
    await user.selectOptions(
      screen.getByLabelText('General area (public, optional)'),
      'Library area',
    )
    await user.type(screen.getByLabelText(/Private identifying details/), 'torn zip')
    await user.click(screen.getByRole('button', { name: 'Publish locally' }))
    await heading('Black rucksack')
    expect(await screen.findByText('Possible match')).toBeInTheDocument()
    expect(screen.getByText(/not proof that it is yours/)).toBeInTheDocument()
    expect(screen.getByText('torn zip')).toBeInTheDocument()
    expect(screen.queryByText(/verified owner/i)).not.toBeInTheDocument()
  })

  it('CO-AT-08 / CO-AT-09 / CO-AT-10 / CO-AT-11: a private claim, a simulator review, and no access for anyone else', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/community/lost-found/rep-1')
    await heading('Black backpack')
    await user.type(
      await screen.findByLabelText(/Something only the owner would know/),
      'blue keychain',
    )
    await user.click(screen.getByRole('button', { name: 'Request to claim' }))
    expect(await screen.findByRole('link', { name: 'Open your claim' })).toBeInTheDocument()
    const claimId = (await services.community.load()).claims[0]!.id
    await router.navigate(`/community/lost-found/claims/${claimId}`)
    await heading('Your claim')
    expect(await screen.findByText(/blue keychain/)).toBeInTheDocument()
    expect(screen.getByText(/not a real security or lost-property decision/)).toBeInTheDocument()
    // Another profile cannot open it.
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))
    await router.navigate(`/community/lost-found/claims/${claimId}`)
    await heading('Claim not found')
    expect(screen.getByRole('main').textContent).not.toMatch(/blue keychain/)
  })

  it('CO-AT-11: the simulator approves, records the handover, and the item leaves the active list but stays in history', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    const r = await services.community.submitClaim(A, 'rep-1', 'blue keychain')
    if (!r.ok) throw new Error('setup')
    await enableOps(user, router, '/community/lost-found')
    const ops = await screen.findByTestId('demo-ops')
    expect(ops.textContent).toMatch(/Demo reviewer view/)
    await user.click(within(ops).getByRole('button', { name: 'Start review' }))
    await user.click(await within(ops).findByRole('button', { name: 'Approve claim' }))
    await user.click(await within(ops).findByRole('button', { name: 'Record handover' }))
    await waitFor(async () =>
      expect((await services.community.load()).reports.find((x) => x.id === 'rep-1')!.status).toBe(
        'returned',
      ),
    )
    expect(screen.queryByText('Black backpack')).not.toBeInTheDocument()
  })

  it('CO-AT-13: a missing or private report explains itself', async () => {
    const { router, services } = renderApp('/community/lost-found/nope')
    await heading('Report not found')
    const d = await services.community.createReport(
      'demo-student-b',
      { kind: 'lost', title: 'Draft only', category: 'other', publish: false },
      'k',
    )
    if (!d.ok) throw new Error('setup')
    await router.navigate(`/community/lost-found/${d.value.report.id}`)
    await heading('Report not found')
    expect(screen.getByText(/draft that only its owner can see/)).toBeInTheDocument()
  })
})

describe('Clubs', () => {
  it('CO-AT-14 / CO-AT-15 / CO-AT-16 / CO-AT-18: directory search, honest recruitment, no contact details, no fake apply', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/community/clubs')
    await heading('Clubs & Committees')
    await user.type(await screen.findByLabelText('Search clubs'), 'robotics')
    expect(await screen.findByText('Demo Robotics Club')).toBeInTheDocument()
    expect(screen.queryByText('Demo Quiz Club')).not.toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/instagram|whatsapp|\d{10}/i)
    await router.navigate('/community/clubs/club-robotics?tab=recruitment')
    await heading('Demo Robotics Club')
    expect(await screen.findByText('Recruitment closing soon')).toBeInTheDocument()
    expect(screen.getByText(/Application link not provided/)).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /application link/i })).not.toBeInTheDocument()
    expect(screen.getByText(/no closing time is given/)).toBeInTheDocument()
    await router.navigate('/community/clubs/club-quiz?tab=recruitment')
    await heading('Demo Quiz Club')
    const link = await screen.findByRole('link', { name: /Open the application link/ })
    expect(link).toHaveAttribute('href', 'https://example.com/join')
    await router.navigate('/community/clubs/club-drama?tab=recruitment')
    await heading('Demo Drama Society')
    expect(await screen.findByText('Recruitment is closed.')).toBeInTheDocument()
    expect(screen.queryByText(/Apply now/)).not.toBeInTheDocument()
    await router.navigate('/community/clubs/club-nope')
    await heading('Club not found')
  })

  it('CO-AT-17 / CO-AT-21: following changes only a per-profile preference and puts the club’s timed event on the Calendar', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/community/clubs/club-robotics?tab=connect')
    await heading('Demo Robotics Club')
    await user.click(await screen.findByRole('button', { name: 'Follow' }))
    expect(await screen.findByRole('button', { name: 'Unfollow' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect((await services.community.load()).follows[A]).toEqual(['club-robotics'])
    await router.navigate('/calendar?view=day&date=2026-11-05')
    await user.click(await screen.findByRole('radio', { name: 'Campus Life' }))
    expect(
      (await screen.findAllByText(/Sample robotics workshop \(Demo Robotics Club, demo event\)/))
        .length,
    ).toBeGreaterThan(0)
    await router.navigate('/community')
    await heading('Community')
    expect(await screen.findByText(/Sample robotics workshop/)).toBeInTheDocument()
  })

  it('CO-AT-19 / CO-AT-20 / CO-AT-24: a conversation request stays pending, then one labelled Calendar entry once the simulator accepts', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/community/clubs/club-quiz?tab=connect')
    await heading('Demo Quiz Club')
    await user.click(await screen.findByRole('button', { name: 'Record request locally' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Propose a date/)
    await user.type(screen.getByLabelText('Preferred date'), '2026-11-04')
    await user.type(screen.getByLabelText('Start'), '12:00')
    await user.type(screen.getByLabelText('End'), '12:30')
    expect(screen.getByText(/has not been sent to any club officer/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Record request locally' }))
    await heading('My club requests')
    expect(await screen.findByText(/Request recorded \(not sent to anyone\)/)).toBeInTheDocument()
    const m = (await services.academics.load()).meetings[0]!
    expect(m).toMatchObject({
      actorKind: 'club',
      actorLabel: 'Demo Quiz Club',
      status: 'requested',
    })
    expect(services.academics.bookingRefs(A)).toHaveLength(0)
    await enableOps(user, router, '/community/clubs/requests')
    const ops = await screen.findByTestId('demo-ops')
    await user.click(within(ops).getByRole('button', { name: 'Accept' }))
    expect(
      (await screen.findAllByText(/Accepted locally \(simulated club representative\)/)).length,
    ).toBeGreaterThan(0)
    expect(services.academics.bookingRefs(A)).toHaveLength(1)
    expect(services.academics.bookingRefs(A)[0]).toMatchObject({
      category: 'meeting',
      resource: 'Meeting with Demo Quiz Club (demo, not official)',
    })
  })

  it('CO-AT-22: a simulated change keeps the event, tells followers and shows on the club page', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    await services.community.setFollow(A, 'club-robotics', true)
    await enableOps(user, router, '/community/clubs/club-robotics?tab=events')
    await heading('Demo Robotics Club')
    const ops = await screen.findByTestId('demo-ops')
    const row = within(ops)
      .getByText(/Sample robotics workshop/)
      .closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Cancel' }))
    expect((await screen.findAllByText('Cancelled')).length).toBeGreaterThan(0)
    expect((await services.community.load()).clubEvents.find((e) => e.id === 'cev-1')!.status).toBe(
      'cancelled',
    )
    const note = (await services.prefs.notifications.load(A)).value.items
    expect(note.filter((n) => /club event you follow was cancelled/.test(n.title))).toHaveLength(1)
  })
})

describe('Sports', () => {
  it('CO-AT-33 / CO-AT-39: fixtures show unknown times honestly and filter by sport and team', async () => {
    const user = userEvent.setup()
    const { router } = renderApp('/community/sports-events')
    await heading('Sports & Teams')
    expect(await screen.findByText(/Sample football fixture/)).toBeInTheDocument()
    expect(screen.getAllByText(/time not provided/).length).toBeGreaterThan(0)
    await user.selectOptions(screen.getByLabelText('Sport'), 'Football')
    expect(screen.queryByText(/Demo Hoopers vs/)).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Sport'), '')
    await user.selectOptions(screen.getByLabelText('Team'), 'team-1')
    expect(await screen.findByText(/Demo Hoopers vs Demo Strikers/)).toBeInTheDocument()
    expect(screen.queryByText(/Sample football fixture/)).not.toBeInTheDocument()
    await router.navigate('/community/sports-events/fixtures/fx-2')
    await heading('Sample football fixture')
    expect(
      await screen.findByText(/no confirmed time yet, so it is not on any Calendar/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Not provided').length).toBeGreaterThanOrEqual(2)
  })

  it('CO-AT-25 / CO-AT-26 / CO-AT-27 / CO-AT-38: create a team, request once, and nothing books a court', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/community/sports-events?tab=create')
    await heading('Sports & Teams')
    await user.click(await screen.findByRole('button', { name: 'Create team' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Give the team a name/)
    await user.type(screen.getByLabelText('Team name'), 'Demo Strikers')
    await user.type(screen.getByLabelText('Maximum roster'), '1')
    await user.click(screen.getByRole('button', { name: 'Create team' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 to 30/)
    await user.clear(screen.getByLabelText('Maximum roster'))
    await user.click(screen.getByRole('button', { name: 'Create team' }))
    await heading('Demo Strikers')
    expect(
      await screen.findByText(
        /not committee approval for any event, and it does not reserve a court or pitch/,
      ),
    ).toBeInTheDocument()
    await router.navigate('/community/sports-events/teams/team-1')
    await user.click(await screen.findByRole('button', { name: 'Request to join' }))
    expect(await screen.findByText(/Your request is waiting for the captain/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Request to join' })).not.toBeInTheDocument()
    expect(
      (await services.community.load()).joinRequests.filter((r) => r.profileId === A),
    ).toHaveLength(1)
    expect((await services.sports.load()).reservations).toHaveLength(0)
  })

  it('CO-AT-28 / CO-AT-29 / CO-AT-37: the simulated captain re-checks capacity, and a student cannot decide a team they do not captain', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    for (const p of [A, 'demo-student-b', 'demo-student-empty'])
      await services.community.requestJoin(p, 'team-1')
    await enableOps(user, router, '/community/sports-events')
    const ops = await screen.findByTestId('demo-ops')
    const team = within(ops)
      .getByText(/Demo Hoopers \(Basketball\)/)
      .closest('li')!
    const accepts = within(team).getAllByRole('button', { name: 'Accept as captain' })
    await user.click(accepts[0]!)
    await user.click(
      (await within(team).findAllByRole('button', { name: 'Accept as captain' }))[0]!,
    )
    await waitFor(async () =>
      expect(
        (await services.community.load()).teams.find((t) => t.id === 'team-1')!.members,
      ).toHaveLength(2),
    )
    await user.click(
      (await within(team).findAllByRole('button', { name: 'Accept as captain' }))[0]!,
    )
    expect((await screen.findAllByText(/This team is full/)).length).toBeGreaterThan(0)
    expect(
      (await services.community.load()).teams.find((t) => t.id === 'team-1')!.members,
    ).toHaveLength(2)
    const r = await services.community.decideJoin(
      { kind: 'student', profileId: A },
      'team-1',
      'x',
      'accept',
    )
    expect(r.ok).toBe(false)
  })

  it('CO-AT-32: an expired looking-for-players post shows no sign-up', async () => {
    renderApp('/community/sports-events?tab=looking')
    await heading('Sports & Teams')
    expect(await screen.findByText(/Two players for the sample match/)).toBeInTheDocument()
    expect(screen.queryByText(/A goalkeeper \(sample\)/)).not.toBeInTheDocument()
    expect(screen.getByText(/1 earlier post\(s\) have closed/)).toBeInTheDocument()
  })

  it('CO-AT-34 / CO-AT-35: a simulated reschedule updates one fixture and the Calendar, with one message per member', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    const r = await services.community.requestJoin(A, 'team-1')
    if (!r.ok) throw new Error('setup')
    await services.community.decideJoin({ kind: 'demoCaptain' }, 'team-1', r.value.id, 'accept')
    await enableOps(user, router, '/community/sports-events/fixtures/fx-1')
    await heading(/Demo Hoopers vs Demo Strikers/)
    const ops = await screen.findByTestId('demo-ops')
    await user.type(within(ops).getByLabelText('New date'), '2026-11-09')
    await user.type(within(ops).getByLabelText('Start'), '10:00')
    await user.type(within(ops).getByLabelText('End'), '11:00')
    const row = within(ops)
      .getByText(/Demo Hoopers vs Demo Strikers/)
      .closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Reschedule' }))
    expect(await screen.findByText(/Version 1 \(until/)).toBeInTheDocument()
    await router.navigate('/calendar?view=day&date=2026-11-09')
    await user.click(await screen.findByRole('radio', { name: 'Campus Life' }))
    expect(
      (await screen.findAllByText(/Demo Hoopers vs Demo Strikers \(sample\) \(demo fixture\)/))
        .length,
    ).toBeGreaterThan(0)
    const notes = (await services.prefs.notifications.load(A)).value.items.filter((n) =>
      /fixture you are in changed/.test(n.title),
    )
    expect(notes).toHaveLength(1)
    expect((await services.community.load()).fixtures.filter((f) => f.id === 'fx-1')).toHaveLength(
      1,
    )
  })

  it('CO-AT-36: a fixture in the past does not become completed on its own', async () => {
    const { services } = renderApp('/community/sports-events?tab=fixtures')
    await heading('Sports & Teams')
    expect(
      (await services.community.load()).fixtures.every((f) => f.status !== 'completedDemo'),
    ).toBe(true)
  })

  it('CO-AT-41: Home My activity lists your own open requests and links to the right record', async () => {
    const { services } = renderApp('/')
    await services.community.requestJoin(A, 'team-1')
    await services.academics.submitMeeting(
      A,
      { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Other' },
      'k',
    )
    await services.community.submitClaim(A, 'rep-1', 'blue keychain')
    const activity = await screen.findByRole('region', { name: /My activity/ })
    const link = (name: RegExp) => within(activity).findByRole('link', { name })
    expect(await link(/Join Demo Hoopers/)).toHaveAttribute(
      'href',
      '/community/sports-events/teams/team-1',
    )
    expect(await link(/Meeting with Demo Faculty A/)).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/academics\/appointments\//),
    )
    expect(await link(/Claim: Black backpack/)).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/community\/lost-found\/claims\//),
    )
    expect(activity.textContent).not.toMatch(/blue keychain/)
  })
})

describe('whole module', () => {
  it('CO-AT-40 / CO-AT-43: records survive a reload per profile, and Reset demo returns the starting scenario', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const a = renderApp('/community', { services: first.services })
    await first.services.community.createTeam(A, { sport: 'Football', name: 'Mine' })
    await first.services.community.setFollow(A, 'club-quiz', true)
    a.unmount()
    renderApp('/community/sports-events/my-participation', { services: first.services })
    await heading('My participation')
    expect(await screen.findByText('Mine')).toBeInTheDocument()
    const other = await first.services.community.load()
    expect(other.follows['demo-student-b']).toBeUndefined()
    await first.services.community.resetAll()
    expect((await first.services.community.load()).teams.some((t) => t.name === 'Mine')).toBe(false)
    expect(user).toBeDefined()
  })

  it('CO-AT-42: the hub and pages never claim outside messages, real approval or live sync', async () => {
    renderApp('/community')
    await heading('Community')
    const text = screen.getByRole('main').textContent ?? ''
    expect(text).toMatch(/nobody is messaged/)
    expect(text).not.toMatch(/real-time|live updates|email sent|officially approved/i)
  })
})
