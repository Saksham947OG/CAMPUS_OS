import { initialCommunityStore } from '@/data/seeds/demo/community-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  communityStoreSchema,
  type Claim,
  type ClubEvent,
  type CommunityStore,
  type Fixture,
  type JoinRequest,
  type PlayerNeed,
  type Report,
  type Team,
} from '@/domain/community'
import {
  cancelTeam,
  changeClubEvent,
  changeFixture,
  closeNeed,
  closeReport,
  createReport,
  createTeam,
  decideJoin,
  decideTeamApproval,
  leaveTeam,
  markReturned,
  postNeed,
  publishReport,
  requestJoin,
  reviewClaim,
  setFollow,
  setRecruiting,
  submitClaim,
  submitTeam,
  updateReport,
  withdrawClaim,
  withdrawJoin,
  type ReportInput,
  type TeamActor,
} from '@/domain/community-logic'
import type { BookingRef } from '@/domain/records'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { makeNow } from '@/selectors/now'

/**
 * The owner of Lost & Found, clubs and sports teams/fixtures (COS-COMMUNITY-001). One GLOBAL store
 * because reports and teams are seen by several profiles; private fields are filtered by the
 * selectors. Club meeting requests use the Academics meeting engine with actorKind "club".
 */
export const COMMUNITY_STORE_KEY = storageKey({ area: 'community', version: 1 })
type Out<T> = Promise<Result<T>>

export interface CommunityRepository {
  load(): Promise<CommunityStore>
  clubIds(): string[]
  /** Read-only projection for Calendar and Home: followed club events, and fixtures of teams you are on. */
  bookingRefs(profileId: string): BookingRef[]

  createReport(
    profileId: string,
    input: ReportInput,
    idempotencyKey: string,
    confirmDuplicate?: boolean,
  ): Out<{ report: Report; created: boolean }>
  updateReport(
    profileId: string,
    id: string,
    patch: Omit<ReportInput, 'kind' | 'publish'>,
  ): Out<Report>
  publishReport(profileId: string, id: string): Out<Report>
  closeReport(profileId: string, id: string): Out<Report>
  submitClaim(profileId: string, reportId: string, answer: string): Out<Claim>
  withdrawClaim(profileId: string, id: string): Out<Claim>

  setFollow(profileId: string, clubId: string, follow: boolean): Out<void>

  createTeam(
    profileId: string,
    input: {
      sport: Team['sport']
      name: string
      maxRoster?: number
      description?: string
      recruiting?: boolean
    },
  ): Out<Team>
  requestJoin(profileId: string, teamId: string): Out<JoinRequest>
  withdrawJoin(profileId: string, requestId: string): Out<void>
  leaveTeam(profileId: string, teamId: string): Out<void>
  decideJoin(
    actor: TeamActor,
    teamId: string,
    requestId: string,
    decision: 'accept' | 'reject',
  ): Out<JoinRequest>
  setRecruiting(actor: TeamActor, teamId: string, open: boolean): Out<Team>
  submitTeam(actor: TeamActor, teamId: string): Out<Team>
  cancelTeam(actor: TeamActor, teamId: string): Out<Team>
  postNeed(
    actor: TeamActor,
    teamId: string,
    input: { description: string; positions?: string; expiresOn: DateOnly; fixtureId?: string },
  ): Out<PlayerNeed>
  closeNeed(actor: TeamActor, needId: string): Out<void>

  // Local simulator only
  reviewClaim(
    id: string,
    action: 'startReview' | 'approve' | 'reject',
    opts?: { expectedVersion?: number; reason?: string },
  ): Out<Claim>
  markReturned(reportId: string): Out<Report>
  changeClubEvent(
    eventId: string,
    change:
      | { cancel: true; reason?: string }
      | {
          cancel?: false
          date: DateOnly
          start?: LocalTime
          end?: LocalTime
          venue?: string
          reason?: string
        },
  ): Out<ClubEvent>
  decideTeamApproval(teamId: string, decision: 'approvedDemo' | 'declinedDemo'): Out<Team>
  changeFixture(
    fixtureId: string,
    change:
      | {
          kind: 'reschedule'
          date: DateOnly
          start?: LocalTime
          end?: LocalTime
          venue?: string
          reason?: string
        }
      | { kind: 'cancel'; reason?: string }
      | { kind: 'complete'; result?: string },
    expectedVersion?: number,
  ): Out<Fixture>

  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface CommunityRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
}

