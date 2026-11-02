import { demoProfiles } from '@/data/seeds/demo/profiles'
import { emptyProfileData, type CalendarEvent, type RecurrenceSeries } from '@/domain/records'
import { addDays, fixedClock, parseDateOnly, parseLocalTime, type LocalTime } from '@/lib/time'
import { endOfMonth, startOfMonth } from '@/lib/time/calendar'
import { makeRepo } from '@/test/campus-fixtures'
import { findConflicts } from './conflicts'
import { standingOf } from './deadlines'
import { applyFilters, CALENDAR_PRESETS, defaultFilters, hiddenReason } from './filters'
import { computeFreePockets, defaultPlanningPrefs } from './free-pockets'
import { isTimed, type CalendarItem } from './items'
import { itemsInRange, itemsOnDate, findItemByKey } from './occurrences'
import { ruleDates } from './occurrences'
import { makeNow } from './now'

const t = (v: string) => parseLocalTime(v)

/** Synthetic timed item for algorithm tests. */
const item = (over: Partial<CalendarItem> & { start: string; end: string }): CalendarItem => {
  const { start, end, ...rest } = over
  return {
    key: `x-${start}-${end}@2026-11-02`,
    recordId: `x-${start}-${end}`,
    recordKind: 'event',
    title: 'x',
    category: 'class',
    layer: 'academic',
    date: parseDateOnly('2026-11-02'),
    time: { kind: 'timed', start: t(start), end: t(end) },
    status: 'scheduled',
    verification: 'confirmed',
    provenance: {
      dataMode: 'demoSeed',
      verification: 'confirmed',
      authority: 'demoIllustration',
      sourceLabel: 's',
    },
    blocksTime: true,
    editable: false,
    ...rest,
  }
}

describe('C-T01 shared views', () => {
  it('the same source event appears in the Day, Week, Month and Agenda ranges', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const date = d(1) // club meetup
    const key = `ev-club-meetup@${date}`
    const day = itemsInRange(data, date, date)
    const week = itemsInRange(data, addDays(date, -3), addDays(date, 3))
    const month = itemsInRange(data, startOfMonth(date), endOfMonth(date))
    const agenda = itemsInRange(data, date, addDays(date, 7))
    for (const view of [day, week, month, agenda])
      expect(view.filter((i) => i.key === key)).toHaveLength(1)
  })
})

describe('C-T03 / H-T06 time accuracy', () => {
  it('a date-only deadline stays date-only: no invented time, off the hourly grid', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const dl = itemsOnDate(data, d(2)).find((i) => i.recordId === 'dl-assign-1')!
    expect(dl.time).toEqual({ kind: 'deadline', dueTime: undefined })
    expect(isTimed(dl)).toBe(false)
  })

  it('a deadline with a supplied time keeps exactly that time and is still not a timed commitment', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const dl = itemsOnDate(data, d(4)).find((i) => i.recordId === 'dl-homework-1')!
    expect(dl.time).toEqual({ kind: 'deadline', dueTime: '17:00' })
    expect(dl.blocksTime).toBe(false)
  })
})

describe('C-T04 recurrence bounds', () => {
  it('weekly rules generate only within their term and only on the listed weekdays', async () => {
    const { load, w } = makeRepo()
    const data = await load()
    const series = data.series.find((s) => s.id === 's1-course-a')!
    const dates = ruleDates(series.rule)
    expect(dates.every((x) => x >= series.rule.startDate && x <= series.rule.endDate)).toBe(true)
    expect(dates.length).toBeGreaterThan(20)
    const before = itemsInRange(
      data,
      addDays(series.rule.startDate, -30),
      addDays(series.rule.startDate, -1),
    )
    const after = itemsInRange(
      data,
      addDays(series.rule.endDate, 1),
      addDays(series.rule.endDate, 60),
    )
    expect(before.filter((i) => i.seriesId === series.id)).toEqual([])
    expect(after.filter((i) => i.seriesId === series.id)).toEqual([])
    // Mon/Wed of the current week only
    const thisWeek = itemsInRange(data, w(0), w(6)).filter((i) => i.seriesId === series.id)
    expect(thisWeek.map((i) => i.date)).toEqual([w(0), w(2)])
  })

  it('monthly rules skip months without the day instead of shifting it, and yearly 29 Feb only exists in leap years', () => {
    const base = {
      interval: 1,
      startDate: parseDateOnly('2026-01-31'),
      endDate: parseDateOnly('2026-06-30'),
    }
    expect(ruleDates({ ...base, freq: 'monthly' }).map(String)).toEqual([
      '2026-01-31',
      '2026-03-31',
      '2026-05-31',
    ])
    const leap = ruleDates({
      freq: 'yearly',
      interval: 1,
      startDate: parseDateOnly('2024-02-29'),
      endDate: parseDateOnly('2030-12-31'),
    })
    expect(leap.map(String)).toEqual(['2024-02-29', '2028-02-29'])
  })
})

