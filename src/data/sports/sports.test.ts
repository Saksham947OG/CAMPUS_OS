import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixedClock, type Clock, type DateOnly, type LocalTime } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { SPORTS_STORE_KEY, createSportsRepository, type BookInput } from './sports-repository'
import { waitlistPosition } from '@/domain/sports-logic'

const NOW = '2026-11-02T04:30:00Z' // Monday 10:00 IST
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const B = 'demo-student-b'
const C = 'demo-student-empty'
const t = (v: string) => v as LocalTime

function setup(nowIso = NOW) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  let iso = nowIso
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createSportsRepository({
      storage,
      clock,
      newId: (p) => `${p}-t${++n}`,
      notifications: prefs.notifications,
    })
  const repo = build()
  const ok = async <T>(
    p: Promise<{ ok: boolean; value?: T; error?: { message: string } }>,
  ): Promise<T> => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as T
  }
  return {
    repo,
    build,
    memory,
    prefs,
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
  extra: Partial<BookInput> = {},
  date: DateOnly = TODAY,
) =>
  env.repo.reserve(profile, {
    resourceId,
    date,
    start: t(start),
    idempotencyKey: `k${++k}`,
    ...extra,
  })

describe('storage discipline', () => {
  it('SP-T14: reading never writes, and a booking survives a reload for its owner only', async () => {
    const env = setup()
    await env.repo.load()
    expect(env.memory.data.has(SPORTS_STORE_KEY)).toBe(false)
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    const again = env.build()
    expect((await again.load()).reservations.map((r) => r.id)).toEqual([reservation.id])
    expect(again.bookingRefs(A)).toHaveLength(1)
    expect(again.bookingRefs(B)).toEqual([])
  })
})

