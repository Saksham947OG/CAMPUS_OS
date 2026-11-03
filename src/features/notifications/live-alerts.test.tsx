import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createServices } from '@/app/services'
import { withPersonaWorkspace } from '@/data/seeds/demo/workspace-demo'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { emptyWorkspace } from '@/domain/workspace'
import { fixedClock, type DateOnly } from '@/lib/time'
import { ALERT_WINDOW, liveAlerts } from '@/selectors/live-alerts'
import { instantMs } from '@/selectors/now'
import { createMemoryStorage } from '@/test/memory-storage'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'

const A = 'demo-student-a'
const TODAY = '2026-11-03' as DateOnly
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

const at = (hhmm: string) => instantMs(TODAY, hhmm as never)

describe('live alerts from 4:00 to 5:30 pm (LA-T01 … LA-T03)', () => {
  it('LA-T01: nothing is raised before the window, and alerts arrive in time order as the clock reaches them', async () => {
    const { services } = makeServices({ sourceData: true })
    const data = await services.campus.load(A)
    const ws = withPersonaWorkspace(emptyWorkspace())
    const profiles = await services.profiles.list()
    const at15 = (nowMs: number) =>
      liveAlerts({ data, ws, profiles, profileId: A, today: TODAY, nowMs })
    expect(at15(at('15:59'))).toEqual([])
    const early = at15(at('16:12'))
    expect(early.map((a) => a.title)).toEqual(
      expect.arrayContaining([
        'Laundry load starts in 15 minutes',
        'A decision is waiting for your group',
      ]),
    )
    const late = at15(at('17:31'))
    expect(late.length).toBeGreaterThan(early.length)
    expect(late.map((a) => a.atMs)).toEqual([...late.map((a) => a.atMs)].sort((x, y) => x - y))
    const from = at(ALERT_WINDOW.from)
    const to = at(ALERT_WINDOW.to)
    for (const a of late) expect(a.atMs >= from - 15 * 60_000 && a.atMs <= to).toBe(true)
    expect(new Set(late.map((a) => a.key)).size).toBe(late.length)
  })

  it('LA-T02: every alert is true of the records and addressed to the person (a task due, a vote missing, a reply waiting)', async () => {
    const { services } = makeServices({ sourceData: true })
    const data = await services.campus.load(A)
    const ws = withPersonaWorkspace(emptyWorkspace())
    const profiles = await services.profiles.list()
    const titles = liveAlerts({
      data,
      ws,
      profiles,
      profileId: A,
      today: TODAY,
      nowMs: at('17:31'),
    }).map((a) => a.title)
    expect(titles).toContain('A team task is due tomorrow')
    expect(titles).toContain('A meeting poll needs your vote')
    // Ananya has no review waiting for her, so none is raised; Abeer does.
    expect(titles).not.toContain('A review is waiting for you')
    const abeer = liveAlerts({
      data: await services.campus.load('demo-student-b'),
      ws,
      profiles,
      profileId: 'demo-student-b',
      today: TODAY,
      nowMs: at('17:31'),
    })
    expect(abeer.map((a) => a.title)).toContain('A review is waiting for you')
    // A vote already cast removes the poll alert.
    const voted = {
      ...ws,
      polls: ws.polls.map((p) => ({
        ...p,
        votes: [{ userId: A, candidateId: p.candidates[0]!.id, vote: 'yes' as const }],
      })),
    }
    expect(
      liveAlerts({ data, ws: voted, profiles, profileId: A, today: TODAY, nowMs: at('17:31') }).map(
        (a) => a.title,
      ),
    ).not.toContain('A meeting poll needs your vote')
  })

  it('LA-T03: an alert appears on screen when its time comes, can be dismissed, and is filed in the inbox once', async () => {
    const user = userEvent.setup()
    const memory = createMemoryStorage()
    const services = createServices({
      storage: createStorageAdapter({ backend: memory.storage }),
      clock: fixedClock('2026-11-03T10:56:00Z'), // 4:26 pm in Asia/Kolkata
      sourceData: true,
      demoExamples: false,
    })
    renderApp('/', { services })
    const stack = within(await screen.findByRole('complementary', { name: 'Live alerts' }))
    expect(await stack.findByText('A team task is due tomorrow')).toBeInTheDocument()
    await waitFor(async () => {
      const keys = (await services.prefs.notifications.load(A)).value.items.map((n) => n.key)
      expect(keys.some((k) => k.includes('|decision|'))).toBe(true)
      expect(keys.some((k) => k.includes('|task|'))).toBe(true)
      expect(new Set(keys).size).toBe(keys.length)
    })
    await user.click(
      stack.getByRole('button', { name: /^Dismiss alert: A team task is due tomorrow/ }),
    )
    await waitFor(() =>
      expect(
        screen.queryByText('A team task is due tomorrow', { selector: 'span' }),
      ).not.toBeInTheDocument(),
    )
    expect(
      (await services.prefs.notifications.load(A)).value.items.some(
        (n) => n.title === 'A team task is due tomorrow',
      ),
    ).toBe(true)
  })
})
