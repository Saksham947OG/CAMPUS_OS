import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import {
  checkAttachment,
  checkLeaveInput,
  describeAttachment,
  STALE,
  type LeaveInput,
  type TicketInput,
} from '@/domain/admin-logic'
import { CATEGORIES, leaveStatusLabel, ticketStatusLabel } from '@/domain/admin'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { createMemoryStorage } from '@/test/memory-storage'
import { ADMIN_STORE_KEY, createAdminRepository } from './admin-repository'

const NOW = '2026-11-02T04:30:00Z' // Monday 10:00 IST
const A = 'demo-student-a'
const B = 'demo-student-b'
const d = (v: string) => v as DateOnly
const t = (v: string) => v as LocalTime

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const iso = NOW
  const clock: Clock = { now: () => Temporal.Instant.from(iso) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createAdminRepository({
      storage,
      clock,
      newId: (p) => `${p}-t${++n}`,
      notifications: prefs.notifications,
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
type Env = ReturnType<typeof setup>

const leaveInput = (extra: Partial<LeaveInput> = {}): LeaveInput => ({
  leaveType: 'personal',
  startDate: d('2026-11-05'),
  startTime: t('09:00'),
  endTime: t('17:00'),
  reason: 'Family visit',
  ...extra,
})
let k = 0
const sendLeave = async (env: Env, profile = A, extra: Partial<LeaveInput> = {}) =>
  (await env.ok(env.repo.submitLeave(profile, leaveInput(extra), `k${++k}`))).leave
const approverAct = (
  env: Env,
  id: string,
  action: Parameters<Env['repo']['leaveAct']>[1],
  opts: Parameters<Env['repo']['leaveAct']>[3] = {},
) => env.repo.leaveAct(id, action, 'demoApprover', opts)
const gateAct = (env: Env, id: string, action: 'logDeparture' | 'logReturn') =>
  env.repo.leaveAct(id, action, 'demoGate')

describe('storage discipline (AD-AT-32, AD-AT-40)', () => {
  it('AD-AT-32: reading never writes, and a reload rebuilds status and audit trail from storage', async () => {
    const env = setup()
    await env.repo.load()
    expect(env.memory.data.has(ADMIN_STORE_KEY)).toBe(false)
    const leave = await sendLeave(env)
    await ok(approverAct(env, leave.id, 'startReview'))
    const again = env.build()
    const stored = (await again.load()).leaves[0]!
    expect(stored.status).toBe('underReview')
    expect(stored.history.map((h) => h.eventType)).toEqual(['submitted', 'startReview'])
    async function ok<T>(p: Promise<{ ok: boolean; value?: T }>) {
      expect((await p).ok).toBe(true)
    }
  })

  it('AD-AT-40: corrupt saved data is not overwritten by a read and never shows a fake success', async () => {
    const env = setup()
    env.memory.data.set(ADMIN_STORE_KEY, '{broken')
    const store = await env.repo.load()
    expect(store.leaves).toEqual([]) // safe empty scenario in memory
    expect(env.memory.data.get(ADMIN_STORE_KEY)).toBe('{broken')
  })

  it('AD-AT-40: a failed save says so, keeps the previous state and creates nothing', async () => {
    const memory = createMemoryStorage()
    let failing = false
    const backend: Storage = {
      ...memory.storage,
      setItem: (key: string, v: string) => {
        if (failing && key === ADMIN_STORE_KEY) throw new DOMException('full', 'QuotaExceededError')
        memory.storage.setItem(key, v)
      },
    } as Storage
    const storage = createStorageAdapter({ backend })
    const prefs = createPrefsRepositories(storage)
    let n = 0
    const clock: Clock = { now: () => Temporal.Instant.from(NOW) }
    const repo = createAdminRepository({
      storage,
      clock,
      newId: (p) => `${p}-${++n}`,
      notifications: prefs.notifications,
    })
    await repo.submitLeave(A, leaveInput(), 'a')
    failing = true
    const r = await repo.submitLeave(A, leaveInput({ reason: 'Second' }), 'b')
    expect(r).toMatchObject({ ok: false, error: { code: 'storage' } })
    failing = false
    expect((await repo.load()).leaves).toHaveLength(1)
  })
})

describe('leave (AD-AT-03 … AD-AT-15)', () => {
  it('AD-AT-03 / AD-AT-04: a valid request makes one persisted request with a stable id, and a repeated submit makes no second', async () => {
    const env = setup()
    const first = await env.ok(env.repo.submitLeave(A, leaveInput(), 'same'))
    const second = await env.ok(env.repo.submitLeave(A, leaveInput(), 'same'))
    expect(first.created).toBe(true)
    expect(second).toMatchObject({ created: false })
    expect(second.leave.id).toBe(first.leave.id)
    const store = await env.repo.load()
    expect(store.leaves).toHaveLength(1)
    expect(store.leaves[0]).toMatchObject({
      status: 'submitted',
      revision: 1,
      statusVersion: 1,
      endDate: '2026-11-05',
    })
    expect(store.leaves[0]!.provenance.dataMode).toBe('userCreated')
    expect((await env.notes(A)).filter((n) => n.title === 'Local request saved')).toHaveLength(1)
  })

  it('AD-AT-05: an invalid interval or reason is refused whole, and an overnight return needs its date', async () => {
    const env = setup()
    for (const bad of [
      leaveInput({ endTime: t('09:00') }), // zero duration
      leaveInput({ endTime: t('08:00') }), // return before departure
      leaveInput({ reason: '   ' }),
      leaveInput({ reason: 'x'.repeat(501) }),
    ]) {
      expect(checkLeaveInput(bad)).not.toBeNull()
      expect((await env.repo.submitLeave(A, bad, `b${++k}`)).ok).toBe(false)
    }
    expect((await env.repo.load()).leaves).toEqual([])
    expect(
      checkLeaveInput(leaveInput({ startTime: t('22:00'), endTime: t('06:00') })),
    ).not.toBeNull() // no guessed next day
    expect(
      checkLeaveInput(
        leaveInput({ startTime: t('22:00'), endTime: t('06:00'), endDate: d('2026-11-06') }),
      ),
    ).toBeNull()
  })

  it('AD-AT-06: a student cannot perform an approver step, however they ask', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    for (const action of ['startReview', 'approve', 'reject', 'requestChanges'] as const) {
      const r = await env.repo.leaveAct(leave.id, action, 'student', { reason: 'x' })
      expect(!r.ok && r.error.message).toMatch(/different demo role/)
    }
    expect((await env.repo.leaveAct(leave.id, 'approve', 'demoGate')).ok).toBe(false) // wrong simulated role too
    expect((await env.repo.load()).leaves[0]!.status).toBe('submitted')
  })

  it('AD-AT-07: starting review updates the timeline and status exactly once and tells the student', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    expect((await approverAct(env, leave.id, 'startReview')).ok).toBe(false) // replay is refused
    const l = (await env.repo.load()).leaves[0]!
    expect(l.status).toBe('underReview')
    expect(l.statusVersion).toBe(2)
    expect(l.history.filter((h) => h.eventType === 'startReview')).toHaveLength(1)
    expect(l.history[1]).toMatchObject({
      actorType: 'demoApprover',
      from: 'submitted',
      to: 'underReview',
    })
    expect((await env.notes(A)).filter((n) => n.title === 'Demo review started')).toHaveLength(1)
  })

  it('AD-AT-08: a rejection needs and records a reason, and a rejected request can never reach a gate event', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    expect((await approverAct(env, leave.id, 'reject')).ok).toBe(false) // no reason
    await env.ok(approverAct(env, leave.id, 'reject', { reason: 'Clashes with an exam' }))
    const l = (await env.repo.load()).leaves[0]!
    expect(l).toMatchObject({
      status: 'rejected',
      decision: { decision: 'rejected', reason: 'Clashes with an exam', actorRole: 'demoApprover' },
    })
    expect((await gateAct(env, leave.id, 'logDeparture')).ok).toBe(false)
    expect((await gateAct(env, leave.id, 'logReturn')).ok).toBe(false)
    const n = (await env.notes(A)).find((x) => x.title === 'Decision recorded locally')!
    expect(n.body).toMatch(
      /Rejected locally: Clashes with an exam\. This is not an official decision/,
    )
  })

  it('AD-AT-09: changes requested show the reason, allow a new revision, and keep every earlier revision', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    expect((await approverAct(env, leave.id, 'requestChanges')).ok).toBe(false) // reason required
    await env.ok(approverAct(env, leave.id, 'requestChanges', { reason: 'Add the return time' }))
    expect(
      (await env.notes(A)).find((n) => n.title === 'Changes requested (simulated)')!.body,
    ).toBe('Add the return time')
    expect((await env.repo.reviseLeave(B, leave.id, leaveInput())).ok).toBe(false) // not theirs
    await env.ok(
      env.repo.reviseLeave(
        A,
        leave.id,
        leaveInput({ endTime: t('18:00'), reason: 'Family visit, back by 6' }),
      ),
    )
    const l = (await env.repo.load()).leaves[0]!
    expect(l).toMatchObject({
      status: 'resubmitted',
      revision: 2,
      endTime: '18:00',
      decision: null,
    })
    expect(l.revisions.map((r) => [r.revision, r.endTime])).toEqual([
      [1, '17:00'],
      [2, '18:00'],
    ])
    expect(l.history.map((h) => h.eventType)).toEqual([
      'submitted',
      'startReview',
      'requestChanges',
      'resubmitted',
    ])
    await env.ok(approverAct(env, leave.id, 'startReview')) // a resubmitted request goes back into review
  })

  it('AD-AT-10: a decision made on an old revision or an out-of-date view is refused; the newest revision stays authoritative', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    await env.ok(approverAct(env, leave.id, 'requestChanges', { reason: 'More detail' }))
    await env.ok(env.repo.reviseLeave(A, leave.id, leaveInput({ reason: 'More detail' })))
    await env.ok(approverAct(env, leave.id, 'startReview'))
    const stale = await approverAct(env, leave.id, 'approve', { expectedRevision: 1 })
    expect(!stale.ok && stale.error.message).toBe(STALE)
    const staleView = await approverAct(env, leave.id, 'approve', { expectedVersion: 2 })
    expect(!staleView.ok && staleView.error.message).toBe(STALE)
    expect((await env.repo.load()).leaves[0]!.status).toBe('underReview')
    await env.ok(approverAct(env, leave.id, 'approve', { expectedRevision: 2, expectedVersion: 5 }))
    expect((await env.repo.load()).leaves[0]!.decision).toMatchObject({
      revision: 2,
      decision: 'approved',
    })
  })

  it('AD-AT-11: an approval is only ever "locally" and says it is not a permission', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    await env.ok(approverAct(env, leave.id, 'approve'))
    expect(leaveStatusLabel.approvedInDemo).toBe('Approved locally — NOT A VALID GATE PASS')
    expect(Object.values(leaveStatusLabel).some((v) => /^Approved$/i.test(v))).toBe(false)
    const n = (await env.notes(A)).find((x) => x.title === 'Decision recorded locally')!
    expect(n.body).toMatch(/not an official permission and not a valid gate pass/)
  })

  it('AD-AT-12 / AD-AT-13: gate events are separate steps that need an eligible state, in order, and the demo gate policy', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    expect((await gateAct(env, leave.id, 'logDeparture')).ok).toBe(false) // not even reviewed
    await env.ok(approverAct(env, leave.id, 'startReview'))
    await env.ok(approverAct(env, leave.id, 'approve'))
    expect((await env.repo.load()).leaves[0]!.gate).toEqual({}) // approval did not log a departure
    expect((await gateAct(env, leave.id, 'logReturn')).ok).toBe(false) // no departure yet
    await env.ok(gateAct(env, leave.id, 'logDeparture'))
    expect((await gateAct(env, leave.id, 'logDeparture')).ok).toBe(false)
    await env.ok(gateAct(env, leave.id, 'logReturn'))
    const l = (await env.repo.load()).leaves[0]!
    expect(l.status).toBe('gateReturnLogged')
    expect(l.gate.departedAt).toBeDefined()
    expect(l.gate.returnedAt).toBeDefined()
    expect(
      (await env.notes(A)).filter((n) => n.title === 'Simulated gate status updated'),
    ).toHaveLength(2)
    // With the policy off, gate actions do not exist.
    const env2 = setup()
    const l2 = await sendLeave(env2)
    await env2.ok(approverAct(env2, l2.id, 'startReview'))
    await env2.ok(approverAct(env2, l2.id, 'approve'))
    await env2.ok(env2.repo.setPolicy({ gateEnabled: false }))
    expect((await gateAct(env2, l2.id, 'logDeparture')).ok).toBe(false)
  })

  it('an edit after approval is a new revision that voids the approval and never keeps a stale one', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    await env.ok(approverAct(env, leave.id, 'startReview'))
    await env.ok(approverAct(env, leave.id, 'approve'))
    await env.ok(env.repo.reviseLeave(A, leave.id, leaveInput({ startTime: t('10:00') })))
    const l = (await env.repo.load()).leaves[0]!
    expect(l).toMatchObject({ status: 'resubmitted', revision: 2, decision: null })
    expect(l.history.at(-1)!.eventType).toBe('revisedAfterApproval')
    expect((await gateAct(env, leave.id, 'logDeparture')).ok).toBe(false)
    // After departure was logged the request can no longer be edited.
    const l2 = await sendLeave(env, A, { reason: 'Second trip' })
    await env.ok(approverAct(env, l2.id, 'startReview'))
    await env.ok(approverAct(env, l2.id, 'approve'))
    await env.ok(gateAct(env, l2.id, 'logDeparture'))
    expect((await env.repo.reviseLeave(A, l2.id, leaveInput())).ok).toBe(false)
  })

  it('AD-AT-14: withdrawal is limited to undecided states, is recorded, and ends the request', async () => {
    const env = setup()
    const a = await sendLeave(env)
    const b = await sendLeave(env, A, { reason: 'Other' })
    await env.ok(env.repo.withdrawLeave(A, a.id))
    expect((await env.repo.load()).leaves.find((l) => l.id === a.id)).toMatchObject({
      status: 'withdrawn',
      decision: null,
    })
    expect((await env.repo.withdrawLeave(A, a.id)).ok).toBe(false)
    expect((await env.repo.withdrawLeave(B, b.id)).ok).toBe(false) // someone else's
    await env.ok(approverAct(env, b.id, 'startReview'))
    await env.ok(approverAct(env, b.id, 'approve'))
    const refused = await env.repo.withdrawLeave(A, b.id)
    expect(!refused.ok && refused.error.message).toMatch(/not been decided/)
    expect((await gateAct(env, a.id, 'logDeparture')).ok).toBe(false) // withdrawn is never gate-cleared
    expect(
      (await env.repo.load()).leaves.find((l) => l.id === a.id)!.history.at(-1)!.eventType,
    ).toBe('withdrawn')
  })

  it('AD-AT-15: no sensitive proof is ever stored: attachments are metadata only, and a seeded store has none', async () => {
    const env = setup()
    const store = await env.repo.load()
    expect(store.leaves).toEqual([])
    expect(store.tickets).toEqual([])
    const att = describeAttachment(
      { name: 'sample-proof.png', type: 'image/png', size: 1200 },
      { nowIso: NOW, newId: (p) => `${p}-1` },
    )
    expect(Object.keys(att).sort()).toEqual(['demoOnly', 'displayName', 'id', 'mime', 'sizeBytes'])
    expect(att.demoOnly).toBe(true)
    expect(checkAttachment({ name: 'x.pdf', type: 'application/pdf', size: 10 }, 'image')).toMatch(
      /Only PNG, JPEG or WebP/,
    )
    expect(
      checkAttachment({ name: 'big.png', type: 'image/png', size: 3_000_000 }, 'image'),
    ).toMatch(/larger than 2 MB/)
    expect(
      checkAttachment({ name: 'proof.pdf', type: 'application/pdf', size: 10 }, 'any'),
    ).toBeNull()
  })

  it('AD-AT-27 / AD-AT-28: ids are shared but a request is reachable only by its owner', async () => {
    const env = setup()
    const leave = await sendLeave(env)
    expect((await env.repo.withdrawLeave(B, leave.id)).ok).toBe(false)
    expect((await env.repo.reviseLeave(B, leave.id, leaveInput())).ok).toBe(false)
  })
})

