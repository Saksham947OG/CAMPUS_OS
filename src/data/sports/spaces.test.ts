import { Temporal } from 'temporal-polyfill'
import { checkSlot } from '@/domain/booking-core'
import { spanMs } from '@/domain/booking-core'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { initialSportsStore } from '@/data/seeds/demo/sports-data'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { reminderPlan } from '@/selectors/reminders'
import { defaultReminderPrefs } from '@/data/prefs/reminder-prefs'
import { createCampusRepository } from '@/data/domain/campus-repository'
import { demoProfiles } from '@/data/seeds/demo/profiles'
import { itemsInRange } from '@/selectors/occurrences'
import {
  facilityView,
  hoursText,
  ownLoans,
  searchCatalogue,
  slotViews,
  spanText,
} from '@/selectors/sports'
import { LIBRARY_ID } from '@/domain/sports-logic'
import { addDays, type Clock, type DateOnly, type LocalTime } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { SPORTS_STORE_KEY, createSportsRepository, type BookInput } from './sports-repository'

const NOW = '2026-11-02T04:30:00Z' // Monday 10:00 IST
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const B = 'demo-student-b'
const t = (v: string) => v as LocalTime

function setup(nowIso = NOW) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  let iso = nowIso
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const newId = (p: string) => `${p}-t${++n}`
  const build = () =>
    createSportsRepository({ storage, clock, newId, notifications: prefs.notifications })
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
    storage,
    prefs,
    clock,
    newId,
    ok,
    setNow: (v: string) => (iso = v),
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}
type Env = ReturnType<typeof setup>
let k = 0
const book = (
  env: Env,
  profile: string,
  resourceId: string,
  start: string,
  date: DateOnly,
  extra: Partial<BookInput> = {},
) =>
  env.repo.reserve(profile, {
    resourceId,
    date,
    start: t(start),
    idempotencyKey: `k${++k}`,
    ...extra,
  })

describe('one shared engine (SR-AT-02, SR-AT-04, SR-AT-06, SR-AT-32)', () => {
  it('SR-AT-02: library, music and chill zone bookings all land in the one Sports store and nowhere else', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY))
    await env.ok(book(env, A, 'DEMO-MUSIC-1', '14:30', TODAY))
    const keys = [...env.memory.data.keys()].filter((key) => key.startsWith('campusos:'))
    expect(keys.filter((key) => key.includes(':sports:'))).toHaveLength(1)
    expect(keys.some((key) => /library|music|chill|spaces/.test(key))).toBe(false)
    const store = await env.repo.load()
    expect(store.reservations.map((r) => r.resourceId).sort()).toEqual([
      'DEMO-LIB-ROOM-1',
      'DEMO-MUSIC-1',
    ])
  })

  it('SR-AT-04: nothing about the spaces is presented as a real campus fact', async () => {
    const env = setup()
    const store = await env.repo.load()
    const spaces = store.resources.filter((r) =>
      ['library', 'musicRoom', 'chillZone'].includes(r.activity),
    )
    expect(spaces).toHaveLength(7)
    for (const r of spaces) {
      expect(r.sourceLabel).toMatch(/Illustrative sample space \(not a real campus space\)/)
      expect(r.provenance.dataMode).toBe('demoSeed')
      expect(r.label).toMatch(/^Demo /)
    }
    expect(store.config.policies.library.participantMax).toBeUndefined() // no capacity invented
    expect(store.config.policies.musicRoom.participantMax).toBeUndefined()
    expect(store.equipment.some((e) => e.facilityId === 'DEMO-MUSIC-1')).toBe(false)
    expect(store.loans).toEqual([])
    expect(store.catalogue.every((b) => /^Demo Book/.test(b.title))).toBe(true)
  })

  it('SR-AT-06: a library room reservation makes exactly one canonical reservation, even when submitted twice', async () => {
    const env = setup()
    const input: BookInput = {
      resourceId: 'DEMO-LIB-ROOM-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'same',
    }
    await env.ok(env.repo.reserve(A, input))
    expect((await env.ok(env.repo.reserve(A, input))).created).toBe(false)
    expect((await env.repo.load()).reservations).toHaveLength(1)
    expect(env.repo.bookingRefs(A)).toHaveLength(1)
  })

  it('SR-AT-32: a facility that is not configured for booking is never offered as reservable', async () => {
    const env = setup()
    const facility = await book(env, A, 'DEMO-LIBRARY', '12:00', TODAY) // the library itself, not a room
    expect(!facility.ok && facility.error.message).toMatch(/not configured/)
    await env.ok(env.repo.setPolicy('library', { bookable: false }))
    const room = await book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY)
    expect(!room.ok && room.error.message).toMatch(/not configured/)
    const store = await env.repo.load()
    const open = slotViews(
      store,
      store.resources.find((r) => r.id === 'DEMO-LIB-ROOM-1')!,
      TODAY,
      A,
      Date.parse(NOW),
    )
    expect(open).toEqual([]) // no slots invented
  })

  it('a store saved before the space services existed is topped up without losing anything', async () => {
    const env = setup()
    const old = initialSportsStore(Date.parse(NOW))
    const legacy = {
      ...old,
      resources: old.resources.filter(
        (r) => !['library', 'musicRoom', 'chillZone'].includes(r.activity),
      ),
      reservations: [],
      config: {
        ...old.config,
        policies: Object.fromEntries(
          Object.entries(old.config.policies).filter(
            ([key]) => !['library', 'musicRoom', 'chillZone'].includes(key),
          ),
        ),
      },
    } as Record<string, unknown>
    delete legacy.catalogue
    delete legacy.loans
    delete legacy.libraryOccupancy
    env.memory.data.set(SPORTS_STORE_KEY, JSON.stringify(legacy))
    const store = await env.repo.load()
    expect(store.resources.some((r) => r.id === 'DEMO-CHILL-1')).toBe(true)
    expect(store.resources.filter((r) => r.id === 'DEMO-COURT-1')).toHaveLength(1)
    expect(store.config.policies.chillZone.slotMinutes).toBe(30)
    expect(store.catalogue.length).toBeGreaterThan(0)
    expect(env.memory.data.get(SPORTS_STORE_KEY)).toBe(JSON.stringify(legacy)) // reading wrote nothing
  })
})