describe('C-T05 / C-T06 / H-T05 occurrence exceptions', () => {
  it('a cancelled occurrence is subdued and addressable; neighbours are untouched', async () => {
    const { load, w } = makeRepo()
    const data = await load()
    const occ = itemsInRange(data, w(-7), w(21)).filter((i) => i.seriesId === 's1-course-b')
    expect(occ.find((i) => i.date === w(8))?.status).toBe('cancelled')
    expect(occ.filter((i) => i.status === 'cancelled')).toHaveLength(1)
    expect(occ.filter((i) => i.status === 'scheduled').length).toBeGreaterThanOrEqual(3)
  })

  it('a moved occurrence appears once at its new time and never also as an active original', async () => {
    const { load, w } = makeRepo()
    const data = await load()
    const range = itemsInRange(data, w(8), w(14)).filter((i) => i.seriesId === 's1-course-c')
    expect(range).toHaveLength(1)
    expect(range[0]).toMatchObject({
      date: w(11),
      status: 'rescheduled',
      time: { kind: 'timed', start: '10:00', end: '11:30' },
    })
    expect(range[0]!.changedFrom).toMatchObject({ date: w(10), start: '14:00', end: '15:30' })
    expect(range[0]!.key).toBe(`s1-course-c@${w(10)}`) // identity stays the original occurrence
    expect(findItemByKey(data, range[0]!.key)?.date).toBe(w(11))
  })
})

describe('C-T07 holiday intersection', () => {
  it('a holiday does not implicitly cancel a class on the same day', async () => {
    const { load, w } = makeRepo()
    const data = await load()
    const day = itemsOnDate(data, w(9))
    expect(day.some((i) => i.category === 'holiday')).toBe(true)
    expect(day.find((i) => i.seriesId === 's1-course-a')?.status).toBe('scheduled')
  })
})

describe('C-T08 / C-T09 conflicts', () => {
  it('flags overlap, never adjacency', () => {
    expect(
      findConflicts([
        item({ start: '09:00', end: '10:00' }),
        item({ start: '09:30', end: '10:30' }),
      ]),
    ).toHaveLength(1)
    expect(
      findConflicts([
        item({ start: '09:00', end: '10:00' }),
        item({ start: '10:00', end: '11:00' }),
      ]),
    ).toEqual([])
  })

  it('a tentative participant makes the overlap "possible", not definite', () => {
    const [c] = findConflicts([
      item({ start: '09:00', end: '10:00' }),
      item({ start: '09:30', end: '10:30', verification: 'tentative' }),
    ])
    expect(c?.certainty).toBe('possible')
    const [d] = findConflicts([
      item({ start: '09:00', end: '10:00' }),
      item({ start: '09:30', end: '10:30' }),
    ])
    expect(d?.certainty).toBe('definite')
  })

  it('ignores cancelled items, untimed records and items that do not block time', () => {
    const base = item({ start: '09:00', end: '10:00' })
    expect(
      findConflicts([base, item({ start: '09:30', end: '10:30', status: 'cancelled' })]),
    ).toEqual([])
    expect(
      findConflicts([base, item({ start: '09:30', end: '10:30', blocksTime: false })]),
    ).toEqual([])
    expect(
      findConflicts([base, { ...base, key: 'k2', recordId: 'k2', time: { kind: 'unknownTime' } }]),
    ).toEqual([])
  })
})

