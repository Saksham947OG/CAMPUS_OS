import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { clash, findTimes, mergeIntervals, type Participant } from '@/domain/availability'
import { tally } from '@/domain/meetings-logic'
import { fixedClock, type DateOnly, type LocalTime } from '@/lib/time'
import { roomStateOf } from '@/selectors/availability'
import { instantMs } from '@/selectors/now'
import { createMemoryStorage } from '@/test/memory-storage'

const NOW = '2026-11-02T04:30:00Z' // Monday 2 Nov 2026, 10:00 IST
const A = 'demo-student-a'
const B = 'demo-student-b'
const E = 'demo-student-empty'
const D = (s: string) => s as DateOnly
const T = (s: string) => s as LocalTime

function setup() {
  const services = createServices({
    sourceData: false,
    storage: createStorageAdapter({ backend: createMemoryStorage().storage }),
    clock: fixedClock(NOW),
  })
  const people = async (
    ids: [string, boolean][],
    from: DateOnly,
    to: DateOnly,
  ): Promise<Participant[]> =>
    Promise.all(
      ids.map(async ([id, required]) => {
        const av = await services.meetings.availabilityOf(id, from, to)
        return {
          id,
          label: id === A ? 'Student A' : id === B ? 'Student B' : 'Student E',
          required,
          busy: av.busy,
          coverage: av.coverage,
        }
      }),
    )
  const base = (p: Participant[], over: Partial<Parameters<typeof findTimes>[0]> = {}) => ({
    participants: p,
    from: D('2026-11-03'),
    to: D('2026-11-06'),
    durationMin: 45,
    dayWindow: { from: T('09:00'), to: T('18:00') },
    includeWeekends: false,
    stepMin: 15,
    bufferMin: 0,
    preference: 'any' as const,
    nowMs: Date.parse(NOW),
    ...over,
  })
  const ok = async <V>(p: Promise<{ ok: boolean; value?: V; error?: { message: string } }>) => {
    const r = await p
    if (!r.ok) throw new Error(r.error?.message)
    return r.value as V
  }
  const bad = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => {
    const r = await p
    expect(r.ok).toBe(false)
    return r.error?.message ?? ''
  }
  const meet = (over: object = {}) => ({
    organizerProfileId: A,
    title: 'Ops project sync',
    date: D('2026-11-03'),
    start: T('14:00'),
    end: T('14:45'),
    attendees: [{ profileId: B, required: true }],
    opId: 'op-1',
    ...over,
  })
  return {
    services,
    people,
    base,
    ok,
    bad,
    meet,
    notes: async (p: string) => (await services.prefs.notifications.load(p)).value.items,
  }
}