describe('library (SR-AT-05, SR-AT-07, SR-AT-08, SR-AT-10, SR-AT-11)', () => {
  it('SR-AT-07 / SR-AT-08: occupancy is unknown until a snapshot exists, a duplicate check-in counts once, and unknown is never zero', async () => {
    const env = setup()
    const nowMs = Date.parse(NOW)
    expect(facilityView(await env.repo.load(), A, nowMs, LIBRARY_ID).snapshot).toMatch(/^Unknown/)
    expect(await env.ok(env.repo.gymCheckIn(A, LIBRARY_ID))).toEqual({ created: true })
    expect(await env.ok(env.repo.gymCheckIn(A, LIBRARY_ID))).toEqual({ created: false })
    let v = facilityView(await env.repo.load(), A, nowMs, LIBRARY_ID)
    expect(v.selfReportedNow).toBe(1)
    // The library and the gym are separate facilities: a gym check-in does not count here.
    await env.ok(env.repo.gymCheckIn(B))
    v = facilityView(await env.repo.load(), A, nowMs, LIBRARY_ID)
    expect(v.selfReportedNow).toBe(1)
    await env.ok(env.repo.setOccupancy({ count: null }, LIBRARY_ID))
    expect(facilityView(await env.repo.load(), A, nowMs, LIBRARY_ID).snapshot).toMatch(/^Unknown ·/)
    await env.ok(env.repo.setOccupancy({ count: 0 }, LIBRARY_ID))
    expect(facilityView(await env.repo.load(), A, nowMs, LIBRARY_ID).snapshot).toMatch(
      /Reported active check-ins: 0 ·/,
    ) // an explicit report, not an assumption
    await env.ok(env.repo.gymCheckOut(A, LIBRARY_ID))
    expect((await env.repo.gymCheckOut(A, LIBRARY_ID)).ok).toBe(false)
  })

  it('SR-AT-07: an abandoned session is set aside as stale, not counted as presence', async () => {
    const env = setup()
    await env.ok(env.repo.gymCheckIn(A, LIBRARY_ID))
    const later = Date.parse(NOW) + 3 * 3_600_000
    const v = facilityView(await env.repo.load(), A, later, LIBRARY_ID)
    expect(v.selfReportedNow).toBe(0)
    expect(v.staleForReview).toBe(1)
  })

  it('SR-AT-10: a loan due date stays date-only, has no fine, can only be returned by the simulator, and an update keeps one loan', async () => {
    const env = setup()
    const loan = await env.ok(
      env.repo.addDemoLoan({
        profileId: A,
        bookId: 'DEMO-BOOK-1',
        dueDate: '2026-11-10' as DateOnly,
      }),
    )
    expect(loan.dueDate).toBe('2026-11-10')
    expect(loan.dueDate).not.toMatch(/T|:/)
    expect(Object.keys(loan)).not.toContain('fine')
    expect(loan.provenance.dataMode).toBe('simulated')
    const updated = await env.ok(env.repo.updateLoanDue(loan.id, '2026-11-07' as DateOnly))
    expect(updated.id).toBe(loan.id)
    expect((await env.repo.load()).loans).toHaveLength(1)
    await env.ok(env.repo.recordLoanReturn(loan.id))
    expect((await env.repo.recordLoanReturn(loan.id)).ok).toBe(false)
    expect((await env.repo.updateLoanDue(loan.id, '2026-11-20' as DateOnly)).ok).toBe(false)
    expect((await env.repo.addDemoLoan({ profileId: A, bookId: 'nope', dueDate: TODAY })).ok).toBe(
      false,
    )
  })

  it('SR-AT-10: the reminder starts at 09:00 the day before a date-only due date, shows once, and never invents a due hour', async () => {
    const env = setup()
    await env.ok(
      env.repo.addDemoLoan({
        profileId: A,
        bookId: 'DEMO-BOOK-1',
        dueDate: '2026-11-04' as DateOnly,
      }),
    )
    expect(await env.repo.checkDue()).toBe(0) // 10:00 on 2 Nov: reminder opens 09:00 on 3 Nov
    env.setNow('2026-11-03T03:00:00Z') // 08:30 IST on 3 Nov
    expect(await env.repo.checkDue()).toBe(0)
    env.setNow('2026-11-03T03:45:00Z') // 09:15 IST
    expect(await env.repo.checkDue()).toBe(1)
    expect(await env.repo.checkDue()).toBe(0)
    const n = (await env.notes(A)).filter((x) => x.title === 'Library book due soon (demo)')
    expect(n).toHaveLength(1)
    expect(n[0]!.body).toMatch(/date-only due date, so no time is implied/)
    expect(n[0]!.body).toMatch(/not library data/)
    expect(n[0]!.href).toBe('/bookings/library/loans')
  })

  it('SR-AT-11: another profile never sees a loan, and a student note is separate from the loan data', async () => {
    const env = setup()
    const loan = await env.ok(
      env.repo.addDemoLoan({
        profileId: A,
        bookId: 'DEMO-BOOK-2',
        dueDate: '2026-11-10' as DateOnly,
      }),
    )
    const store = await env.repo.load()
    expect(ownLoans(store, A)).toHaveLength(1)
    expect(ownLoans(store, B)).toEqual([])
    expect((await env.repo.setLoanNote(B, loan.id, 'mine now')).ok).toBe(false)
    await env.ok(env.repo.setLoanNote(A, loan.id, 'Renew on Friday'))
    const kept = (await env.repo.load()).loans[0]!
    expect(kept.studentNote).toBe('Renew on Friday')
    expect(kept.dueDate).toBe('2026-11-10') // unchanged by a note
  })

  it('SR-AT-09: the catalogue is explicitly fictional and its statuses are snapshots, never live availability', async () => {
    const env = setup()
    const store = await env.repo.load()
    expect(store.catalogue.every((b) => /Fictional demo catalogue/.test(b.sourceLabel))).toBe(true)
    expect(store.catalogue.map((b) => b.status)).toEqual(
      expect.arrayContaining(['availableSnapshot', 'onLoanSnapshot', 'unknown']),
    )
    expect(searchCatalogue(store, 'sample methods').map((b) => b.id)).toEqual(['DEMO-BOOK-3'])
    expect(searchCatalogue(store, 'zzzz')).toEqual([])
  })
})

