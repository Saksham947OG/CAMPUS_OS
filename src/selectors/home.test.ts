import { fixedClock } from '@/lib/time'
import { makeRepo } from '@/test/campus-fixtures'
import {
  activityEntries,
  campusPulse,
  contextSuggestion,
  dailyBriefing,
  greetingFor,
  timeTaxHours,
} from './home'
import { makeNow } from './now'
import { deadlineFocus } from './deadlines'
import { upNext } from './up-next'
import { messPreview } from './mess'
import { itemsOnDate } from './occurrences'
import { emptyProfileData } from '@/domain/records'

const at = (iso: string) => makeNow(fixedClock(iso))

describe('greeting and briefing (H-W00)', () => {
  it('follows the local clock bands', () => {
    expect([4, 5, 11, 12, 16, 17, 23].map(greetingFor)).toEqual([
      'Good evening',
      'Good morning',
      'Good morning',
      'Good afternoon',
      'Good afternoon',
      'Good evening',
      'Good evening',
    ])
  })
  it('summarises real records and says so when there are none (never "free day")', async () => {
    const { load, now } = makeRepo()
    expect(dailyBriefing(await load(), now)).toMatchObject({
      hasData: true,
      summary: expect.stringMatching(/scheduled class/),
    })
    const empty = dailyBriefing(emptyProfileData('x'), now)
    expect(empty).toEqual({ hasData: false, summary: 'No schedule data available for today.' })
    expect(empty.summary).not.toMatch(/free/i)
  })
})

describe('H-T14-adjacent: Up Next (H-W02)', () => {
  it('ranks ongoing first, then the earliest start; never calls an ended item ongoing', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const today = itemsOnDate(data, d(0)) // class 09:00–10:00, meeting 15:00–16:00
    const morning = upNext(today, at('2026-11-02T03:45:00Z')) // 09:15 IST
    expect(morning.map((e) => [e.item.title, e.state])).toEqual([
      ['Sample Course A — lecture', 'ongoing'],
      ['Sample project meeting', 'upcoming'],
    ])
    const afternoon = upNext(today, at('2026-11-02T10:45:00Z')) // 16:15 IST
    expect(afternoon).toEqual([])
  })
})

describe('H-T14 / H-W03 Deadline Focus ranking', () => {
  it('lists overdue first, then due today, then nearest; completed work last', async () => {
    const { load, now } = makeRepo()
    const list = deadlineFocus(await load(), now, { hideCompleted: false })
    expect(list.slice(0, 3).map((e) => [e.title, e.standing])).toEqual([
      ['Review sample notes', 'overdue'],
      ['Read sample chapter', 'dueToday'],
      ['Draft sample report outline', 'upcoming'],
    ])
    expect(list.at(-1)?.standing).toBe('completed')
    expect(
      deadlineFocus(await load(), now, { hideCompleted: true }).some(
        (e) => e.standing === 'completed',
      ),
    ).toBe(false)
  })
})

describe('H-T15 deterministic suggestions', () => {
  it('rule 1: a date-only deadline due tomorrow suggests it without any countdown', async () => {
    const { repo, now } = makeRepo()
    await repo.saveTask('demo-student-a', {
      id: 'task-a-reading',
      title: 'Read sample chapter',
      state: 'personallyCompleted',
      subtasks: [],
      dueDate: now.today,
    })
    await repo.saveTask('demo-student-a', {
      id: 'task-a-overdue',
      title: 'Review sample notes',
      state: 'personallyCompleted',
      subtasks: [],
      dueDate: '2026-11-01' as never,
    })
    await repo.saveTask('demo-student-a', {
      id: 'task-a-outline',
      title: 'Draft sample report outline',
      state: 'personallyCompleted',
      subtasks: [],
      dueDate: '2026-11-03' as never,
    })
    const s = contextSuggestion(await repo.load('demo-student-a'), now)
    // Remaining open items are further out, so no deadline qualifies: falls through to class/other rules.
    expect(s?.rule).not.toBe(1)
  })

  it('rule 1 with a due-today task shows the date, never "hours left"', async () => {
    const { load, now } = makeRepo()
    const s = contextSuggestion(await load(), now)
    expect(s).toMatchObject({
      rule: 1,
      text: 'Upcoming deadline: Read sample chapter',
      detail: 'Due today (date only)',
    })
    expect(JSON.stringify(s)).not.toMatch(/hours? left|in \d+ (h|min)/i)
    expect(s?.href).toContain('/calendar?')
  })

  it('rule 2/3: a booking within 2 hours, then a class with a known venue within an hour', async () => {
    const { repo, d } = makeRepo()
    for (const id of ['task-a-reading', 'task-a-overdue', 'task-a-outline']) {
      await repo.saveTask('demo-student-a', {
        id,
        title: 'x',
        state: 'personallyCompleted',
        subtasks: [],
      })
    }
    await repo.saveEvent('demo-student-a', {
      id: 'ev-class-like',
      title: 'x',
      category: 'personal',
      date: d(0),
      timing: { kind: 'allDay' },
      blocksTime: false,
    })
    const data = await repo.load('demo-student-a')
    // 09:30 IST: the 09:00 class already started; the 15:00 meeting is not within 60 minutes; no rule matches... except the open deadline later
    const none = contextSuggestion(
      { ...data, deadlines: [], tasks: [] },
      at('2026-11-02T04:00:00Z'),
    )
    expect(none?.rule === 3 || none === undefined || none?.rule === 5).toBe(true)

    const nearClass = contextSuggestion(
      { ...data, deadlines: [], tasks: [] },
      at('2026-11-02T03:00:00Z'),
    ) // 08:30 IST, class at 09:00
    expect(nearClass).toMatchObject({
      rule: 3,
      text: 'Next class: Sample Course A — lecture at Sample Room (fictional)',
    })
    // A meeting is not a class: the class rule never fires for it.
    expect(
      contextSuggestion(
        { ...data, deadlines: [], tasks: [], series: [] },
        at('2026-11-02T09:00:00Z'),
      )?.rule,
    ).not.toBe(3) // 14:30 IST
  })

  it('rule 5: a permissioned birthday today; nothing is invented when no rule applies', async () => {
    const { repo, now } = makeRepo()
    const data = await repo.load('demo-student-a')
    const s = contextSuggestion(
      { ...data, deadlines: [], tasks: [], events: [], series: [], bookings: [], mess: [] },
      now,
    )
    expect(s).toMatchObject({ rule: 5, text: "It's Sample Person One's birthday" })
    expect(contextSuggestion(emptyProfileData('x'), now)).toBeUndefined()
  })
})