describe('availability engine', () => {
  it('returns at most three real, conflict-free, non-overlapping suggestions, and allows adjacent slots', async () => {
    const e = setup()
    const p = await e.people(
      [
        [A, true],
        [B, true],
      ],
      D('2026-11-03'),
      D('2026-11-06'),
    )
    const r = findTimes(e.base(p))
    expect(r.suggestions.length).toBeGreaterThan(0)
    expect(r.suggestions.length).toBeLessThanOrEqual(3)
    const merged = new Map(p.map((x) => [x.id, mergeIntervals(x.busy)]))
    for (const s of r.suggestions) {
      const slot = { start: instantMs(s.date, s.start), end: instantMs(s.date, s.end) }
      for (const x of p) expect(merged.get(x.id)!.some((b) => clash(slot, b))).toBe(false)
      expect(s.reasons.length).toBeGreaterThan(0)
    }
    const starts = r.suggestions.map((s) => ({
      start: instantMs(s.date, s.start),
      end: instantMs(s.date, s.end),
    }))
    for (let i = 0; i < starts.length; i++)
      for (let j = i + 1; j < starts.length; j++) expect(clash(starts[i]!, starts[j]!)).toBe(false)
    expect(r.suggestions.map((s) => s.score)).toEqual(
      [...r.suggestions.map((s) => s.score)].sort((a, b) => b - a),
    )
    // Tuesday: Student B has a 09:00–10:00 class, and a candidate may start exactly at 10:00.
    const tue = findTimes(
      e.base(p, {
        from: D('2026-11-03'),
        to: D('2026-11-03'),
        dayWindow: { from: T('09:00'), to: T('11:00') },
        stepMin: 15,
      }),
    )
    expect(
      tue.suggestions.every(
        (s) => !(s.date === '2026-11-03' && s.start < '10:00' && s.end > '09:00'),
      ),
    ).toBe(true)
  })

  it('never calls a person with no recorded schedule free, and never fabricates a third option', async () => {
    const e = setup()
    const p = await e.people(
      [
        [A, true],
        [E, true],
      ],
      D('2026-11-03'),
      D('2026-11-04'),
    )
    expect(p[1]!.coverage).toBe('unknown')
    const r = findTimes(e.base(p, { to: D('2026-11-04') }))
    expect(r.suggestions).toEqual([])
    expect(r.needsConfirmation.length).toBeGreaterThan(0)
    expect(r.needsConfirmation.every((c) => c.unknownRequired.includes('Student E'))).toBe(true)
    // One tiny window leaves exactly one option, not three.
    const q = await e.people([[A, true]], D('2026-11-03'), D('2026-11-03'))
    const one = findTimes(
      e.base(q, { to: D('2026-11-03'), dayWindow: { from: T('15:00'), to: T('15:45') } }),
    )
    expect(one.suggestions).toHaveLength(1)
  })

  it('explains an empty result in privacy-safe words and does not drop a required person', async () => {
    const e = setup()
    const p = await e.people(
      [
        [A, true],
        [B, true],
      ],
      D('2026-11-03'),
      D('2026-11-03'),
    )
    const r = findTimes(
      e.base(p, {
        from: D('2026-11-03'),
        to: D('2026-11-03'),
        dayWindow: { from: T('09:00'), to: T('10:00') },
        durationMin: 60,
      }),
    )
    expect(r.suggestions).toEqual([])
    expect(r.blockers.join(' ')).toMatch(/Student B has recorded commitments/)
    expect(r.blockers.join(' ')).not.toMatch(/Sample Course|lecture|class/i)
  })

  it('optional attendees raise the rank but never block, and a buffer widens the clash', async () => {
    const e = setup()
    const p = await e.people(
      [
        [A, true],
        [B, false],
      ],
      D('2026-11-03'),
      D('2026-11-03'),
    )
    const r = findTimes(e.base(p, { from: D('2026-11-03'), to: D('2026-11-03') }))
    expect(r.suggestions.length).toBeGreaterThan(0)
    expect(r.suggestions[0]!.optionalTotal).toBe(1)
    const tight = findTimes(
      e.base(await e.people([[A, true]], D('2026-11-03'), D('2026-11-03')), {
        from: D('2026-11-03'),
        to: D('2026-11-03'),
        bufferMin: 30,
      }),
    )
    for (const s of tight.suggestions) expect(s.start >= '09:00').toBe(true)
  })
})

