import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

describe('Report an issue', () => {
  it('saves a report with a status and a record ID, scoped to the profile, and says it was not sent anywhere', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/help/report?from=/calendar')
    await heading('Report an issue')
    expect(screen.getByText(/not sent to developers/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/Describe what went wrong/)
    await user.selectOptions(screen.getByLabelText('Category'), 'Timetable/Data Error')
    await user.type(screen.getByLabelText('What happened?'), 'CR1 shows free but a class is in it')
    expect(
      screen.getByText(/Your grades, attendance, mail and seating are never attached/),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save report' }))
    expect((await screen.findAllByText(/Recorded on this device/)).length).toBeGreaterThan(0)
    const s = await services.reports.load()
    expect(s.issues).toHaveLength(1)
    expect(s.issues[0]).toMatchObject({
      category: 'Timetable/Data Error',
      route: '/calendar',
      status: 'RECEIVED',
      ownerProfileId: 'demo-student-a',
    })
    expect(
      (await services.prefs.notifications.load('demo-student-a')).value.items.some((n) =>
        /Report recorded \(local\)/.test(n.title),
      ),
    ).toBe(true)
    // A repeated submission with the same operation id makes no second report.
    const again = await services.reports.submit('demo-student-a', {
      category: 'Bug',
      description: 'x',
      route: '/',
      attachments: [],
      opId: s.issues[0]!.opId!,
    })
    expect(again.ok && again.value.created).toBe(false)
  })

  it('a simulated reviewer moves the status, and only the owner sees the report', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/settings')
    await user.click(await screen.findByRole('checkbox', { name: /Show Local Operations/ }))
    const r = await services.reports.submit('demo-student-a', {
      category: 'Bug',
      description: 'Broken',
      route: '/',
      attachments: [],
      opId: 'o1',
    })
    if (!r.ok) throw new Error('setup')
    await router.navigate('/help/report')
    await heading('Report an issue')
    const ops = await screen.findByTestId('demo-ops')
    await user.click(await within(ops).findByRole('button', { name: 'Marked resolved' }))
    await waitFor(async () =>
      expect((await services.reports.load()).issues[0]!.status).toBe('RESOLVED'),
    )
    expect((await services.reports.load()).issues[0]!.history.map((h) => h.actor)).toEqual([
      'student',
      'demoReviewer',
    ])
    await user.click(await screen.findByRole('button', { name: /^Persona:/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Reference Student B/ }))
    await router.navigate('/help/report')
    await heading('Report an issue')
    expect(await screen.findByText('You have not filed a report.')).toBeInTheDocument()
  })
})
