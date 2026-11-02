import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderApp } from '@/test/render-app'
import { setViewport, clearViewport } from '@/test/viewport'

// The fixed test clock is Monday 2 Nov 2026, 10:00 IST; the persona is "Reference Student A".
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

async function openAssistant(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Ask CampusOS' }))
  const panel = await screen.findByRole('region', { name: 'CampusOS Assistant' })
  return within(panel)
}
const ask = async (
  user: ReturnType<typeof userEvent.setup>,
  a: ReturnType<typeof within>,
  q: string,
) => {
  await user.type(a.getByLabelText('Ask CampusOS Assistant'), q)
  await user.click(a.getByRole('button', { name: 'Send question' }))
}

describe('CampusOS Assistant', () => {
  it('CHAT-AT-01: the shared-shell launcher opens an accessible, labelled panel, and the top-bar button opens the same one', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    expect(a.getByRole('heading', { name: 'CampusOS Assistant' })).toBeInTheDocument()
    expect(
      a.getByText(/Demo assistant · uses recorded CampusOS data · not a language model/),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hide assistant' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    await user.click(a.getByRole('button', { name: 'Close CampusOS Assistant' }))
    expect(screen.queryByRole('heading', { name: 'CampusOS Assistant' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open CampusOS Assistant' }))
    expect(await screen.findByRole('heading', { name: 'CampusOS Assistant' })).toBeInTheDocument()
    expect(screen.getAllByRole('region', { name: 'CampusOS Assistant' })).toHaveLength(1) // one assistant, not two
  })

  it('CHAT-AT-02: typed and suggested questions work, and Escape closes it and returns focus to the launcher', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    await user.click(a.getByRole('button', { name: 'Is this live data?' }))
    expect(await a.findByText(/academic demonstration/i)).toBeInTheDocument()
    await ask(user, a, 'what is on today')
    expect((await a.findAllByText(/Source:/)).length).toBe(2)
    expect(a.getByLabelText('Ask CampusOS Assistant')).toHaveValue('')
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('heading', { name: 'CampusOS Assistant' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ask CampusOS' })).toHaveFocus()
  })

  it('CHAT-AT-03: schedule and task answers come from the active profile’s records and link to the Calendar', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    await user.click(a.getByRole('button', { name: 'What is on today?' }))
    expect(await a.findByText(/Today you have \d+ timed commitment/)).toBeInTheDocument()
    expect(a.getByRole('link', { name: 'Open today in Calendar' })).toHaveAttribute(
      'href',
      '/calendar?view=day&date=2026-11-02',
    )
    await user.click(a.getByRole('button', { name: 'Show my tasks' }))
    expect(await a.findByText(/open personal task/)).toBeInTheDocument()
    expect(a.getByText(/not an official submission/)).toBeInTheDocument()
    expect(a.getByRole('link', { name: 'Open tasks' })).toHaveAttribute(
      'href',
      '/calendar?view=agenda&panel=tasks',
    )
  })

  it('CHAT-AT-04: service, booking, academics, administration and community answers link to live routes', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    const cases: [string, string, string][] = [
      ['Where can I book a court?', 'Open Bookings', '/bookings'],
      ['tell me about laundry', 'Open Campus Services', '/services'],
      ['faculty and mentorship', 'Open Academics', '/academics'],
      ['how do I make a complaint', 'Open My requests', '/administration/requests'],
      ['clubs and lost property', 'Open Community', '/community'],
    ]
    for (const [q, label, to] of cases) {
      await ask(user, a, q)
      const links = await a.findAllByRole('link', { name: label })
      expect(links.at(-1)).toHaveAttribute('href', to)
    }
  })

  it('CHAT-AT-05: data-authenticity answers describe the demo and link to the labels', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    await ask(user, a, 'is this real or official information?')
    expect(
      await a.findByText(/not an official campus system or a live service feed/),
    ).toBeInTheDocument()
    expect(a.getByRole('link', { name: 'View data labels' })).toHaveAttribute(
      'href',
      '/settings#data-labels',
    )
    expect(a.getByTestId('assistant-log').textContent).not.toMatch(/is live|is official/)
  })

  it('CHAT-AT-06: unknown questions stay honest and suggest what it can help with; actions are refused', async () => {
    const user = userEvent.setup()
    renderApp('/')
    const a = await openAssistant(user)
    await ask(user, a, 'tell me a joke about penguins')
    expect(await a.findByText(/can’t answer that yet/)).toBeInTheDocument()
    expect(
      a.getByText(/finding a group time, your next exam and seat, bookings/),
    ).toBeInTheDocument()
    await ask(user, a, 'Please book CR1 for me and approve my leave')
    expect(await a.findByText(/can’t book, approve, cancel or send anything/)).toBeInTheDocument()
    expect(a.getByRole('link', { name: 'Open Classrooms to book yourself' })).toBeInTheDocument()
  })

  it('answers only from the active profile: another profile’s seat and tasks are never shown', async () => {
    const user = userEvent.setup()
    const { services } = renderApp('/')
    await services.shared.changeSeat('exam-1', 'demo-student-b', { hall: 'Demo Hall 9' })
    const a = await openAssistant(user)
    await user.click(a.getByRole('button', { name: 'Show my seating' }))
    await a.findAllByText(/Source:/)
    expect(a.getByTestId('assistant-log').textContent).not.toMatch(/Hall 9/)
  })
})