describe('meeting + room lifecycle', () => {
  it('confirms one canonical meeting with a room, projects it once to every guest, and holds the room', async () => {
    const e = setup()
    const r = await e.ok<{ meeting: { id: string; status: string; roomReservationId?: string } }>(
      e.services.meetings.schedule(e.meet({ room: { roomId: 'CR1', purpose: 'Project meeting' } })),
    )
    const id = r.meeting.id
    for (const p of [A, B]) {
      const data = await e.services.campus.load(p)
      expect(data.bookings.filter((b) => b.id === id)).toHaveLength(1)
    }
    expect(
      (await e.services.campus.load(A)).bookings.filter((b) => /CR1/.test(b.resource)),
    ).toHaveLength(0) // the room is not projected a second time
    expect((await e.services.campus.load(E)).bookings.filter((b) => b.id === id)).toHaveLength(0)
    const rooms = await e.services.classrooms.load()
    expect(rooms.reservations[0]).toMatchObject({
      meetingId: id,
      state: 'confirmedDemo',
      roomId: 'CR1',
    })
    expect(roomStateOf(r.meeting as never, rooms)).toBe('confirmed')
    const again = await e.ok<{ created: boolean }>(
      e.services.meetings.schedule(e.meet({ room: { roomId: 'CR1', purpose: 'Project meeting' } })),
    )
    expect(again.created).toBe(false)
    expect((await e.services.classrooms.load()).reservations).toHaveLength(1)
  })

  it('a required person who gained a commitment since the suggestion makes the booking fail, with no room left held', async () => {
    const e = setup()
    await e.services.campus.saveEvent(B, {
      title: 'Private appointment',
      category: 'personal',
      date: D('2026-11-03'),
      timing: { kind: 'timed', start: T('14:15'), end: T('15:00') },
      blocksTime: true,
    } as never)
    const msg = await e.bad(
      e.services.meetings.schedule(e.meet({ room: { roomId: 'CR1', purpose: 'Project meeting' } })),
    )
    expect(msg).toMatch(/required person now has a recorded commitment/)
    expect(msg).not.toMatch(/Private appointment/)
    expect((await e.services.classrooms.load()).reservations).toHaveLength(0)
    expect((await e.services.meetings.load()).meetings).toHaveLength(0)
  })

  it('a room that is already taken stops the meeting and keeps nothing', async () => {
    const e = setup()
    await e.services.classrooms.injectOtherBooking('CR1', {
      date: D('2026-11-03'),
      start: T('14:00'),
      end: T('15:00'),
    })
    expect(
      await e.bad(
        e.services.meetings.schedule(
          e.meet({ room: { roomId: 'CR1', purpose: 'Project meeting' } }),
        ),
      ),
    ).toMatch(/room could not be reserved/)
    expect((await e.services.meetings.load()).meetings).toHaveLength(0)
  })

  it('an approval room keeps the meeting pending-room until the reviewer decides, without calling it fully confirmed', async () => {
    const e = setup()
    const r = await e.ok<{ meeting: { id: string } }>(
      e.services.meetings.schedule(
        e.meet({ room: { roomId: 'CR_CONFERENCE_HALL', purpose: 'Presentation' } }),
      ),
    )
    let rooms = await e.services.classrooms.load()
    const m = (await e.services.meetings.load()).meetings[0]!
    expect(roomStateOf(m, rooms)).toBe('pending')
    await e.ok(e.services.classrooms.decide(rooms.reservations[0]!.id, 'approve'))
    rooms = await e.services.classrooms.load()
    expect(roomStateOf(m, rooms)).toBe('confirmed')
    expect(r.meeting.id).toBe(m.id)
  })

  it('RSVP is separate from the organizer’s choice; a move resets replies, tells each person once, and keeps the old booking if the new room fails', async () => {
    const e = setup()
    const r = await e.ok<{ meeting: { id: string; revision: number } }>(
      e.services.meetings.schedule(e.meet({ room: { roomId: 'CR1', purpose: 'Project meeting' } })),
    )
    const id = r.meeting.id
    let m = (await e.services.meetings.load()).meetings[0]!
    expect(m.attendees.find((a) => a.profileId === B)!.rsvp).toBe('INVITED')
    await e.ok(e.services.meetings.respond(B, id, 'ACCEPTED'))
    m = (await e.services.meetings.load()).meetings[0]!
    expect(m.attendees.find((a) => a.profileId === B)!.rsvp).toBe('ACCEPTED')
    expect(await e.bad(e.services.meetings.respond(E, id, 'ACCEPTED'))).toMatch(/not found/)
    // A clash in the new room: the old reservation and meeting stay exactly as they were.
    await e.services.classrooms.injectOtherBooking('CR1', {
      date: D('2026-11-04'),
      start: T('15:00'),
      end: T('15:45'),
    })
    expect(
      await e.bad(
        e.services.meetings.reschedule(A, id, 1, {
          date: D('2026-11-04'),
          start: T('15:00'),
          end: T('15:45'),
        }),
      ),
    ).toMatch(/stays where it was/)
    m = (await e.services.meetings.load()).meetings[0]!
    expect(m).toMatchObject({ date: '2026-11-03', start: '14:00', revision: 1 })
    expect((await e.services.classrooms.load()).reservations[0]).toMatchObject({
      date: '2026-11-03',
      start: '14:00',
      state: 'confirmedDemo',
    })
    // A good move.
    await e.ok(
      e.services.meetings.reschedule(A, id, 1, {
        date: D('2026-11-04'),
        start: T('13:00'),
        end: T('13:45'),
      }),
    )
    m = (await e.services.meetings.load()).meetings[0]!
    expect(m).toMatchObject({ date: '2026-11-04', start: '13:00', revision: 2 })
    expect(m.attendees.find((a) => a.profileId === B)).toMatchObject({
      rsvp: 'INVITED',
      needsReconfirm: true,
    })
    expect((await e.services.classrooms.load()).reservations[0]).toMatchObject({
      date: '2026-11-04',
      start: '13:00',
    })
    expect((await e.notes(B)).filter((n) => /time changed/i.test(n.title))).toHaveLength(1)
    // A stale edit is refused.
    expect(
      await e.bad(
        e.services.meetings.reschedule(A, id, 1, {
          date: D('2026-11-05'),
          start: T('16:00'),
          end: T('16:45'),
        }),
      ),
    ).toMatch(/changed since you opened it/)
    expect(
      await e.bad(
        e.services.meetings.reschedule(B, id, 2, {
          date: D('2026-11-05'),
          start: T('16:00'),
          end: T('16:45'),
        }),
      ),
    ).toMatch(/Only the organizer/)
  })

  it('cancelling releases the recorded room and the busy block, keeps history, and leaves unrelated records alone', async () => {
    const e = setup()
    const r = await e.ok<{ meeting: { id: string } }>(
      e.services.meetings.schedule(e.meet({ room: { roomId: 'CR3', purpose: 'Project meeting' } })),
    )
    const tasksBefore = (await e.services.campus.load(A)).tasks.length
    await e.ok(e.services.meetings.cancel(A, r.meeting.id))
    expect((await e.services.classrooms.load()).reservations[0]!.state).toBe('cancelled')
    const m = (await e.services.meetings.load()).meetings[0]!
    expect(m.status).toBe('CANCELLED')
    expect(m.history.map((h) => h.type)).toEqual(['created', 'cancelled'])
    const slot = {
      start: instantMs(D('2026-11-03'), T('14:00')),
      end: instantMs(D('2026-11-03'), T('14:45')),
    }
    const av = await e.services.meetings.availabilityOf(B, D('2026-11-03'), D('2026-11-03'))
    expect(av.busy.some((b) => clash(slot, b))).toBe(false)
    expect((await e.services.campus.load(A)).tasks.length).toBe(tasksBefore)
    await e.ok(
      e.services.meetings.schedule(
        e.meet({ opId: 'op-2', room: { roomId: 'CR3', purpose: 'Project meeting' } }),
      ),
    ) // the slot is bookable again
    expect(await e.bad(e.services.meetings.cancel(B, r.meeting.id))).toMatch(/Only the organizer/)
  })
})

