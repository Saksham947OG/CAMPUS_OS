import { initialAcademicsStore } from '@/data/seeds/demo/academics-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  academicsStoreSchema,
  type AcademicsStore,
  type Group,
  type Invite,
  type Meeting,
} from '@/domain/academics'
import {
  actorRoleFor,
  addMilestone,
  createGroup,
  deleteGroup,
  markRead,
  meetingAct,
  respondInvite,
  saveNote,
  sendInvite,
  setMilestoneStatus,
  submitMeeting,
  withdrawInvite,
  type MeetingAction,
  type MeetingInput,
} from '@/domain/academics-logic'
import type { BookingRef } from '@/domain/records'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'

/**
 * The owner of faculty/office/club meetings, project groups and mentorship (COS-ACADEMICS-001).
 * One GLOBAL store because the simulator answers other profiles' requests; a student reads only
 * their own through the selectors. Course, class and deadline records stay in the Calendar data.
 */
export const ACADEMICS_STORE_KEY = storageKey({ area: 'academics', version: 1 })
type Out<T> = Promise<Result<T>>

export interface AcademicsRepository {
  load(): Promise<AcademicsStore>
  /** Read-only projection of a profile's open and accepted meetings for Calendar and Home. */
  bookingRefs(profileId: string): BookingRef[]

  markRead(profileId: string, announcementId: string): Out<void>
  saveNote(profileId: string, courseId: string, text: string): Out<void>

  submitMeeting(
    profileId: string,
    input: MeetingInput,
    idempotencyKey: string,
  ): Out<{ meeting: Meeting; created: boolean }>
  studentAct(
    profileId: string,
    id: string,
    action: Extract<
      MeetingAction,
      'withdraw' | 'acceptAlternative' | 'declineAlternative' | 'requestCancellation'
    >,
    expectedVersion?: number,
  ): Out<Meeting>

  createGroup(
    profileId: string,
    input: { title: string; description?: string; courseId?: string; memberAliases?: string[] },
  ): Out<Group>
  addMilestone(
    profileId: string,
    groupId: string,
    input: { title: string; dueDate?: DateOnly },
  ): Out<void>
  setMilestoneStatus(
    profileId: string,
    groupId: string,
    milestoneId: string,
    status: 'notStarted' | 'inProgress' | 'done',
  ): Out<void>
  deleteGroup(profileId: string, groupId: string): Out<void>
  sendInvite(
    profileId: string,
    input: { groupId: string; facultyId: string; note: string },
  ): Out<Invite>
  withdrawInvite(profileId: string, inviteId: string): Out<Invite>

  // Local simulator only
  simulateMeeting(
    id: string,
    action: Extract<
      MeetingAction,
      'accept' | 'reject' | 'propose' | 'confirmAlternative' | 'cancel' | 'complete'
    >,
    opts?: {
      expectedVersion?: number
      reason?: string
      alternative?: { date: DateOnly; start: LocalTime; end: LocalTime }
    },
  ): Out<Meeting>
  simulateInvite(
    id: string,
    response: 'accepted' | 'declined' | 'feedbackRequested',
    expectedVersion?: number,
  ): Out<Invite>

  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface AcademicsRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  /** Ids of the clubs a club meeting request may be addressed to. */
  clubIds?: () => string[]
}

export function createAcademicsRepository(o: AcademicsRepositoryOptions): AcademicsRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<AcademicsStore>({
    storage: o.storage,
    key: ACADEMICS_STORE_KEY,
    schema: academicsStoreSchema,
    starting: () => initialAcademicsStore(nowMs()),
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
    bookingRefs(profileId) {
      const s = read()
      return s.meetings
        .filter(
          (m) =>
            m.ownerProfileId === profileId &&
            (m.status === 'acceptedDemo' || m.status === 'cancellationRequested'),
        )
        .map((m) => {
          const who =
            m.actorLabel ??
            (m.actorKind === 'faculty'
              ? (s.faculty.find((f) => f.id === m.actorId)?.displayName ?? 'Faculty')
              : m.actorKind === 'office'
                ? s.office.name
                : 'Club')
          return {
            id: m.id,
            ownerProfileId: m.ownerProfileId,
            resource: `Meeting with ${who} (not official)`,
            date: m.date,
            start: m.start,
            end: m.end,
            status: 'active' as const,
            category: 'meeting' as const,
            manageRoute: `/academics/appointments/${m.id}`,
            updatedAt: m.updatedAt,
            provenance: m.provenance,
          }
        })
    },

    markRead: (profileId, id) => run((s) => markRead(s, profileId, id)),
    saveNote: (profileId, courseId, text) =>
      run((s, c) => saveNote(s, profileId, courseId, text, c)),

    submitMeeting: (profileId, input, idempotencyKey) =>
      run((s, c) =>
        submitMeeting(
          s,
          {
            ...input,
            profileId,
            idempotencyKey,
            nowMs: nowMs(),
            ...(o.clubIds ? { knownClubs: o.clubIds() } : {}),
          },
          c,
        ),
      ),
    studentAct: (profileId, id, action, expectedVersion) =>
      run((s, c) => meetingAct(s, id, action, 'student', c, { profileId, expectedVersion })),

    createGroup: (profileId, input) => run((s, c) => createGroup(s, profileId, input, c)),
    addMilestone: (profileId, groupId, input) =>
      run((s, c) => addMilestone(s, profileId, groupId, input, c)),
    setMilestoneStatus: (profileId, groupId, mid, status) =>
      run((s, c) => setMilestoneStatus(s, profileId, groupId, mid, status, c)),
    deleteGroup: (profileId, groupId) => run((s) => deleteGroup(s, profileId, groupId)),
    sendInvite: (profileId, input) => run((s, c) => sendInvite(s, profileId, input, c)),
    withdrawInvite: (profileId, id) => run((s, c) => withdrawInvite(s, profileId, id, c)),

    simulateMeeting: (id, action, opts) =>
      run((s, c) => {
        const m = s.meetings.find((x) => x.id === id)
        return meetingAct(s, id, action, m ? actorRoleFor(m.actorKind) : 'demoFaculty', c, opts)
      }),
    simulateInvite: (id, response, expectedVersion) =>
      run((s, c) => respondInvite(s, id, response, c, { expectedVersion })),

    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
