import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { slotStatus } from '@/domain/classrooms-logic'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { createClassroomRepository } from './classroom-repository'

const NOW = '2026-11-02T04:30:00Z' // Monday 2 Nov 2026, 10:00 IST
const A = 'demo-student-a'
const B = 'demo-student-b'
const D = (s: string) => s as DateOnly
const T = (s: string) => s as LocalTime
const MON = D('2026-11-02')
const TUE = D('2026-11-03')
const base = { purpose: 'Study group' as const }

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const clock: Clock = { now: () => Temporal.Instant.from(NOW) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const repo = createClassroomRepository({
    storage,
    clock,
    newId: (p) => `${p}-t${++n}`,
    notifications: prefs.notifications,
  })
  const ok = async <T>(p: Promise<{ ok: boolean; value?: T; error?: { message: string } }>) => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as T
  }
  const bad = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => {
    const r = await p
    expect(r.ok).toBe(false)
    return r.error?.message ?? ''
  }
  let k = 0
  const book = (
    profile: string,
    roomId: string,
    date: DateOnly,
    start: string,
    end: string,
    extra: object = {},
  ) =>
    repo.reserve(
      profile,
      { roomId, date, start: T(start), end: T(end), ...base, ...extra },
      `key-${++k}`,
    )
  return {
    repo,
    storage,
    prefs,
    ok,
    bad,
    book,
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}

