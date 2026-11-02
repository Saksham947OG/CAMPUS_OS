import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { LOAD_STAGES } from '@/domain/ess'
import { isParcelOverdue } from '@/domain/ess-logic'
import { fixedClock, isoFromMs, type Clock, type DateOnly } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import {
  expectedReturnText,
  feeView,
  messOccupancy,
  ownLoads,
  ownParcels,
  parcelView,
  slotViews,
  visitText,
} from '@/selectors/ess'
import { createEssRepository, ESS_STORE_KEY } from './ess-repository'

const NOW = '2026-11-02T04:30:00Z' // Monday 10:00 IST
const TODAY = '2026-11-02' as DateOnly
const A = 'demo-student-a'
const B = 'demo-student-b'

function setup(nowIso = NOW) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  let iso = nowIso
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createEssRepository({
      storage,
      clock,
      newId: (p) => `${p}-t${++n}`,
      notifications: prefs.notifications,
      profileIds: [A, B],
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
    nowMs: () => Temporal.Instant.from(iso).epochMilliseconds,
    setNow: (v: string) => (iso = v),
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}
type Env = ReturnType<typeof setup>

const register = async (env: Env, profile = A, key = 'k1', extra = {}) =>
  (await env.ok(
    env.repo.registerLoad({
      profileId: profile,
      handedOverDate: TODAY,
      idempotencyKey: key,
      ...extra,
    }),
  )) as {
    load: { id: string }
    created: boolean
  }

const reserve = (
  env: Env,
  profile: string,
  machine: string,
  start: string,
  key: string,
  date: DateOnly = TODAY,
) => env.repo.reserve(profile, machine, date, start, key)

describe('storage discipline', () => {
  it('ESS-S02: reading or checking for due messages never writes, and a reload keeps the data', async () => {
    const env = setup()
    await env.repo.load()
    await env.repo.checkDue()
    expect(env.memory.data.has(ESS_STORE_KEY)).toBe(false)
    await register(env)
    const again = env.build()
    expect(ownLoads(await again.load(), A)).toHaveLength(1)
    expect(ownLoads(await again.load(), B)).toHaveLength(0)
  })
})

describe('SS Laundry (ESS-L01 … ESS-L06)', () => {
  it('ESS-L01: a registration is student-reported and idempotent, and says nothing about receipt', async () => {
    const env = setup()
    const a = await register(env)
    const b = await register(env) // same key again
    expect(a.created).toBe(true)
    expect(b.created).toBe(false)
    const store = await env.repo.load()
    expect(store.loads).toHaveLength(1)
    const l = store.loads[0]!
    expect(l.stage).toBe('registered')
    expect(l.provenance.dataMode).toBe('userCreated')
    expect(l.history[0]!.actorKind).toBe('student')
    expect(l.expectedReturnConfidence).toBe('unknown')
    expect(expectedReturnText(l)).toMatch(/Awaiting confirmation/)
  })

  it('ESS-L01: the student can edit only while registered, and can withdraw only before receipt', async () => {
    const env = setup()
    const { load } = await register(env)
    await env.ok(env.repo.editLoad(A, load.id, { notes: 'two bags' }))
    expect((await env.repo.editLoad(B, load.id, { notes: 'x' })).ok).toBe(false)
    await env.ok(env.repo.advanceLoad(load.id, 'received'))
    expect((await env.repo.editLoad(A, load.id, { notes: 'late' })).ok).toBe(false)
    expect((await env.repo.withdrawLoad(A, load.id)).ok).toBe(false)
  })

  it('ESS-L02: a provider visit and its arrival never change an individual load', async () => {
    const env = setup()
    const { load } = await register(env)
    const before = (await env.repo.load()).loads[0]!
    await env.ok(env.repo.announceVisit({ status: 'confirmed', date: '2026-11-03' as DateOnly }))
    await env.ok(env.repo.recordVisitArrival())
    const after = (await env.repo.load()).loads.find((l) => l.id === load.id)!
    expect(after).toEqual(before)
    const visit = (await env.repo.load()).visit!
    expect(visit.arrivedAt).toBeDefined()
    expect(visitText(visit).detail.join(' ')).toMatch(
      /does not mean any individual load was returned/,
    )
  })

  it('ESS-L02: with no visit supplied nothing is invented', () => {
    expect(visitText(null).headline).toBe('No visit has been reported')
  })

  it('ESS-L03: only the next stage is permitted, every step is an audited simulated transition, and collected is final', async () => {
    const env = setup()
    const { load } = await register(env)
    expect((await env.repo.advanceLoad(load.id, 'processing')).ok).toBe(false) // skipping receipt
    for (const stage of LOAD_STAGES.slice(1)) await env.ok(env.repo.advanceLoad(load.id, stage))
    const l = (await env.repo.load()).loads[0]!
    expect(l.stage).toBe('collected')
    expect(l.version).toBe(6)
    expect(l.history.map((h) => h.action)).toEqual(['registered', ...LOAD_STAGES.slice(1)])
    expect(
      l.history
        .slice(1)
        .every((h) => h.actorKind === 'demoSimulator' && h.dataMode === 'simulated'),
    ).toBe(true)
    expect((await env.repo.advanceLoad(load.id, 'collected')).ok).toBe(false)
  })

  it('ESS-L04: a delay with no date says unknown; a supplied date keeps its stated confidence and never changes the stage', async () => {
    const env = setup()
    const { load } = await register(env)
    await env.ok(env.repo.advanceLoad(load.id, 'received'))
    await env.ok(env.repo.setLoadDelay(load.id, true))
    let l = (await env.repo.load()).loads[0]!
    expect(l.delayFlag).toBe(true)
    expect(l.expectedReturnDate).toBeUndefined()
    expect(expectedReturnText(l)).toBe('New date unknown. Awaiting confirmation.')
    await env.ok(env.repo.scheduleLoadReturn(load.id, '2026-11-06' as DateOnly, 'tentative'))
    l = (await env.repo.load()).loads[0]!
    expect(expectedReturnText(l)).toMatch(/tentative/)
    expect(l.expectedReturnConfidence).toBe('tentative')
    expect(l.stage).toBe('received') // an expectation is not proof of movement
  })

  it('ESS-L05: a partial return flags a discrepancy and the load is not closed as fully collected', async () => {
    const env = setup()
    const { load } = await register(env)
    for (const s of LOAD_STAGES.slice(1, 4)) await env.ok(env.repo.advanceLoad(load.id, s))
    await env.ok(env.repo.setLoadDiscrepancy(load.id, true, 'Only 3 of 5 items returned'))
    let l = (await env.repo.load()).loads[0]!
    expect(l.discrepancyFlag).toBe(true)
    expect(l.underReview).toBe(true)
    expect(l.stage).toBe('returnedToCampus')
    await env.ok(env.repo.advanceLoad(load.id, 'readyForCollection'))
    l = (await env.repo.load()).loads[0]!
    expect(l.discrepancyFlag).toBe(true) // still open after the next stage
    await env.ok(env.repo.setLoadDiscrepancy(load.id, false))
    expect((await env.repo.load()).loads[0]!.discrepancyFlag).toBe(false)
  })

  it('ESS-L06 / ESS-S03: ready creates exactly one notification, to the owner only, linking to the load', async () => {
    const env = setup()
    const { load } = await register(env)
    for (const s of LOAD_STAGES.slice(1, 5)) await env.ok(env.repo.advanceLoad(load.id, s))
    const ready = (await env.notes(A)).filter((n) => n.title.startsWith('Your laundry is ready'))
    expect(ready).toHaveLength(1)
    expect(ready[0]!.href).toBe(`/services/laundry/ss/${load.id}`)
    expect(ready[0]!.kind).toBe('service')
    expect((await env.notes(B)).filter((n) => n.title.includes('laundry'))).toHaveLength(0)
    expect((await env.repo.advanceLoad(load.id, 'readyForCollection')).ok).toBe(false)
    expect(
      (await env.notes(A)).filter((n) => n.title.startsWith('Your laundry is ready')),
    ).toHaveLength(1)
  })

  it('a student collection report is self-reported until a simulated handover', async () => {
    const env = setup()
    const { load } = await register(env)
    expect((await env.repo.reportLoadCollected(A, load.id)).ok).toBe(false) // not back yet
    for (const s of LOAD_STAGES.slice(1, 5)) await env.ok(env.repo.advanceLoad(load.id, s))
    await env.ok(env.repo.reportLoadCollected(A, load.id))
    const l = (await env.repo.load()).loads[0]!
    expect(l.studentReportedCollected).toBe(true)
    expect(l.stage).toBe('readyForCollection')
  })

  it('visit announcements reach every profile once each', async () => {
    const env = setup()
    await env.ok(env.repo.announceVisit({ status: 'tentative', date: '2026-11-04' as DateOnly }))
    for (const p of [A, B])
      expect((await env.notes(p)).filter((n) => n.title.includes('visit'))).toHaveLength(1)
  })
})

describe('Machines (ESS-L07 … ESS-L10)', () => {
  it('ESS-L07: conflicting slots are rejected, other machines and times are free, and each student holds one booking', async () => {
    const env = setup()
    const first = await env.ok(reserve(env, A, 'machine-1', '12:00', 'r1'))
    expect(first).toMatchObject({ created: true })
    const clash = await reserve(env, B, 'machine-1', '12:00', 'r2')
    expect(clash.ok).toBe(false)
    expect(!clash.ok && clash.error.message).toMatch(/already reserved/)
    expect((await reserve(env, B, 'machine-2', '12:00', 'r3')).ok).toBe(true)
    const limit = await reserve(env, A, 'machine-1', '14:00', 'r4')
    expect(!limit.ok && limit.error.message).toMatch(/upcoming machine booking/)
    expect(
      slotViews(await env.repo.load(), 'machine-1', TODAY, B, env.nowMs()).find(
        (s) => s.start === '12:00',
      ),
    ).toMatchObject({ state: 'reserved', mine: false })
  })

  it('a double submit with one key creates one reservation', async () => {
    const env = setup()
    await env.ok(reserve(env, A, 'machine-1', '12:00', 'same'))
    const again = await env.ok(reserve(env, A, 'machine-1', '12:00', 'same'))
    expect(again).toMatchObject({ created: false })
    expect((await env.repo.load()).reservations).toHaveLength(1)
  })

  it('refuses out-of-service and unknown-status machines, past slots, and dates beyond the horizon', async () => {
    const env = setup()
    expect((await reserve(env, A, 'machine-3', '12:00', 'a')).ok).toBe(false) // out of service
    expect((await reserve(env, A, 'machine-4', '12:00', 'b')).ok).toBe(false) // unknown
    expect((await reserve(env, A, 'machine-1', '08:00', 'c')).ok).toBe(false) // already past at 10:00
    expect((await reserve(env, A, 'machine-1', '12:00', 'd', '2026-12-31' as DateOnly)).ok).toBe(
      false,
    )
    expect((await reserve(env, A, 'machine-1', '12:30', 'e')).ok).toBe(false) // not a slot
  })

  it('an outage warns on existing reservations without cancelling or altering them', async () => {
    const env = setup()
    const { reservation } = await env.ok(reserve(env, A, 'machine-1', '12:00', 'r1'))
    await env.ok(env.repo.setMachineStatus('machine-1', { operationalStatus: 'outOfService' }))
    const store = await env.repo.load()
    expect(store.reservations[0]!.state).toBe('reserved')
    expect((await reserve(env, B, 'machine-1', '15:00', 'r2')).ok).toBe(false) // new bookings stop
    expect((await env.notes(A)).some((n) => n.title.startsWith('Machine out of service'))).toBe(
      true,
    )
    expect(reservation.id).toBeTruthy()
  })

  it('ESS-L08: a no-show needs the grace period to pass, releases the slot, and does not change physical status', async () => {
    const env = setup()
    const { reservation } = await env.ok(reserve(env, A, 'machine-2', '10:00', 'r1')) // starts 10:00, "now" is 10:00
    const early = await env.repo.simulateReservation(reservation.id, 'noShow')
    expect(early.ok).toBe(false) // grace period of 10 minutes not over
    env.setNow('2026-11-02T04:45:00Z') // 10:15 IST
    await env.ok(env.repo.simulateReservation(reservation.id, 'noShow'))
    const store = await env.repo.load()
    expect(store.reservations[0]!.state).toBe('noShow')
    expect(store.machines.find((m) => m.id === 'machine-2')!.physicalStatus).toBe('occupied') // untouched
    // the slot window is gone for that hour, but the released booking no longer blocks a new one
    const refs = env.repo.bookingRefs(A)
    expect(refs[0]!.status).toBe('cancelled')
  })

  it('ESS-L09: a cycle estimate is announced once as an estimate and never marks the reservation completed', async () => {
    const env = setup()
    const { reservation } = await env.ok(reserve(env, A, 'machine-1', '10:00', 'r1'))
    await env.ok(env.repo.reservationAction(A, reservation.id, 'checkIn'))
    await env.ok(env.repo.reservationAction(A, reservation.id, 'startCycle'))
    expect(await env.repo.checkDue()).toBe(0) // estimate not reached
    env.setNow('2026-11-02T05:30:00Z') // 60 minutes later; sample cycle is 45
    expect(await env.repo.checkDue()).toBe(1)
    expect(await env.repo.checkDue()).toBe(0) // once only
    const r = (await env.repo.load()).reservations[0]!
    expect(r.state).toBe('used')
    const msgs = (await env.notes(A)).filter((n) => n.title.startsWith('Estimated finish'))
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.body).toMatch(/not confirmation/)
  })

  it('reservation actions follow the state machine and belong to the owner', async () => {
    const env = setup()
    const { reservation } = await env.ok(reserve(env, A, 'machine-1', '12:00', 'r1'))
    expect((await env.repo.reservationAction(B, reservation.id, 'cancel')).ok).toBe(false)
    expect((await env.repo.reservationAction(A, reservation.id, 'startCycle')).ok).toBe(false) // must check in first
    await env.ok(env.repo.reservationAction(A, reservation.id, 'cancel'))
    expect((await env.repo.reservationAction(A, reservation.id, 'checkIn')).ok).toBe(false)
  })

  it('ESS-L10: a reservation reaches the shared booking projection once, and cancelling updates the same record', async () => {
    const env = setup()
    const { reservation } = await env.ok(reserve(env, A, 'machine-1', '12:00', 'r1'))
    let refs = env.repo.bookingRefs(A)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      id: reservation.id,
      status: 'active',
      manageRoute: '/services/laundry/machines',
    })
    expect(env.repo.bookingRefs(B)).toEqual([])
    await env.ok(env.repo.reservationAction(A, reservation.id, 'cancel'))
    refs = env.repo.bookingRefs(A)
    expect(refs).toHaveLength(1)
    expect(refs[0]!.status).toBe('cancelled')
  })
})

