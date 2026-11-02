import type {
  Claim,
  Club,
  ClubEvent,
  CommunityStore,
  Fixture,
  PlayerNeed,
  Report,
  Team,
} from '@/domain/community'
import { CLAIM_ACTIVE } from '@/domain/community'
import { needOpen, recruitmentView } from '@/domain/community-logic'
import type { DateOnly } from '@/lib/time'
import type { Now } from './now'
import type { ActivityEntry } from './home'
import { claimStatusLabel, reportStatusLabel } from '@/domain/community'
import { formatInstant } from '@/lib/time'

/** What a viewer may see of a report. Private proof fields belong to the owner alone. */
export function viewReport(r: Report, viewerId: string): Report {
  if (r.ownerProfileId === viewerId) return r
  const { privateDetails: _p, idempotencyKey: _i, history: _h, ...rest } = r
  return { ...rest, history: [] }
}

export interface ReportFilter {
  tab: 'lost' | 'found' | 'mine'
  q: string
  category: string
  area: string
  /** Show only reports whose known date is on or after this one. Unknown dates are kept out when set. */
  since: string
}

export function listReports(s: CommunityStore, viewerId: string, f: ReportFilter): Report[] {
  const q = f.q.trim().toLowerCase()
  return s.reports
    .filter((r) =>
      f.tab === 'mine'
        ? r.ownerProfileId === viewerId
        : r.kind === f.tab && r.status === 'published',
    )
    .filter((r) =>
      q ? `${r.title} ${r.description ?? ''} ${r.colour ?? ''}`.toLowerCase().includes(q) : true,
    )
    .filter((r) => (f.category ? r.category === f.category : true))
    .filter((r) => (f.area ? r.area === f.area : true))
    .filter((r) => (f.since ? !!r.approxDate && r.approxDate >= f.since : true))
    .map((r) => viewReport(r, viewerId))
    .sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id.localeCompare(b.id),
    )
}

export const myClaims = (s: CommunityStore, viewerId: string): Claim[] =>
  s.claims.filter((c) => c.claimantProfileId === viewerId)

/** A claim as its viewer may see it: the claimant sees their own answer, nobody else does. */
export const viewClaim = (c: Claim, viewerId: string): Claim | undefined =>
  c.claimantProfileId === viewerId ? c : undefined

/** Only a count for the reporter. The claimants and their answers stay private. */
export const waitingClaimCount = (s: CommunityStore, reportId: string) =>
  s.claims.filter((c) => c.reportId === reportId && CLAIM_ACTIVE.includes(c.status)).length

export const isFollowing = (s: CommunityStore, profileId: string, clubId: string) =>
  (s.follows[profileId] ?? []).includes(clubId)

export function listClubs(s: CommunityStore, q: string, category: string): Club[] {
  const t = q.trim().toLowerCase()
  return s.clubs
    .filter((c) => (t ? `${c.name} ${c.purpose}`.toLowerCase().includes(t) : true))
    .filter((c) => (category ? c.category === category || c.type === category : true))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const eventsOf = (s: CommunityStore, clubId: string): ClubEvent[] =>
  s.clubEvents
    .filter((e) => e.clubId === clubId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

export const clubRecruitment = (s: CommunityStore, club: Club, now: Now) =>
  recruitmentView(club, now.today, s.config.closingSoonDays)

export interface FixtureFilter {
  sport: string
  when: 'all' | 'upcoming' | 'past'
  teamId: string
}

export function listFixtures(s: CommunityStore, f: FixtureFilter, today: DateOnly): Fixture[] {
  return s.fixtures
    .filter((x) => (f.sport ? x.sport === f.sport : true))
    .filter((x) => (f.teamId ? x.teamIds.includes(f.teamId) : true))
    .filter((x) =>
      f.when === 'all'
        ? true
        : f.when === 'upcoming'
          ? !x.date || x.date >= today
          : !!x.date && x.date < today,
    )
    .sort((a, b) =>
      (a.date ?? '9999') < (b.date ?? '9999')
        ? -1
        : (a.date ?? '9999') > (b.date ?? '9999')
          ? 1
          : a.id.localeCompare(b.id),
    )
}

export const fixtureTeams = (s: CommunityStore, f: Fixture): Team[] =>
  f.teamIds.map((id) => s.teams.find((t) => t.id === id)).filter((t): t is Team => !!t)

export const openNeeds = (s: CommunityStore, today: DateOnly): PlayerNeed[] =>
  s.needs.filter(
    (n) => needOpen(n, today) && s.teams.find((t) => t.id === n.teamId)?.status === 'recruiting',
  )

export const closedNeeds = (s: CommunityStore, today: DateOnly): PlayerNeed[] =>
  s.needs.filter((n) => !needOpen(n, today))

/** Requests waiting on a team this profile captains. */
export const requestsForCaptain = (s: CommunityStore, profileId: string) =>
  s.joinRequests.filter(
    (r) =>
      r.status === 'requested' &&
      s.teams.find((t) => t.id === r.teamId)?.captainProfileId === profileId,
  )

export const myRequests = (s: CommunityStore, profileId: string) =>
  s.joinRequests.filter((r) => r.profileId === profileId)
export const myTeams = (s: CommunityStore, profileId: string) =>
  s.teams.filter((t) => t.members.includes(profileId) || t.captainProfileId === profileId)

/** Your own open reports, claims and join requests. Other people's records never appear here. */
export function communityActivity(s: CommunityStore, profileId: string): ActivityEntry[] {
  const reports: ActivityEntry[] = s.reports
    .filter(
      (r) => r.ownerProfileId === profileId && (r.status === 'draft' || r.status === 'published'),
    )
    .map((r) => ({
      id: r.id,
      type: 'Lost & found' as const,
      label: `${r.kind === 'lost' ? 'Lost' : 'Found'}: ${r.title}`,
      status: reportStatusLabel[r.status],
      when: `Updated ${formatInstant(r.updatedAt)}`,
      mode: 'userCreated' as const,
      href: `/community/lost-found/${r.id}`,
      active: true,
    }))
  const claims: ActivityEntry[] = s.claims
    .filter((c) => c.claimantProfileId === profileId && CLAIM_ACTIVE.includes(c.status))
    .map((c) => ({
      id: c.id,
      type: 'Claim' as const,
      label: `Claim: ${s.reports.find((r) => r.id === c.reportId)?.title ?? 'item'}`,
      status: claimStatusLabel[c.status],
      when: `Updated ${formatInstant(c.updatedAt)}`,
      mode: 'userCreated' as const,
      href: `/community/lost-found/claims/${c.id}`,
      active: true,
      simulated: c.status === 'reviewPending',
    }))
  const joins: ActivityEntry[] = s.joinRequests
    .filter((r) => r.profileId === profileId && r.status === 'requested')
    .map((r) => ({
      id: r.id,
      type: 'Team request' as const,
      label: `Join ${s.teams.find((t) => t.id === r.teamId)?.name ?? 'team'}`,
      status: 'Waiting for the captain (demo)',
      when: `Requested ${formatInstant(r.createdAt)}`,
      mode: 'userCreated' as const,
      href: `/community/sports-events/teams/${r.teamId}`,
      active: true,
    }))
  return [...claims, ...joins, ...reports]
}
