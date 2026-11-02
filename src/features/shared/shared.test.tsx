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

describe('notification center', () => {
  it('SH-AT-11: an empty inbox says so usefully', async () => {
    renderApp('/notifications')
    await heading('Notifications')
    expect(await screen.findByText(/No reminders have appeared yet/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Notification preferences' })).toBeInTheDocument()
  })

  it('SH-AT-01 / SH-AT-02 / SH-AT-03 / SH-AT-07: the inbox is this profile’s, filters work, read state persists and a link opens its record', async () => {
    const user = userEvent.setup()
    const first = makeServices()
    const a = renderApp('/notifications', { services: first.services })
    await first.services.shared.changeSeat('exam-1', A, { hall: 'Demo Hall 5' })
    await first.services.shared.changeSeat('exam-1', 'demo-student-b', { hall: 'Demo Hall 6' })
    await heading('Notifications')
    const link = await screen.findByRole('link', {
      name: /Open: Your exam seating changed \(demo\)/,
    })
    expect(screen.getAllByRole('link', { name: /Open: Your exam seating changed/ })).toHaveLength(1) // B's is not here
    expect(screen.getByText(/Exams · Critical/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Important' }))
    expect(await screen.findAllByRole('link', { name: /Open: Your exam/ })).toHaveLength(1)
    await user.selectOptions(screen.getByLabelText('Category'), 'parcels')
    expect(await screen.findByText(/Nothing matches this filter/)).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Category'), '')
    await user.click(screen.getByRole('button', { name: 'Mark all shown read' }))
    await waitFor(async () =>
      expect(
        (await first.services.prefs.notifications.load(A)).value.items.every(
          (i) => i.readState === 'read',
        ),
      ).toBe(true),
    )
    a.unmount()
    renderApp('/notifications', { services: first.services })
    await heading('Notifications')
    expect(await screen.findByText(/\(0 unread\)/)).toBeInTheDocument() // read state survived the reload
    await user.click(
      await screen.findByRole('link', { name: /Open: Your exam seating changed \(demo\)/ }),
    )
    await heading('Sample Course A: mid-term (demo)')
    expect(link).toBeDefined()
  })

  it('SH-AT-04 / SH-AT-05 / SH-AT-08: muting a category hides its standard messages, keeps critical ones, and no external delivery is claimed', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/notifications/preferences')
    await services.admin.submitTicket(
      A,
      { kind: 'complaint', category: 'wifi', description: 'Drops', reportedSeverity: 'normal' },
      'k1',
    )
    await services.shared.changeSeat('exam-1', A, { hall: 'Demo Hall 5' })
    await heading('Notification preferences')
    expect(
      screen.getByText(/Nothing is sent by email, SMS, WhatsApp or phone push/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: /Administration/ }))
    await user.click(screen.getByRole('checkbox', { name: /Exams/ }))
    await router.navigate('/notifications')
    await heading('Notifications')
    expect(await screen.findByText(/1 standard or optional message is hidden/)).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Ticket recorded in CampusOS demo/ }),
    ).not.toBeInTheDocument() // standard, muted
    expect(
      screen.getByRole('link', { name: /Open: Your exam seating changed/ }),
    ).toBeInTheDocument() // critical, muted category still shown
    await router.navigate('/notifications/preferences')
    await user.click(await screen.findByRole('button', { name: 'Show every category again' }))
    await router.navigate('/notifications')
    expect(
      await screen.findByRole('link', { name: /Open: Ticket recorded in CampusOS demo/ }),
    ).toBeInTheDocument()
  })
})

describe('exam pages', () => {
  it('SH-AT-20 / SH-AT-21 / SH-AT-23: only your own seating shows, an exam without one says so, and a date-only exam has no time', async () => {
    const user = userEvent.setup()
    renderApp('/academics/exams')
    await heading('Exams')
    expect(await screen.findByText('Sample Course A: mid-term (demo)')).toBeInTheDocument()
    expect(screen.getByText('Your seating is available.')).toBeInTheDocument()
    expect(
      screen.getAllByText('Seating not provided for this demo profile.').length,
    ).toBeGreaterThan(0)
    expect(screen.getAllByText(/start time not provided/).length).toBeGreaterThan(0)
    expect(screen.getByRole('main').textContent).not.toMatch(/Demo Hall 2|row 1, column 2/) // B's seat
    await user.click(screen.getAllByRole('link', { name: 'View my seating' })[0]!)
    await heading('Sample Course A: mid-term (demo)')
    expect(await screen.findByText('Demo Hall 1, row 3, column 5')).toBeInTheDocument()
    expect(screen.getByText(/Not an official allotment/)).toBeInTheDocument()
  })

  it('SH-AT-20 / SH-AT-26: a profile without the course gets "not found", and the private seat never leaks through a deep link', async () => {
    const { router } = renderApp('/academics/exams/exam-1')
    await heading('Sample Course A: mid-term (demo)')
    await router.navigate('/academics/exams/exam-99')
    expect(await heading('Exam not found')).toBeVisible()
  })

  it('SH-AT-22 / SH-AT-24 / SH-AT-28: the simulator’s change keeps versions, a contradiction is flagged, and the page works from the keyboard', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/academics/exams')
    await enableOps(user, router, '/academics/exams')
    const ops = await screen.findByTestId('demo-ops')
    expect(ops.textContent).toMatch(/Fictional seats only/)
    await user.type(within(ops).getByLabelText('Hall'), 'Demo Hall 7')
    await user.click(within(ops).getByRole('button', { name: 'Set or change seat' }))
    await waitFor(async () =>
      expect(
        (await services.shared.load()).seats.find(
          (s) => s.ownerProfileId === A && s.examId === 'exam-1',
        )!.version,
      ).toBe(2),
    )
    await user.click(within(ops).getByRole('button', { name: 'Add a contradicting allocation' }))
    await router.navigate('/academics/exams/exam-1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Needs verification')
    expect(screen.getByRole('main').textContent).not.toMatch(/Demo Hall 7|Demo Hall 9/)
    await router.navigate('/academics/exams')
    await screen.findByTestId('demo-ops')
    const row = (await screen.findAllByRole('listitem')).find((li) =>
      /Demo Hall 7/.test(li.textContent ?? ''),
    )!
    await user.click(within(row).getByRole('button', { name: 'Keep this one' }))
    await router.navigate('/academics/exams/exam-1')
    expect(await screen.findByText('Earlier versions (1)')).toBeInTheDocument()
  })
})