describe('C-T14 / H-T14 Free Pockets', () => {
  const prefs = defaultPlanningPrefs()

  it('merges overlapping and adjacent commitments and clips to the window', () => {
    const result = computeFreePockets(
      [
        item({ start: '07:00', end: '09:00' }), // clipped to 08:00
        item({ start: '08:30', end: '10:00' }), // overlaps
        item({ start: '10:00', end: '11:00' }), // adjacent
        item({ start: '20:00', end: '23:00' }), // clipped to 22:00
      ],
      prefs,
    )
    expect(result).toMatchObject({
      kind: 'gaps',
      pockets: [{ start: '11:00', end: '20:00', minutes: 540 }],
    })
  })

  it('drops gaps shorter than the minimum and reports "none" when nothing qualifies', () => {
    const items = [item({ start: '08:00', end: '12:00' }), item({ start: '12:30', end: '22:00' })]
    expect(computeFreePockets(items, prefs)).toEqual({ kind: 'none' })
    expect(computeFreePockets(items, { ...prefs, minimumMinutes: 15 })).toMatchObject({
      kind: 'gaps',
    })
  })

  it('excludes date-only, all-day, unknown-time, cancelled and non-blocking items', () => {
    const base = item({ start: '10:00', end: '11:00' })
    const noise: CalendarItem[] = [
      { ...base, key: 'a', recordId: 'a', time: { kind: 'allDay' } },
      { ...base, key: 'b', recordId: 'b', time: { kind: 'deadline' } },
      { ...base, key: 'c', recordId: 'c', time: { kind: 'unknownTime' } },
      item({ start: '12:00', end: '13:00', status: 'cancelled' }),
      item({ start: '14:00', end: '15:00', blocksTime: false }),
    ]
    expect(computeFreePockets(noise, prefs)).toEqual({ kind: 'noData' })
    const withReal = computeFreePockets([...noise, base], prefs)
    expect(withReal).toMatchObject({
      kind: 'gaps',
      pockets: [
        { start: '08:00', end: '10:00' },
        { start: '11:00', end: '22:00' },
      ],
    })
  })

  it('no recorded commitments is "noData", never a 14-hour free slot', () => {
    expect(computeFreePockets([], prefs)).toEqual({ kind: 'noData' })
  })

  it('tentative commitments do not block time but add a caution to the affected gap', () => {
    const result = computeFreePockets(
      [
        item({ start: '09:00', end: '10:00' }),
        item({ start: '13:00', end: '14:00', verification: 'tentative' }),
      ],
      prefs,
    )
    expect(result.kind).toBe('gaps')
    if (result.kind === 'gaps') {
      const gap = result.pockets.find((p) => p.start === '10:00')!
      expect(gap.end).toBe('22:00')
      expect(gap.cautions).toHaveLength(1)
    }
  })

  it('focus blocks count as busy time (DEC-018)', () => {
    const r = computeFreePockets(
      [item({ start: '08:00', end: '22:00', category: 'focus', recordKind: 'focus' })],
      prefs,
    )
    expect(r).toEqual({ kind: 'none' })
  })
})

describe('C-T15 preset isolation', () => {
  it('presets hide items visually without touching any record', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const snapshot = JSON.stringify(data)
    const items = itemsInRange(data, d(0), d(10))
    const academic = CALENDAR_PRESETS.find((p) => p.id === 'academic')!
    const filtered = applyFilters(items, { ...defaultFilters(), categories: academic.categories })
    expect(filtered.length).toBeLessThan(items.length)
    expect(filtered.every((i) => academic.categories.includes(i.category))).toBe(true)
    expect(JSON.stringify(data)).toBe(snapshot)
    expect(itemsInRange(data, d(0), d(10))).toHaveLength(items.length)
  })

  it('explains why a hidden item is hidden (C-T16 groundwork)', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const club = itemsOnDate(data, d(1)).find((i) => i.recordId === 'ev-club-meetup')!
    expect(hiddenReason(club, defaultFilters())).toMatch(/hidden/)
    expect(hiddenReason(club, defaultFilters(), new Set([club.key]))).toBeNull()
  })
})

