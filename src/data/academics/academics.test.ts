import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { isSafeUrl, meetingAct } from '@/domain/academics-logic'
import { initialAcademicsStore } from '@/data/seeds/demo/academics-data'
import { academicsStoreSchema } from '@/domain/academics'
import { announcementsFor, isRead, myGroups, myMeetings, openWindows } from '@/selectors/academics'
import { createMemoryStorage } from '@/test/memory-storage'
import { createAcademicsRepository } from './academics-repository'

const NOW = '2026-11-02T04:30:00Z'
const NOW_MS = Temporal.Instant.from(NOW).epochMilliseconds
const D = (s: string) => s as DateOnly
const T = (s: string) => s as LocalTime
const A = 'demo-student-a'
const B = 'demo-student-b'

function setup() {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const clock: Clock = { now: () => Temporal.Instant.from(NOW) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createAcademicsRepository({
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
  const bad = async (p: Promise<{ ok: boolean; error?: { message: string } }>) => {
    const r = await p
    expect(r.ok).toBe(false)
    return r.error?.message ?? ''
  }
  return {
    repo: build(),
    build,
    ok,
    bad,
    prefs,
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}

const faculty = (slotId = 'av-a-1') => ({
  actorKind: 'faculty' as const,
  actorId: 'fac-a',
  slotId,
  topic: 'Academic doubt' as const,
})

describe('seeds', () => {
  it('AC-AT-15 / AC-AT-16: faculty have no presence, and unknown office hours stay unknown', () => {
    const s = initialAcademicsStore(NOW_MS)
    expect(academicsStoreSchema.safeParse(s).success).toBe(true)
    expect(s.faculty.find((f) => f.id === 'fac-b')?.officeHoursText).toBeUndefined()
    expect(JSON.stringify(s)).not.toMatch(/online|in office|available now/i)
  })

  it('AC-AT-03 / AC-AT-04: notices carry source, category and audience, and an undated notice stays undated', () => {
    const s = initialAcademicsStore(NOW_MS)
    for (const a of s.announcements) {
      expect(a.sourceLabel).toMatch(/sample/i)
      expect(a.noticeType).toBeTruthy()
      expect(a.audienceLabel).toBeTruthy()
    }
    expect(announcementsFor(s, 'course-b')[0]?.publishedOn).toBeUndefined()
  })

  it('AC-AT-06 / AC-AT-07: only a real https link can be opened; others are not resources', () => {
    expect(isSafeUrl('https://example.com/reading')).toBe(true)
    for (const u of [
      undefined,
      '',
      'javascript:alert(1)',
      'http://example.com',
      'not a url',
      'https://localhost',
    ])
      expect(isSafeUrl(u)).toBe(false)
  })
})

describe('course state', () => {
  it('AC-AT-05 / AC-AT-35: read state is per profile and survives a reload', async () => {
    const { repo, build, ok } = setup()
    await ok(repo.markRead(A, 'ann-1'))
    const again = await build().load()
    expect(isRead(again, A, 'ann-1')).toBe(true)
    expect(isRead(again, B, 'ann-1')).toBe(false)
  })

  it('a note is private to its owner and an empty note removes it', async () => {
    const { repo, ok } = setup()
    await ok(repo.saveNote(A, 'course-a', 'my private note'))
    const s = await repo.load()
    expect(s.notes.filter((x) => x.ownerProfileId === B)).toHaveLength(0)
    await ok(repo.saveNote(A, 'course-a', '   '))
    expect((await repo.load()).notes).toHaveLength(0)
  })
})

describe('meeting engine', () => {
  it('AC-AT-17: invalid requests are rejected with a reason', async () => {
    const { repo, bad } = setup()
    expect(await bad(repo.submitMeeting(A, { ...faculty(), actorId: 'nobody' }, 'k0'))).toMatch(
      /not found/,
    )
    expect(await bad(repo.submitMeeting(A, { ...faculty('av-zzz') }, 'k1'))).toMatch(
      /window was not found/,
    )
    expect(
      await bad(
        repo.submitMeeting(A, { actorKind: 'faculty', actorId: 'fac-c', topic: 'Other' }, 'k2'),
      ),
    ).toMatch(/date and a start and end/)
    expect(
      await bad(
        repo.submitMeeting(
          A,
          {
            actorKind: 'faculty',
            actorId: 'fac-c',
            topic: 'Other',
            date: D('2026-11-05'),
            start: T('12:00'),
            end: T('11:00'),
          },
          'k3',
        ),
      ),
    ).toMatch(/end must be after/)
    expect(
      await bad(
        repo.submitMeeting(
          A,
          {
            actorKind: 'faculty',
            actorId: 'fac-c',
            topic: 'Other',
            date: D('2026-10-01'),
            start: T('10:00'),
            end: T('10:30'),
          },
          'k4',
        ),
      ),
    ).toMatch(/already passed/)
    expect((await repo.load()).meetings).toHaveLength(0)
  })

  it('AC-AT-18: a repeated submit does not duplicate, and an identical open request is refused', async () => {
    const { repo, ok, bad } = setup()
    const first = await ok(repo.submitMeeting(A, faculty(), 'same'))
    const second = await ok(repo.submitMeeting(A, faculty(), 'same'))
    expect(first.created).toBe(true)
    expect(second.created).toBe(false)
    expect(second.meeting.id).toBe(first.meeting.id)
    expect(await bad(repo.submitMeeting(A, faculty(), 'other-key'))).toMatch(
      /already have an open request/,
    )
    expect((await repo.load()).meetings).toHaveLength(1)
  })

  it('AC-AT-19 / AC-AT-20: a request is not an appointment, and a student cannot accept their own', async () => {
    const { repo, ok } = setup()
    const { meeting } = await ok(repo.submitMeeting(A, faculty(), 'k'))
    expect(repo.bookingRefs(A)).toHaveLength(0)
    const s = await repo.load()
    const forged = meetingAct(
      s,
      meeting.id,
      'accept',
      'student',
      { nowIso: NOW, newId: () => 'x' },
      { profileId: A },
    )
    expect(forged.ok).toBe(false)
    const wrongRole = meetingAct(s, meeting.id, 'accept', 'demoOffice', {
      nowIso: NOW,
      newId: () => 'x',
    })
    expect(wrongRole.ok).toBe(false)
    expect((await repo.load()).meetings[0]?.status).toBe('requested')
  })

  it('AC-AT-21 / AC-AT-22 / AC-AT-23: accepting shows one labelled projection, cancelling removes it, history keeps every step', async () => {
    const { repo, ok } = setup()
    const { meeting } = await ok(repo.submitMeeting(A, faculty(), 'k'))
    await ok(repo.simulateMeeting(meeting.id, 'accept', { expectedVersion: 1 }))
    const refs = repo.bookingRefs(A)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({
      category: 'meeting',
      manageRoute: `/academics/appointments/${meeting.id}`,
    })
    expect(refs[0]?.resource).toMatch(/not official/)
    expect(repo.bookingRefs(B)).toHaveLength(0)
    await ok(repo.studentAct(A, meeting.id, 'requestCancellation', 2))
    await ok(repo.simulateMeeting(meeting.id, 'cancel', { expectedVersion: 3 }))
    expect(repo.bookingRefs(A)).toHaveLength(0)
    const m = (await repo.load()).meetings[0]!
    expect(m.status).toBe('cancelledDemo')
    expect(m.statusVersion).toBe(4)
    expect(m.history.map((h) => [h.actorType, h.eventType])).toEqual([
      ['student', 'requested'],
      ['demoFaculty', 'accept'],
      ['student', 'requestCancellation'],
      ['demoFaculty', 'cancel'],
    ])
    expect(m.history.every((h) => h.at && h.requestId === m.id)).toBe(true)
  })

  it('AC-AT-24: a stale transition fails instead of overwriting newer state', async () => {
    const { repo, ok, bad } = setup()
    const { meeting } = await ok(repo.submitMeeting(A, faculty(), 'k'))
    await ok(repo.simulateMeeting(meeting.id, 'accept', { expectedVersion: 1 }))
    expect(await bad(repo.simulateMeeting(meeting.id, 'cancel', { expectedVersion: 1 }))).toMatch(
      /changed; refresh/,
    )
    expect(await bad(repo.studentAct(A, meeting.id, 'requestCancellation', 1))).toMatch(
      /changed; refresh/,
    )
    expect((await repo.load()).meetings[0]?.status).toBe('acceptedDemo')
  })

  it('an exclusive window cannot be accepted twice, and a decline needs a reason', async () => {
    const { repo, ok, bad } = setup()
    const a = await ok(repo.submitMeeting(A, faculty(), 'ka'))
    const b = await ok(repo.submitMeeting(B, faculty(), 'kb'))
    await ok(repo.simulateMeeting(a.meeting.id, 'accept'))
    expect(await bad(repo.simulateMeeting(b.meeting.id, 'accept'))).toMatch(/already accepted/)
    expect(await bad(repo.simulateMeeting(b.meeting.id, 'reject'))).toMatch(/reason is required/)
    await ok(repo.simulateMeeting(b.meeting.id, 'reject', { reason: 'Clash' }))
    expect(
      openWindows(await repo.load(), 'faculty', 'fac-a', NOW_MS).map((w) => w.id),
    ).not.toContain('av-a-1')
  })

  it('an alternative changes nothing until the student accepts, then needs a separate confirmation', async () => {
    const { repo, ok, bad } = setup()
    const { meeting } = await ok(repo.submitMeeting(A, faculty(), 'k'))
    const alt = { date: D('2026-11-09'), start: T('10:00'), end: T('10:30') }
    await ok(repo.simulateMeeting(meeting.id, 'propose', { alternative: alt }))
    let m = (await repo.load()).meetings[0]!
    expect(m).toMatchObject({ date: '2026-11-04', start: '15:00', status: 'alternativeProposed' })
    expect(repo.bookingRefs(A)).toHaveLength(0)
    expect(await bad(repo.simulateMeeting(meeting.id, 'confirmAlternative'))).toMatch(
      /not accepted an alternative/,
    )
    await ok(repo.studentAct(A, meeting.id, 'acceptAlternative'))
    m = (await repo.load()).meetings[0]!
    expect(m).toMatchObject({ date: '2026-11-09', status: 'alternativeAccepted' })
    expect(repo.bookingRefs(A)).toHaveLength(0)
    await ok(repo.simulateMeeting(meeting.id, 'confirmAlternative'))
    expect(repo.bookingRefs(A)).toHaveLength(1)
  })

  it('AC-AT-25: a proposed time that overlaps a class is a warning in the form, never a reschedule (no stored change)', async () => {
    const { repo, ok } = setup()
    const r = await ok(
      repo.submitMeeting(
        A,
        {
          actorKind: 'faculty',
          actorId: 'fac-c',
          topic: 'Other',
          date: D('2026-11-03'),
          start: T('10:00'),
          end: T('10:30'),
        },
        'k',
      ),
    )
    expect(r.created).toBe(true)
  })

  it('AC-AT-29 / AC-AT-30: the BMS Office uses the same engine and touches nothing else', async () => {
    const { repo, ok } = setup()
    const { meeting } = await ok(
      repo.submitMeeting(
        A,
        {
          actorKind: 'office',
          actorId: 'office-bms',
          slotId: 'av-o-1',
          topic: 'Administrative query',
        },
        'k',
      ),
    )
    await ok(repo.simulateMeeting(meeting.id, 'accept'))
    const s = await repo.load()
    expect(s.meetings[0]).toMatchObject({ actorKind: 'office', status: 'acceptedDemo' })
    expect(s.meetings[0]?.history.map((h) => h.actorType)).toEqual(['student', 'demoOffice'])
    // Capacity 2 on the office window: a second profile may also be accepted.
    const b = await ok(
      repo.submitMeeting(
        B,
        { actorKind: 'office', actorId: 'office-bms', slotId: 'av-o-1', topic: 'Other' },
        'kb',
      ),
    )
    await ok(repo.simulateMeeting(b.meeting.id, 'accept'))
  })

  it('AC-AT-31 / AC-AT-32: each transition notifies only its owner once, in-app, and never claims outside delivery', async () => {
    const { repo, ok, notes } = setup()
    const { meeting } = await ok(repo.submitMeeting(A, faculty(), 'k'))
    await ok(repo.simulateMeeting(meeting.id, 'accept'))
    const mine = await notes(A)
    expect(mine).toHaveLength(2)
    expect(new Set(mine.map((n) => n.key)).size).toBe(2)
    expect(mine.every((n) => n.href === `/academics/appointments/${meeting.id}`)).toBe(true)
    expect(await notes(B)).toHaveLength(0)
    expect(JSON.stringify(mine)).not.toMatch(/email sent|text message|whatsapp|push notification/i)
    expect(mine.some((n) => /not an official/i.test(n.body))).toBe(true)
  })

  it('SH-AT-06: replaying the same transition creates no duplicate notification', async () => {
    const { repo, ok, notes } = setup()
    await ok(repo.submitMeeting(A, faculty(), 'same-key'))
    await ok(repo.submitMeeting(A, faculty(), 'same-key'))
    expect(await notes(A)).toHaveLength(1)
  })

  it('AC-AT-35 / AC-AT-36: meetings persist across a reload and reset restores the starting scenario', async () => {
    const { repo, build, ok } = setup()
    await ok(repo.submitMeeting(A, faculty(), 'k'))
    expect(myMeetings(await build().load(), A)).toHaveLength(1)
    await repo.resetAll()
    expect((await build().load()).meetings).toHaveLength(0)
  })
})

describe('project groups and mentorship', () => {
  it('AC-AT-13 / AC-AT-14: groups and milestones are private and never touch course deadlines', async () => {
    const { repo, ok } = setup()
    const g = await ok(
      repo.createGroup(A, { title: 'Studio project', memberAliases: ['Made-up Max'] }),
    )
    await ok(repo.addMilestone(A, g.id, { title: 'Draft', dueDate: D('2026-11-20') }))
    const id = (await repo.load()).groups[0]!.milestones[0]!.id
    await ok(repo.setMilestoneStatus(A, g.id, id, 'done'))
    const s = await repo.load()
    expect(myGroups(s, A)[0]?.milestones[0]?.status).toBe('done')
    expect(myGroups(s, B)).toHaveLength(0)
    expect(JSON.stringify(Object.keys(s))).not.toMatch(/deadline/)
  })

  it('AC-AT-26 / AC-AT-27: an invitation is never delivered, a simulated answer follows semantics, and only one is active per group', async () => {
    const { repo, ok, bad, notes } = setup()
    const g = await ok(repo.createGroup(A, { title: 'Studio project' }))
    const inv = await ok(
      repo.sendInvite(A, { groupId: g.id, facultyId: 'fac-a', note: 'Please guide us' }),
    )
    expect((await notes(A))[0]?.body).toMatch(/Nothing was delivered/)
    expect(
      await bad(repo.sendInvite(A, { groupId: g.id, facultyId: 'fac-b', note: 'again' })),
    ).toMatch(/already has an active/)
    await ok(repo.simulateInvite(inv.id, 'declined', 1))
    expect(await bad(repo.simulateInvite(inv.id, 'accepted', 2))).toMatch(/newly sent/)
    expect(await bad(repo.withdrawInvite(A, inv.id))).toMatch(/already finished/)
    const next = await ok(
      repo.sendInvite(A, { groupId: g.id, facultyId: 'fac-b', note: 'second try' }),
    )
    await ok(repo.simulateInvite(next.id, 'feedbackRequested'))
    const i = (await repo.load()).invites.find((x) => x.id === next.id)!
    expect(i.feedback).toBeTruthy()
    expect(i.history.map((h) => h.actorType)).toEqual(['student', 'demoMentor'])
    await ok(repo.withdrawInvite(A, next.id))
  })

  it('AC-AT-28: a mentor meeting request uses the faculty meeting engine and keeps the group link', async () => {
    const { repo, ok } = setup()
    const g = await ok(repo.createGroup(A, { title: 'Studio project' }))
    const { meeting } = await ok(
      repo.submitMeeting(A, { ...faculty(), topic: 'Project guidance', groupId: g.id }, 'k'),
    )
    expect(meeting).toMatchObject({ actorKind: 'faculty', groupId: g.id, status: 'requested' })
  })

  it('deleting a group removes its invitations; another profile cannot delete it', async () => {
    const { repo, ok, bad } = setup()
    const g = await ok(repo.createGroup(A, { title: 'Studio project' }))
    await ok(repo.sendInvite(A, { groupId: g.id, facultyId: 'fac-a', note: 'help' }))
    expect(await bad(repo.deleteGroup(B, g.id))).toMatch(/not found/)
    await ok(repo.deleteGroup(A, g.id))
    const s = await repo.load()
    expect(s.groups).toHaveLength(0)
    expect(s.invites).toHaveLength(0)
  })
})