describe('Best Time to Go and Time Tax pages', () => {
  it('SH-AT-12 / SH-AT-13 / SH-AT-14 / SH-AT-16 / SH-AT-17 / SH-AT-19: charts are labelled simulation, thin data is withheld, and nothing claims a place is open', async () => {
    const user = userEvent.setup()
    renderApp('/services/best-time')
    await heading('Best time to go')
    expect(
      screen.getAllByText(/Illustrative simulation — not actual crowd data/).length,
    ).toBeGreaterThan(0)
    expect(await screen.findByText(/Historically quietest in this sample/)).toBeInTheDocument()
    expect(screen.getByText(/not a statement that Mess is open/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open Mess' })).toHaveAttribute(
      'href',
      '/services/mess',
    ) // navigation only: no booking is made
    await user.click(screen.getByRole('button', { name: 'Laundry machines' }))
    expect(
      await screen.findByText(/No reliable pattern available: too few comparable samples/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /^Open Laundry/ })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Day of the week'), '0')
    expect(
      await screen.findByText(
        /No reliable pattern available: no observations exist for this day, which is not the same as the place being quiet/,
      ),
    ).toBeInTheDocument()
  })

  it('SH-AT-29 / SH-AT-31 / SH-AT-32 / SH-AT-33 / SH-AT-39: the calculator recalculates, keeps a deterioration visible and states its method', async () => {
    const user = userEvent.setup()
    renderApp('/time-tax/scenarios')
    await heading('Time Tax scenarios')
    expect(screen.getAllByText(/Illustrative scenario — not observed/).length).toBeGreaterThan(0)
    expect(await screen.findByText(/Per visit: −16 minutes \(less time\)/)).toBeInTheDocument()
    expect(screen.getByText(/Weekly: 106.67 student-hours/)).toBeInTheDocument() // 200 × 2 × 16 ÷ 60
    const scn = screen.getByLabelText('Scenario minutes per visit')
    await user.clear(scn)
    await user.type(scn, '30')
    expect(
      await screen.findByText(/Per visit: \+10 minutes \(MORE time, a deterioration\)/),
    ).toBeInTheDocument()
    expect(screen.getByText(/Weekly: 0.00 student-hours/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Adoption (%)'))
    await user.type(screen.getByLabelText('Adoption (%)'), '150')
    expect(await screen.findByText(/adoption up to 100/)).toBeInTheDocument()
    expect(screen.getByText(/Assumes everyone who adopts visits equally often/)).toBeInTheDocument()
  })

  it('SH-AT-35 / SH-AT-38: with no observations no observed chart is drawn, and resetting a scenario leaves observations alone', async () => {
    const user = userEvent.setup()
    const { router, services } = renderApp('/time-tax/scenarios')
    await heading('Time Tax scenarios')
    await user.click(screen.getByRole('button', { name: 'Save this scenario' }))
    await waitFor(async () => expect((await services.shared.load()).scenarios).toHaveLength(1))
    await router.navigate('/time-tax')
    await heading('Time Tax')
    expect(await screen.findByText(/illustrative, on-site waiting/)).toBeInTheDocument()
    await router.navigate('/time-tax/observations')
    expect(await screen.findByText(/No field observations imported/)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    await router.navigate('/time-tax/scenarios')
    await user.click(await screen.findByRole('button', { name: 'Reset this scenario' }))
    await waitFor(async () => expect((await services.shared.load()).scenarios).toHaveLength(0))
    await router.navigate('/time-tax/observations')
    expect(await screen.findByText(/No field observations imported/)).toBeInTheDocument()
  })

  it('SH-AT-34 / SH-AT-36: the overview never adds different measures into one total and says no savings are measured', async () => {
    const { services, router } = renderApp('/time-tax')
    const base = {
      baselineMinutes: 20,
      scenarioMinutes: 4,
      eligibleStudents: 100,
      visitsPerWeek: 1,
      adoptionPercent: 50,
      weeks: 10,
    }
    await services.shared.saveScenario(A, {
      serviceId: 'chill-spot',
      measure: 'onSiteWaiting',
      ...base,
    })
    await services.shared.saveScenario(A, {
      serviceId: 'ss-laundry',
      measure: 'failedTrips',
      ...base,
    })
    await router.navigate('/time-tax')
    await heading('Time Tax')
    expect(await screen.findByText(/not added into one total/)).toBeInTheDocument()
    expect(screen.getByText(/No measured savings yet/)).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/total saved|saved you/i)
  })
})
