import type { Provenance } from '@/domain/provenance'
import type { Club, ClubEvent, CommunityStore, Fixture, Report, Team } from '@/domain/community'
import { addDays, fixedClock, isoFromMs, type DateOnly, type LocalTime } from '@/lib/time'
import { makeNow } from '@/selectors/now'

const demo = (
  nowIso: string,
  label = 'Illustrative sample record (not a real club, team or item)',
): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: label,
  updatedAt: nowIso,
})

/**
 * The starting Community scenario. Four fictional clubs (one with an open link, one open without a
 * link, one closed, one committee with nothing announced), three fictional events (one date-only),
 * teams including two with the SAME name, fixtures including one with no venue or time, and a few
 * found items reported by Reference Student B. Nobody in it is real, and no phone number, handle or
 * precise room appears.
 */
export function initialCommunityStore(nowMs: number): CommunityStore {
  const nowIso = isoFromMs(nowMs)
  const today: DateOnly = makeNow(fixedClock(nowIso)).today
  const day = (n: number) => addDays(today, n)
  const T = (s: string) => s as LocalTime
  const src = 'Illustrative sample record (not a real club)'
  const club = (c: Omit<Club, 'sourceLabel' | 'provenance'>): Club => ({
    ...c,
    sourceLabel: src,
    provenance: demo(nowIso),
  })
  const event = (
    e: Omit<ClubEvent, 'status' | 'version' | 'history' | 'sourceLabel' | 'provenance'>,
  ): ClubEvent => ({
    ...e,
    status: 'scheduled',
    version: 1,
    history: [],
    sourceLabel: 'Illustrative sample event (not a real event)',
    provenance: demo(nowIso),
  })
  const team = (
    t: Omit<Team, 'status' | 'createdAt' | 'updatedAt' | 'provenance' | 'history'>,
  ): Team => ({
    ...t,
    status: 'recruiting',
    createdAt: nowIso,
    updatedAt: nowIso,
    provenance: demo(nowIso, 'Illustrative sample team (not a real team)'),
    history: [],
  })
  const fixture = (
    f: Omit<Fixture, 'version' | 'revisions' | 'sourceLabel' | 'provenance'>,
  ): Fixture => ({
    ...f,
    version: 1,
    revisions: [],
    sourceLabel: 'Illustrative sample fixture (not a real fixture)',
    provenance: demo(nowIso),
  })
  const found = (
    id: string,
    title: string,
    category: Report['category'],
    extra: Partial<Report>,
  ): Report => ({
    id,
    ownerProfileId: 'demo-student-b',
    kind: 'found',
    title,
    category,
    status: 'published',
    createdAt: nowIso,
    updatedAt: nowIso,
    provenance: demo(nowIso, 'Illustrative sample report (not a real item)'),
    history: [],
    ...extra,
  })
  return {
    schemaVersion: 1,
    config: { defaultMaxRoster: 8, closingSoonDays: 7 },
    reports: [
      found('rep-1', 'Black backpack', 'bag', {
        colour: 'Black',
        area: 'Library area',
        approxDate: day(-1),
        description: 'A plain backpack handed in.',
        privateDetails: 'Blue keychain in the front pocket',
      }),
      found('rep-2', 'Set of keys', 'keys', {
        area: 'Sports ground',
        description: 'Keys on a plain ring.',
        privateDetails: 'Two keys, one with red tape',
      }),
      found('rep-3', 'Steel water bottle', 'bottle', { colour: 'Silver', area: 'Mess area' }),
    ],
    claims: [],
    clubs: [
      club({
        id: 'club-robotics',
        name: 'Demo Robotics Club',
        type: 'club',
        category: 'Technical',
        purpose: 'Builds sample robots and runs weekend workshops (fictional).',
        roles: [{ title: 'Coordinator', holderLabel: 'Demo Coordinator' }],
        recruitment: { state: 'open', openDate: day(-5), closeDate: day(5) },
      }),
      club({
        id: 'club-quiz',
        name: 'Demo Quiz Club',
        type: 'club',
        category: 'Academic',
        purpose: 'Weekly sample quizzes (fictional).',
        roles: [],
        recruitment: { state: 'open', url: 'https://example.com/join' },
      }),
      club({
        id: 'club-drama',
        name: 'Demo Drama Society',
        type: 'club',
        category: 'Cultural',
        purpose: 'Stages sample plays (fictional).',
        roles: [{ title: 'President', holderLabel: 'Demo President' }],
        recruitment: { state: 'closed', closeDate: day(-10) },
      }),
      club({
        id: 'club-sports-committee',
        name: 'Demo Sports Committee',
        type: 'committee',
        category: 'Sports',
        purpose: 'A fictional committee for sample fixtures.',
        roles: [],
        recruitment: { state: 'notAnnounced' },
      }),
    ],
    clubEvents: [
      event({
        id: 'cev-1',
        clubId: 'club-robotics',
        title: 'Sample robotics workshop',
        date: day(3),
        start: T('14:00'),
        end: T('15:00'),
        venue: 'Demo Lab (fictional)',
      }),
      event({ id: 'cev-2', clubId: 'club-drama', title: 'Sample open rehearsal', date: day(4) }),
      event({
        id: 'cev-3',
        clubId: 'club-quiz',
        title: 'Sample quiz night',
        date: day(6),
        start: T('17:00'),
        end: T('18:00'),
      }),
    ],
    follows: {},
    teams: [
      team({
        id: 'team-1',
        sport: 'Basketball',
        name: 'Demo Hoopers',
        captainLabel: 'Demo Captain (fictional)',
        maxRoster: 2,
        members: [],
        description: 'A sample team looking for players.',
      }),
      team({
        id: 'team-2',
        sport: 'Basketball',
        name: 'Demo Strikers',
        captainProfileId: 'demo-student-b',
        captainLabel: 'Reference Student B (captain)',
        maxRoster: 6,
        members: ['demo-student-b'],
      }),
      team({
        id: 'team-3',
        sport: 'Football',
        name: 'Demo Strikers',
        captainLabel: 'Demo Captain (fictional)',
        maxRoster: 8,
        members: [],
      }),
    ],
    joinRequests: [],
    needs: [
      {
        id: 'need-1',
        teamId: 'team-1',
        fixtureId: 'fx-1',
        description: 'Two players for the sample match',
        positions: 'Guards',
        expiresOn: day(3),
        closed: false,
        createdAt: nowIso,
      },
      {
        id: 'need-2',
        teamId: 'team-3',
        description: 'A goalkeeper (sample)',
        expiresOn: day(-1),
        closed: false,
        createdAt: nowIso,
      },
    ],
    fixtures: [
      fixture({
        id: 'fx-1',
        sport: 'Basketball',
        title: 'Demo Hoopers vs Demo Strikers (sample)',
        teamIds: ['team-1', 'team-2'],
        date: day(4),
        start: T('16:00'),
        end: T('17:00'),
        venue: 'Demo Court 1 (fictional)',
        status: 'scheduled',
      }),
      fixture({
        id: 'fx-2',
        sport: 'Football',
        title: 'Sample football fixture',
        teamIds: ['team-3'],
        date: day(9),
        status: 'tentative',
      }),
    ],
  }
}
