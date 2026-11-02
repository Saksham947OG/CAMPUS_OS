import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import type { NotificationRecord } from '@/data/prefs/reminder-prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { defaultNotificationPrefs, type Scenario } from '@/domain/shared'
import type { Clock, DateOnly } from '@/lib/time'
import {
  aggregate,
  illustrativeObservations,
  MIN_SAMPLES,
  recommend,
  serviceMetric,
} from '@/selectors/besttime'
import { examsFor, examTimeText, seatText, seatView } from '@/selectors/exams'
import {
  categoryOf,
  filterInbox,
  isHiddenByMute,
  unreadCount,
  visibleNotifications,
} from '@/selectors/notifications'
import { computeScenario, presets, totalsByMeasure } from '@/selectors/timetax'
import { createMemoryStorage } from '@/test/memory-storage'
import { createSharedRepository, SHARED_STORE_KEY } from './shared-repository'

const NOW = '2026-11-02T04:30:00Z'
const A = 'demo-student-a'
const B = 'demo-student-b'
const E = 'demo-student-empty'

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const clock: Clock = { now: () => Temporal.Instant.from(NOW) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createSharedRepository({
      storage,
      clock,
      newId: (p) => `${p}-t${++n}`,
      notifications: prefs.notifications,
      profileIds: [A, B, E],
    })
  const ok = async <T>(
    p: Promise<{ ok: boolean; value?: T; error?: { message: string } }>,
  ): Promise<T> => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as T
  }
  return {
    repo: build(),
    build,
    memory,
    prefs,
    ok,
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}

const rec = (
  key: string,
  href: string,
  significance: NotificationRecord['significance'],
  read = false,
  kind: NotificationRecord['kind'] = 'service',
): NotificationRecord => ({
  key,
  kind,
  title: key,
  body: '',
  href,
  significance,
  surfacedAt: '2026-11-02T04:30:00Z',
  readState: read ? 'read' : 'unread',
})

describe('notification triage', () => {
  const items = [
    rec('a', '/community/clubs/x', 'optional'),
    rec('b', '/administration/requests/r1', 'critical'),
    rec('c', '/bookings/my/b1', 'important', true),
    rec('d', '/services/parcels/p1', 'standard'),
    rec('e', '/calendar', 'standard', false, 'reminder'),
  ]
  it('SH-AT-02: every message gets a category from its own link, and the filters count correctly', () => {
    expect(items.map(categoryOf)).toEqual([
      'community',
      'administration',
      'bookings',
      'parcels',
      'calendar',
    ])
    const p = defaultNotificationPrefs()
    expect(filterInbox(items, p, { show: 'all', category: '' })).toHaveLength(5)
    expect(
      filterInbox(items, p, { show: 'unread', category: '' })
        .map((n) => n.key)
        .sort(),
    ).toEqual(['a', 'b', 'd', 'e'])
    expect(
      filterInbox(items, p, { show: 'important', category: '' })
        .map((n) => n.key)
        .sort(),
    ).toEqual(['b', 'c'])
    expect(filterInbox(items, p, { show: 'all', category: 'parcels' }).map((n) => n.key)).toEqual([
      'd',
    ])
    expect(unreadCount(items, p)).toBe(4)
  })

  it('SH-AT-04 / SH-AT-05: muting hides standard and optional messages only, critical and important always stay, nothing is deleted', () => {
    const p = {
      schemaVersion: 1 as const,
      muted: ['community', 'administration', 'parcels'] as (
        'community' | 'administration' | 'parcels'
      )[],
    }
    expect(isHiddenByMute(items[0]!, p)).toBe(true) // optional club message
    expect(isHiddenByMute(items[1]!, p)).toBe(false) // critical leave decision in a muted category
    expect(isHiddenByMute(items[3]!, p)).toBe(true) // standard parcel message
    expect(
      visibleNotifications(items, p)
        .map((n) => n.key)
        .sort(),
    ).toEqual(['b', 'c', 'e'])
    expect(unreadCount(items, p)).toBe(2)
    expect(items).toHaveLength(5) // the records themselves are untouched
    expect(visibleNotifications(items, defaultNotificationPrefs())).toHaveLength(5) // unmuting restores them
  })

  it('SH-AT-03 / SH-AT-09 / SH-AT-10: read state and preferences are per profile, persist, and never change a source record', async () => {
    const env = setup()
    await env.prefs.notificationPrefs.save(A, { schemaVersion: 1, muted: ['community'] })
    expect((await env.prefs.notificationPrefs.load(A)).value.muted).toEqual(['community'])
    expect((await env.prefs.notificationPrefs.load(B)).value.muted).toEqual([]) // another profile is unaffected
    await env.prefs.notifications.save(A, {
      schemaVersion: 1,
      items: [rec('x', '/bookings/my/1', 'standard')],
    })
    expect((await env.prefs.notifications.load(B)).value.items).toEqual([])
    const before = await env.repo.load()
    await env.prefs.notificationPrefs.reset(A)
    expect(await env.repo.load()).toEqual(before) // preferences never touch Shared records
  })
})

