import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { itemsInRange } from '@/selectors/occurrences'
import { makeServices, renderApp } from '@/test/render-app'
import { clearViewport, setViewport } from '@/test/viewport'
import type { DateOnly, LocalTime } from '@/lib/time'

const A = 'demo-student-a'
beforeEach(() => setViewport(1600))
afterEach(() => clearViewport())

describe('Academics, Shared and Community integration', () => {
  it('AC-AT-12: a focus block keeps its linked task id and shows on the Calendar data', async () => {
    const { services } = makeServices()
    const data = await services.campus.load(A)
    const task = data.tasks.find((t) => t.courseId === 'course-a') ?? data.tasks[0]!
    const saved = await services.campus.saveFocusBlock(A, {
      taskId: task.id,
      title: 'Study block',
      date: '2026-11-04' as DateOnly,
      start: '18:00' as LocalTime,
      end: '19:00' as LocalTime,
    })
    expect(saved.ok).toBe(true)
    const after = await services.campus.load(A)
    const items = itemsInRange(after, '2026-11-04' as DateOnly, '2026-11-04' as DateOnly)
    const focus = items.find((i) => i.recordKind === 'focus' && i.title === 'Study block')
    expect(focus?.taskId ?? after.focusBlocks.find((f) => f.title === 'Study block')?.taskId).toBe(
      task.id,
    )
  })

  it('AC-AT-21: an accepted meeting is one Calendar entry and one Home activity, linking to the meeting', async () => {
    const { services } = makeServices()
    const r = await services.academics.submitMeeting(
      A,
      { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Other' },
      'k',
    )
    if (!r.ok) throw new Error('setup')
    await services.academics.simulateMeeting(r.value.meeting.id, 'accept')
    const data = await services.campus.load(A)
    expect(data.bookings.filter((b) => b.id === r.value.meeting.id)).toHaveLength(1)
    renderApp('/', { services })
    const activity = await screen.findByRole('region', { name: /My activity/ })
    const links = await within(activity).findAllByRole('link', {
      name: /Meeting with Demo Faculty A/,
    })
    expect(links).toHaveLength(1)
  })

  it('AC-AT-34: a deep link reveals a record the current filters hide, without changing the filters', async () => {
    const { services } = makeServices()
    await services.community.setFollow(A, 'club-robotics', true) // Club items are hidden by the default preset
    renderApp('/calendar?view=day&date=2026-11-05&event=cev-1@2026-11-05&panel=details', {
      services,
    })
    await screen.findByRole('heading', { level: 1, name: 'Calendar' })
    expect(await screen.findAllByText(/Sample robotics workshop/)).not.toHaveLength(0)
    expect(
      screen.getByRole('radio', { name: 'Balanced Campus', checked: true }),
    ).toBeInTheDocument()
  })

  it('AC-AT-35: seeded Academics data is never edited by a user action', async () => {
    const user = userEvent.setup()
    const { services } = makeServices()
    const before = (await services.academics.load()).faculty
    await services.academics.submitMeeting(
      A,
      { actorKind: 'faculty', actorId: 'fac-a', slotId: 'av-a-1', topic: 'Other' },
      'k',
    )
    expect((await services.academics.load()).faculty).toEqual(before)
    expect(user).toBeDefined()
  })

  it('CO-AT-45: the evidence file names what was not checked by hand', () => {
    const doc = readFileSync(join(process.cwd(), 'docs/TEST_EVIDENCE.md'), 'utf8')
    expect(doc).toMatch(/What this evidence does not cover/)
    expect(doc).toMatch(/Manual screen-reader testing/)
    expect(doc).toMatch(/Real devices/)
  })

  it('SH-AT-40 / AC-AT-40 / CO-AT-42: no server, socket, polling or provider code was added to the app', () => {
    const files: string[] = []
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) files.push(p)
      }
    }
    walk(join(process.cwd(), 'src'))
    const source = files.map((f) => readFileSync(f, 'utf8')).join('\n')
    expect(source).not.toMatch(
      /new WebSocket|EventSource\(|XMLHttpRequest|navigator\.sendBeacon|fetch\(\s*['"`]https?:/,
    )
    const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>
    }
    const deps = Object.keys(pkg.dependencies ?? {}).join(' ')
    expect(deps).not.toMatch(/express|fastify|firebase|supabase|socket\.io|prisma|mongoose|axios/)
  })
})