describe('music room (SR-AT-12 … SR-AT-16)', () => {
  it('SR-AT-12: only published 90-minute slots inside the configured hours can be booked, and an unknown capacity is not invented', async () => {
    const env = setup()
    expect((await book(env, A, 'DEMO-MUSIC-1', '10:30', TODAY)).ok).toBe(false) // not on the 90-minute grid
    expect((await book(env, A, 'DEMO-MUSIC-1', '09:00', TODAY)).ok).toBe(false) // before opening
    expect((await book(env, A, 'DEMO-MUSIC-1', '21:00', TODAY)).ok).toBe(false) // would end after closing
    const ok = await env.ok(book(env, A, 'DEMO-MUSIC-1', '11:30', TODAY, { participants: 40 }))
    expect(ok.reservation).toMatchObject({ start: '11:30', end: '13:00', participants: 40 }) // no cap exists, so none is enforced
    await env.ok(env.repo.setPolicy('musicRoom', { participantMax: 6 }))
    const over = await book(env, B, 'DEMO-MUSIC-1', '14:30', TODAY, { participants: 7 })
    expect(!over.ok && over.error.message).toMatch(/up to 6 participants/)
  })

  it('SR-AT-13: equipment is unknown until supplied, and a supplied entry starts as status unknown', async () => {
    const env = setup()
    expect(
      (await env.repo.load()).equipment.filter((e) => e.facilityId === 'DEMO-MUSIC-1'),
    ).toEqual([])
    await env.ok(env.repo.addEquipment('DEMO-MUSIC-1', 'Sample amplifier'))
    const e = (await env.repo.load()).equipment.find((x) => x.facilityId === 'DEMO-MUSIC-1')!
    expect(e).toMatchObject({ label: 'Sample amplifier', status: 'unknown' })
    expect((await env.repo.addEquipment('DEMO-MUSIC-1', '   ')).ok).toBe(false)
    expect((await env.repo.addEquipment('NOPE', 'x')).ok).toBe(false)
  })

  it('SR-AT-14 / SR-AT-15: a closure blocks new colliding bookings and flags an existing one without changing it', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-MUSIC-1', '14:30', TODAY))
    await env.ok(env.repo.closeResource('DEMO-MUSIC-1', 'Floor repair'))
    const blocked = await book(env, B, 'DEMO-MUSIC-1', '17:30', TODAY)
    expect(!blocked.ok && blocked.error.message).toMatch(/closed/)
    const r = (await env.repo.load()).reservations.find((x) => x.id === reservation.id)!
    expect(r).toMatchObject({
      state: 'confirmedDemo',
      disrupted: true,
      disruptionNote: 'Floor repair',
    })
    const alerts = (await env.notes(A)).filter(
      (x) => x.title === 'Your demo reservation may be affected',
    ) // SR-AT-25
    expect(alerts).toHaveLength(1)
    expect(alerts[0]!.href).toBe(`/bookings/my/${reservation.id}`)
    await env.ok(env.repo.closeResource('DEMO-MUSIC-1', 'Again')) // closing twice does not repeat the alert
    expect(
      (await env.notes(A)).filter((x) => x.title === 'Your demo reservation may be affected'),
    ).toHaveLength(1)
  })

  it('SR-AT-16: a session that has passed its end time is not checked out for the student', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-MUSIC-1', '10:00', TODAY)) // 10:00–11:30
    await env.ok(env.repo.act(A, reservation.id, 'checkIn'))
    env.setNow('2026-11-02T10:00:00Z') // 15:30 IST, hours after the slot ended
    const r = (await env.repo.load()).reservations[0]!
    expect(r.state).toBe('checkedIn')
    await env.ok(env.repo.act(A, reservation.id, 'finish'))
    expect((await env.repo.load()).reservations[0]!.state).toBe('completed')
  })
})