describe('exam seating', () => {
  it('SH-AT-20 / SH-AT-21: each profile sees only its own seat, and an exam without one says so', async () => {
    const env = setup()
    const s = await env.repo.load()
    const a1 = seatView(s, A, 'exam-1')
    const b1 = seatView(s, B, 'exam-1')
    expect(a1.kind === 'seat' && seatText(a1.seat)).toBe('Demo Hall 1, row 3, column 5')
    expect(b1.kind === 'seat' && seatText(b1.seat)).toBe('Demo Hall 2, row 1, column 2')
    expect(seatView(s, A, 'exam-2')).toEqual({ kind: 'none' })
    expect(seatView(s, E, 'exam-1')).toEqual({ kind: 'none' })
    expect(seatView(s, A, 'exam-3')).toEqual({ kind: 'none' })
  })

  it('SH-AT-23 / SH-AT-27: date-only exams keep no start time, and every seat is labelled fictional', async () => {
    const env = setup()
    const s = await env.repo.load()
    expect(s.exams.find((e) => e.id === 'exam-1')!.startTime).toBeUndefined()
    expect(examTimeText(s.exams.find((e) => e.id === 'exam-1')!)).toBe('start time not provided')
    expect(examTimeText(s.exams.find((e) => e.id === 'exam-2')!)).toBe('starts 10:00')
    expect(
      s.seats.every((x) => /Fictional demo seat \(not an official allotment\)/.test(x.sourceLabel)),
    ).toBe(true)
    // exam-4 is the quiz the Campus Mail demo sends seating for; it is dated today so it sorts first.
    expect(examsFor(s, new Set(['course-a'])).map((e) => e.id)).toEqual(['exam-4', 'exam-1'])
    expect(examsFor(s, new Set())).toEqual([])
  })

  it('SH-AT-24 / SH-AT-25 / SH-AT-26: a change keeps every version, tells only the owner once, and never prints the seat', async () => {
    const env = setup()
    await env.ok(env.repo.changeSeat('exam-1', A, { hall: 'Demo Hall 3', row: '7', column: '8' }))
    await env.ok(env.repo.changeSeat('exam-1', A, { hall: 'Demo Hall 4', row: '2', column: '2' }))
    const seat = (await env.repo.load()).seats.find(
      (x) => x.ownerProfileId === A && x.examId === 'exam-1',
    )!
    expect(seat.version).toBe(3)
    expect(seat.history.map((h) => [h.version, h.hall])).toEqual([
      [1, 'Demo Hall 1'],
      [2, 'Demo Hall 3'],
      [3, 'Demo Hall 4'],
    ])
    const mine = (await env.notes(A)).filter((n) => n.title === 'Your exam seating changed (local)')
    expect(mine).toHaveLength(2) // one per distinct version
    expect(mine[0]!.significance).toBe('critical')
    expect(mine[0]!.href).toBe('/academics/exams/exam-1')
    for (const n of mine) expect(`${n.title} ${n.body}`).not.toMatch(/Hall|row|column|\d+,/)
    expect(await env.notes(B)).toEqual([])
    expect((await env.repo.changeSeat('exam-1', A, {})).ok).toBe(false)
    expect((await env.repo.changeSeat('nope', A, { hall: 'x' })).ok).toBe(false)
  })

  it('SH-AT-22: contradicting allocations are flagged for review and neither is shown as fact until the simulator picks one', async () => {
    const env = setup()
    await env.ok(env.repo.injectSeatConflict('exam-1', A))
    let s = await env.repo.load()
    const v = seatView(s, A, 'exam-1')
    expect(v.kind).toBe('conflict')
    expect(v.kind === 'conflict' && v.seats).toHaveLength(2)
    expect(seatView(s, B, 'exam-1').kind).toBe('seat') // others are unaffected
    const keep = s.seats.find((x) => x.ownerProfileId === A && x.hall === 'Demo Hall 1')!
    await env.ok(env.repo.resolveSeatConflict(keep.id))
    s = await env.repo.load()
    expect(seatView(s, A, 'exam-1').kind).toBe('seat')
    expect((await env.repo.injectSeatConflict('exam-2', A)).ok).toBe(false) // no seat to contradict
  })

  it('an exam change is a versioned, critical, simulated notice and does not touch seats', async () => {
    const env = setup()
    const before = (await env.repo.load()).seats
    await env.ok(env.repo.rescheduleExam('exam-1', { date: '2026-11-20' as DateOnly }))
    const s = await env.repo.load()
    expect(s.exams.find((e) => e.id === 'exam-1')).toMatchObject({
      date: '2026-11-20',
      status: 'changed',
      version: 2,
    })
    expect(s.seats).toEqual(before)
    for (const p of [A, B, E])
      expect(
        (await env.notes(p)).filter((n) => n.title === 'Exam details changed (local)'),
      ).toHaveLength(1)
  })

  it('reading never writes, and the scoped reset restores the sample exams and seats', async () => {
    const env = setup()
    await env.repo.load()
    expect(env.memory.data.has(SHARED_STORE_KEY)).toBe(false)
    await env.ok(env.repo.changeSeat('exam-1', A, { hall: 'X' }))
    expect(env.memory.data.has(SHARED_STORE_KEY)).toBe(true)
    await env.ok(env.repo.resetScenarioAll())
    expect(env.memory.data.has(SHARED_STORE_KEY)).toBe(false)
    expect((await env.repo.load()).seats).toHaveLength(3)
  })
})