describe('classroom reservations', () => {
  it('confirms a free slot in an instant room at once, and shows it once on the Calendar and Home source', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string; state: string } }>(
      e.book(A, 'CR1', MON, '14:00', '15:00'),
    )
    expect(r.reservation.state).toBe('confirmedDemo')
    const refs = e.repo.bookingRefs(A)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      id: r.reservation.id,
      resource: 'CR1 (local reservation)',
      manageRoute: `/bookings/classrooms/bookings/${r.reservation.id}`,
    })
    expect(e.repo.bookingRefs(B)).toHaveLength(0)
  })

  it('rejects the same interval and a partial overlap, but allows back-to-back slots', async () => {
    const e = setup()
    await e.ok(e.book(A, 'CR1', MON, '14:00', '15:00'))
    expect(await e.bad(e.book(B, 'CR1', MON, '14:00', '15:00'))).toMatch(/overlaps/)
    expect(await e.bad(e.book(B, 'CR1', MON, '14:30', '15:30'))).toMatch(/overlaps/)
    await e.ok(e.book(B, 'CR1', MON, '15:00', '16:00')) // half-open: 15:00 does not collide with an end of 15:00
    await e.ok(e.book(B, 'CR1', MON, '13:00', '14:00'))
  })

  it('treats a mapped class as a blocker, and does not block an unmapped time', async () => {
    const e = setup()
    expect(await e.bad(e.book(A, 'CR1', MON, '10:00', '11:00'))).toMatch(/overlaps/)
    await e.ok(e.book(A, 'CR1', MON, '12:00', '13:00'))
    const s = await e.repo.load()
    expect(slotStatus(s, 'CR1', { date: MON, start: T('09:00'), end: T('10:00') }, A)).toEqual({
      kind: 'blocked',
      label: 'Scheduled class (local)',
      until: '11:00',
    })
    expect(slotStatus(s, 'CR3', { date: MON, start: T('10:00'), end: T('11:00') }, A).kind).toBe(
      'available',
    )
  })

  it('never calls an uncovered time free: G12 in the afternoon is UNKNOWN and only a verification request is allowed', async () => {
    const e = setup()
    const s = await e.repo.load()
    expect(slotStatus(s, 'G12', { date: MON, start: T('15:00'), end: T('16:00') }, A).kind).toBe(
      'unknown',
    )
    expect(await e.bad(e.book(A, 'G12', MON, '15:00', '16:00'))).toMatch(/does not cover that time/)
    const r = await e.ok<{
      reservation: { state: string; needsVerification?: boolean; id: string }
    }>(e.book(A, 'G12', MON, '15:00', '16:00', { asVerificationRequest: true }))
    expect(r.reservation).toMatchObject({ state: 'pendingApproval', needsVerification: true })
    expect(e.repo.bookingRefs(A)).toHaveLength(0) // a request is not on the Calendar
  })

  it('keeps another student’s booking as a bare busy interval', async () => {
    const e = setup()
    await e.ok(
      e.book(B, 'CR3', MON, '14:00', '15:00', { groupName: 'Secret group', notes: 'private' }),
    )
    const s = await e.repo.load()
    const asA = slotStatus(s, 'CR3', { date: MON, start: T('14:00'), end: T('15:00') }, A)
    expect(asA).toEqual({ kind: 'booked', until: '15:00', mine: false })
    expect(JSON.stringify(asA)).not.toMatch(/Secret|private|demo-student-b/)
  })

  it('enforces the per-student limit, the horizon and past times', async () => {
    const e = setup()
    await e.ok(e.book(A, 'CR1', MON, '14:00', '15:00'))
    await e.ok(e.book(A, 'CR3', MON, '14:00', '15:00'))
    expect(await e.bad(e.book(A, 'CR1', MON, '16:00', '17:00'))).toMatch(/most reservations/)
    expect(await e.bad(e.book(B, 'CR1', D('2026-12-30'), '14:00', '15:00'))).toMatch(
      /further ahead/,
    )
    expect(await e.bad(e.book(B, 'CR1', MON, '08:00', '09:00'))).toMatch(/already passed/)
    expect(await e.bad(e.book(B, 'CR1', MON, '16:00', '15:00'))).toMatch(/end must be after/)
  })

  it('repeats of the same submission create one booking', async () => {
    const e = setup()
    const input = { roomId: 'CR1', date: MON, start: T('14:00'), end: T('15:00'), ...base }
    const first = await e.ok<{ reservation: { id: string }; created: boolean }>(
      e.repo.reserve(A, input, 'same'),
    )
    const again = await e.ok<{ reservation: { id: string }; created: boolean }>(
      e.repo.reserve(A, input, 'same'),
    )
    expect(again.created).toBe(false)
    expect(again.reservation.id).toBe(first.reservation.id)
    expect((await e.repo.load()).reservations).toHaveLength(1)
  })

  it('an approval room makes a request that holds nothing until a reviewer approves it, and rechecks at approval time', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string; state: string } }>(
      e.book(A, 'CR_CONFERENCE_HALL', TUE, '14:00', '15:00'),
    )
    expect(r.reservation.state).toBe('pendingApproval')
    // A pending request does not block someone else's request for the same time.
    await e.ok(e.book(B, 'CR_CONFERENCE_HALL', TUE, '14:00', '15:00'))
    await e.ok(
      e.repo.injectOtherBooking('CR_CONFERENCE_HALL', {
        date: TUE,
        start: T('14:00'),
        end: T('15:00'),
      }),
    )
    expect(await e.bad(e.repo.decide(r.reservation.id, 'approve'))).toMatch(/now holds that time/)
    expect(await e.bad(e.repo.decide(r.reservation.id, 'reject'))).toMatch(/reason is required/)
    await e.ok(e.repo.decide(r.reservation.id, 'reject', 'Room in use'))
    expect((await e.notes(A)).some((n) => /not approved/i.test(n.title))).toBe(true)
  })

  it('approves a waiting request when the slot is still free, and then it holds the room', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string } }>(
      e.book(A, 'CR_CONFERENCE_HALL', TUE, '10:00', '11:00'),
    )
    await e.ok(e.repo.decide(r.reservation.id, 'approve'))
    expect(e.repo.bookingRefs(A)).toHaveLength(1)
    expect(await e.bad(e.book(B, 'CR_CONFERENCE_HALL', TUE, '10:00', '11:00'))).toMatch(/overlaps/)
    expect(await e.bad(e.repo.decide(r.reservation.id, 'approve'))).toMatch(
      /Only a waiting request/,
    )
  })

  it('cancelling frees the recorded slot and tells only the owner', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string } }>(e.book(A, 'CR1', MON, '14:00', '15:00'))
    expect(await e.bad(e.repo.cancel(B, r.reservation.id))).toMatch(/not found/)
    await e.ok(e.repo.cancel(A, r.reservation.id))
    await e.ok(e.book(B, 'CR1', MON, '14:00', '15:00'))
    expect(e.repo.bookingRefs(A)[0]!.status).toBe('cancelled')
    expect(
      (await e.notes(A)).some(
        (n) => /cancelled/i.test(n.title) && /does not mean anyone checked/.test(n.body),
      ),
    ).toBe(true)
    expect(await e.bad(e.repo.cancel(A, r.reservation.id))).toMatch(/already finished/)
  })

  it('a move is atomic: a failed move leaves the original untouched, a good one frees the old slot', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string } }>(e.book(A, 'CR1', MON, '14:00', '15:00'))
    await e.ok(e.book(B, 'CR3', MON, '16:00', '17:00'))
    expect(
      await e.bad(
        e.repo.reschedule(A, r.reservation.id, {
          roomId: 'CR3',
          date: MON,
          start: T('16:00'),
          end: T('17:00'),
        }),
      ),
    ).toMatch(/overlaps/)
    let s = await e.repo.load()
    expect(s.reservations.find((x) => x.id === r.reservation.id)).toMatchObject({
      roomId: 'CR1',
      start: '14:00',
      state: 'confirmedDemo',
      version: 1,
    })
    await e.ok(
      e.repo.reschedule(A, r.reservation.id, {
        roomId: 'CR3',
        date: MON,
        start: T('17:00'),
        end: T('18:00'),
      }),
    )
    s = await e.repo.load()
    expect(s.reservations.find((x) => x.id === r.reservation.id)).toMatchObject({
      roomId: 'CR3',
      start: '17:00',
      version: 2,
    })
    await e.ok(e.book(B, 'CR1', MON, '14:00', '15:00')) // the old slot is free again
    // Moving onto its own old time is not a conflict with itself.
    await e.ok(
      e.repo.reschedule(A, r.reservation.id, {
        roomId: 'CR3',
        date: MON,
        start: T('17:00'),
        end: T('18:00'),
      }),
    )
  })

  it('a closure disrupts overlapping bookings, tells their owners, and blocks new ones', async () => {
    const e = setup()
    const r = await e.ok<{ reservation: { id: string } }>(e.book(A, 'CR1', MON, '14:00', '15:00'))
    const out = await e.ok<{ disrupted: number }>(
      e.repo.closeRoom('CR1', { date: MON, start: T('13:30'), end: T('14:30') }, 'Closed'),
    )
    expect(out.disrupted).toBe(1)
    expect((await e.repo.load()).reservations.find((x) => x.id === r.reservation.id)!.state).toBe(
      'disrupted',
    )
    expect(e.repo.bookingRefs(A)[0]!.resource).toMatch(/may be affected/)
    expect(await e.bad(e.book(B, 'CR1', MON, '13:30', '14:30'))).toMatch(/overlaps/)
    expect((await e.notes(A)).some((n) => n.significance === 'important')).toBe(true)
    expect(await e.notes(B)).toHaveLength(0)
  })

  it('the starting scenario names exactly the four rooms and states no capacity or equipment', async () => {
    const e = setup()
    const s = await e.repo.load()
    expect(s.rooms.map((r) => r.displayName)).toEqual(['CR Conference Hall', 'CR1', 'CR3', 'G12'])
    expect(s.rooms.every((r) => r.capacity === undefined && r.features === undefined)).toBe(true)
    expect(JSON.stringify(s.rooms)).toMatch(/Demonstration/)
    await e.repo.resetAll()
    expect((await e.repo.load()).reservations).toHaveLength(0)
  })
})