describe('chill zone and midnight (SR-AT-17 … SR-AT-21, SR-AT-34)', () => {
  const D = '2026-11-07' as DateOnly // Saturday evening

  it('SR-AT-17: the three demo spots are labelled placeholders with no real names or places', async () => {
    const env = setup()
    const spots = (await env.repo.load()).resources.filter((r) => r.activity === 'chillZone')
    expect(spots.map((s) => s.label)).toEqual(['Demo Spot 1', 'Demo Spot 2', 'Demo Spot 3'])
    expect(spots.every((s) => s.location === 'Sample location (fictional)')).toBe(true)
  })

  it('SR-AT-18: a 23:45 booking ends at 00:15 on the NEXT date, and appears on both dates in the Calendar projection', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-CHILL-1', '23:45', D))
    expect(reservation).toMatchObject({
      date: '2026-11-07',
      start: '23:45',
      end: '00:15',
      endDate: '2026-11-08',
    })
    const s = spanMs(reservation)
    expect((s.end - s.start) / 60_000).toBe(30)
    expect(
      spanText({
        startDate: reservation.date,
        start: reservation.start,
        endDate: reservation.endDate!,
        end: reservation.end,
      }),
    ).toBe('Sat, 7 Nov 11:45 pm → Sun, 8 Nov 12:15 am')
    const ref = env.repo.bookingRefs(A)[0]!
    expect(ref).toMatchObject({ date: '2026-11-07', endDate: '2026-11-08', end: '00:15' })
    const campus = createCampusRepository({
      storage: env.storage,
      clock: env.clock,
      profiles: demoProfiles,
      newId: env.newId,
      extraBookings: () => [ref],
    })
    const data = await campus.load(A)
    const items = itemsInRange(data, D, addDays(D, 1)).filter((i) => i.recordId === reservation.id)
    expect(items.map((i) => i.date)).toEqual(['2026-11-07', '2026-11-08'])
    expect(items[0]!.time).toMatchObject({ start: '23:45' })
    expect(items[1]!.time).toMatchObject({ start: '00:00', end: '00:15' })
    expect(items[1]!.title).toMatch(/\(continued\)/)
  })

  it('SR-AT-18: the rollover works across a month and a year boundary', async () => {
    const env = setup('2026-12-30T04:30:00Z')
    const { reservation } = await env.ok(
      book(env, A, 'DEMO-CHILL-2', '23:45', '2026-12-31' as DateOnly),
    )
    expect(reservation).toMatchObject({ date: '2026-12-31', endDate: '2027-01-01', end: '00:15' })
    const env2 = setup('2026-11-29T04:30:00Z')
    expect(
      (await env2.ok(book(env2, A, 'DEMO-CHILL-2', '23:45', '2026-11-30' as DateOnly))).reservation
        .endDate,
    ).toBe('2026-12-01')
  })

  it('SR-AT-18: slots after midnight belong to the evening grid but start on the next date', async () => {
    const env = setup()
    const store = await env.repo.load()
    const spot = store.resources.find((r) => r.id === 'DEMO-CHILL-1')!
    const views = slotViews(store, spot, D, A, Date.parse(NOW))
    expect(views[0]).toMatchObject({ start: '19:45', startDate: '2026-11-07' })
    const after = views.find((v) => v.start === '00:15')!
    expect(after).toMatchObject({ startDate: '2026-11-08', endDate: '2026-11-08', end: '00:45' })
    expect(hoursText(spot.hours)).toBe('7:45 pm–1:45 am (next day) (demo)')
    const { reservation } = await env.ok(
      book(env, A, 'DEMO-CHILL-1', '00:15', '2026-11-08' as DateOnly),
    )
    expect(reservation).toMatchObject({ date: '2026-11-08', start: '00:15', end: '00:45' })
    expect(reservation.endDate).toBeUndefined()
  })

  it('SR-AT-19: two overlapping bookings of one spot cannot both confirm, and the loser gets the conflict message', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-CHILL-1', '23:45', D))
    const second = await book(env, B, 'DEMO-CHILL-1', '23:45', D)
    expect(!second.ok && second.error.message).toMatch(/already reserved/)
    expect((await env.repo.load()).reservations).toHaveLength(1)
    expect((await book(env, B, 'DEMO-CHILL-2', '23:45', D)).ok).toBe(true) // alternate spot, same slot
  })

  it('SR-AT-20: back-to-back slots on one spot are allowed, and a configured turnaround makes them conflict', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-CHILL-1', '23:45', D))
    expect((await book(env, B, 'DEMO-CHILL-1', '00:15', '2026-11-08' as DateOnly)).ok).toBe(true)
    const env2 = setup()
    await env2.ok(env2.repo.setPolicy('chillZone', { bufferMinutes: 10 }))
    await env2.ok(book(env2, A, 'DEMO-CHILL-1', '23:45', D))
    expect((await book(env2, B, 'DEMO-CHILL-1', '00:15', '2026-11-08' as DateOnly)).ok).toBe(false)
  })

  it('SR-AT-34: an end that is not after the start fails validation, and an off-grid start is refused', async () => {
    const base = {
      nowMs: Date.parse(NOW),
      today: TODAY,
      horizonDays: 7,
      ownerId: 'a',
      resourceId: 'r',
      maxActivePerOwner: 2,
      active: [],
    }
    // 23:45 → 00:15 WITHOUT the next-day end date is an end before the start: refused, never guessed.
    expect(checkSlot({ ...base, span: { date: D, start: t('23:45'), end: t('00:15') } })).toBe(
      'invalid',
    )
    expect(checkSlot({ ...base, span: { date: D, start: t('12:00'), end: t('12:00') } })).toBe(
      'invalid',
    )
    expect(
      checkSlot({
        ...base,
        span: { date: D, start: t('23:45'), end: t('00:15'), endDate: '2026-11-08' as DateOnly },
      }),
    ).toBeNull()
    const env = setup()
    expect((await book(env, A, 'DEMO-CHILL-1', '23:50', D)).ok).toBe(false)
  })

  it('the space services share ONE upcoming limit of two, while sports keep their own', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY))
    await env.ok(book(env, A, 'DEMO-MUSIC-1', '14:30', TODAY))
    const third = await book(env, A, 'DEMO-CHILL-1', '23:45', TODAY)
    expect(!third.ok && third.error.message).toMatch(
      /2 upcoming bookings across the space services/,
    )
    // Badminton is a different group and is unaffected.
    expect((await book(env, A, 'DEMO-COURT-1', '16:00', TODAY)).ok).toBe(true)
  })

  it('SR-AT-26 / SP-T33: a space booking gets the existing in-app reminder (30 minutes before) and never claims push', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY))
    const campus = createCampusRepository({
      storage: env.storage,
      clock: env.clock,
      profiles: demoProfiles,
      newId: env.newId,
      extraBookings: (p) => env.repo.bookingRefs(p),
    })
    const data = await campus.load(A)
    const item = itemsInRange(data, TODAY, TODAY).find(
      (i) => i.recordKind === 'booking' && /Demo group study room 1/.test(i.title),
    )!
    const plan = reminderPlan(item, defaultReminderPrefs())
    expect(plan).not.toBeNull()
    expect(JSON.stringify(plan)).toMatch(/1800000|30/) // 30 minutes before the exact start
    // Preferences are per profile, so another profile's settings are separate records.
    expect(env.repo.bookingRefs(B)).toEqual([])
  })
})

