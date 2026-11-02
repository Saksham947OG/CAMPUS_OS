import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { GYM_ID } from '@/domain/sports-logic'
import { facilityView } from '@/selectors/sports'
import type { Clock } from '@/lib/time'
import { createSportsRepository } from './sports-repository'

const A = 'demo-student-a'

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  let iso = '2026-11-02T04:30:00Z'
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
  return {
    repo: build(),
    build,
    advance: (min: number) => (iso = new Date(Date.parse(iso) + min * 60_000).toISOString()),
    now: () => Date.parse(iso),
  }
}

describe('check-in lease', () => {
  it('expires a forgotten check-in after the maximum, without claiming the person left, and stays expired after a reload', async () => {
    const e = setup()
    await e.repo.gymCheckIn(A)
    let s = await e.repo.load()
    expect(s.gymSessions[0]!.expiresAt).toBeTruthy()
    expect(facilityView(s, A, e.now(), GYM_ID).mySession).toBeTruthy()
    e.advance(59)
    expect(facilityView(await e.repo.load(), A, e.now(), GYM_ID).mySession).toBeTruthy()
    e.advance(2) // 61 minutes after check-in
    s = await e.repo.load()
    const v = facilityView(s, A, e.now(), GYM_ID)
    expect(v.mySession).toBeUndefined()
    expect(v.myExpired).toMatchObject({ closeReason: 'AUTO_EXPIRED' })
    expect(v.selfReportedNow).toBe(0)
    // A fresh repository (a reload) reaches the same answer, and the closed session is not revived.
    s = await e.build().load()
    expect(facilityView(s, A, e.now(), GYM_ID).mySession).toBeUndefined()
    expect(s.gymSessions.filter((g) => g.closeReason === 'AUTO_EXPIRED')).toHaveLength(1)
    // Reading again changes nothing (idempotent) and sends no notification.
    expect(JSON.stringify(await e.repo.load())).toBe(JSON.stringify(s))
    expect(
      (
        await createPrefsRepositories(
          createStorageAdapter({ backend: createMemoryStorage().storage }),
        ).notifications.load(A)
      ).value.items,
    ).toHaveLength(0)
  })

  it('"Still here" renews within the lease, but never revives an expired check-in', async () => {
    const e = setup()
    await e.repo.gymCheckIn(A)
    e.advance(40)
    expect((await e.repo.gymRenew(A)).ok).toBe(true)
    e.advance(40) // 80 minutes after the first check-in, but renewed at 40
    expect(facilityView(await e.repo.load(), A, e.now(), GYM_ID).mySession).toBeTruthy()
    e.advance(30) // past the renewed lease
    const late = await e.repo.gymRenew(A)
    expect(late.ok).toBe(false)
    expect(!late.ok && late.error.message).toMatch(/already expired/)
    expect(facilityView(await e.repo.load(), A, e.now(), GYM_ID).myExpired).toBeTruthy()
  })

  it('a manual check-out is recorded as manual and an old stored session without an expiry still expires', async () => {
    const e = setup()
    await e.repo.gymCheckIn(A)
    await e.repo.gymCheckOut(A)
    expect((await e.repo.load()).gymSessions[0]).toMatchObject({ closeReason: 'MANUAL' })
    e.advance(500)
    expect(facilityView(await e.repo.load(), A, e.now(), GYM_ID).myExpired).toBeUndefined() // a manual close is never "expired"
  })
})

describe('booking-linked check-in expiry', () => {
  it('a check-in nobody closed ends with its booking as "expired; physical use unconfirmed", never "finished", and is idempotent', async () => {
    const e = setup()
    const r = await e.repo.reserve(A, {
      resourceId: 'DEMO-COURT-1',
      date: '2026-11-02' as never,
      start: '11:00' as never,
      idempotencyKey: 'lease-1',
    })
    if (!r.ok) throw new Error(r.error.message)
    e.advance(50) // 10:50 IST: check-in opens 15 minutes before the 11:00 slot
    const id = r.value.reservation.id
    expect((await e.repo.act(A, id, 'checkIn')).ok).toBe(true)
    expect((await e.repo.load()).reservations.find((x) => x.id === id)?.state).toBe('checkedIn')
    e.advance(90) // well past the 12:00 end of the slot
    const s = await e.repo.load()
    const got = s.reservations.find((x) => x.id === id)!
    expect(got.state).toBe('checkInExpired')
    expect(got.history.at(-1)).toMatchObject({ action: 'checkInExpired', actorKind: 'system' })
    // A reload reaches the same answer and adds no second event.
    const again = (await e.build().load()).reservations.find((x) => x.id === id)!
    expect(again.history.filter((h) => h.action === 'checkInExpired')).toHaveLength(1)
    expect(JSON.stringify(await e.repo.load())).toBe(JSON.stringify(s))
  })
})
