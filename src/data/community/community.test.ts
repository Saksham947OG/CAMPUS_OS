import { Temporal } from 'temporal-polyfill'
import { createPrefsRepositories } from '@/data/prefs/prefs'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { initialCommunityStore } from '@/data/seeds/demo/community-data'
import { communityStoreSchema, validatePhoto, type Report } from '@/domain/community'
import { findDuplicate, matchCandidates, needOpen, recruitmentView } from '@/domain/community-logic'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { listClubs, listFixtures, listReports, viewClaim, viewReport } from '@/selectors/community'
import { createMemoryStorage } from '@/test/memory-storage'
import { createCommunityRepository } from './community-repository'

const NOW = '2026-11-02T04:30:00Z' // Monday 2 Nov 2026, 10:00 IST
const NOW_MS = Temporal.Instant.from(NOW).epochMilliseconds
const D = (s: string) => s as DateOnly
const T = (s: string) => s as LocalTime
const A = 'demo-student-a'
const B = 'demo-student-b'
const E = 'demo-student-empty'
const captainA = { kind: 'student' as const, profileId: A }
const captainB = { kind: 'student' as const, profileId: B }
const fictional = { kind: 'demoCaptain' as const }

function setup(at = NOW) {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const clock: Clock = { now: () => Temporal.Instant.from(at) }
  let n = 0
  const prefs = createPrefsRepositories(storage)
  const build = () =>
    createCommunityRepository({
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
    storage,
    prefs,
    repo: build(),
    build,
    ok,
    bad,
    notes: async (p: string) => (await prefs.notifications.load(p)).value.items,
  }
}

const lostBag = (extra: Partial<Report> = {}) => ({
  kind: 'lost' as const,
  title: 'Black rucksack',
  category: 'bag' as const,
  colour: 'black',
  area: 'Library area' as const,
  publish: true,
  ...extra,
})

describe('seeds', () => {
  it('CO-AT-14 / CO-AT-15 / CO-AT-16: only fictional clubs, with no phone, handle or link-like contact', () => {
    const s = initialCommunityStore(NOW_MS)
    expect(communityStoreSchema.safeParse(s).success).toBe(true)
    expect(listClubs(s, 'robot', '').map((c) => c.id)).toEqual(['club-robotics'])
    expect(listClubs(s, '', 'committee').map((c) => c.id)).toEqual(['club-sports-committee'])
    expect(listClubs(s, 'zzz', '')).toHaveLength(0)
    const text = JSON.stringify(s.clubs)
    expect(text).not.toMatch(/\+?\d{10}|instagram|@[a-z]+|whatsapp/i)
    expect(s.clubs.find((c) => c.id === 'club-quiz')?.recruitment.url).toBe(
      'https://example.com/join',
    )
    expect(s.clubs.find((c) => c.id === 'club-robotics')?.recruitment.url).toBeUndefined()
  })

  it('CO-AT-23: "closing soon" comes only from a real close date and never invents a time', () => {
    const s = initialCommunityStore(NOW_MS)
    const today = D('2026-11-02')
    expect(
      recruitmentView(
        s.clubs.find((c) => c.id === 'club-robotics')!,
        today,
        7,
      ),
    ).toBe('closingSoon')
    expect(
      recruitmentView(
        s.clubs.find((c) => c.id === 'club-quiz')!,
        today,
        7,
      ),
    ).toBe('open') // no date, never "closing soon"
    expect(
      recruitmentView(
        s.clubs.find((c) => c.id === 'club-drama')!,
        today,
        7,
      ),
    ).toBe('closed')
    expect(
      recruitmentView(
        s.clubs.find((c) => c.id === 'club-sports-committee')!,
        today,
        7,
      ),
    ).toBe('notAnnounced')
    expect(
      recruitmentView({ recruitment: { state: 'open', closeDate: '2026-11-01' } }, today, 7),
    ).toBe('closed')
    expect(JSON.stringify(s.clubs.map((c) => c.recruitment))).not.toMatch(/\d\d:\d\d/)
  })

  it('CO-AT-05: an unsupported or oversize picture is rejected', () => {
    expect(validatePhoto({ name: 'a.gif', type: 'image/gif', size: 100 })).toMatch(
      /JPEG, PNG or WebP/,
    )
    expect(validatePhoto({ name: 'a.png', type: 'image/png', size: 3_000_000 })).toMatch(
      /larger than 2 MB/,
    )
    expect(validatePhoto({ name: 'a.png', type: 'image/png', size: 0 })).toMatch(/empty/)
    expect(validatePhoto({ name: 'a.png', type: 'image/png', size: 5000 })).toBeNull()
  })
})

describe('Lost & Found', () => {
  it('CO-AT-03: a report validates, saves and survives a reload; an unknown date stays unknown', async () => {
    const { repo, build, ok, bad } = setup()
    expect(await bad(repo.createReport(A, lostBag({ title: '  ' }), 'k0'))).toMatch(/short title/)
    expect(await bad(repo.createReport(A, lostBag({ area: 'Moon' as never }), 'k0b'))).toMatch(
      /general area/,
    )
    const { report, created } = await ok(repo.createReport(A, lostBag(), 'k1'))
    expect(created).toBe(true)
    expect(report.approxDate).toBeUndefined()
    const again = await ok(repo.createReport(A, lostBag(), 'k1'))
    expect(again.created).toBe(false)
    expect((await build().load()).reports.filter((r) => r.ownerProfileId === A)).toHaveLength(1)
  })

  it('CO-AT-04 / CO-AT-01: private details stay with the owner; public lists carry only public fields', async () => {
    const { repo, ok } = setup()
    await ok(
      repo.createReport(
        A,
        {
          ...lostBag({ kind: 'found' as never }),
          kind: 'found',
          privateDetails: 'tiny red sticker',
          publish: true,
        },
        'k1',
      ),
    )
    const s = await repo.load()
    const mine = s.reports.find((r) => r.ownerProfileId === A)!
    expect(viewReport(mine, A).privateDetails).toBe('tiny red sticker')
    expect(viewReport(mine, B).privateDetails).toBeUndefined()
    const asB = listReports(s, B, { tab: 'found', q: '', category: '', area: '', since: '' })
    expect(JSON.stringify(asB)).not.toMatch(/tiny red sticker/)
    expect(
      listReports(s, A, { tab: 'mine', q: '', category: '', area: '', since: '' }).every(
        (r) => r.ownerProfileId === A,
      ),
    ).toBe(true)
    expect(
      listReports(s, A, { tab: 'lost', q: '', category: '', area: '', since: '' }),
    ).toHaveLength(0)
  })

  it('CO-AT-02: search, category, area and date filters work together and reset restores everything', async () => {
    const s = initialCommunityStore(NOW_MS)
    const all = listReports(s, A, { tab: 'found', q: '', category: '', area: '', since: '' })
    expect(all).toHaveLength(3)
    expect(
      listReports(s, A, {
        tab: 'found',
        q: 'backpack',
        category: 'bag',
        area: 'Library area',
        since: '',
      }),
    ).toHaveLength(1)
    expect(
      listReports(s, A, { tab: 'found', q: 'backpack', category: 'keys', area: '', since: '' }),
    ).toHaveLength(0)
    // Reports with an unknown date drop out when a date filter is set.
    expect(
      listReports(s, A, { tab: 'found', q: '', category: '', area: '', since: '2026-10-01' }).map(
        (r) => r.id,
      ),
    ).toEqual(['rep-1'])
  })

  it('CO-AT-07: a possible match needs a category plus another shared detail and never says verified', async () => {
    const { repo, ok } = setup()
    await ok(repo.createReport(A, lostBag(), 'k1'))
    const s = await repo.load()
    const mine = s.reports.find((r) => r.ownerProfileId === A)!
    const m = matchCandidates(s, mine)
    expect(m.map((x) => x.report.id)).toEqual(['rep-1'])
    expect(m[0]!.signals).toEqual(
      expect.arrayContaining(['Same broad category', 'Same colour', 'Same general area']),
    )
    expect(JSON.stringify(m)).not.toMatch(/verified owner/i)
    // Same category only: no suggestion.
    await ok(
      repo.createReport(
        A,
        { kind: 'lost', title: 'Grey satchel', category: 'bag', colour: 'grey', publish: true },
        'k2',
      ),
    )
    const s2 = await repo.load()
    expect(
      matchCandidates(
        s2,
        s2.reports.find((r) => r.title === 'Grey satchel')!,
      ),
    ).toHaveLength(0)
    // A draft never matches.
    expect(matchCandidates(s2, { ...mine, status: 'draft' })).toHaveLength(0)
  })

  it('a possible match is announced once to each owner without exposing private details', async () => {
    const { repo, ok, notes } = setup()
    await ok(repo.createReport(A, lostBag(), 'k1'))
    const a = await notes(A)
    const b = await notes(B)
    expect(a).toHaveLength(1)
    expect(b).toHaveLength(1)
    expect(a[0]!.body).toMatch(/only a suggestion/)
    expect(JSON.stringify([a, b])).not.toMatch(/Blue keychain/)
  })

  it('CO-AT-12: a similar open report is suggested, never merged, and needs confirmation', async () => {
    const { repo, ok, bad } = setup()
    await ok(repo.createReport(A, lostBag(), 'k1'))
    expect(await bad(repo.createReport(A, lostBag({ title: ' black RUCKSACK ' }), 'k2'))).toMatch(
      /similar open report/,
    )
    const s = await repo.load()
    expect(
      findDuplicate(s, A, { kind: 'lost', title: 'Black rucksack', category: 'bag' })?.title,
    ).toBe('Black rucksack')
    await ok(repo.createReport(A, lostBag({ title: ' black RUCKSACK ' }), 'k3', true))
    expect((await repo.load()).reports.filter((r) => r.ownerProfileId === A)).toHaveLength(2)
  })

  it('CO-AT-08 / CO-AT-09: a claim needs a private answer, has a history and is invisible to others', async () => {
    const { repo, ok, bad, notes } = setup()
    expect(await bad(repo.submitClaim(A, 'rep-1', '   '))).toMatch(/only its owner would know/)
    expect(await bad(repo.submitClaim(B, 'rep-1', 'x'))).toMatch(
      /cannot claim an item you reported/,
    )
    expect(await bad(repo.submitClaim(A, 'nope', 'x'))).toMatch(/not open for claims/)
    const claim = await ok(repo.submitClaim(A, 'rep-1', 'It has a blue keychain'))
    expect(await bad(repo.submitClaim(A, 'rep-1', 'again'))).toMatch(/already have an open claim/)
    const s = await repo.load()
    expect(viewClaim(s.claims[0]!, A)?.privateAnswer).toBe('It has a blue keychain')
    expect(viewClaim(s.claims[0]!, B)).toBeUndefined()
    expect(claim.history.map((h) => h.eventType)).toEqual(['requested'])
    // The reporter is told a claim exists, but not what it says.
    const toB = await notes(B)
    expect(toB.some((n) => /asked to claim/.test(n.title))).toBe(true)
    expect(JSON.stringify(toB)).not.toMatch(/blue keychain/i)
  })

  it('CO-AT-10 / CO-AT-11: only one competing claim can win, and a handover archives without erasing history', async () => {
    const { repo, ok, bad, notes } = setup()
    const c1 = await ok(repo.submitClaim(A, 'rep-1', 'blue keychain'))
    const c2 = await ok(repo.submitClaim(E, 'rep-1', 'a sticker'))
    expect(await bad(repo.reviewClaim(c1.id, 'approve'))).toMatch(/under review before/)
    await ok(repo.reviewClaim(c1.id, 'startReview', { expectedVersion: 1 }))
    await ok(repo.reviewClaim(c2.id, 'startReview'))
    expect(await bad(repo.reviewClaim(c1.id, 'startReview', { expectedVersion: 1 }))).toMatch(
      /changed; refresh/,
    )
    await ok(repo.reviewClaim(c1.id, 'approve'))
    let s = await repo.load()
    expect(s.claims.find((c) => c.id === c2.id)!.status).toBe('demoRejected')
    expect(await bad(repo.reviewClaim(c2.id, 'approve'))).toMatch(/under review before/)
    expect(await bad(repo.submitClaim(E, 'rep-1', 'late'))).toMatch(/already approved|already have/)
    // The losing claimant is told nothing about the winner.
    const lost = await notes(E)
    expect(lost.some((n) => /Another claim.*approved/.test(n.body))).toBe(true)
    expect(JSON.stringify(lost)).not.toMatch(/Demo Student A|blue keychain/)
    expect(await bad(repo.markReturned('rep-2'))).toMatch(/No claim is approved/)
    await ok(repo.markReturned('rep-1'))
    s = await repo.load()
    expect(
      listReports(s, A, { tab: 'found', q: 'backpack', category: '', area: '', since: '' }),
    ).toHaveLength(0)
    const owner = s.reports.find((r) => r.id === 'rep-1')!
    expect(owner.status).toBe('returned')
    expect(owner.handoverAt).toBeTruthy()
    expect(
      listReports(s, B, { tab: 'mine', q: '', category: '', area: '', since: '' }).map((r) => r.id),
    ).toContain('rep-1')
    expect(s.claims.find((c) => c.id === c1.id)!.history.length).toBeGreaterThan(1)
  })

  it('a reason is required to refuse a claim, and the claimant can withdraw', async () => {
    const { repo, ok, bad } = setup()
    const c = await ok(repo.submitClaim(A, 'rep-1', 'blue keychain'))
    expect(await bad(repo.reviewClaim(c.id, 'reject'))).toMatch(/reason is required/)
    await ok(repo.withdrawClaim(A, c.id))
    expect(await bad(repo.withdrawClaim(A, c.id))).toMatch(/already finished/)
    expect(await bad(repo.withdrawClaim(B, c.id))).toMatch(/not found/)
  })

  it('closing a report ends any waiting claim', async () => {
    const { repo, ok } = setup()
    const c = await ok(repo.submitClaim(A, 'rep-1', 'blue keychain'))
    await ok(repo.closeReport(B, 'rep-1'))
    expect((await repo.load()).claims.find((x) => x.id === c.id)!.status).toBe('demoRejected')
  })
})

describe('clubs', () => {
  it('CO-AT-17: following is a per-profile preference, not a membership', async () => {
    const { repo, ok, bad } = setup()
    await ok(repo.setFollow(A, 'club-robotics', true))
    const s = await repo.load()
    expect(s.follows[A]).toEqual(['club-robotics'])
    expect(s.follows[B]).toBeUndefined()
    expect(JSON.stringify(s)).not.toMatch(/member(ship)?s?":\s*\[[^\]]*demo-student-a/)
    expect(await bad(repo.setFollow(A, 'club-nope', true))).toMatch(/not found/)
    await ok(repo.setFollow(A, 'club-robotics', false))
    expect((await repo.load()).follows[A]).toEqual([])
  })

  it('CO-AT-20 / CO-AT-21 / CO-AT-22: a followed club event is projected once, keeps its id when changed, and followers hear once', async () => {
    const { repo, ok, notes } = setup()
    expect(repo.bookingRefs(A)).toHaveLength(0)
    await ok(repo.setFollow(A, 'club-robotics', true))
    await ok(repo.setFollow(A, 'club-drama', true)) // its event is date-only: no timed block
    const refs = repo.bookingRefs(A)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toMatchObject({ id: 'cev-1', category: 'club', status: 'active' })
    expect(repo.bookingRefs(E)).toHaveLength(0)
    await ok(
      repo.changeClubEvent('cev-1', {
        date: D('2026-11-06'),
        start: T('15:00'),
        end: T('16:00'),
        reason: 'Lab clash',
      }),
    )
    expect(repo.bookingRefs(A)).toHaveLength(1)
    expect(repo.bookingRefs(A)[0]).toMatchObject({
      id: 'cev-1',
      date: '2026-11-06',
      start: '15:00',
    })
    await ok(repo.changeClubEvent('cev-1', { cancel: true }))
    expect(repo.bookingRefs(A)[0]!.status).toBe('cancelled')
    const mine = (await notes(A)).filter((n) => n.href === '/community/clubs/club-robotics')
    expect(mine).toHaveLength(2) // one per version
    expect(await notes(B)).toHaveLength(0)
  })
})

describe('teams and fixtures', () => {
  it('CO-AT-25 / CO-AT-26: a team validates, persists with a stable id, and same-named teams stay distinct', async () => {
    const { repo, build, ok, bad } = setup()
    expect(await bad(repo.createTeam(A, { sport: 'Football', name: '  ' }))).toMatch(
      /Give the team a name/,
    )
    expect(await bad(repo.createTeam(A, { sport: 'Football', name: 'X', maxRoster: 1 }))).toMatch(
      /2 to 30/,
    )
    expect(await bad(repo.createTeam(A, { sport: 'Football', name: 'X', maxRoster: 40 }))).toMatch(
      /2 to 30/,
    )
    expect(await bad(repo.createTeam(A, { sport: 'Moon' as never, name: 'X' }))).toMatch(
      /Choose a sport/,
    )
    const t = await ok(repo.createTeam(A, { sport: 'Football', name: 'Demo Strikers' }))
    const s = await build().load()
    expect(s.teams.filter((x) => x.name === 'Demo Strikers').map((x) => x.id)).toHaveLength(3)
    expect(new Set(s.teams.map((x) => x.id)).size).toBe(s.teams.length)
    expect(s.teams.find((x) => x.id === t.id)).toMatchObject({
      captainProfileId: A,
      members: [A],
      maxRoster: 8,
    })
  })

  it('CO-AT-27 / CO-AT-28 / CO-AT-29 / CO-AT-30: one active request each, capacity is rechecked at decision time and the roster counts accepted members only', async () => {
    const { repo, ok, bad } = setup()
    const ra = await ok(repo.requestJoin(A, 'team-1'))
    expect(await bad(repo.requestJoin(A, 'team-1'))).toMatch(/already have a request/)
    const rb = await ok(repo.requestJoin(B, 'team-1'))
    const re = await ok(repo.requestJoin(E, 'team-1'))
    let team = (await repo.load()).teams.find((t) => t.id === 'team-1')!
    expect(team.members).toHaveLength(0) // pending requests never count
    await ok(repo.decideJoin(fictional, 'team-1', ra.id, 'accept'))
    await ok(repo.decideJoin(fictional, 'team-1', rb.id, 'accept'))
    expect(await bad(repo.decideJoin(fictional, 'team-1', re.id, 'accept'))).toMatch(/team is full/)
    await ok(repo.decideJoin(fictional, 'team-1', re.id, 'reject'))
    team = (await repo.load()).teams.find((t) => t.id === 'team-1')!
    expect(team.members).toEqual([A, B])
    expect(await bad(repo.requestJoin(E, 'team-1'))).toMatch(/not recruiting|full/)
    await ok(repo.leaveTeam(A, 'team-1'))
    expect((await repo.load()).teams.find((t) => t.id === 'team-1')!.members).toEqual([B])
    const withdrawn = await ok(repo.requestJoin(A, 'team-1'))
    await ok(repo.withdrawJoin(A, withdrawn.id))
    expect((await repo.load()).teams.find((t) => t.id === 'team-1')!.members).toEqual([B])
  })

  it('CO-AT-37: only the captain can decide, and the simulator cannot act for a real profile’s team', async () => {
    const { repo, ok, bad } = setup()
    const r = await ok(repo.requestJoin(A, 'team-2')) // captained by Demo Student B
    expect(await bad(repo.decideJoin(captainA, 'team-2', r.id, 'accept'))).toMatch(
      /Only the team captain/,
    )
    expect(await bad(repo.decideJoin(fictional, 'team-2', r.id, 'accept'))).toMatch(
      /Only the team captain/,
    )
    expect(await bad(repo.decideJoin(captainB, 'team-3', r.id, 'accept'))).toMatch(/not found/)
    await ok(repo.decideJoin(captainB, 'team-2', r.id, 'accept'))
    expect(await bad(repo.setRecruiting(captainA, 'team-2', false))).toMatch(
      /Only the team captain/,
    )
    expect(await bad(repo.cancelTeam(captainA, 'team-2'))).toMatch(/Only the team captain/)
    expect(
      await bad(
        repo.postNeed(captainA, 'team-2', { description: 'x', expiresOn: D('2026-11-10') }),
      ),
    ).toMatch(/Only the team captain/)
  })

  it('CO-AT-31: roster acceptance is not committee approval; approval is a separate simulated step', async () => {
    const { repo, ok, bad } = setup()
    const r = await ok(repo.requestJoin(A, 'team-2'))
    await ok(repo.decideJoin(captainB, 'team-2', r.id, 'accept'))
    let t = (await repo.load()).teams.find((x) => x.id === 'team-2')!
    expect(t.members).toContain(A)
    expect(t.status).toBe('recruiting') // still not approved
    expect(await bad(repo.submitTeam(captainB, 'team-2'))).toMatch(/Close the roster first/)
    expect(await bad(repo.decideTeamApproval('team-2', 'approvedDemo'))).toMatch(
      /Only a submitted team/,
    )
    await ok(repo.setRecruiting(captainB, 'team-2', false))
    await ok(repo.submitTeam(captainB, 'team-2'))
    await ok(repo.decideTeamApproval('team-2', 'approvedDemo'))
    t = (await repo.load()).teams.find((x) => x.id === 'team-2')!
    expect(t.status).toBe('approvedDemo')
    expect(t.history.map((h) => h.actorType)).toContain('demoCommittee')
  })

  it('CO-AT-32: a looking-for-players post closes only on its configured date or by hand', async () => {
    const { repo, ok, bad } = setup()
    const s = await repo.load()
    expect(s.needs.map((n) => [n.id, needOpen(n, D('2026-11-02'))])).toEqual([
      ['need-1', true],
      ['need-2', false],
    ])
    expect(needOpen(s.needs[0]!, D('2026-11-06'))).toBe(false)
    const made = await ok(repo.createTeam(A, { sport: 'Football', name: 'Mine' }))
    expect(
      await bad(repo.postNeed(captainA, made.id, { description: 'x', expiresOn: D('2026-10-01') })),
    ).toMatch(/today or later/)
    const n = await ok(
      repo.postNeed(captainA, made.id, {
        description: 'Need a keeper',
        expiresOn: D('2026-11-10'),
      }),
    )
    await ok(repo.closeNeed(captainA, n.id))
    expect(
      needOpen(
        (await repo.load()).needs.find((x) => x.id === n.id)!,
        D('2026-11-02'),
      ),
    ).toBe(false)
  })

  it('CO-AT-33 / CO-AT-39: a fixture with no time shows unknown and is not projected; filters keep the right fixtures', async () => {
    const { repo, ok } = setup()
    const s = await repo.load()
    const fx2 = s.fixtures.find((f) => f.id === 'fx-2')!
    expect(fx2.start).toBeUndefined()
    expect(fx2.venue).toBeUndefined()
    const t3 = await ok(repo.requestJoin(A, 'team-3'))
    await ok(repo.decideJoin(fictional, 'team-3', t3.id, 'accept'))
    expect(repo.bookingRefs(A)).toHaveLength(0) // fx-2 has no confirmed time
    const today = D('2026-11-02')
    expect(
      listFixtures(s, { sport: 'Football', when: 'all', teamId: '' }, today).map((f) => f.id),
    ).toEqual(['fx-2'])
    expect(
      listFixtures(s, { sport: '', when: 'all', teamId: 'team-1' }, today).map((f) => f.id),
    ).toEqual(['fx-1'])
    expect(listFixtures(s, { sport: '', when: 'past', teamId: '' }, today)).toHaveLength(0)
    expect(
      listFixtures(s, { sport: 'Basketball', when: 'upcoming', teamId: 'team-3' }, today),
    ).toHaveLength(0)
  })

  it('CO-AT-34 / CO-AT-35 / CO-AT-38: a reschedule keeps one canonical fixture and one projection; a cancel tells only its members once', async () => {
    const { repo, ok, bad, notes } = setup()
    const ra = await ok(repo.requestJoin(A, 'team-1'))
    await ok(repo.decideJoin(fictional, 'team-1', ra.id, 'accept'))
    expect(repo.bookingRefs(A).map((r) => r.id)).toEqual(['fx-1'])
    expect(repo.bookingRefs(E)).toHaveLength(0)
    await ok(
      repo.changeFixture(
        'fx-1',
        {
          kind: 'reschedule',
          date: D('2026-11-07'),
          start: T('10:00'),
          end: T('11:00'),
          reason: 'Rain',
        },
        1,
      ),
    )
    expect(await bad(repo.changeFixture('fx-1', { kind: 'cancel' }, 1))).toMatch(/changed; refresh/)
    let s = await repo.load()
    const f = s.fixtures.find((x) => x.id === 'fx-1')!
    expect(s.fixtures.filter((x) => x.id === 'fx-1')).toHaveLength(1)
    expect(f).toMatchObject({ status: 'rescheduled', version: 2, date: '2026-11-07' })
    expect(f.revisions[0]).toMatchObject({
      version: 1,
      date: '2026-11-06',
      start: '16:00',
      reason: 'Rain',
    })
    expect(repo.bookingRefs(A)).toHaveLength(1)
    expect(repo.bookingRefs(A)[0]).toMatchObject({
      id: 'fx-1',
      date: '2026-11-07',
      category: 'sports',
    })
    await ok(repo.changeFixture('fx-1', { kind: 'cancel' }, 2))
    expect(repo.bookingRefs(A)[0]!.status).toBe('cancelled')
    expect(await bad(repo.changeFixture('fx-1', { kind: 'cancel' }))).toMatch(/finished/)
    const toA = (await notes(A)).filter((n) => n.href === '/community/sports-events/fixtures/fx-1')
    expect(toA).toHaveLength(2)
    expect(await notes(E)).toHaveLength(0)
    expect(await notes(B)).toHaveLength(2) // B captains team-2, the other team in this fixture
    s = await repo.load()
    // No court is reserved by any of this.
    expect(JSON.stringify(s)).not.toMatch(/reservation|booking/i)
  })

  it('CO-AT-36: a fixture never completes just because time has passed', async () => {
    const { repo, storage, prefs, ok } = setup()
    await ok(repo.setFollow(A, 'club-quiz', true)) // writes the starting scenario to storage
    const later = createCommunityRepository({
      storage,
      clock: { now: () => Temporal.Instant.from('2027-03-01T04:30:00Z') },
      newId: (p) => `${p}-later`,
      notifications: prefs.notifications,
    })
    const s = await later.load()
    expect(s.fixtures.map((f) => f.status)).toEqual(['scheduled', 'tentative'])
    expect(
      listFixtures(s, { sport: '', when: 'past', teamId: '' }, D('2027-03-01')).map((f) => f.id),
    ).toEqual(['fx-1', 'fx-2'])
    expect(s.fixtures.find((f) => f.id === 'fx-1')!.result).toBeUndefined()
  })

  it('completing is a deliberate step and records only the text it is given', async () => {
    const { repo, ok } = setup()
    await ok(repo.changeFixture('fx-1', { kind: 'complete', result: '' }))
    const f = (await repo.load()).fixtures.find((x) => x.id === 'fx-1')!
    expect(f.status).toBe('completedDemo')
    expect(f.result).toBeUndefined()
  })

  it('a captain cancelling keeps history and tells joined members once', async () => {
    const { repo, ok, notes } = setup()
    const r = await ok(repo.requestJoin(A, 'team-2'))
    await ok(repo.decideJoin(captainB, 'team-2', r.id, 'accept'))
    const pending = await ok(repo.requestJoin(E, 'team-2'))
    await ok(repo.cancelTeam(captainB, 'team-2'))
    const s = await repo.load()
    expect(s.teams.find((t) => t.id === 'team-2')!.status).toBe('withdrawn')
    expect(s.joinRequests.find((x) => x.id === pending.id)!.status).toBe('withdrawn')
    expect((await notes(A)).filter((n) => /cancelled/i.test(n.title))).toHaveLength(1)
  })
})

describe('whole module', () => {
  it('CO-AT-40 / CO-AT-43: everything persists across a reload, and reset restores the starting scenario', async () => {
    const { repo, build, ok } = setup()
    await ok(repo.createTeam(A, { sport: 'Football', name: 'Mine' }))
    await ok(repo.setFollow(A, 'club-quiz', true))
    expect((await build().load()).teams.some((t) => t.name === 'Mine')).toBe(true)
    await repo.resetAll()
    const s = await build().load()
    expect(s.teams.some((t) => t.name === 'Mine')).toBe(false)
    expect(s.follows).toEqual({})
    expect(s.reports.map((r) => r.id)).toEqual(['rep-1', 'rep-2', 'rep-3'])
  })

  it('CO-AT-42: no notice claims outside delivery, real committee approval or live sync', async () => {
    const { repo, ok, notes } = setup()
    await ok(repo.createReport(A, lostBag(), 'k1'))
    const c = await ok(repo.submitClaim(A, 'rep-1', 'blue keychain'))
    await ok(repo.reviewClaim(c.id, 'startReview'))
    const r = await ok(repo.requestJoin(A, 'team-1'))
    await ok(repo.decideJoin(fictional, 'team-1', r.id, 'accept'))
    const text = JSON.stringify([await notes(A), await notes(B)])
    expect(text).not.toMatch(/email|sms|whatsapp|push notification|real committee has|officially/i)
  })
})