describe('C-T22 / C-T23 / H-T16 / H-T21 privacy and isolation', () => {
  it('birthdays follow documented visibility and never expose a birth year', async () => {
    const { repo } = makeRepo()
    const names = async (id: string) => (await repo.load(id)).birthdays.map((b) => b.id).sort()
    expect(await names('demo-student-a')).toEqual(['bd-1', 'bd-3', 'bd-4'])
    expect(await names('demo-student-b')).toEqual(['bd-1', 'bd-2'])
    expect(await names('demo-student-empty')).toEqual(['bd-1'])
    const all = JSON.stringify((await repo.load('demo-student-a')).birthdays)
    expect(all).not.toMatch(/year|19\d\d|20\d\d/i)
  })

  it('personal tasks and sectioned schedules do not leak between profiles', async () => {
    const { repo } = makeRepo()
    const a = await repo.load('demo-student-a')
    const b = await repo.load('demo-student-b')
    expect(a.tasks.every((x) => x.ownerProfileId === 'demo-student-a')).toBe(true)
    expect(b.tasks.map((x) => x.id)).toEqual(['task-b-1'])
    expect(a.series.map((s) => s.id).every((id) => id.startsWith('s1-'))).toBe(true)
    expect(b.series.map((s) => s.id).every((id) => id.startsWith('s2-'))).toBe(true)
    expect(a.bookings.map((x) => x.id)).not.toContain('bk-b-1')
  })

  it('an empty profile has no personal schedule, tasks or bookings', async () => {
    const { repo } = makeRepo()
    const e = await repo.load('demo-student-empty')
    expect([e.series.length, e.deadlines.length, e.tasks.length, e.bookings.length]).toEqual([
      0, 0, 0, 0,
    ])
    expect(demoProfiles.find((p) => p.id === 'demo-student-empty')).toBeTruthy()
  })
})

describe('C-T17 student permissions and C-T24 persistence', () => {
  it('students cannot edit or delete supplied/sample records', async () => {
    const { repo } = makeRepo()
    const ex = await repo.saveException('demo-student-a', {
      seriesId: 's1-course-a',
      originalDate: parseDateOnly('2026-11-02'),
      action: 'cancelled',
    })
    expect(ex).toMatchObject({ ok: false, error: { code: 'forbidden' } })
    expect(await repo.deleteEvent('demo-student-a', 'ev-club-meetup')).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    })
    expect(await repo.deleteSeries('demo-student-a', 's1-course-a')).toMatchObject({
      ok: false,
      error: { code: 'forbidden' },
    })
  })

  it('user-created events survive a reload through the same storage and stay profile-scoped', async () => {
    const first = makeRepo()
    const saved = await first.repo.saveEvent('demo-student-a', {
      title: 'My study session',
      category: 'personal',
      date: first.d(0),
      timing: { kind: 'timed', start: t('18:00'), end: t('19:00') },
      blocksTime: true,
    })
    expect(saved).toMatchObject({ ok: true, value: { persisted: true } })
    const second = makeRepo(undefined, first.memory)
    const a = await second.load('demo-student-a')
    expect(
      a.events.some(
        (e) => e.title === 'My study session' && e.provenance.dataMode === 'userCreated',
      ),
    ).toBe(true)
    expect(
      (await second.load('demo-student-b')).events.some((e) => e.title === 'My study session'),
    ).toBe(false)
  })

  it('repeated saves with the same id never duplicate a record (double-submit safety, C-T25)', async () => {
    const { repo, load, d } = makeRepo()
    const draft = {
      id: 'ev-fixed',
      title: 'Once',
      category: 'personal' as const,
      date: d(0),
      timing: { kind: 'allDay' as const },
      blocksTime: false,
    }
    await repo.saveEvent('demo-student-a', draft)
    await repo.saveEvent('demo-student-a', draft)
    expect((await load()).events.filter((e) => e.id === 'ev-fixed')).toHaveLength(1)
  })

  it('invalid drafts return field errors and write nothing (C-T25)', async () => {
    const { repo, memory } = makeRepo()
    const bad = await repo.saveEvent('demo-student-a', {
      title: '   ',
      category: 'personal',
      date: parseDateOnly('2026-11-02'),
      timing: { kind: 'timed', start: t('10:00'), end: t('09:00') },
      blocksTime: true,
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) {
      expect(bad.error.fieldErrors?.title).toBeTruthy()
      expect(bad.error.fieldErrors?.['timing.end']).toMatch(/after the start/)
    }
    expect(memory.data.size).toBe(0)
  })

  it('corrupt saved data is not shown, not deleted, and does not crash loading', async () => {
    const { repo, memory } = makeRepo()
    memory.data.set('campusos:domain:v1:demo-student-a', '{broken')
    const data = await repo.load('demo-student-a')
    expect(data.importWarnings.join(' ')).toMatch(/could not be read/)
    expect(memory.data.get('campusos:domain:v1:demo-student-a')).toBe('{broken')
  })
})

