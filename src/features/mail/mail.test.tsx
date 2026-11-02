import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixedClock } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

const A = 'demo-student-a'
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())
const heading = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })

// 14:00 IST on Mon 2 Nov 2026: the demo quiz at 15:00 starts in one hour.
const services14 = () =>
  createServices({
    storage: createStorageAdapter({ backend: createMemoryStorage().storage }),
    clock: fixedClock('2026-11-02T08:30:00Z'),
  })

async function enableOps(
  user: ReturnType<typeof userEvent.setup>,
  router: { navigate: (p: string) => Promise<void> },
  then: string,
) {
  await router.navigate('/settings')
  await user.click(await screen.findByRole('checkbox', { name: /Show Demo Operations/ }))
  await router.navigate(then)
  await heading('Campus Mail')
}

describe('Campus Mail', () => {
  it('shows a labelled, simulated mailbox with sample mail, tabs and search', async () => {
    const user = userEvent.setup()
    renderApp('/notifications/mail')
    await heading('Campus Mail')
    expect(screen.getByText(/Demo only · simulated mail/)).toBeInTheDocument()
    expect(screen.getByTestId('mail-status')).toHaveTextContent(
      /demo\.student\.a@bms-demo\.invalid.*Demo only.*not applicable/,
    )
    expect(screen.getByText('BMS Weekly Update (Demo)')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Student Life' }))
    expect(screen.queryByText('BMS Weekly Update (Demo)')).not.toBeInTheDocument()
    expect(screen.getByText('Club Applications Open (Demo)')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'All mail' }))
    await user.type(screen.getByLabelText('Search subject, sender or text'), 'zzz')
    expect(await screen.findByText('No message matches.')).toBeInTheDocument()
    expect(screen.queryByTestId('demo-ops')).not.toBeInTheDocument()
  })

  it('the one-hour flow: a revised seating email updates the inbox, alert, Home signal, exam page and original-mail link; a correction and a replay behave', async () => {
    const user = userEvent.setup()
    const services = services14()
    const { router } = renderApp('/settings', { services })
    await enableOps(user, router, '/notifications/mail')
    const lab = await screen.findByTestId('demo-ops')
    await user.click(
      within(lab).getByRole('button', { name: 'Receive Revised Quiz Seating Email' }),
    )
    expect(await screen.findByText('Quiz Seating — Revised (Demo)')).toBeInTheDocument()
    expect((await screen.findByTestId('push-preview')).textContent).toMatch(
      /Quiz seating has been updated — open CampusOS/,
    )
    expect(screen.getByTestId('push-preview').textContent).not.toMatch(/CR5/) // the lock screen never shows the seat
    // Notification Center
    await router.navigate('/notifications')
    expect(
      await screen.findByRole('link', {
        name: /Open: Quiz seating updated — CR5, Column 2, Row 3/,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText(/starts in 1 hour/)).toBeInTheDocument()
    // Home: the urgent signal sits above the dashboard
    await router.navigate('/')
    const signal = await screen.findByTestId('urgent-signal')
    expect(signal).toHaveTextContent(/DEMO-OPS101 Quiz 1 \(demo\): CR5, Column 2, Row 3/)
    expect(signal).toHaveTextContent(/starts in 1 hour/)
    expect(within(signal).getByRole('link', { name: 'View original mail' })).toBeInTheDocument()
    // The exam page is the one owner of the seat, with a link back to the original message.
    await router.navigate('/academics/exams/exam-4')
    await heading('DEMO-OPS101 Quiz 1 (demo)')
    expect(await screen.findByText('CR5, row 3, column 2')).toBeInTheDocument()
    expect(screen.getByText(/not an official allotment/)).toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'View the original mail' }))
    await heading('Quiz Seating — Revised (Demo)')
    const pipe = within(screen.getByTestId('pipeline'))
    for (const s of ['received', 'classified', 'extracted', 'identity', 'seat', 'alert'])
      expect(pipe.getAllByText(s, { exact: false }).length).toBeGreaterThan(0)
    await user.click(screen.getByText('Show extraction evidence'))
    expect(screen.getByText(/column: “Column: 2” \(line 7\)/)).toBeInTheDocument()
    expect(screen.getByText(/No push, email or SMS was sent/)).toBeInTheDocument()
    // Correction, then the same email again.
    await router.navigate('/notifications/mail')
    await heading('Campus Mail')
    const lab2 = await screen.findByTestId('demo-ops')
    await user.click(within(lab2).getByRole('button', { name: /Receive Correction Email/ }))
    await waitFor(async () =>
      expect((await services.shared.load()).seats.find((s) => s.examId === 'exam-4')!.column).toBe(
        '4',
      ),
    )
    await user.click(within(lab2).getByRole('button', { name: /Receive Correction Email/ }))
    const alerts = (await services.prefs.notifications.load(A)).value.items.filter((n) =>
      /seating|changed/i.test(n.title),
    )
    expect(alerts).toHaveLength(2)
    expect(alerts.some((n) => n.title === 'Your column changed — CR5, Column 4, Row 3')).toBe(true)
    expect(
      (await services.mail.load()).emails.filter((m) => m.messageId === 'demo-msg-seat-v2'),
    ).toHaveLength(1)
  })

  it('another demo profile sees none of it, and a seat for a different student is not shown', async () => {
    const user = userEvent.setup()
    const services = services14()
    const { router } = renderApp('/settings', { services })
    await enableOps(user, router, '/notifications/mail')
    await user.click(
      within(await screen.findByTestId('demo-ops')).getByRole('button', {
        name: 'Receive Revised Quiz Seating Email',
      }),
    )
    await screen.findByText('Quiz Seating — Revised (Demo)')
    await user.click(await screen.findByRole('button', { name: /demo profile/i }))
    await user.click(await screen.findByRole('menuitemradio', { name: /Demo Student B/ }))
    await router.navigate('/notifications/mail')
    await heading('Campus Mail')
    expect(await screen.findByText('BMS Weekly Update (Demo)')).toBeInTheDocument()
    expect(screen.queryByText('Quiz Seating — Revised (Demo)')).not.toBeInTheDocument()
    await router.navigate('/')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByTestId('urgent-signal')).not.toBeInTheDocument()
    await router.navigate('/academics/exams/exam-4')
    await heading('DEMO-OPS101 Quiz 1 (demo)')
    expect(
      await screen.findByText('Seating not provided for this demo profile.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('main').textContent).not.toMatch(/CR5|DEMO-BMS-001/)
    // A message that belongs to the first mailbox is not reachable by id from this one.
    const id = (await services.mail.load()).emails.find(
      (m) => m.messageId === 'demo-msg-seat-v1',
    )!.id
    await router.navigate(`/notifications/mail/${id}`)
    await heading('Message not found')
  })

  it('an unlisted sender, a missing room and an "URGENT!!!" promotion stop with a visible reason and no alert', async () => {
    const user = userEvent.setup()
    const services = services14()
    const { router } = renderApp('/settings', { services })
    await enableOps(user, router, '/notifications/mail')
    const lab = await screen.findByTestId('demo-ops')
    await user.click(within(lab).getByRole('button', { name: /unlisted sender/ }))
    await user.click(within(lab).getByRole('button', { name: /room missing/ }))
    await user.click(within(lab).getByRole('button', { name: /URGENT!!!/ }))
    await waitFor(async () => expect((await services.mail.load()).emails.length).toBe(5))
    expect(
      (await services.prefs.notifications.load(A)).value.items.filter((n) =>
        /seating/i.test(n.title),
      ),
    ).toHaveLength(0)
    expect((await services.shared.load()).seats.some((s) => s.examId === 'exam-4')).toBe(false)
    expect((await screen.findAllByText('Needs review')).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('tab', { name: 'Other' }))
    expect(await screen.findByText(/URGENT!!! Win a free coffee/)).toBeInTheDocument()
  })
})
