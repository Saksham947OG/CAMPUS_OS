import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the demo profile is "Demo Student A".
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
  await user.click(await screen.findByRole('checkbox', { name: /Show Demo Operations/ }))
  await router.navigate(then)
}

describe('course hub', () => {
  it('AC-AT-01: the overview shows source-labelled entry points to courses, faculty, mentorship and the office', async () => {
    renderApp('/academics')
    await heading('Academics')
    expect(await screen.findByText(/Demo · sample data, not official records/)).toBeInTheDocument()
    for (const name of [/My courses/, /Faculty Connect/, /Mentorship/, /BMS Office/])
      expect(screen.getAllByRole('link', { name }).length).toBeGreaterThan(0)
  })

  it('AC-AT-02 / AC-AT-03: only this profile’s own courses are listed, and unknown fields say so', async () => {
    const user = userEvent.setup()
    renderApp('/academics/courses')
    await heading('My courses')
    expect(await screen.findByText(/DEMO-101 · Sample Course A/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search courses'), 'zzz')
    expect(await screen.findByText('No course matches that search.')).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Search courses'))
    await user.click(await screen.findByRole('link', { name: /DEMO-101 · Sample Course A/ }))
    await heading(/DEMO-101 · Sample Course A/)
    expect(screen.getByText('Not provided in this demo.')).toBeInTheDocument()
  })

  it('AC-AT-04 / AC-AT-05: notices show source and audience, and read state is kept per profile', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const a = renderApp('/academics/courses/course-a/announcements', { services: first.services })
    await heading(/Sample Course A/)
    expect(await screen.findByText(/Sample reading for next week/)).toBeInTheDocument()
    expect(screen.getAllByText(/Everyone in this sample course/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Illustrative sample record/).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Mark as read' })[0]!)
    await waitFor(async () =>
      expect((await first.services.academics.load()).read[A]).toHaveLength(1),
    )
    a.unmount()
    renderApp('/academics/courses/course-a/announcements', { services: first.services })
    await screen.findByText(/Sample reading for next week/)
    expect(screen.getAllByRole('button', { name: 'Mark as read' })).toHaveLength(1)
  })

  it('AC-AT-06 / AC-AT-07: a missing link says "Resource not provided", a real https link opens in a new tab', async () => {
    renderApp('/academics/courses/course-a/materials')
    await heading(/Sample Course A/)
    expect(
      await screen.findByText(/Sample slide deck \(no link in this demo\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Resource not provided. There is no usable link./)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Open link/ })
    expect(link).toHaveAttribute('href', 'https://example.com/reading')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('AC-AT-06: a course with no materials is an honest empty state', async () => {
    renderApp('/academics/courses/course-b/materials')
    await heading(/Sample Course B/)
    expect(
      await screen.findByText(/Resource not provided. No materials are on record/),
    ).toBeInTheDocument()
  })

  it('AC-AT-08 / AC-AT-09 / AC-AT-10 / AC-AT-11: assignments are the canonical deadlines, date-only stays date-only and no submission is implied', async () => {
    renderApp('/academics/courses/course-a/assignments')
    await heading(/Sample Course A/)
    expect(await screen.findByText(/Sample Assignment 1/)).toBeInTheDocument()
    expect(screen.getAllByText(/\(date only\)/).length).toBeGreaterThan(0)
    expect(screen.queryByText(/23:59/)).not.toBeInTheDocument()
    expect(screen.getAllByText(/never mark this as submitted/).length).toBeGreaterThan(0)
    const open = screen.getAllByRole('link', { name: 'Open in Calendar' })[0]!
    expect(open.getAttribute('href')).toMatch(/event=.*dl-assign-1/)
  })

  it('AC-AT-13: a milestone is a personal plan and says it never changes a course deadline', async () => {
    const user = userEvent.setup()
    renderApp('/academics/mentorship')
    await heading('Mentorship')
    await user.type(await screen.findByLabelText('Group title'), 'Studio project')
    await user.click(screen.getByRole('button', { name: 'Create group' }))
    await user.click(await screen.findByRole('link', { name: 'Studio project' }))
    await heading('Studio project')
    expect(screen.getByText(/never changes an official course deadline/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('New milestone'), 'Draft report')
    await user.click(screen.getByRole('button', { name: 'Add milestone' }))
    expect(await screen.findByText('Draft report')).toBeInTheDocument()
  })

  it('an unknown course or tab is handled honestly', async () => {
    const { router } = renderApp('/academics/courses/nope')
    await heading('Course not found')
    await router.navigate('/academics/courses/course-a/bogus')
    await heading(/Sample Course A/)
  })
})

describe('faculty meetings', () => {
  it('AC-AT-15 / AC-AT-16: profiles never claim presence and unknown office hours say "not provided"', async () => {
    renderApp('/academics/faculty')
    await heading('Faculty Connect')
    expect(await screen.findByText('Demo Faculty B')).toBeInTheDocument()
    expect(screen.getAllByText(/Office hours: not provided/).length).toBeGreaterThan(0)
    expect(screen.getByRole('main').textContent).not.toMatch(/available now|in office|online/i)
  })

  it('AC-AT-17 / AC-AT-18 / AC-AT-19: the form validates, a request is recorded once and is not an appointment', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/academics/faculty/appointments/new?actor=fac-a')
    await heading('New faculty meeting request')
    await user.click(screen.getByRole('button', { name: 'Record request in demo' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Choose a published window/)
    await user.selectOptions(screen.getByLabelText('Published sample window'), 'av-a-1')
    await user.click(screen.getByRole('button', { name: 'Record request in demo' }))
    await heading(/Meeting with Demo Faculty A/)
    expect(await screen.findByText('Awaiting demo response')).toBeInTheDocument()
    expect(screen.getByText(/No email, push or message was sent/)).toBeInTheDocument()
    expect((await services.academics.load()).meetings).toHaveLength(1)
    expect(services.academics.bookingRefs(A)).toHaveLength(0)
  })

  it('AC-AT-25: an overlap with a class warns and does not move the class', async () => {
    const user = userEvent.setup()
    renderApp('/academics/faculty/appointments/new?actor=fac-c')
    await heading('New faculty meeting request')
    await user.type(screen.getByLabelText('Proposed date'), '2026-11-04')
    await user.type(screen.getByLabelText('Start'), '09:30')
    await user.type(screen.getByLabelText('End'), '10:00')
    expect(await screen.findByRole('alert')).toHaveTextContent(/overlaps Sample Course A/)
    expect(screen.getByRole('alert')).toHaveTextContent(/nothing on your Calendar is moved/)
  })

  it('AC-AT-20 / AC-AT-21 / AC-AT-22 / AC-AT-23: only the Settings-gated simulator accepts; the Calendar then shows one labelled entry and withdrawing leaves history', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/academics/faculty')
    expect(screen.queryByTestId('demo-ops')).not.toBeInTheDocument()
    const { meeting } = await (async () => {
      const r = await services.academics.submitMeeting(
        A,
        { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Academic doubt' },
        'k',
      )
      if (!r.ok) throw new Error(r.error.message)
      return r.value
    })()
    await router.navigate(`/academics/appointments/${meeting.id}`)
    await heading(/Meeting with Demo Faculty A/)
    expect(screen.queryByTestId('demo-ops')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument()
    await enableOps(user, router, `/academics/appointments/${meeting.id}`)
    const ops = await screen.findByTestId('demo-ops')
    await user.click(within(ops).getByRole('button', { name: 'Accept' }))
    expect(
      (await screen.findAllByText(/Accepted in demo \(not an official appointment\)/)).length,
    ).toBeGreaterThan(0)
    await router.navigate('/calendar?view=agenda&date=2026-11-04')
    expect(
      (await screen.findAllByText(/Meeting with Demo Faculty A \(demo, not official\)/)).length,
    ).toBeGreaterThan(0)
    // One canonical record: the profile's data holds exactly one entry for it.
    const data = await services.campus.load(A)
    expect(data.bookings.filter((b) => b.id === meeting.id)).toHaveLength(1)
    await router.navigate(`/academics/appointments/${meeting.id}`)
    await user.click(await screen.findByRole('button', { name: 'Request cancellation' }))
    await user.click(await screen.findByRole('button', { name: 'Yes, continue' }))
    expect((await screen.findAllByText(/Cancellation requested/)).length).toBeGreaterThan(0)
    const hist = screen.getByRole('heading', { name: 'History' }).closest('section')!
    expect(within(hist).getAllByRole('listitem').length).toBe(3)
  })

  it('AC-AT-24: a stale button press fails and says to refresh', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/settings')
    const r = await services.academics.submitMeeting(
      A,
      { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Other' },
      'k',
    )
    if (!r.ok) throw new Error('setup')
    await enableOps(user, router, '/academics')
    const ops = await screen.findByTestId('demo-ops')
    const accept = await within(ops).findByRole('button', { name: 'Accept' })
    // A newer state arrives from elsewhere before the button is pressed.
    await services.academics.simulateMeeting(r.value.meeting.id, 'reject', { reason: 'Clash' })
    await user.click(accept)
    await waitFor(() =>
      expect(within(ops).queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument(),
    )
    expect((await services.academics.load()).meetings[0]?.status).toBe('rejectedDemo')
  })

  it('AC-AT-29 / AC-AT-30: the BMS Office page uses the same engine and says it changes nothing else', async () => {
    const user = userEvent.setup()
    renderApp('/academics/office')
    await heading('BMS Office')
    expect(
      await screen.findByText(/does not change leave approvals or campus access/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Request an appointment' }))
    await heading('New BMS Office request')
    await user.selectOptions(screen.getByLabelText('Published sample window'), 'av-o-1')
    await user.click(screen.getByRole('button', { name: 'Record request in demo' }))
    await heading(/Meeting with Demo BMS Office/)
  })

  it('a request belonging to another profile is not found', async () => {
    const { services, router } = renderApp('/academics')
    const r = await services.academics.submitMeeting(
      'demo-student-b',
      { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Other' },
      'kb',
    )
    if (!r.ok) throw new Error('setup')
    await router.navigate(`/academics/appointments/${r.value.meeting.id}`)
    await heading('Request not found')
  })
})

describe('mentorship', () => {
  it('AC-AT-14 / AC-AT-26 / AC-AT-27: groups are private, an invitation is not delivered and a simulated answer shows its meaning', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/academics/mentorship')
    await enableOps(user, router, '/academics/mentorship')
    await user.type(await screen.findByLabelText('Group title'), 'Studio project')
    await user.click(screen.getByRole('button', { name: 'Create group' }))
    await user.click(await screen.findByRole('link', { name: 'Studio project' }))
    await heading('Studio project')
    await user.selectOptions(screen.getByLabelText('Invite a (fictional) mentor'), 'fac-a')
    await user.type(screen.getByLabelText('What would you like help with?'), 'Please guide us')
    await user.click(screen.getByRole('button', { name: 'Record invitation in demo' }))
    expect(
      (await screen.findAllByText(/Sent in demo \(nothing was delivered\)/)).length,
    ).toBeGreaterThan(0)
    const ops = await screen.findByTestId('demo-ops')
    await user.click(within(ops).getByRole('button', { name: 'Accept' }))
    expect(
      (await screen.findAllByText(/Accepted in demo \(simulated mentor\)/)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.getByRole('link', { name: 'Request a meeting with this mentor' }),
    ).toBeInTheDocument()
    expect((await services.academics.load()).groups[0]?.ownerProfileId).toBe(A)
    await router.navigate('/academics/mentorship/groups/not-mine')
    await heading('Group not found')
  })
})
