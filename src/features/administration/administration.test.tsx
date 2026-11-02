import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DateOnly, LocalTime } from '@/lib/time'
import { itemsInRange } from '@/selectors/occurrences'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'
import type { LeaveInput, TicketInput } from '@/domain/admin-logic'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
const MON = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const B = 'demo-student-b'
const t = (v: string) => v as LocalTime

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const many = async (text: string | RegExp) =>
  expect((await screen.findAllByText(text)).length).toBeGreaterThan(0)

async function enableOps(
  user: ReturnType<typeof userEvent.setup>,
  router: { navigate: (p: string) => Promise<void> },
  then: string,
) {
  await router.navigate('/settings')
  await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
  await router.navigate(then)
}

const leave = (extra: Partial<LeaveInput> = {}): LeaveInput => ({
  leaveType: 'personal',
  startDate: '2026-11-05' as DateOnly,
  startTime: t('09:00'),
  endTime: t('17:00'),
  reason: 'Family visit',
  ...extra,
})
const complaint = (extra: Partial<TicketInput> = {}): TicketInput => ({
  kind: 'complaint',
  category: 'plumbing',
  description: 'Tap keeps dripping',
  location: 'Sample Block washroom',
  reportedSeverity: 'normal',
  ...extra,
})
let k = 0

describe('hub (AD-AT-01, AD-AT-02, AD-AT-36)', () => {
  it('AD-AT-01: the hub routes to leave, complaints and teaching aids, and the tabs lead back', async () => {
    const user = userEvent.setup()
    renderApp('/administration')
    await heading('Administration')
    const main = within(await screen.findByRole('main'))
    for (const name of [/Leave and out-time/, /Facility complaints/, /Teaching aids/])
      expect((await main.findAllByRole('link', { name })).length).toBeGreaterThan(0)
    await user.click(main.getAllByRole('link', { name: /Leave and out-time/ })[0]!)
    await heading('Leave and out-time')
    await user.click(screen.getByRole('link', { name: 'Overview' }))
    await heading('Administration')
  })

  it('AD-AT-02 / AD-AT-36: every Administration screen says it is a demo, and none claims delivery, approval or a repair', async () => {
    for (const path of [
      '/administration',
      '/administration/leave',
      '/administration/leave/new',
      '/administration/complaints',
      '/administration/complaints/new',
      '/administration/teaching-aids',
      '/administration/teaching-aids/new',
      '/administration/requests',
    ]) {
      const { unmount } = renderApp(path)
      await screen.findByRole('heading', { level: 1 })
      await many(/Demonstration only/)
      const body = screen.getByRole('main').textContent ?? ''
      expect(body).not.toMatch(
        /email sent|sms sent|push notification sent|sent to the university|officially approved|verified by guard|technician fixed/i,
      )
      unmount()
    }
  })

  it('AD-AT-35: the Time Tax scenario is labelled illustrative on every service', async () => {
    for (const path of [
      '/administration/leave',
      '/administration/complaints',
      '/administration/teaching-aids',
    ]) {
      const { unmount } = renderApp(path)
      const tt = await screen.findByRole('region', { name: 'Time Tax scenario' })
      expect(within(tt).getByText('Illustrative scenario, not an observation')).toBeInTheDocument()
      expect(within(tt).getByText(/Observed results: none recorded/)).toBeInTheDocument()
      unmount()
    }
  })
})