describe('Mess (ESS-M04 … ESS-M07)', () => {
  it('ESS-M04: check-in needs opt-in, is idempotent, and a second check-out is rejected helpfully', async () => {
    const env = setup()
    expect((await env.repo.messCheckIn(A)).ok).toBe(false)
    await env.ok(env.repo.setMessOptIn(A, true))
    expect(await env.ok(env.repo.messCheckIn(A))).toEqual({ created: true })
    expect(await env.ok(env.repo.messCheckIn(A))).toEqual({ created: false })
    expect((await env.repo.load()).messSessions).toHaveLength(1)
    await env.ok(env.repo.messCheckOut(A))
    const again = await env.repo.messCheckOut(A)
    expect(!again.ok && again.error.message).toMatch(/not checked in/)
  })

  it('ESS-M04 / ESS-M05: occupancy is a labelled self-reported sample, stale sessions are set aside, and no percentage or seat count appears', async () => {
    const env = setup()
    expect(messOccupancy(await env.repo.load(), env.nowMs()).text).toMatch(/No one has joined/)
    await env.ok(env.repo.setMessOptIn(A, true))
    await env.ok(env.repo.setMessOptIn(B, true))
    await env.ok(env.repo.messCheckIn(A))
    env.setNow('2026-11-02T07:00:00Z') // 150 minutes later: A's session is stale
    await env.ok(env.repo.messCheckIn(B))
    const occ = messOccupancy(await env.repo.load(), env.nowMs())
    expect(occ.selfReportedNow).toBe(1)
    expect(occ.staleForReview).toBe(1)
    expect(occ.text).not.toMatch(/%|percent|free seat|seats free|available seat/i)
    expect(`${occ.text} ${occ.caveat}`).not.toMatch(/\d\s*%/)
    expect(occ.text).toMatch(/self-report/i)
    expect(occ.caveat).toMatch(/capacity is unknown/i)
    expect(occ.caveat).toMatch(/Not actual occupied seats/)
  })

  it('ESS-M06: with no fee supplied there is no amount, no link and an unknown status', async () => {
    const env = setup()
    const v = feeView(await env.repo.load(), A)
    expect(v).toMatchObject({ supplied: false, amountText: null, formUrl: null, status: 'unknown' })
  })

  it('ESS-M06: only what was typed is shown, and a link must be https', async () => {
    const env = setup()
    await env.ok(
      env.repo.supplyFee({ currency: 'INR', dueDate: '2026-11-10' as DateOnly } as never),
    )
    const v = feeView(await env.repo.load(), A)
    expect(v).toMatchObject({
      supplied: true,
      amountText: null,
      formUrl: null,
      status: 'notSubmitted',
    })
    expect(
      (await env.repo.supplyFee({ authorizedFormUrl: 'http://example.test/pay' } as never)).ok,
    ).toBe(false)
    expect(
      (await env.repo.supplyFee({ authorizedFormUrl: 'javascript:alert(1)' } as never)).ok,
    ).toBe(false)
    await env.ok(env.repo.supplyFee({ authorizedFormUrl: 'https://example.test/form' } as never))
    expect(feeView(await env.repo.load(), A).formUrl).toBe('https://example.test/form')
  })

  it('ESS-M07: reporting a submission is self-reported and never verified-paid; supplying a new fee resets it', async () => {
    const env = setup()
    expect((await env.repo.reportFeeSubmitted(A, true)).ok).toBe(false) // no fee yet
    await env.ok(env.repo.supplyFee({ amountMinor: 250000 } as never))
    await env.ok(env.repo.reportFeeSubmitted(A, true))
    expect(feeView(await env.repo.load(), A)).toMatchObject({ status: 'studentReportedSubmitted' })
    expect(feeView(await env.repo.load(), B).status).toBe('notSubmitted')
    expect(feeView(await env.repo.load(), A).statusLabel).toMatch(/not a receipt/)
    await env.ok(env.repo.supplyFee({ amountMinor: 300000 } as never))
    expect(feeView(await env.repo.load(), A).status).toBe('notSubmitted')
  })

  it('feedback is stored for the posting profile and validated', async () => {
    const env = setup()
    expect((await env.repo.addMessFeedback(A, 'm1', 9)).ok).toBe(false)
    await env.ok(env.repo.addMessFeedback(A, 'm1', 4, 'fine'))
    expect((await env.repo.load()).messFeedback).toHaveLength(1)
  })
})