describe('booking engine (SP-T05 … SP-T13)', () => {
  it('SP-T05: a valid slot creates exactly one persisted reservation with a stable id and a notification', async () => {
    const env = setup()
    const r = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    expect(r.created).toBe(true)
    expect(r.reservation).toMatchObject({
      state: 'confirmedDemo',
      disrupted: false,
      start: '12:00',
      end: '13:00',
    })
    expect(r.reservation.provenance.dataMode).toBe('userCreated')
    const n = (await env.notes(A)).filter((x) => x.title === 'Reservation saved in CampusOS')
    expect(n).toHaveLength(1)
    expect(n[0]!.href).toBe(`/bookings/my/${r.reservation.id}`)
  })

  it('SP-T06: a repeated submission with one key creates no duplicate', async () => {
    const env = setup()
    const input: BookInput = {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'same',
    }
    await env.ok(env.repo.reserve(A, input))
    const again = await env.ok(env.repo.reserve(A, input))
    expect(again.created).toBe(false)
    expect((await env.repo.load()).reservations).toHaveLength(1)
    expect(
      (await env.notes(A)).filter((x) => x.title.startsWith('Reservation saved')),
    ).toHaveLength(1)
  })

  it('SP-T07: an overlapping exclusive reservation is rejected with an explanation, and a different court is free', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    const clash = await book(env, B, 'DEMO-COURT-1', '12:00')
    expect(!clash.ok && clash.error.message).toMatch(/already reserved/)
    expect((await book(env, B, 'DEMO-COURT-2', '12:00')).ok).toBe(true)
    expect((await env.repo.load()).reservations).toHaveLength(2)
  })

  it('SP-T08: adjacent intervals do not conflict, but a configured turnover buffer makes them conflict', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    expect((await book(env, B, 'DEMO-COURT-1', '13:00')).ok).toBe(true) // adjacent
    const env2 = setup()
    await env2.ok(env2.repo.setPolicy('badminton', { bufferMinutes: 15 }))
    await env2.ok(book(env2, A, 'DEMO-COURT-1', '12:00'))
    expect((await book(env2, B, 'DEMO-COURT-1', '13:00')).ok).toBe(false)
  })

  it('SP-T09 / SP-T10: a closure blocks new bookings, flags existing ones as disrupted and cancels nothing silently', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    expect(await env.ok(env.repo.closeResource('DEMO-COURT-1', 'Net being replaced'))).toBe(1)
    const r = (await env.repo.load()).reservations[0]!
    expect(r.state).toBe('confirmedDemo')
    expect(r).toMatchObject({ disrupted: true, disruptionNote: 'Net being replaced' })
    expect(r.history.map((h) => h.action)).toEqual(['confirmedDemo', 'disrupted'])
    const blocked = await book(env, B, 'DEMO-COURT-1', '15:00')
    expect(!blocked.ok && blocked.error.message).toMatch(/closed/)
    const n = (await env.notes(A)).find(
      (x) => x.title === 'Your local reservation may be affected',
    )!
    expect(n.href).toBe(`/bookings/my/${reservation.id}`)
    expect(env.repo.bookingRefs(A)[0]).toMatchObject({ status: 'active' })
    expect(env.repo.bookingRefs(A)[0]!.resource).toMatch(/may be affected/)
    // Reopening does not erase the flag; only an explicit step does.
    await env.ok(env.repo.reopenResource('DEMO-COURT-1'))
    expect((await env.repo.load()).reservations[0]!.disrupted).toBe(true)
    await env.ok(env.repo.resolveDisruption(reservation.id, 'resolve'))
    expect((await env.repo.load()).reservations[0]!.disrupted).toBe(false)
  })

  it('SP-T10: a disruption can be resolved by an explicit, logged cancellation', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    await env.ok(env.repo.closeResource('DEMO-COURT-1', 'Floor repair'))
    await env.ok(env.repo.resolveDisruption(reservation.id, 'cancel'))
    const store = await env.repo.load()
    expect(store.reservations[0]!.state).toBe('cancelled')
    expect(store.operations.map((o) => o.action)).toEqual(['cancelForClosure', 'closeResource'])
    expect(store.operations.every((o) => o.actorLabel === 'Local operations view')).toBe(true)
  })

  it('SP-T11: cancelling frees the slot and never claims the court is empty', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    await env.ok(env.repo.act(A, reservation.id, 'cancel'))
    expect((await book(env, B, 'DEMO-COURT-1', '12:00')).ok).toBe(true)
    const h = (await env.repo.load()).reservations
      .find((r) => r.id === reservation.id)!
      .history.at(-1)!
    expect(h.note).toMatch(/does not say the resource is empty/)
    expect((await env.repo.act(B, reservation.id, 'cancel')).ok).toBe(false) // not theirs
    expect((await env.repo.act(A, reservation.id, 'cancel')).ok).toBe(false) // already cancelled
  })

  it('SP-T12: past slots, bad times, out-of-horizon dates, the future-booking limit and bad participants are rejected', async () => {
    const env = setup()
    expect((await book(env, A, 'DEMO-COURT-1', '08:00')).ok).toBe(false) // finished (it is 10:00)
    expect((await book(env, A, 'DEMO-COURT-1', '12:30')).ok).toBe(false) // not a slot
    expect((await book(env, A, 'DEMO-COURT-1', '12:00', {}, '2026-12-30' as DateOnly)).ok).toBe(
      false,
    )
    expect((await book(env, A, 'DEMO-COURT-1', '05:00')).ok).toBe(false) // outside published hours
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    await env.ok(book(env, A, 'DEMO-COURT-2', '14:00'))
    const third = await book(env, A, 'DEMO-COURT-3', '16:00')
    expect(!third.ok && third.error.message).toMatch(/2 upcoming bookings/)
    // The limit is per activity: a table tennis booking is still allowed.
    expect((await book(env, A, 'DEMO-TT-1', '12:00')).ok).toBe(true)
    expect((await book(env, B, 'DEMO-BBALL-1', '12:00', { participants: 0 })).ok).toBe(false)
  })

  it('SP-T13: a failed save reports the failure, preserves state and never claims success', async () => {
    const memory = createMemoryStorage()
    let failing = false
    const backend: Storage = {
      ...memory.storage,
      setItem: (key: string, v: string) => {
        if (failing && key === SPORTS_STORE_KEY)
          throw new DOMException('full', 'QuotaExceededError')
        memory.storage.setItem(key, v)
      },
    } as Storage
    const storage = createStorageAdapter({ backend })
    const prefs = createPrefsRepositories(storage)
    let n = 0
    const repo = createSportsRepository({
      storage,
      clock: fixedClock(NOW),
      newId: (p) => `${p}-${++n}`,
      notifications: prefs.notifications,
    })
    await repo.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: TODAY,
      start: t('12:00'),
      idempotencyKey: 'a',
    })
    failing = true
    const r = await repo.reserve(A, {
      resourceId: 'DEMO-COURT-2',
      date: TODAY,
      start: t('14:00'),
      idempotencyKey: 'b',
    })
    expect(r).toMatchObject({ ok: false, error: { code: 'storage' } })
    failing = false
    expect((await repo.load()).reservations).toHaveLength(1)
  })
})