describe('leave journey (AD-AT-03 … AD-AT-11, AD-AT-34)', () => {
  it('AD-AT-03 / AD-AT-04: a valid request is reviewed, then saved once even if submit is clicked twice', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration/leave/new')
    await heading('New leave request')
    await user.type(screen.getByLabelText('Reason'), 'Family visit')
    await user.click(screen.getByRole('button', { name: 'Review request' }))
    expect(await screen.findByText('Review your local request')).toBeInTheDocument()
    expect(
      screen.getByText(/not received by the university and is not a campus permission/),
    ).toBeInTheDocument()
    await user.dblClick(screen.getByRole('button', { name: 'Submit local request' }))
    await waitFor(async () => expect((await services.admin.load()).leaves).toHaveLength(1))
    expect((await services.admin.load()).leaves).toHaveLength(1)
    await waitFor(() =>
      expect(router.state.location.pathname).toMatch(/^\/administration\/leave\/leave-/),
    )
    expect(await screen.findByText(/Saved on this device as leave-/)).toHaveTextContent(
      'It has not been sent to anyone',
    )
    expect(screen.getByText('Submitted to demo', { selector: 'span' })).toBeInTheDocument()
  })

  it('AD-AT-05: an invalid interval blocks the request, keeps what was typed and creates nothing', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/leave/new')
    await heading('New leave request')
    await user.type(screen.getByLabelText('Reason'), 'Dentist')
    const ret = screen.getByLabelText('Return time')
    await user.clear(ret)
    await user.type(ret, '08:00')
    await user.click(screen.getByRole('button', { name: 'Review request' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The return must be after the departure',
    )
    expect(screen.getByLabelText('Reason')).toHaveValue('Dentist')
    expect((await services.admin.load()).leaves).toEqual([])
    await user.clear(screen.getByLabelText('Reason'))
    await user.click(screen.getByRole('button', { name: 'Review request' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('AD-AT-06: no simulator or approval control exists until Local Operations is switched on', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration')
    await services.admin.submitLeave(A, leave(), `k${++k}`)
    await heading('Administration')
    expect(screen.queryByTestId('demo-ops')).not.toBeInTheDocument()
    await router.navigate('/administration/leave')
    await user.click(await screen.findByRole('link', { name: 'Open request' }))
    await heading('Personal request')
    expect(
      screen.queryByRole('button', { name: /approve|reject|start review/i }),
    ).not.toBeInTheDocument()
    await enableOps(user, router, '/administration/leave')
    const ops = await screen.findByTestId('demo-ops')
    expect(ops.textContent).toMatch(/Local Operations: Administration/)
    expect(ops.textContent).toMatch(/No real person, team or office is involved/)
  })

  it('AD-AT-07 / AD-AT-09 / AD-AT-11: review, a reasoned change request, a new revision and a demo approval, all with their caveats', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration/leave')
    const made = await services.admin.submitLeave(A, leave(), `k${++k}`)
    const id = made.ok ? made.value.leave.id : ''
    await enableOps(user, router, '/administration/leave')
    const ops = await screen.findByTestId('demo-ops')
    await user.click(await within(ops).findByRole('button', { name: 'Start review' }))
    await waitFor(async () =>
      expect((await services.admin.load()).leaves[0]!.status).toBe('underReview'),
    )
    await user.type(within(ops).getByLabelText(/Reason \(needed/), 'Add the return time')
    await user.click(within(ops).getByRole('button', { name: 'Request changes' }))
    await waitFor(async () =>
      expect((await services.admin.load()).leaves[0]!.status).toBe('changesRequested'),
    )

    await router.navigate(`/administration/leave/${id}`)
    await heading('Personal request')
    expect(await screen.findByRole('alert')).toHaveTextContent('Add the return time')
    await user.click(screen.getByRole('button', { name: 'Edit and resubmit' }))
    expect(screen.getByLabelText('Reason')).toHaveValue('Family visit') // prefilled
    await user.clear(screen.getByLabelText('Reason'))
    await user.type(screen.getByLabelText('Reason'), 'Family visit, back by 5 pm')
    await user.click(screen.getByRole('button', { name: 'Review request' }))
    await user.click(await screen.findByRole('button', { name: 'Submit new revision' }))
    await many('Resubmitted to demo')
    expect(screen.getByText(/2 revisions are kept/)).toBeInTheDocument()
    expect(screen.getByText(/“Add the return time”/)).toBeInTheDocument() // the earlier reason stays in the timeline

    await router.navigate('/administration/leave')
    const ops2 = await screen.findByTestId('demo-ops')
    await user.click(await within(ops2).findByRole('button', { name: 'Start review' }))
    await user.click(await within(ops2).findByRole('button', { name: 'Approve locally' }))
    await router.navigate(`/administration/leave/${id}`)
    await heading('Personal request')
    await many('Approved locally — NOT A VALID GATE PASS')
    expect(screen.getByText(/It is NOT A VALID GATE PASS/)).toBeInTheDocument()
    expect(
      screen.queryByText(/valid campus permission|official permission granted/i),
    ).not.toBeInTheDocument()
  })

  it('AD-AT-14: a student can withdraw an undecided request after confirming, and then it is history', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration/leave')
    const made = await services.admin.submitLeave(A, leave(), `k${++k}`)
    await router.navigate(`/administration/leave/${made.ok ? made.value.leave.id : ''}`)
    await heading('Personal request')
    await user.click(await screen.findByRole('button', { name: 'Withdraw request' }))
    await user.click(await screen.findByRole('button', { name: 'Withdraw request', hidden: false }))
    await many('Withdrawn')
    expect(screen.queryByRole('button', { name: 'Withdraw request' })).not.toBeInTheDocument()
  })

  it('AD-AT-34: asking to miss a class records a snapshot and never cancels the class in the Calendar', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/leave/new')
    await heading('New leave request')
    const dep = screen.getByLabelText('Departure date')
    const ret = screen.getByLabelText('Return date')
    await user.clear(dep)
    await user.type(dep, '2026-11-02')
    await user.clear(ret)
    await user.type(ret, '2026-11-02')
    const classBox = await screen.findByRole('checkbox', { name: /Sample Course A/ })
    await user.click(classBox)
    await user.type(screen.getByLabelText('Reason'), 'Appointment')
    await user.click(screen.getByRole('button', { name: 'Review request' }))
    await user.click(await screen.findByRole('button', { name: 'Submit local request' }))
    await waitFor(async () => expect((await services.admin.load()).leaves).toHaveLength(1))
    const l = (await services.admin.load()).leaves[0]!
    expect(l.classesMissed).toHaveLength(1)
    expect(l.classesMissed[0]).toMatchObject({
      title: expect.stringContaining('Sample Course A'),
      date: '2026-11-02',
    })
    const data = await services.campus.load(A)
    const cls = itemsInRange(data, MON, MON).filter(
      (i) => /Sample Course A/.test(i.title) && i.category === 'class',
    )
    expect(cls.length).toBeGreaterThan(0)
    expect(cls.every((i) => i.status === 'scheduled')).toBe(true)
  })

  it('AD-AT-15: a proof is only a name-and-size descriptor and is labelled demo-only', async () => {
    const user = userEvent.setup()
    renderApp('/administration/leave/new')
    await heading('New leave request')
    expect(
      screen.getByText(/Do not attach real medical or personal documents to this app/),
    ).toBeInTheDocument()
    await user.upload(
      screen.getByLabelText('Supporting proof (optional)'),
      new File(['x'], 'sample-note.pdf', { type: 'application/pdf' }),
    )
    expect(
      await screen.findByText(/sample-note.pdf · 1 KB · demo descriptor only/),
    ).toBeInTheDocument()
  })
})

describe('complaints and teaching aids (AD-AT-15 … AD-AT-26)', () => {
  it('AD-AT-16 / AD-AT-17 / AD-AT-18: a complaint offers every category, saves once, and shows no SLA', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/complaints/new')
    await heading('Report a facility issue')
    const options = within(screen.getByLabelText('Category'))
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(options).toEqual([
      'Plumbing',
      'Electricity',
      'Wi-Fi',
      'Room cleaning',
      'Washroom',
      'Other',
    ])
    await user.type(screen.getByLabelText('Location (optional)'), 'Sample Block')
    await user.type(screen.getByLabelText('Description'), 'Tap keeps dripping')
    await user.click(screen.getByLabelText('Urgent (my view)'))
    await user.dblClick(screen.getByRole('button', { name: 'Submit demo ticket' }))
    await waitFor(async () => expect((await services.admin.load()).tickets).toHaveLength(1))
    const tk = (await services.admin.load()).tickets[0]!
    expect(tk).toMatchObject({
      reportedSeverity: 'urgent',
      locationSource: 'selfReported',
      status: 'submitted',
    })
    await heading('Plumbing ticket')
    expect(
      screen.getByText('No response target has been provided. CampusOS shows no SLA.'),
    ).toBeInTheDocument()
    expect(screen.getByText('Urgent (your view)')).toBeInTheDocument()
    expect(screen.getByText('Demo assigned priority').nextElementSibling).toHaveTextContent(
      'Not assigned',
    )
    expect(screen.getByText('Team').nextElementSibling).toHaveTextContent('Team not assigned')
    expect(screen.getByRole('main').textContent).not.toMatch(
      /overdue according|within \d+ hours|guaranteed/i,
    )
  })

  it('AD-AT-15: only an acceptable image can be described for a complaint, and a bad one is refused without losing the form', async () => {
    const user = userEvent.setup({ applyAccept: false })
    renderApp('/administration/complaints/new')
    await heading('Report a facility issue')
    await user.type(screen.getByLabelText('Description'), 'Broken light')
    await user.upload(
      screen.getByLabelText('Photo (optional)'),
      new File(['x'], 'notes.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PNG, JPEG or WebP')
    expect(screen.getByLabelText('Description')).toHaveValue('Broken light')
    await user.upload(
      screen.getByLabelText('Photo (optional)'),
      new File(['x'], 'light.png', { type: 'image/png' }),
    )
    expect(await screen.findByText(/light.png · 1 KB · demo descriptor only/)).toBeInTheDocument()
  })

  it('AD-AT-19 / AD-AT-20 / AD-AT-21: a resolved ticket is reopened with a reason on the same ticket, and its history stays', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration/complaints')
    const made = await services.admin.submitTicket(A, complaint(), `k${++k}`)
    const id = made.ok ? made.value.ticket.id : ''
    for (const a of ['assign', 'start', 'resolve'] as const)
      await services.admin.ticketAct(id, a, 'demoMaintenance')
    await router.navigate(`/administration/complaints/${id}`)
    await heading('Plumbing ticket')
    await many('Marked resolved (simulated)')
    expect(screen.getByText(/Please confirm it is sorted, or reopen it/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'It is not fixed: reopen' }))
    await user.click(screen.getByRole('button', { name: 'Reopen ticket' }))
    expect(
      await screen.findByText('Say what is still wrong so the history makes sense'),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText('What is still wrong?'), 'Still dripping')
    await user.click(screen.getByRole('button', { name: 'Reopen ticket' }))
    await many('Reopened')
    const store = await services.admin.load()
    expect(store.tickets).toHaveLength(1)
    expect(store.tickets[0]!.history.map((h) => h.eventType)).toEqual([
      'submitted',
      'assign',
      'start',
      'resolve',
      'reopen',
    ])
    expect(screen.getByText(/“Still dripping”/)).toBeInTheDocument()
    expect(screen.getAllByText('resolve').length).toBeGreaterThan(0) // the earlier attempt remains in the timeline
  })

  it('AD-AT-22: the student screen offers no way to assign, start or resolve a ticket', async () => {
    const { services, router } = renderApp('/administration/complaints')
    const made = await services.admin.submitTicket(A, complaint(), `k${++k}`)
    await router.navigate(`/administration/complaints/${made.ok ? made.value.ticket.id : ''}`)
    await heading('Plumbing ticket')
    expect(
      screen.queryByRole('button', { name: /assign|start work|resolve|mark resolved|fixed/i }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel ticket' })).toBeInTheDocument() // the only student step before work starts
  })

  it('AD-AT-23 / AD-AT-24 / AD-AT-25: a teaching-aid report needs a classroom, joins the shared ticket list and shows its equipment details', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/teaching-aids/new')
    await heading('Report teaching equipment')
    await user.type(screen.getByLabelText('Description'), 'No signal')
    await user.click(screen.getByRole('button', { name: 'Submit equipment report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter the classroom for this report',
    )
    expect(screen.getByLabelText('Description')).toHaveValue('No signal')
    await user.type(screen.getByLabelText('Classroom'), 'Room 12')
    await user.selectOptions(screen.getByLabelText('Equipment type'), 'microphone')
    await user.selectOptions(screen.getByLabelText(/Effect on class/), 'delayed')
    await user.click(screen.getByRole('button', { name: 'Submit equipment report' }))
    await waitFor(async () => expect((await services.admin.load()).tickets).toHaveLength(1))
    const tk = (await services.admin.load()).tickets[0]!
    expect(tk).toMatchObject({
      kind: 'teachingAid',
      teaching: {
        classroomReference: 'Room 12',
        classroomSource: 'selfReported',
        assetType: 'microphone',
        classImpact: 'delayed',
      },
    })
    await heading('Microphone report')
    expect(screen.getByText(/\(self-reported\)/)).toBeInTheDocument()
    expect(screen.getByText(/your own report, not measured/)).toBeInTheDocument()
    expect(
      screen.getByText(
        /0 earlier reports of this equipment from you. No campus maintenance history is available/,
      ),
    ).toBeInTheDocument()
  })

  it('AD-AT-26: a similar open ticket is mentioned but never merged, and the new one is still created', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/complaints/new')
    await services.admin.submitTicket(A, complaint(), `k${++k}`)
    await heading('Report a facility issue')
    await user.type(screen.getByLabelText('Location (optional)'), 'Sample Block washroom')
    expect(
      await screen.findByText(/You already have a similar open ticket here/),
    ).toBeInTheDocument()
    expect(screen.getByText(/nothing is merged for you/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Description'), 'Another tap')
    await user.click(screen.getByRole('button', { name: 'Submit demo ticket' }))
    await waitFor(async () => expect((await services.admin.load()).tickets).toHaveLength(2))
  })
})

describe('requests, privacy and integration (AD-AT-27 … AD-AT-33)', () => {
  it('AD-AT-27 / AD-AT-28: another profile’s requests never appear, and a deep link to one is "not found" with no details', async () => {
    const { services, router } = renderApp('/administration/requests')
    const other = await services.admin.submitLeave(B, leave({ reason: 'SECRET reason' }), `k${++k}`)
    const ticket = await services.admin.submitTicket(
      B,
      complaint({ description: 'SECRET leak' }),
      `k${++k}`,
    )
    const lid = other.ok ? other.value.leave.id : ''
    const tid = ticket.ok ? ticket.value.ticket.id : ''
    await heading('My requests')
    expect(await screen.findByText(/You have not made any requests yet/)).toBeInTheDocument()
    await router.navigate(`/administration/requests/${lid}`)
    expect(await heading('Request not found')).toBeVisible()
    expect(screen.getByRole('main').textContent).not.toMatch(/SECRET/)
    await router.navigate(`/administration/complaints/${tid}`)
    expect(await heading('Ticket not found')).toBeVisible()
    expect(screen.getByRole('main').textContent).not.toMatch(/SECRET/)
    await router.navigate(`/administration/teaching-aids/${tid}`)
    expect(await heading('Ticket not found')).toBeVisible()
    await router.navigate(`/administration/leave/${lid}`)
    expect(await heading('Request not found')).toBeVisible()
  })

  it('AD-AT-29: My requests filters change the view only, and a private reason is never printed in the list', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/administration/requests')
    await services.admin.submitLeave(A, leave({ reason: 'Private medical thing' }), `k${++k}`)
    await services.admin.submitTicket(A, complaint(), `k${++k}`)
    await heading('My requests')
    expect(await screen.findByText('Showing 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/Private medical thing/)
    expect(screen.getAllByText('Private reason').length).toBeGreaterThan(0)
    await user.selectOptions(screen.getByLabelText('Type'), 'complaint')
    expect(await screen.findByText('Showing 1 of 2')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Type'), 'leave')
    await user.type(screen.getByRole('searchbox', { name: 'Search' }), 'zzzz')
    expect(
      await screen.findByText(/No request matches these filters. Nothing was deleted./),
    ).toBeInTheDocument()
    const s = await services.admin.load()
    expect(s.leaves).toHaveLength(1)
    expect(s.tickets).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(await screen.findByText('Showing 2 of 2')).toBeInTheDocument()
  })

  it('AD-AT-30 / AD-AT-31: Home shows the request, its notification opens that exact request, and it appears once', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/')
    const made = await services.admin.submitLeave(A, leave(), `k${++k}`)
    const id = made.ok ? made.value.leave.id : ''
    await services.admin.leaveAct(id, 'startReview', 'demoApprover')
    await screen.findByRole('region', { name: 'My activity' })
    const activity = screen.getByRole('region', { name: 'My activity' })
    expect(await within(activity).findByText(/Personal request, Thu, 5 Nov/)).toBeInTheDocument()
    expect(within(activity).getAllByText(/Under review \(simulated\)/).length).toBeGreaterThan(0)
    expect(within(activity).getAllByText(/Personal request, Thu, 5 Nov/)).toHaveLength(1)
    await router.navigate('/notifications')
    await heading('Notifications')
    const link = await screen.findByRole('link', { name: 'Open: Demo review started' })
    expect(screen.getAllByRole('link', { name: /Open: Demo review started/ })).toHaveLength(1)
    expect(link).toHaveAttribute('href', `/administration/requests/${id}`)
    await user.click(link)
    await heading('Personal request') // forwarded to the canonical leave record
    expect(router.state.location.pathname).toBe(`/administration/leave/${id}`)
  })

  it('AD-AT-32: requests and their audit trail survive a reload of the app', async () => {
    const first = makeServices()
    const a = renderApp('/administration/leave', { services: first.services })
    const made = await first.services.admin.submitLeave(A, leave(), `k${++k}`)
    await first.services.admin.leaveAct(
      made.ok ? made.value.leave.id : '',
      'startReview',
      'demoApprover',
    )
    a.unmount()
    renderApp('/administration/leave', { services: first.services })
    await heading('Leave and out-time')
    expect(await screen.findByText(/Under review \(simulated\)/)).toBeInTheDocument()
  })

  it('AD-AT-33: view filters never delete, and Reset reference data clears only through its own confirmed step', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/administration/requests')
    await services.admin.submitLeave(A, leave(), `k${++k}`)
    await services.admin.submitTicket(A, complaint(), `k${++k}`)
    await router.navigate('/settings')
    await user.click(await screen.findByRole('button', { name: /Reset reference data/ }))
    expect(
      await screen.findByText(
        /Leave requests, complaints and teaching-aid reports, with their histories/,
      ),
    ).toBeInTheDocument()
    expect((await services.admin.load()).leaves).toHaveLength(1) // not cleared until confirmed
    await user.click(
      await screen.findByRole('button', { name: 'Reset reference data', hidden: false }),
    )
    await waitFor(async () => {
      const s = await services.admin.load()
      expect(s.leaves).toHaveLength(0)
      expect(s.tickets).toHaveLength(0)
    })
  })

  it('AD-AT-39: every status is written out in words, never colour alone', async () => {
    const { services } = renderApp('/administration/requests')
    await services.admin.submitLeave(A, leave(), `k${++k}`)
    await heading('My requests')
    const item = (await screen.findAllByRole('listitem')).find((li) =>
      /Personal request/.test(li.textContent ?? ''),
    )!
    expect(item).toHaveTextContent('Submitted to demo')
    await act(async () => {})
  })
})