describe('Parcels (ESS-P01 … ESS-P06)', () => {
  it('ESS-P01 / ESS-P02: a logged parcel is visible to its recipient only, with one notification linking to it', async () => {
    const env = setup()
    const p = await env.ok(
      env.repo.logParcel({
        recipientProfileId: A,
        courier: 'Sample Courier',
        collectionPoint: 'Sample desk',
      }),
    )
    const store = await env.repo.load()
    expect(ownParcels(store, A)).toHaveLength(1)
    expect(ownParcels(store, B)).toHaveLength(0)
    const a = (await env.notes(A)).filter((n) => n.title.startsWith('Parcel logged'))
    expect(a).toHaveLength(1)
    expect(a[0]!.href).toBe(`/services/parcels/${p.id}`)
    expect(await env.notes(B)).toHaveLength(0)
  })

  it('ESS-P03: an unknown collection point is labelled unknown', async () => {
    const env = setup()
    const p = await env.ok(env.repo.logParcel({ recipientProfileId: A }))
    const store = await env.repo.load()
    expect(
      parcelView(
        store.parcels.find((x) => x.id === p.id)!,
        store,
        env.nowMs(),
      ).where,
    ).toMatch(/unknown/i)
    expect((await env.notes(A))[0]!.body).toMatch(/unknown/i)
  })

  it('refuses a full tracking number', async () => {
    const env = setup()
    expect(
      (await env.repo.logParcel({ recipientProfileId: A, referenceSuffix: '1234567890123' })).ok,
    ).toBe(false)
  })

  it('ESS-P04: an old parcel earns one derived reminder and its status stays "logged"', async () => {
    const env = setup()
    const old = isoFromMs(env.nowMs() - 96 * 3_600_000)
    const p = await env.ok(env.repo.logParcel({ recipientProfileId: A, loggedAt: old }))
    const fresh = await env.ok(env.repo.logParcel({ recipientProfileId: A }))
    let store = await env.repo.load()
    expect(
      isParcelOverdue(
        store.parcels.find((x) => x.id === p.id)!,
        store.rules,
        env.nowMs(),
      ),
    ).toBe(true)
    expect(
      isParcelOverdue(
        store.parcels.find((x) => x.id === fresh.id)!,
        store.rules,
        env.nowMs(),
      ),
    ).toBe(false)
    expect(await env.repo.checkDue()).toBe(1)
    expect(await env.repo.checkDue()).toBe(0)
    store = await env.repo.load()
    expect(store.parcels.find((x) => x.id === p.id)!.state).toBe('logged')
    expect(
      (await env.notes(A)).filter((n) => n.title.startsWith('Parcel still uncollected')),
    ).toHaveLength(1)
    expect(
      parcelView(
        store.parcels.find((x) => x.id === p.id)!,
        store,
        env.nowMs(),
      ).overdue,
    ).toBe(true)
  })

  it('ESS-P05: only the simulator marks a parcel collected, history is kept, and a student report changes nothing', async () => {
    const env = setup()
    const p = await env.ok(env.repo.logParcel({ recipientProfileId: A }))
    await env.ok(env.repo.reportParcelIssue(A, p.id, 'Box looks damaged'))
    expect((await env.repo.reportParcelIssue(B, p.id, 'not mine')).ok).toBe(false)
    expect((await env.repo.reportParcelIssue(A, p.id, '   ')).ok).toBe(false)
    let parcel = (await env.repo.load()).parcels[0]!
    expect(parcel.state).toBe('logged')
    await env.ok(env.repo.recordParcelCollected(p.id))
    parcel = (await env.repo.load()).parcels[0]!
    expect(parcel.state).toBe('collected')
    expect(parcel.history.map((h) => h.action)).toEqual(['logged', 'issueReported', 'collected'])
    expect(parcel.history.map((h) => h.actorKind)).toEqual([
      'demoSimulator',
      'student',
      'demoSimulator',
    ])
    expect((await env.repo.recordParcelCollected(p.id)).ok).toBe(false)
    expect((await env.repo.markParcelException(p.id, 'x')).ok).toBe(false)
    expect(
      (await env.notes(A)).filter((n) => n.title.startsWith('Parcel collection recorded')),
    ).toHaveLength(1)
  })

  it('an exception is recorded with its note and notifies the recipient as important', async () => {
    const env = setup()
    const p = await env.ok(env.repo.logParcel({ recipientProfileId: A }))
    await env.ok(env.repo.markParcelException(p.id, 'Addressed to someone else'))
    const parcel = (await env.repo.load()).parcels[0]!
    expect(parcel.state).toBe('exception')
    expect(
      (await env.notes(A)).find((n) => n.title.startsWith('Parcel needs attention'))!.significance,
    ).toBe('important')
  })
})

