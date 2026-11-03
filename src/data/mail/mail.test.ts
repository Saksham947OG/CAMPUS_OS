import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createSharedRepository } from '@/data/shared/shared-repository'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { fixture } from '@/data/seeds/demo/mail-fixtures'
import { classify, normalizeKey, parseSeating, startsIn } from '@/domain/mail-logic'
import type { Clock } from '@/lib/time'
import { inboxFor, urgentSignal } from '@/selectors/mail'
import { createMemoryStorage } from '@/test/memory-storage'
import { createMailRepository } from './mail-repository'

const A = 'demo-student-a'
const B = 'demo-student-b'
const E = 'demo-student-empty'
const KEY_A = 'DEMO-BMS-001'
const AT_10 = '2026-11-02T04:30:00Z' // 10:00 IST
const AT_14 = '2026-11-02T08:30:00Z' // 14:00 IST: the quiz starts in one hour

function setup(at = AT_14) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const clock: Clock = { now: () => Temporal.Instant.from(at) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const newId = (p: string) => `${p}-t${++n}`
  const shared = createSharedRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    profileIds: [A, B, E],
  })
  const repo = createMailRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    shared,
  })
  const ok = async <T>(p: Promise<{ ok: boolean; value?: T; error?: { message: string } }>) => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as T
  }
  type R = { emailId: string; duplicate: boolean; alerted: boolean }
  return {
    repo,
    shared,
    prefs,
    ok,
    send: (p: string | null, s: Parameters<typeof fixture>[0]) =>
      ok<R>(repo.receive(p, fixture(s, p === A ? KEY_A : p === B ? 'DEMO-BMS-002' : undefined))),
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
    seat: async (p: string) =>
      (await shared.load()).seats.find((x) => x.ownerProfileId === p && x.examId === 'exam-4'),
  }
}