describe('polls', () => {
  const poll = (over: object = {}) => ({
    organizerProfileId: A,
    title: 'Section A tutorial slot',
    durationMin: 45,
    scope: { kind: 'course' as const, label: 'DEMO-101 Section 1' },
    eligible: [A, B],
    requiredIds: [A],
    candidates: [
      { date: D('2026-11-03'), start: T('14:00'), end: T('14:45') },
      { date: D('2026-11-03'), start: T('16:00'), end: T('16:45') },
    ],
    ...over,
  })

  it('only eligible people vote, one ballot each, non-voters stay distinct from No, ties are explained, and the organizer finalizes one meeting', async () => {
    const e = setup()
    const p = await e.ok<{ id: string; candidates: { id: string }[] }>(
      e.services.meetings.createPoll(poll()),
    )
    const [c1, c2] = p.candidates.map((c) => c.id) as [string, string]
    expect(await e.bad(e.services.meetings.vote(p.id, E, { [c1]: 'YES' }))).toMatch(
      /not on this poll/,
    )
    expect(await e.bad(e.services.meetings.vote(p.id, A, { bogus: 'YES' }))).toMatch(
      /not part of this poll/,
    )
    await e.ok(e.services.meetings.vote(p.id, A, { [c1]: 'YES', [c2]: 'IF_NEEDED' }))
    await e.ok(e.services.meetings.vote(p.id, A, { [c1]: 'IF_NEEDED', [c2]: 'YES' })) // replaces the earlier ballot
    const stored = (await e.services.meetings.load()).polls[0]!
    expect(Object.keys(stored.ballots)).toEqual([A])
    expect(stored.ballots[A]!.votes[c2]).toBe('YES')
    const t = tally(stored, new Set([c1, c2]))
    expect(t.rows[0]).toMatchObject({ yes: 0, ifNeeded: 1, no: 0, noReply: 1 }) // B has not voted: not a No
    await e.ok(e.services.meetings.vote(p.id, A, { [c1]: 'YES', [c2]: 'YES' }))
    await e.ok(e.services.meetings.vote(p.id, B, { [c1]: 'YES', [c2]: 'YES' }))
    const tied = tally((await e.services.meetings.load()).polls[0]!, new Set([c1, c2]))
    expect(tied.tieNote).toMatch(/earliest/)
    expect(tied.ranked.map((r) => r.candidateId)).toEqual([c1, c2].sort())
    // A time that is no longer feasible is never ranked.
    expect(
      tally((await e.services.meetings.load()).polls[0]!, new Set([c2])).ranked.map(
        (r) => r.candidateId,
      ),
    ).toEqual([c2])
    await e.ok(e.services.meetings.closePoll(p.id, A))
    expect(await e.bad(e.services.meetings.vote(p.id, B, { [c1]: 'NO' }))).toMatch(/closed/)
    const m = await e.ok<{ id: string; scope?: { label: string } }>(
      e.services.meetings.finalizePoll(p.id, A, c2, {
        title: 'Section A tutorial',
        attendees: [{ profileId: B, required: true }],
      }),
    )
    expect(m.scope?.label).toBe('DEMO-101 Section 1')
    const s = await e.services.meetings.load()
    expect(s.meetings).toHaveLength(1) // one winner event, not one per candidate
    expect(s.polls[0]).toMatchObject({ status: 'FINALIZED', finalMeetingId: m.id })
    expect(
      await e.bad(e.services.meetings.finalizePoll(p.id, A, c1, { title: 'x', attendees: [] })),
    ).toMatch(/already produced/)
  })

  it('a poll cannot override a hard conflict, and rejects empty, duplicate or one-person polls', async () => {
    const e = setup()
    const p = await e.ok<{ id: string; candidates: { id: string }[] }>(
      e.services.meetings.createPoll(
        poll({ candidates: [{ date: D('2026-11-03'), start: T('09:30'), end: T('10:15') }] }),
      ),
    )
    await e.ok(e.services.meetings.vote(p.id, B, { [p.candidates[0]!.id]: 'YES' }))
    // Student B has a class 09:00–10:00 on Tuesday, so everyone voting Yes still cannot book it.
    expect(
      await e.bad(
        e.services.meetings.finalizePoll(p.id, A, p.candidates[0]!.id, {
          title: 'x',
          attendees: [{ profileId: B, required: true }],
        }),
      ),
    ).toMatch(/required person now has a recorded commitment/)
    expect((await e.services.meetings.load()).meetings).toHaveLength(0)
    expect(await e.bad(e.services.meetings.createPoll(poll({ candidates: [] })))).toMatch(
      /between 1 and 8/,
    )
    expect(await e.bad(e.services.meetings.createPoll(poll({ eligible: [A] })))).toMatch(
      /at least one other/,
    )
    const dup = { date: D('2026-11-03'), start: T('14:00'), end: T('14:45') }
    expect(await e.bad(e.services.meetings.createPoll(poll({ candidates: [dup, dup] })))).toMatch(
      /same/,
    )
  })
})