describe('badminton partner, waitlist and no-show (SP-T15 … SP-T20)', () => {
  it('SP-T15: a partner is only a note, never a second booking or a verified person', async () => {
    const env = setup()
    const { reservation } = await env.ok(
      book(env, A, 'DEMO-COURT-1', '12:00', { partnerNote: 'Sample Friend' }),
    )
    expect(reservation.partnerNote).toBe('Sample Friend')
    expect((await env.repo.load()).reservations).toHaveLength(1)
  })

  async function fullSlot(env: Env) {
    return env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
  }

  it('SP-T16 / SP-T17: joining twice is deduplicated, and a waiting entry is not a reservation', async () => {
    const env = setup()
    await fullSlot(env)
    const first = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    const second = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    expect(first.created).toBe(true)
    expect(second).toMatchObject({ created: false })
    const store = await env.repo.load()
    expect(store.waitlist).toHaveLength(1)
    expect(store.reservations.filter((r) => r.ownerProfileId === B)).toEqual([])
    expect(
      (await env.notes(B)).filter((x) => x.title === 'Added to recorded local waitlist'),
    ).toHaveLength(1)
    expect((await env.repo.joinWaitlist(A, 'DEMO-COURT-1', TODAY, t('12:00'))).ok).toBe(false) // you hold it
    expect((await env.repo.joinWaitlist(B, 'DEMO-COURT-2', TODAY, t('12:00'))).ok).toBe(false) // free: book instead
    expect((await env.repo.joinWaitlist(B, 'DEMO-TT-1', TODAY, t('12:00'))).ok).toBe(false) // no waitlist configured
  })

  it('SP-T18 / SP-T19: the earliest recorded entry is offered, needs acceptance, and acceptance revalidates before confirming', async () => {
    const env = setup()
    const { reservation } = await fullSlot(env)
    const wb = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    const wc = await env.ok(env.repo.joinWaitlist(C, 'DEMO-COURT-1', TODAY, t('12:00')))
    expect(waitlistPosition(await env.repo.load(), wc.entry)).toEqual({ position: 2, of: 2 })
    expect((await env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00'))).ok).toBe(false) // still reserved
    await env.ok(env.repo.act(A, reservation.id, 'cancel'))
    const offered = await env.ok(env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00')))
    expect(offered.id).toBe(wb.entry.id) // earliest sequence, not C
    expect((await env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00'))).ok).toBe(false) // one open offer
    expect((await env.notes(B)).find((x) => x.title === 'A slot offer is available')!.body).toMatch(
      /not yours until you accept/,
    )
    expect((await env.repo.load()).reservations.filter((r) => r.ownerProfileId === B)).toEqual([]) // not granted yet
    expect((await env.repo.respondToOffer(C, wb.entry.id, true)).ok).toBe(false) // not theirs
    const accepted = await env.ok(env.repo.respondToOffer(B, wb.entry.id, true))
    expect(accepted.reservation).toMatchObject({
      ownerProfileId: B,
      start: '12:00',
      state: 'confirmedDemo',
    })
    const store = await env.repo.load()
    expect(store.waitlist.find((w) => w.id === wb.entry.id)).toMatchObject({
      state: 'accepted',
      resultingReservationId: accepted.reservation!.id,
    })
    expect((await env.repo.respondToOffer(B, wb.entry.id, true)).ok).toBe(false) // already used
  })

  it('SP-T19: an accepted offer is refused if the slot was taken in the meantime', async () => {
    const env = setup()
    const { reservation } = await fullSlot(env)
    const wb = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(env.repo.act(A, reservation.id, 'cancel'))
    await env.ok(env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(book(env, C, 'DEMO-COURT-1', '12:00')) // someone books it directly
    const r = await env.repo.respondToOffer(B, wb.entry.id, true)
    expect(!r.ok && r.error.message).toMatch(/already reserved/)
    expect((await env.repo.load()).reservations.filter((x) => x.ownerProfileId === B)).toEqual([])
  })

  it('an offer lapses visibly: acceptance is refused after the lifetime and the simulator marks it expired', async () => {
    const env = setup()
    const { reservation } = await fullSlot(env)
    const wb = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(env.repo.act(A, reservation.id, 'cancel'))
    await env.ok(env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00')))
    expect((await env.repo.expireOffer(wb.entry.id)).ok).toBe(false) // not lapsed yet
    env.setNow('2026-11-02T04:50:00Z') // 20 minutes later; lifetime is 15
    const late = await env.repo.respondToOffer(B, wb.entry.id, true)
    expect(!late.ok && late.error.message).toMatch(/expired/)
    await env.ok(env.repo.expireOffer(wb.entry.id))
    expect((await env.repo.load()).waitlist[0]!.state).toBe('expired')
  })

  it('declining frees the offer so the next entry can be offered', async () => {
    const env = setup()
    const { reservation } = await fullSlot(env)
    const wb = await env.ok(env.repo.joinWaitlist(B, 'DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(env.repo.joinWaitlist(C, 'DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(env.repo.act(A, reservation.id, 'cancel'))
    await env.ok(env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00')))
    await env.ok(env.repo.respondToOffer(B, wb.entry.id, false))
    const next = await env.ok(env.repo.issueOffer('DEMO-COURT-1', TODAY, t('12:00')))
    expect(next.profileId).toBe(C)
  })

  it('SP-T20: a no-show releases the booking claim after the grace period and leaves physical occupancy unknown', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '10:00'))
    expect((await env.repo.processNoShow(reservation.id)).ok).toBe(false) // within 10-minute grace
    env.setNow('2026-11-02T04:45:00Z') // 10:15
    await env.ok(env.repo.processNoShow(reservation.id))
    const store = await env.repo.load()
    expect(store.reservations[0]!.state).toBe('noShow')
    expect(store.occupancy).toBeNull() // nothing asserted about the court
    expect(
      (await env.notes(A)).find((x) => x.title === 'Local booking released after no-show')!.body,
    ).toMatch(/does not mean the resource is physically empty/)
    expect((await env.repo.processNoShow(reservation.id)).ok).toBe(false)
  })

  it('check-in and finishing are self-reports with their own limits', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '14:00')) // starts 14:00
    expect((await env.repo.act(A, reservation.id, 'checkIn')).ok).toBe(false) // opens 15 min before
    env.setNow('2026-11-02T08:35:00Z') // 14:05 IST
    await env.ok(env.repo.act(A, reservation.id, 'checkIn'))
    expect(
      (await env.notes(A)).find((x) => x.title === 'Self-reported check-in recorded')!.body,
    ).toMatch(/not an access or security check/)
    expect((await env.repo.act(A, reservation.id, 'cancel')).ok).toBe(false) // already started
    await env.ok(env.repo.act(A, reservation.id, 'finish'))
    expect((await env.repo.load()).reservations[0]!.state).toBe('completed')
  })
})

describe('gym schedule upgrade', () => {
  it('upgrades a saved information-only gym without losing user records or closures', async () => {
    const env = setup()
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    await env.ok(env.repo.gymCheckIn(A))
    const old = await env.repo.load()
    delete old.gymScheduleVersion
    old.config.policies.gym.bookable = false
    old.config.policies.gym.slotMinutes = 60
    const gym = old.resources.find((r) => r.id === 'DEMO-GYM')!
    gym.hours!.close = t('21:00')
    gym.status = 'closed'
    gym.closureNote = 'Maintenance'
    env.memory.storage.setItem(SPORTS_STORE_KEY, JSON.stringify(old))
    const upgraded = await env.build().load()
    expect(upgraded.config.policies.gym).toMatchObject({ bookable: true, slotMinutes: 30 })
    expect(upgraded.resources.find((r) => r.id === 'DEMO-GYM')).toMatchObject({
      hours: { open: '06:00', close: '22:00' },
      status: 'closed',
      closureNote: 'Maintenance',
    })
    expect(upgraded.reservations).toEqual(old.reservations)
    expect(upgraded.gymSessions).toEqual(old.gymSessions)
    // A later planning policy edit is respected once the upgrade has been saved.
    upgraded.config.policies.gym.bookable = false
    env.memory.storage.setItem(SPORTS_STORE_KEY, JSON.stringify(upgraded))
    expect((await env.build().load()).config.policies.gym.bookable).toBe(false)
  })
})

describe('gym and other sports (SP-T21 … SP-T25)', () => {
  it('SP-T21: a second check-in does not create a second session; check-out and correction are explicit', async () => {
    const env = setup()
    expect(await env.ok(env.repo.gymCheckIn(A))).toEqual({ created: true })
    expect(await env.ok(env.repo.gymCheckIn(A))).toEqual({ created: false })
    expect((await env.repo.load()).gymSessions).toHaveLength(1)
    await env.ok(env.repo.gymCorrect(A))
    expect((await env.repo.load()).gymSessions).toHaveLength(0)
    expect((await env.repo.gymCheckOut(A)).ok).toBe(false)
    await env.ok(env.repo.gymCheckIn(A))
    await env.ok(env.repo.gymCheckOut(A))
    expect((await env.repo.gymCheckOut(A)).ok).toBe(false)
    expect((await env.repo.load()).gymSessions[0]!.endedAt).toBeDefined()
  })

  it('SP-T23: an equipment fault or report never closes the gym or any other resource', async () => {
    const env = setup()
    await env.ok(env.repo.setEquipmentStatus('DEMO-EQ-1', 'underMaintenance'))
    await env.ok(env.repo.reportFault(A, 'DEMO-EQ-2', 'Cable frays'))
    expect((await env.repo.reportFault(A, 'DEMO-EQ-2', '  ')).ok).toBe(false)
    const store = await env.repo.load()
    expect(store.resources.every((r) => r.status === 'open')).toBe(true)
    expect(store.equipment.find((e) => e.id === 'DEMO-EQ-2')!.status).toBe('reportedAvailable') // a report is not a verified fault
    expect(store.faultReports).toHaveLength(1)
  })

  it('SP-T24: table tennis, pool and basketball use their own policy and slot configuration', async () => {
    const env = setup()
    const { config } = await env.repo.load()
    const { tableTennis, pool, basketball, badminton } = config.policies
    expect(tableTennis.slotMinutes).toBe(30)
    expect(basketball.horizonDays).toBe(3)
    expect(badminton.maxActive).toBe(2)
    expect(tableTennis.maxActive).toBe(1)
    expect(pool.bookable).toBe(false)
    const tt = (await env.ok(book(env, A, 'DEMO-TT-1', '12:00'))).reservation
    expect(tt).toMatchObject({ start: '12:00', end: '12:30' })
    const bb = (await env.ok(book(env, B, 'DEMO-BBALL-1', '12:00', { participants: 8 })))
      .reservation
    expect(bb).toMatchObject({ end: '13:00', participants: 8 })
    expect((await book(env, C, 'DEMO-BBALL-1', '12:00', {}, '2026-11-09' as DateOnly)).ok).toBe(
      false,
    ) // 3-day horizon
  })

  it('SP-T25: a resource without booking rules or hours offers no slot and cannot be reserved', async () => {
    const env = setup()
    const pool = await book(env, A, 'DEMO-POOL-1', '12:00')
    expect(!pool.ok && pool.error.message).toMatch(/not configured/)
    await env.ok(env.repo.setPolicy('pool', { bookable: true }))
    const noHours = await book(env, A, 'DEMO-POOL-1', '12:00')
    expect(!noHours.ok && noHours.error.message).toMatch(/hours were not provided/)
  })

  it('the owner-supplied people-per-court limits are respected, and the gym has none per reservation', async () => {
    const env = setup()
    expect((await book(env, A, 'DEMO-BBALL-1', '12:00', { participants: 11 })).ok).toBe(false)
    expect((await book(env, A, 'DEMO-BBALL-1', '12:00', { participants: 10 })).ok).toBe(true)
    const p = (await env.repo.load()).config.policies
    expect([p.badminton, p.tableTennis, p.pool, p.snooker].map((x) => x.participantMax)).toEqual([
      4, 2, 2, 2,
    ])
    expect(p.gym.participantMax).toBeUndefined()
  })

  it('a gym slot holds up to 20 reservations, then is full; the same person cannot take two', async () => {
    const env = setup()
    const slot = '12:00'
    for (let i = 0; i < 20; i++) expect((await book(env, `P${i}`, 'DEMO-GYM', slot)).ok).toBe(true)
    const full = await book(env, 'P20', 'DEMO-GYM', slot)
    expect(!full.ok && full.error.message).toMatch(/already reserved/)
    expect((await book(env, 'P0', 'DEMO-GYM', '12:30')).ok).toBe(false) // one upcoming gym booking each
  })

  it('occupancy is a labelled simulated snapshot; unknown stays unknown and is never zero', async () => {
    const env = setup()
    expect((await env.repo.load()).occupancy).toBeNull()
    await env.ok(env.repo.setOccupancy({ count: 7, level: 'moderate' }))
    expect((await env.repo.load()).occupancy).toMatchObject({
      count: 7,
      completeness: 'partial',
      sourceLabel: expect.stringContaining('not a live count'),
    })
    await env.ok(env.repo.setOccupancy({ count: null }))
    expect((await env.repo.load()).occupancy).toMatchObject({
      count: null,
      completeness: 'unknown',
    })
    expect((await env.repo.setOccupancy({ count: -1 })).ok).toBe(false)
  })
})

describe('no background pretending (SP-T35)', () => {
  it('SP-T35: a slot ending or a grace period passing changes nothing by itself, and no occupancy is asserted', async () => {
    const env = setup()
    const { reservation } = await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    const before = await env.repo.load()
    env.setNow('2026-11-02T10:00:00Z') // 15:30 IST: the slot ended two hours ago
    const after = await env.repo.load()
    expect(after.reservations.find((r) => r.id === reservation.id)).toEqual(before.reservations[0])
    expect(after.reservations[0]!.state).toBe('confirmedDemo')
    expect(after.occupancy).toBeNull()
    expect(after.resources.find((r) => r.id === 'DEMO-COURT-1')!.status).toBe('open')
    expect(after.operations).toEqual([])
  })
})

describe('reset and cross-profile privacy (SP-T30)', () => {
  it('resetting Sports clears only Sports records and rebuilds the deterministic scenario', async () => {
    const env = setup()
    env.memory.data.set('campusos:ess:v1', 'ess-data')
    env.memory.data.set('campusos:chill:v1', 'chill-data')
    await env.ok(book(env, A, 'DEMO-COURT-1', '12:00'))
    await env.ok(env.repo.resetScenario())
    expect(env.memory.data.has(SPORTS_STORE_KEY)).toBe(false)
    expect(env.memory.data.get('campusos:ess:v1')).toBe('ess-data')
    expect(env.memory.data.get('campusos:chill:v1')).toBe('chill-data')
    const fresh = await env.repo.load()
    expect(fresh.reservations).toEqual([])
    expect(fresh.resources.map((r) => r.id)).toContain('DEMO-COURT-1')
  })
})