const ticketInput = (extra: Partial<TicketInput> = {}): TicketInput => ({
  kind: 'complaint',
  category: 'plumbing',
  description: 'Tap in the washroom keeps dripping',
  location: 'Sample Block washroom',
  reportedSeverity: 'normal',
  ...extra,
})
const teachingInput = (extra: Partial<TicketInput> = {}): TicketInput =>
  ticketInput({
    kind: 'teachingAid',
    category: 'other',
    description: 'Projector shows no signal',
    teaching: {
      classroomReference: 'Sample Room A (fictional)',
      classroomSource: 'selfReported',
      assetType: 'projector',
    },
    ...extra,
  })
const sendTicket = async (env: Env, input: TicketInput = ticketInput(), profile = A) =>
  (await env.ok(env.repo.submitTicket(profile, input, `t${++k}`))).ticket
const maint = (
  env: Env,
  id: string,
  action: Parameters<Env['repo']['ticketAct']>[1],
  opts: Parameters<Env['repo']['ticketAct']>[3] = {},
) => env.repo.ticketAct(id, action, 'demoMaintenance', opts)
const mine = (
  env: Env,
  id: string,
  action: Parameters<Env['repo']['ticketAct']>[1],
  reason?: string,
  profileId = A,
) => env.repo.ticketAct(id, action, 'student', { profileId, ...(reason ? { reason } : {}) })