describe('Campus Mail: the one-hour exam alert', () => {
  it('a revised seating email lands in the inbox, matches only the exact student key, updates the one seat record and sends one critical alert', async () => {
    const e = setup()
    const r = await e.send(A, 'seat-v1')
    expect(r).toMatchObject({ duplicate: false, alerted: true })
    const seat = await e.seat(A)
    expect(seat).toMatchObject({
      room: 'CR5',
      column: '2',
      row: '3',
      version: 1,
      validation: 'CONFIRMED_DEMO',
      sourceRevision: 1,
    })
    expect(seat!.sourceLabel).toMatch(/not an official allotment/)
    const mail = (await e.repo.load()).emails.find((m) => m.id === r.emailId)!
    expect(mail).toMatchObject({
      category: 'EXAM',
      provenance: 'DEMO_SIMULATED',
      syncState: 'IMPORTED',
    })
    expect(mail.stages.map((s) => [s.stage, s.status])).toEqual([
      ['received', 'done'],
      ['classified', 'done'],
      ['extracted', 'done'],
      ['identity', 'done'],
      ['seat', 'done'],
      ['alert', 'done'],
    ])
    const alerts = (await e.notes(A)).filter((n) => /seating/i.test(n.title))
    expect(alerts).toHaveLength(1)
    expect(alerts[0]).toMatchObject({
      title: 'Quiz seating updated — CR5, Column 2, Row 3',
      significance: 'critical',
      href: '/academics/exams/exam-4',
    })
    expect(alerts[0]!.body).toMatch(/starts in 1 hour/)
    expect(alerts[0]!.body).toMatch(/simulated email, not an official allotment/)
    const shared = await e.shared.load()
    expect(urgentSignal(shared, A, Date.parse(AT_14))).toMatchObject({
      seat: 'CR5, Column 2, Row 3',
      examId: 'exam-4',
    })
  })

  it('a correction updates the same seat in place, keeps the earlier version, and sends one "column changed" alert', async () => {
    const e = setup()
    await e.send(A, 'seat-v1')
    const r = await e.send(A, 'seat-v2')
    expect(r.alerted).toBe(true)
    const seat = await e.seat(A)
    expect(seat).toMatchObject({ column: '4', version: 2, sourceRevision: 2 })
    expect(
      (await e.shared.load()).seats.filter((x) => x.ownerProfileId === A && x.examId === 'exam-4'),
    ).toHaveLength(1)
    expect(seat!.history.map((h) => h.column)).toEqual(['2', '4'])
    const alerts = (await e.notes(A)).filter((n) => /seating|changed/i.test(n.title))
    expect(alerts.map((n) => n.title).sort()).toEqual(
      [
        'Quiz seating updated — CR5, Column 2, Row 3',
        'Your column changed — CR5, Column 4, Row 3',
      ].sort(),
    )
  })

  it('replaying the same email creates no second inbox entry and no second alert', async () => {
    const e = setup()
    const first = await e.send(A, 'seat-v1')
    const again = await e.send(A, 'seat-v1')
    expect(again).toMatchObject({ duplicate: true, alerted: false, emailId: first.emailId })
    expect(
      inboxFor(await e.repo.load(), A).filter((m) => m.messageId === 'demo-msg-seat-v1'),
    ).toHaveLength(1)
    expect((await e.notes(A)).filter((n) => /seating/i.test(n.title))).toHaveLength(1)
    expect((await e.seat(A))!.version).toBe(1)
    const mail = (await e.repo.load()).emails.find((m) => m.id === first.emailId)!
    expect(mail.stages.at(-1)).toMatchObject({ stage: 'received', status: 'duplicate' })
  })

  it('another profile never sees the first student’s seat, key or mail', async () => {
    const e = setup()
    await e.send(A, 'seat-v1')
    expect(await e.seat(B)).toBeUndefined()
    expect(await e.notes(B)).toHaveLength(0)
    const s = await e.repo.load()
    const inbox = inboxFor(s, B)
    expect(inbox.some((m) => m.body.includes(KEY_A))).toBe(false)
    expect(
      inbox.every(
        (m) => m.connectionId === 'conn-demo-student-b' || m.connectionId === 'conn-broadcast',
      ),
    ).toBe(true)
    expect(urgentSignal(await e.shared.load(), B, Date.parse(AT_14))).toBeNull()
  })

  it('a notice with no row for this student applies no seat and says to verify the original', async () => {
    const e = setup()
    const r = await e.send(A, 'seat-other-student')
    expect(r.alerted).toBe(false)
    expect(await e.seat(A)).toBeUndefined()
    const mail = (await e.repo.load()).emails.find((m) => m.id === r.emailId)!
    expect(mail.stages.find((s) => s.stage === 'identity')!.note).toMatch(
      /verify the original notice/,
    )
    // A profile with no student key is never matched.
    const c = await e.send(E, 'seat-v1')
    expect(c.alerted).toBe(false)
    expect(await e.seat(E)).toBeUndefined()
  })

  it('stops, and invents nothing, when the sender, room or attachment cannot be trusted', async () => {
    const e = setup()
    for (const s of ['unlisted-sender', 'seat-no-room', 'attachment-only'] as const) {
      const r = await e.send(A, s)
      expect(r.alerted).toBe(false)
    }
    expect(await e.seat(A)).toBeUndefined()
    const s = await e.repo.load()
    const by = (id: string) => s.emails.find((m) => m.messageId === id)!
    expect(by('demo-msg-seat-unlisted')).toMatchObject({ syncState: 'NEEDS_REVIEW' })
    expect(by('demo-msg-seat-unlisted').stages.at(-1)!.note).toMatch(/not trusted/)
    expect(by('demo-msg-seat-noroom').stages.at(-1)!.note).toMatch(/no room/)
    expect(by('demo-msg-attach').stages.at(-1)!.note).toMatch(/inspect the source/)
    expect(await e.notes(A)).toHaveLength(0)
  })

  it('a room-wide notice is not a personal seat, and an "URGENT!!!" subject earns nothing', async () => {
    const e = setup()
    const wide = await e.send(A, 'room-wide')
    const promo = await e.send(A, 'urgent-promo')
    expect(wide.alerted).toBe(false)
    expect(promo.alerted).toBe(false)
    const s = await e.repo.load()
    expect(s.notices.find((n) => n.sourceEmailId === wide.emailId)).toMatchObject({
      kind: 'ROOM_NOTICE',
      fields: { room: 'CR5' },
    })
    expect(await e.seat(A)).toBeUndefined()
    expect(s.emails.find((m) => m.id === promo.emailId)!.category).toBe('OTHER')
    expect(await e.notes(A)).toHaveLength(0)
  })

  it('an older revision cannot overwrite a newer seat, and two notices of one revision that disagree are a conflict', async () => {
    const e = setup()
    await e.send(A, 'seat-v2')
    const old = await e.send(A, 'seat-v1')
    expect(old.alerted).toBe(false)
    expect((await e.seat(A))!.column).toBe('4')
    const s = await e.repo.load()
    expect(s.notices.find((n) => n.sourceEmailId === old.emailId)!.status).toBe('SUPERSEDED')
    // Same revision, different content.
    const clash = await e.ok<{ emailId: string; alerted: boolean }>(
      e.repo.receive(A, {
        messageId: 'demo-msg-clash',
        from: 'exams@bms.invalid',
        subject: 'Quiz Seating',
        body: 'Exam: DEMO-OPS101 Quiz 1\nRevision: 2\nStudent: DEMO-BMS-001\nRoom: CR6\nColumn: 1\nRow: 1\n',
      }),
    )
    expect(clash.alerted).toBe(false)
    expect((await e.seat(A))!.room).toBe('CR5')
    expect(
      (await e.repo.load()).emails.find((m) => m.id === clash.emailId)!.stages.at(-1)!.note,
    ).toMatch(/CONFLICT — VERIFY WITH OFFICE/)
  })

  it('matches on whitespace and case only, never on a changed digit or a name', () => {
    expect(normalizeKey(' demo-bms-001 ')).toBe(KEY_A)
    expect(normalizeKey('DEMO BMS 001')).toBe('DEMOBMS001')
    expect(normalizeKey('DEMO-BMS-0O1')).not.toBe(KEY_A)
    expect(classify({ subject: 'URGENT!!! click', body: 'free' })).toBe('OTHER')
    expect(classify({ subject: 'Quiz seating', body: 'Exam seating list' })).toBe('EXAM')
    const p = parseSeating(
      'Exam: X\nStudent: DEMO-BMS-001\nRoom: CR5\nColumn: 2\nRow: 3\nStudent: DEMO-BMS-002\nRoom: CR5\nColumn: 4\nRow: 1\n',
    )
    expect(p.rows).toHaveLength(2)
    expect(p.rows[0]).toMatchObject({ room: 'CR5', column: '2', row: '3' })
    expect(p.evidence.find((x) => x.field === 'column')).toMatchObject({
      locator: 'line 4',
      raw: 'Column: 2',
    })
  })

  it('"starts in" comes from the real start and the clock, and an earlier exam is not urgent', async () => {
    expect(startsIn(Date.parse(AT_14) + 3_600_000, Date.parse(AT_14))).toBe('starts in 1 hour')
    expect(startsIn(Date.parse(AT_14) + 25 * 60_000, Date.parse(AT_14))).toBe(
      'starts in 25 minutes',
    )
    expect(startsIn(Date.parse(AT_14) - 1, Date.parse(AT_14))).toBe('has started')
    const e = setup(AT_10)
    await e.send(A, 'seat-v1')
    expect((await e.notes(A))[0]!.body).toMatch(/starts in 5 hours/)
    const shared = await e.shared.load()
    expect(urgentSignal(shared, A, Date.parse('2026-11-02T10:00:00Z'))).toBeNull() // after 15:30 IST: already started
  })

  it('reset removes the mail and seeds again; the broadcast notices are visible to every mailbox', async () => {
    const e = setup()
    await e.send(A, 'seat-v1')
    expect(inboxFor(await e.repo.load(), B).map((m) => m.subject)).toEqual([
      'BMS Weekly Update',
      'Club Applications Open',
    ])
    await e.repo.resetAll()
    expect(inboxFor(await e.repo.load(), A).map((m) => m.subject)).toEqual([
      'BMS Weekly Update',
      'Club Applications Open',
    ])
  })
})