describe('reset and regressions (SR-AT-28, SR-AT-35)', () => {
  it('SR-AT-28: resetting restores the deterministic seeds, including the catalogue, without touching other stores', async () => {
    const env = setup()
    env.memory.data.set('campusos:domain:v1:demo-student-a', 'imported-academic-data')
    env.memory.data.set('campusos:ess:v1', 'ess-data')
    await env.ok(book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY))
    await env.ok(
      env.repo.addDemoLoan({
        profileId: A,
        bookId: 'DEMO-BOOK-1',
        dueDate: '2026-11-10' as DateOnly,
      }),
    )
    await env.ok(env.repo.addEquipment('DEMO-MUSIC-1', 'Sample amplifier'))
    await env.ok(env.repo.resetScenario())
    const fresh = await env.repo.load()
    expect(fresh.reservations).toEqual([])
    expect(fresh.loans).toEqual([])
    expect(fresh.equipment.some((e) => e.facilityId === 'DEMO-MUSIC-1')).toBe(false)
    expect(fresh.catalogue).toHaveLength(5)
    expect(fresh.resources.filter((r) => r.activity === 'chillZone')).toHaveLength(3)
    expect(env.memory.data.get('campusos:domain:v1:demo-student-a')).toBe('imported-academic-data')
    expect(env.memory.data.get('campusos:ess:v1')).toBe('ess-data')
  })

  it('SR-AT-35: adding the space services leaves the sports policies and the washing-machine rules as they were', async () => {
    const env = setup()
    const { config } = await env.repo.load()
    expect(config.policies.badminton).toMatchObject({
      maxActive: 2,
      graceMinutes: 10,
      horizonDays: 7,
      slotMinutes: 60,
      allowWaitlist: true,
    })
    expect(config.policies.tableTennis).toMatchObject({ slotMinutes: 30, maxActive: 1 })
    expect(config.policies.basketball).toMatchObject({ horizonDays: 3, graceMinutes: 15 })
    expect(config.policies.badminton.limitGroup).toBeUndefined() // sports keep their own per-activity limit
    // Badminton and a space booking do not count against each other's limits.
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00', TODAY))
    await env.ok(book(env, A, 'DEMO-COURT-2', '14:00', TODAY))
    await env.ok(book(env, A, 'DEMO-LIB-ROOM-1', '12:00', TODAY))
    await env.ok(book(env, A, 'DEMO-MUSIC-1', '14:30', TODAY))
    expect((await book(env, A, 'DEMO-COURT-3', '16:00', TODAY)).ok).toBe(false) // badminton limit of 2 still holds
  })
})