describe('complaints and teaching aids (AD-AT-16 … AD-AT-26)', () => {
  it('AD-AT-16 / AD-AT-17: a complaint makes one persisted ticket with an id and initial status, in any required category', async () => {
    const env = setup()
    expect(CATEGORIES).toEqual(['plumbing', 'electricity', 'wifi', 'cleaning', 'washroom', 'other'])
    const input = ticketInput()
    const first = await env.ok(env.repo.submitTicket(A, input, 'same'))
    expect((await env.ok(env.repo.submitTicket(A, input, 'same'))).created).toBe(false)
    expect(first.ticket).toMatchObject({
      kind: 'complaint',
      status: 'submitted',
      category: 'plumbing',
      locationSource: 'selfReported',
      reportedSeverity: 'normal',
    })
    expect((await env.repo.load()).tickets).toHaveLength(1)
    // location is optional and a description is required
    const noLoc = await sendTicket(env, ticketInput({ location: undefined, category: 'wifi' }))
    expect(noLoc.location).toBeUndefined()
    expect((await env.repo.submitTicket(A, ticketInput({ description: ' ' }), 'x')).ok).toBe(false)
    expect(
      (await env.notes(A)).filter((n) => n.title === 'Ticket recorded in CampusOS demo'),
    ).toHaveLength(2)
  })

  it('AD-AT-18: no SLA, official priority or response time exists until a simulator supplies a labelled demo value', async () => {
    const env = setup()
    const ticket = await sendTicket(env, ticketInput({ reportedSeverity: 'urgent' }))
    expect(ticket).toMatchObject({ reportedSeverity: 'urgent' })
    expect(ticket.demoPriority).toBeUndefined()
    expect(ticket.demoTargetHours).toBeUndefined()
    expect(ticket.teamLabel).toBeUndefined()
    await env.ok(maint(env, ticket.id, 'assign', { demoPriority: 'high', demoTargetHours: 48 }))
    const t2 = (await env.repo.load()).tickets[0]!
    expect(t2).toMatchObject({
      reportedSeverity: 'urgent',
      demoPriority: 'high',
      demoTargetHours: 48,
      teamLabel: 'Team not assigned',
    })
    expect((await env.notes(A)).find((n) => n.title === 'Assignment simulated')!.body).toMatch(
      /not a real team or a promise of a visit/,
    )
  })

  it('AD-AT-19: assignment, start, awaiting parts and resolution are guarded transitions with an actor and event each', async () => {
    const env = setup()
    const ticket = await sendTicket(env)
    expect((await maint(env, ticket.id, 'start')).ok).toBe(false) // not assigned yet
    expect((await maint(env, ticket.id, 'resolve')).ok).toBe(false)
    expect((await maint(env, ticket.id, 'close')).ok).toBe(false) // submitted → closed is not allowed
    await env.ok(maint(env, ticket.id, 'assign', { team: 'Demo facilities team A' }))
    await env.ok(maint(env, ticket.id, 'awaitParts'))
    expect((await maint(env, ticket.id, 'resolve')).ok).toBe(false) // must resume first
    await env.ok(maint(env, ticket.id, 'resume'))
    await env.ok(maint(env, ticket.id, 'resolve'))
    expect((await maint(env, ticket.id, 'resolve')).ok).toBe(false) // replay refused
    const t = (await env.repo.load()).tickets[0]!
    expect(t.status).toBe('resolvedInDemo')
    expect(t.history.map((h) => [h.eventType, h.actorType])).toEqual([
      ['submitted', 'student'],
      ['assign', 'demoMaintenance'],
      ['awaitParts', 'demoMaintenance'],
      ['resume', 'demoMaintenance'],
      ['resolve', 'demoMaintenance'],
    ])
    expect(t.statusVersion).toBe(5)
    expect(ticketStatusLabel.resolvedInDemo).toBe('Marked resolved (simulated)')
    expect((await maint(env, ticket.id, 'assign')).ok).toBe(false)
    expect(
      (await env.notes(A)).filter((n) => n.title === 'Demo ticket awaiting parts'),
    ).toHaveLength(1)
  })

  it('AD-AT-20 / AD-AT-21: a resolved ticket is reopened on the same id with a reason, and nothing earlier is lost', async () => {
    const env = setup()
    const ticket = await sendTicket(env)
    for (const a of ['assign', 'start', 'resolve'] as const) await env.ok(maint(env, ticket.id, a))
    expect((await mine(env, ticket.id, 'reopen')).ok).toBe(false) // a reason is required
    expect((await mine(env, ticket.id, 'reopen', 'Still leaking', B)).ok).toBe(false) // not theirs
    await env.ok(mine(env, ticket.id, 'reopen', 'Still leaking'))
    const t = (await env.repo.load()).tickets
    expect(t).toHaveLength(1) // not a second ticket
    expect(t[0]).toMatchObject({ id: ticket.id, status: 'reopened', resolutionCount: 1 })
    expect(t[0]!.history.map((h) => h.eventType)).toEqual([
      'submitted',
      'assign',
      'start',
      'resolve',
      'reopen',
    ])
    expect(t[0]!.history.at(-1)!.reason).toBe('Still leaking')
    await env.ok(maint(env, ticket.id, 'assign'))
    await env.ok(maint(env, ticket.id, 'start'))
    await env.ok(maint(env, ticket.id, 'resolve'))
    expect((await env.repo.load()).tickets[0]!.resolutionCount).toBe(2)
    expect((await env.notes(A)).filter((n) => n.title === 'Issue reopened')).toHaveLength(1)
  })

  it('AD-AT-22: a student can never mark their own ticket assigned, started or fixed', async () => {
    const env = setup()
    const ticket = await sendTicket(env)
    for (const action of ['assign', 'start', 'awaitParts', 'resume', 'resolve', 'close'] as const) {
      const r = await env.repo.ticketAct(ticket.id, action, 'student', { profileId: A })
      expect(!r.ok && r.error.message).toMatch(/different demo role/)
    }
    expect((await env.repo.ticketAct(ticket.id, 'resolve', 'demoApprover')).ok).toBe(false)
    expect((await env.repo.load()).tickets[0]!.status).toBe('submitted')
  })

  it('a student can cancel before work starts but not after, and can close a resolved ticket themselves', async () => {
    const env = setup()
    const a = await sendTicket(env)
    const b = await sendTicket(env, ticketInput({ category: 'electricity' }))
    await env.ok(maint(env, b.id, 'assign'))
    await env.ok(mine(env, b.id, 'cancel'))
    expect((await env.repo.load()).tickets.find((t) => t.id === b.id)!.status).toBe(
      'cancelledByReporter',
    )
    expect((await mine(env, b.id, 'cancel')).ok).toBe(false)
    await env.ok(maint(env, a.id, 'assign'))
    await env.ok(maint(env, a.id, 'start'))
    expect((await mine(env, a.id, 'cancel')).ok).toBe(false) // work has started
    await env.ok(maint(env, a.id, 'resolve'))
    expect((await mine(env, a.id, 'cancel')).ok).toBe(false)
    await env.ok(mine(env, a.id, 'acknowledge'))
    expect((await env.repo.load()).tickets.find((t) => t.id === a.id)!.status).toBe('closedInDemo')
    expect((await mine(env, a.id, 'reopen', 'again')).ok).toBe(false) // closed is final
  })

  it('a stale view cannot overwrite a ticket that changed under it', async () => {
    const env = setup()
    const ticket = await sendTicket(env)
    await env.ok(maint(env, ticket.id, 'assign', { expectedVersion: 1 }))
    const stale = await maint(env, ticket.id, 'start', { expectedVersion: 1 })
    expect(!stale.ok && stale.error.message).toBe(STALE)
  })

  it('AD-AT-23 / AD-AT-24: a teaching-aid report needs a classroom and an equipment type and lands in the shared ticket store', async () => {
    const env = setup()
    expect(
      (
        await env.repo.submitTicket(
          A,
          teachingInput({
            teaching: {
              classroomReference: '  ',
              classroomSource: 'selfReported',
              assetType: 'projector',
            },
          }),
          'a',
        )
      ).ok,
    ).toBe(false)
    expect((await env.repo.submitTicket(A, teachingInput({ teaching: undefined }), 'b')).ok).toBe(
      false,
    )
    const t = await sendTicket(
      env,
      teachingInput({
        teaching: {
          classroomReference: 'Sample Room A (fictional)',
          classroomSource: 'timetable',
          assetType: 'microphone',
          classImpact: 'delayed',
          deviceIdentifier: 'MIC-2',
        },
      }),
    )
    const store = await env.repo.load()
    expect(store.tickets).toHaveLength(1) // the same ticket list as complaints
    expect(t).toMatchObject({
      kind: 'teachingAid',
      status: 'submitted',
      teaching: { assetType: 'microphone', classImpact: 'delayed', classroomSource: 'timetable' },
    })
    expect(Object.keys(store)).toEqual(['schemaVersion', 'config', 'leaves', 'tickets']) // no second ticket engine
  })

  it('AD-AT-25: a teaching-aid ticket resolves and reopens exactly like a complaint, and notices name the classroom', async () => {
    const env = setup()
    const t = await sendTicket(env, teachingInput())
    for (const a of ['assign', 'start', 'resolve'] as const) await env.ok(maint(env, t.id, a))
    await env.ok(mine(env, t.id, 'reopen', 'No signal again'))
    expect((await env.repo.load()).tickets[0]!.status).toBe('reopened')
    expect((await env.notes(A)).find((n) => n.title === 'Issue reopened')!.body).toMatch(
      /^Sample Room A \(fictional\): /,
    )
  })

  it('AD-AT-26: two reports about the same equipment stay two tickets', async () => {
    const env = setup()
    await sendTicket(env, teachingInput())
    await sendTicket(env, teachingInput({ description: 'Projector still has no signal' }))
    expect((await env.repo.load()).tickets).toHaveLength(2)
  })

  it('AD-AT-31: a transition notice appears once, to the owner only, and opens the exact request', async () => {
    const env = setup()
    const t = await sendTicket(env)
    await env.ok(maint(env, t.id, 'assign'))
    const notes = (await env.notes(A)).filter((n) => n.title === 'Assignment simulated')
    expect(notes).toHaveLength(1)
    expect(notes[0]!.href).toBe(`/administration/requests/${t.id}`)
    expect(notes[0]!.kind).toBe('service')
    expect(await env.notes(B)).toEqual([])
  })

  it('AD-AT-33: the scoped reset clears Administration records and nothing else', async () => {
    const env = setup()
    env.memory.data.set('campusos:sports:v1', 'sports-data')
    env.memory.data.set('campusos:domain:v1:demo-student-a', 'imported-academic-data')
    await sendLeave(env)
    await sendTicket(env)
    await env.ok(env.repo.resetScenario())
    expect(env.memory.data.has(ADMIN_STORE_KEY)).toBe(false)
    expect(env.memory.data.get('campusos:sports:v1')).toBe('sports-data')
    expect(env.memory.data.get('campusos:domain:v1:demo-student-a')).toBe('imported-academic-data')
    expect((await env.repo.load()).leaves).toEqual([])
  })
})