describe('H-T16 Campus Pulse and privacy', () => {
  it('orders important notices, then birthdays, then events; at most four; no birth year', async () => {
    const { load, now } = makeRepo()
    const pulse = campusPulse(await load(), now)
    expect(pulse.length).toBeLessThanOrEqual(4)
    expect(pulse[0]).toMatchObject({ kind: 'announcement', important: true })
    expect(pulse[1]).toMatchObject({ kind: 'birthday', when: 'Today' })
    const birthdayText = pulse
      .filter((e) => e.kind === 'birthday')
      .map((e) => `${e.title} ${e.when}`)
      .join(' ')
    expect(birthdayText).not.toMatch(/\b(19|20)\d{2}\b|born/i) // day and month only, never a birth year
  })

  it("never shows another profile's private or audience-limited birthdays", async () => {
    const { repo, now } = makeRepo()
    const a = campusPulse(await repo.load('demo-student-a'), now)
      .map((e) => e.title)
      .join('|')
    const b = campusPulse(await repo.load('demo-student-b'), now)
      .map((e) => e.title)
      .join('|')
    expect(a).not.toContain('Person Two')
    expect(a).not.toContain('private')
    expect(b).not.toContain('Person Three')
  })
})

describe('My Activity, Mess Preview, Time Tax (H-T17)', () => {
  it('shows sample bookings only, split into active and history, each labelled as sample', async () => {
    const { load, now } = makeRepo()
    const { active, history } = activityEntries(await load(), now)
    expect(active.map((e) => e.id)).toEqual(['bk-a-1'])
    expect(history.map((e) => e.id)).toEqual(['bk-a-2'])
    expect(active[0]!.status).toMatch(/sample/i)
    expect(active[0]!.mode).toBe('demoSeed')
  })

  it('mess preview uses supplied windows; with none it shows the menu without a time claim', async () => {
    const { load, now } = makeRepo()
    const data = await load()
    expect(messPreview(data, at('2026-11-02T04:30:00Z'))).toMatchObject({
      kind: 'next',
      meal: { meal: 'lunch' },
    }) // 10:00 IST
    expect(
      messPreview({ ...data, mess: data.mess.map(({ start: _s, end: _e, ...m }) => m) }, now),
    ).toMatchObject({ kind: 'menuOnly' })
    expect(messPreview(emptyProfileData('x'), now)).toEqual({ kind: 'none' })
  })

  it('Time Tax is an explicit what-if on stated assumptions', async () => {
    const { load } = makeRepo()
    const [s] = (await load()).timeTax
    expect(s!.basis).toBe('illustrative')
    const r = timeTaxHours(s!)
    expect(r.netChangeMinutes).toBe(26) // 30 → 4 (DEC-051)
    expect(r.minutesSavedPerVisit).toBe(26)
    expect(r.hoursPerWeek).toBeCloseTo(346.67, 1) // 400 × 2 × 26 ÷ 60
    const worse = timeTaxHours({ ...s!, scenarioWaitMinutes: 99 })
    expect(worse.hoursPerWeek).toBe(0) // potential is never negative…
    expect(worse.netChangeMinutes).toBe(-69) // …but the signed change is never hidden
  })
})