describe('Reset scope (ESS-S04)', () => {
  it('resetting Essentials removes only Essentials records and then rebuilds the starting scenario', async () => {
    const env = setup()
    env.memory.data.set('campusos:chill:v1', 'chill-data')
    env.memory.data.set('campusos:domain:v1:demo-student-a', 'calendar-data')
    await register(env)
    await env.ok(env.repo.logParcel({ recipientProfileId: A }))
    expect(env.memory.data.has(ESS_STORE_KEY)).toBe(true)
    await env.ok(env.repo.resetScenario())
    expect(env.memory.data.has(ESS_STORE_KEY)).toBe(false)
    expect(env.memory.data.get('campusos:chill:v1')).toBe('chill-data')
    expect(env.memory.data.get('campusos:domain:v1:demo-student-a')).toBe('calendar-data')
    const fresh = await env.repo.load()
    expect(fresh.loads).toEqual([])
    expect(fresh.machines.length).toBeGreaterThan(0)
  })
})

describe('storage failure', () => {
  it('a failed save reports the failure and leaves the previous state in place', async () => {
    const memory = createMemoryStorage()
    let failing = false
    const backend: Storage = {
      ...memory.storage,
      setItem: (k: string, v: string) => {
        if (failing && k === ESS_STORE_KEY) throw new DOMException('full', 'QuotaExceededError')
        memory.storage.setItem(k, v)
      },
    } as Storage
    const storage = createStorageAdapter({ backend })
    const prefs = createPrefsRepositories(storage)
    let n = 0
    const repo = createEssRepository({
      storage,
      clock: fixedClock(NOW),
      newId: (p) => `${p}-${++n}`,
      notifications: prefs.notifications,
      profileIds: [A],
    })
    await repo.registerLoad({ profileId: A, handedOverDate: TODAY, idempotencyKey: 'a' })
    failing = true
    const r = await repo.registerLoad({ profileId: A, handedOverDate: TODAY, idempotencyKey: 'b' })
    expect(r).toMatchObject({ ok: false, error: { code: 'storage' } })
    failing = false
    expect(ownLoads(await repo.load(), A)).toHaveLength(1)
  })
})