describe('Best Time to Go', () => {
  const obs = illustrativeObservations()
  it('SH-AT-12 / SH-AT-15: bins are by weekday and hour, per service, and use that service’s own unit', () => {
    const mess = aggregate(obs, 'mess', 1)
    const gym = aggregate(obs, 'gym', 1)
    expect(mess.map((b) => b.hour)).toEqual(Array.from({ length: 15 }, (_, i) => 7 + i))
    expect(mess.every((b) => b.n === 4)).toBe(true)
    expect(mess).not.toEqual(gym)
    expect(aggregate(obs, 'mess', 0)).toEqual([]) // Sunday: no observations
    expect(serviceMetric.mess.unit).toBe('people')
    expect(serviceMetric.laundry.unit).toBe('minutes')
  })

  it('SH-AT-13 / SH-AT-17: no data is "no reliable pattern", never zero, and a thin sample withholds the recommendation', () => {
    expect(aggregate(obs, 'mess', 0)).toEqual([])
    expect(recommend([])).toMatchObject({ kind: 'withheld' })
    const laundry = aggregate(obs, 'laundry', 1)
    expect(laundry.length).toBeGreaterThan(0)
    expect(laundry.every((b) => !b.enough && b.n < MIN_SAMPLES)).toBe(true)
    expect(recommend(laundry)).toMatchObject({
      kind: 'withheld',
      reason: expect.stringMatching(/too few comparable samples/),
    })
  })

  it('SH-AT-14 / SH-AT-18: every observation is marked simulated, and counts and minutes are never mixed', () => {
    expect(obs.every((o) => o.mode === 'simulated')).toBe(true)
    expect(new Set(obs.filter((o) => o.serviceId === 'mess').map((o) => o.unit))).toEqual(
      new Set(['people']),
    )
    expect(new Set(obs.filter((o) => o.serviceId === 'laundry').map((o) => o.unit))).toEqual(
      new Set(['minutes']),
    )
  })

  it('a tie is reported as a tie, and the single best hour comes only from bins with enough samples', () => {
    const bins = [
      { hour: 9, mean: 5, n: 4, enough: true },
      { hour: 10, mean: 5, n: 4, enough: true },
      { hour: 11, mean: 2, n: 1, enough: false },
    ]
    expect(recommend(bins)).toEqual({ kind: 'tied', hours: [9, 10], mean: 5 })
    expect(
      recommend([
        { hour: 9, mean: 5, n: 4, enough: true },
        { hour: 12, mean: 3, n: 5, enough: true },
      ]),
    ).toEqual({ kind: 'best', hour: 12, mean: 3 })
  })
})