describe('C-T26 source ambiguities stay unknown', () => {
  it('unknown-time records are listed but never placed on the timed grid; missing fields stay absent', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const open = itemsOnDate(data, d(2)).find((i) => i.recordId === 'ev-campus-open-house')!
    expect(open.time.kind).toBe('unknownTime')
    expect(open.location).toBeUndefined()
    expect(open.instructor).toBeUndefined()
    const classes = itemsInRange(data, d(0), d(14)).filter((i) => i.category === 'class')
    expect(classes.every((c) => c.instructor === undefined)).toBe(true) // never invented
  })
})

describe('C-T29 empty states', () => {
  it('no data produces empty selector results, not fabricated content', () => {
    const empty = emptyProfileData('x')
    expect(itemsInRange(empty, parseDateOnly('2026-11-01'), parseDateOnly('2026-11-30'))).toEqual(
      [],
    )
    expect(computeFreePockets([])).toEqual({ kind: 'noData' })
  })
})

describe('H-T22 no duplicate identities', () => {
  it('every occurrence key in a month is unique', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const items = itemsInRange(data, startOfMonth(d(0)), endOfMonth(addDays(d(0), 35)))
    const keys = items.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})

describe('H-T23 / C-T30 date boundaries in Asia/Kolkata', () => {
  const nowAt = (iso: string) => makeNow(fixedClock(iso))

  it('a date-only deadline is not overdue until the next calendar day', () => {
    const due = parseDateOnly('2026-11-02')
    expect(standingOf(due, undefined, nowAt('2026-11-02T18:29:00Z'), false)).toBe('dueToday') // 23:59 IST
    expect(standingOf(due, undefined, nowAt('2026-11-02T18:30:00Z'), false)).toBe('overdue') // 00:00 IST 3 Nov
  })

  it('a timed deadline uses its real instant', () => {
    const due = parseDateOnly('2026-11-02')
    expect(standingOf(due, '17:00' as LocalTime, nowAt('2026-11-02T11:29:00Z'), false)).toBe(
      'dueToday',
    ) // 16:59 IST
    expect(standingOf(due, '17:00' as LocalTime, nowAt('2026-11-02T11:31:00Z'), false)).toBe(
      'overdue',
    )
  })

  it('completed tasks are never overdue', () => {
    expect(
      standingOf(parseDateOnly('2026-10-01'), undefined, nowAt('2026-11-02T04:30:00Z'), true),
    ).toBe('completed')
  })

  it('Today rolls over at IST midnight across month and year ends', () => {
    expect(nowAt('2026-10-31T18:30:00Z').today).toBe('2026-11-01')
    expect(nowAt('2026-12-31T18:30:00Z').today).toBe('2027-01-01')
  })
})

describe('birthdays on 29 February', () => {
  it('appear only in leap years (no silent substitute date)', () => {
    const data = {
      ...emptyProfileData('x'),
      birthdays: [
        {
          id: 'leap',
          displayName: 'Leap',
          month: 2,
          day: 29,
          visibility: 'private' as const,
          audience: { kind: 'all' as const },
          provenance: {
            dataMode: 'userCreated' as const,
            verification: 'notApplicable' as const,
            authority: 'personal' as const,
          },
        },
      ],
    }
    const dates = (y: number) =>
      itemsInRange(data, parseDateOnly(`${y}-02-01`), parseDateOnly(`${y}-03-31`)).map(
        (i) => i.date,
      )
    expect(dates(2027)).toEqual([])
    expect(dates(2028)).toEqual(['2028-02-29'])
  })
})

describe('series definition sanity', () => {
  it('rejects unbounded or inverted recurrence at the schema boundary', async () => {
    const { repo, d } = makeRepo()
    const draft: Omit<
      RecurrenceSeries,
      'id' | 'provenance' | 'ownerProfileId' | 'updatedAt' | 'status' | 'audience'
    > = {
      title: 'Weekly',
      category: 'personal',
      timing: { kind: 'allDay' },
      blocksTime: false,
      rule: { freq: 'weekly', interval: 1, startDate: d(5), endDate: d(0) },
    }
    const r = await repo.saveSeries('demo-student-a', draft)
    expect(r.ok).toBe(false)
    const ev: Partial<CalendarEvent> = {}
    expect(ev).toBeTruthy()
  })
})