export function createCommunityRepository(o: CommunityRepositoryOptions): CommunityRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const today = () => makeNow(o.clock).today
  const runner = createStoreRunner<CommunityStore>({
    storage: o.storage,
    key: COMMUNITY_STORE_KEY,
    schema: communityStoreSchema,
    starting: () => initialCommunityStore(nowMs()),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: () => listeners.forEach((l) => l()),
  })
  const { read, run } = runner
  return {
    async load() {
      return read()
    },
    clubIds: () => read().clubs.map((c) => c.id),
    bookingRefs(profileId) {
      const s = read()
      const follows = new Set(s.follows[profileId] ?? [])
      const refs: BookingRef[] = []
      for (const e of s.clubEvents) {
        if (!follows.has(e.clubId) || !e.start || !e.end) continue
        const club = s.clubs.find((c) => c.id === e.clubId)
        refs.push({
          id: e.id,
          ownerProfileId: profileId,
          resource: `${e.title} (${club?.name ?? 'club'}, demo event)`,
          date: e.date,
          start: e.start,
          end: e.end,
          status: e.status === 'cancelled' ? 'cancelled' : 'active',
          ...(e.venue ? { location: e.venue } : {}),
          category: 'club',
          manageRoute: `/community/clubs/${e.clubId}`,
          provenance: e.provenance,
        })
      }
      for (const f of s.fixtures) {
        if (!f.date || !f.start || !f.end) continue // unknown time: no timed block
        const mine = s.teams.some((t) => f.teamIds.includes(t.id) && t.members.includes(profileId))
        if (!mine) continue
        refs.push({
          id: f.id,
          ownerProfileId: profileId,
          resource: `${f.title} (demo fixture)`,
          date: f.date,
          start: f.start,
          end: f.end,
          status: f.status === 'cancelled' ? 'cancelled' : 'active',
          ...(f.venue ? { location: f.venue } : {}),
          category: 'sports',
          manageRoute: `/community/sports-events/fixtures/${f.id}`,
          provenance: f.provenance,
        })
      }
      return refs
    },

    createReport: (profileId, input, idempotencyKey, confirmDuplicate) =>
      run((s, c) => createReport(s, profileId, { ...input, idempotencyKey, confirmDuplicate }, c)),
    updateReport: (profileId, id, patch) => run((s, c) => updateReport(s, profileId, id, patch, c)),
    publishReport: (profileId, id) => run((s, c) => publishReport(s, profileId, id, c)),
    closeReport: (profileId, id) => run((s, c) => closeReport(s, profileId, id, c)),
    submitClaim: (profileId, reportId, answer) =>
      run((s, c) => submitClaim(s, profileId, { reportId, answer }, c)),
    withdrawClaim: (profileId, id) => run((s, c) => withdrawClaim(s, profileId, id, c)),

    setFollow: (profileId, clubId, follow) => run((s) => setFollow(s, profileId, clubId, follow)),

    createTeam: (profileId, input) => run((s, c) => createTeam(s, profileId, input, c)),
    requestJoin: (profileId, teamId) => run((s, c) => requestJoin(s, profileId, teamId, c)),
    withdrawJoin: (profileId, requestId) => run((s) => withdrawJoin(s, profileId, requestId)),
    leaveTeam: (profileId, teamId) => run((s, c) => leaveTeam(s, profileId, teamId, c)),
    decideJoin: (actor, teamId, requestId, decision) =>
      run((s, c) => decideJoin(s, teamId, requestId, decision, actor, c)),
    setRecruiting: (actor, teamId, open) => run((s, c) => setRecruiting(s, teamId, open, actor, c)),
    submitTeam: (actor, teamId) => run((s, c) => submitTeam(s, teamId, actor, c)),
    cancelTeam: (actor, teamId) => run((s, c) => cancelTeam(s, teamId, actor, c)),
    postNeed: (actor, teamId, input) =>
      run((s, c) => postNeed(s, teamId, input, actor, today(), c)),
    closeNeed: (actor, needId) => run((s) => closeNeed(s, needId, actor)),

    reviewClaim: (id, action, opts) => run((s, c) => reviewClaim(s, id, action, c, opts)),
    markReturned: (reportId) => run((s, c) => markReturned(s, reportId, c)),
    changeClubEvent: (eventId, change) => run((s, c) => changeClubEvent(s, eventId, change, c)),
    decideTeamApproval: (teamId, decision) =>
      run((s, c) => decideTeamApproval(s, teamId, decision, c)),
    changeFixture: (fixtureId, change, expectedVersion) =>
      run((s, c) => changeFixture(s, fixtureId, change, c, { expectedVersion })),

    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