describe('Time Tax arithmetic', () => {
  const base = {
    baselineMinutes: 20,
    scenarioMinutes: 4,
    eligibleStudents: 400,
    visitsPerWeek: 2,
    adoptionPercent: 50,
    weeks: 14,
  }
  it('SH-AT-29 / SH-AT-31 / SH-AT-33: a 20 → 4 minute change is 16 minutes avoided, and the weekly hours follow the stated adoption', () => {
    const r = computeScenario(base)
    expect(r.avoidedPerVisit).toBe(16)
    expect(r.participants).toBe(200)
    expect(r.weeklyStudentHours).toBeCloseTo((200 * 2 * 16) / 60, 6)
    expect(r.termStudentHours).toBeCloseTo(r.weeklyStudentHours * 14, 6)
    expect(computeScenario({ ...base, adoptionPercent: 100 }).weeklyStudentHours).toBeCloseTo(
      r.weeklyStudentHours * 2,
      6,
    )
    expect(computeScenario({ ...base, baselineMinutes: 30 }).avoidedPerVisit).toBe(26) // inputs recalculate dependents
  })

  it('SH-AT-32: a worsening is preserved in the signed change and never advertised as a benefit', () => {
    const r = computeScenario({ ...base, baselineMinutes: 4, scenarioMinutes: 20 })
    expect(r.netPerVisit).toBe(-16)
    expect(r.worsens).toBe(true)
    expect(r.avoidedPerVisit).toBe(0)
    expect(r.weeklyStudentHours).toBe(0)
  })

  it('SH-AT-30: zero participants or zero visits give zero hours, not NaN', () => {
    expect(computeScenario({ ...base, eligibleStudents: 0 }).weeklyStudentHours).toBe(0)
    expect(computeScenario({ ...base, visitsPerWeek: 0 }).termStudentHours).toBe(0)
  })

  it('SH-AT-36 / SH-AT-37: student-hours add only within one measure, and each service names a single time component', () => {
    const mk = (serviceId: string, measure: Scenario['measure']): Scenario => ({
      id: serviceId,
      ownerProfileId: A,
      serviceId,
      measure,
      updatedAt: NOW,
      ...base,
    })
    const totals = totalsByMeasure([
      mk('chill-spot', 'onSiteWaiting'),
      mk('bookings', 'failedTrips'),
      mk('ss-laundry', 'failedTrips'),
    ])
    expect(totals.map((t) => [t.measure, t.count])).toEqual([
      ['onSiteWaiting', 1],
      ['failedTrips', 2],
    ])
    expect(totals.find((t) => t.measure === 'failedTrips')!.hours).toBeCloseTo(
      2 * computeScenario(base).weeklyStudentHours,
      6,
    )
    expect(new Set(presets.map((p) => p.serviceId)).size).toBe(presets.length)
    expect(presets.find((p) => p.serviceId === 'chill-spot')!.note).toMatch(
      /does not make the food faster/,
    )
  })

  it('SH-AT-29 / SH-AT-38: a scenario is saved per profile and service, validated, and removing it touches nothing else', async () => {
    const env = setup()
    const input = { serviceId: 'chill-spot', measure: 'onSiteWaiting' as const, ...base }
    await env.ok(env.repo.saveScenario(A, input))
    await env.ok(env.repo.saveScenario(A, { ...input, scenarioMinutes: 6 })) // upsert, not a duplicate
    await env.ok(env.repo.saveScenario(B, input))
    let s = await env.repo.load()
    expect(s.scenarios.filter((x) => x.ownerProfileId === A)).toHaveLength(1)
    expect(s.scenarios.find((x) => x.ownerProfileId === A)!.scenarioMinutes).toBe(6)
    expect((await env.repo.saveScenario(A, { ...input, adoptionPercent: 150 })).ok).toBe(false)
    expect((await env.repo.saveScenario(A, { ...input, baselineMinutes: -1 })).ok).toBe(false)
    expect((await env.repo.saveScenario(A, { ...input, weeks: 1.5 })).ok).toBe(false)
    const exams = s.exams
    await env.ok(env.repo.resetScenario(A, 'chill-spot'))
    s = await env.repo.load()
    expect(s.scenarios.map((x) => x.ownerProfileId)).toEqual([B])
    expect(s.exams).toEqual(exams)
  })
})
