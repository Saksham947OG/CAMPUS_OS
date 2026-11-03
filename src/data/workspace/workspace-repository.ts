import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import type { Interval } from '@/domain/availability'
import type { Change, Ctx } from '@/domain/service-core'
import { emptyWorkspace, workspaceStoreSchema, type WorkspaceStore } from '@/domain/workspace'
import {
  demoAvailability,
  withDemo,
  withPersonaWorkspace,
  withTeamProject,
} from '@/data/seeds/demo/workspace-demo'
import type { MeetingRepository } from '@/data/meetings/meeting-repository'
import type { BookingRef, Deadline } from '@/domain/records'
import type { Clock, DateOnly } from '@/lib/time'
import type { Room } from '@/domain/classrooms'
import { markPollFinalized } from '@/domain/workspace-ext'
import { removeDemo, scheduleMeeting, type NewMeeting } from '@/domain/workspace-logic'
import type { WsMeeting } from '@/domain/workspace'

/**
 * The owner of Workspace spaces, pages, project work, meetings and decisions (COS-WORKSPACE-001).
 * One local store on this device: it makes no claim that another device or person sees a change.
 * `mutate` runs one pure rule through the shared persist-then-announce loop; a failed write restores
 * the previous state, so the screen never shows "Saved" for something that was not kept.
 */
export const WORKSPACE_STORE_KEY = storageKey({ area: 'workspace', version: 1 })

export interface WorkspaceRepository {
  load(): Promise<WorkspaceStore>
  mutate<T>(rule: (s: WorkspaceStore, c: Ctx) => Change<WorkspaceStore, T>): Promise<Result<T>>
  loadDemo(): Promise<Result<void>>
  /** A shared project whose members are the three real CampusOS profiles. */
  loadTeamProject(): Promise<Result<void>>
  /** Adds the sample content built from the three personas' records again (after it was removed). */
  restoreSamples(): Promise<Result<void>>
  /** True when this build seeds sample content for the personas. */
  readonly seeded: boolean
  /**
   * Schedules a team meeting. When everyone is a real CampusOS profile it is also created in the main
   * Calendar's meeting engine, holding the chosen campus room, and rolled back if the team record fails.
   */
  scheduleTeamMeeting(
    actor: string,
    input: Omit<NewMeeting, 'roomId' | 'calendarMeetingId'> & {
      room?: { room: Room; groupSize: number; verification: boolean }
      finalizePollId?: string
    },
  ): Promise<Result<WsMeeting>>
  /** Read-only projections for Calendar and Home: team meetings without a Calendar meeting, and open dated team tasks. */
  bookingRefs(profileId: string): BookingRef[]
  deadlineRefs(profileId: string): Deadline[]
  removeDemo(): Promise<Result<void>>
  /** Known busy time. A demo person comes from the fictional set; a CampusOS profile from the real schedule. */
  availabilityOf(
    userId: string,
    from: DateOnly,
    to: DateOnly,
  ): Promise<{ busy: Interval[]; coverage: 'known' | 'unknown' }>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface WorkspaceRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  meetings: () => MeetingRepository
  /** Source-backed personas get sample content built from their own records. */
  seed?: boolean
}

export function createWorkspaceRepository(o: WorkspaceRepositoryOptions): WorkspaceRepository {
  const listeners = new Set<() => void>()
  const provenanceOf = (mode: 'userCreated' | 'demoSeed', at: string, label?: string) =>
    mode === 'demoSeed'
      ? ({
          dataMode: 'demoSeed',
          verification: 'notApplicable',
          authority: 'demoIllustration',
          ...(label ? { sourceLabel: `Workspace · ${label}` } : {}),
          updatedAt: at,
        } as const)
      : ({
          dataMode: 'userCreated',
          verification: 'notApplicable',
          authority: 'personal',
          ...(label ? { sourceLabel: `Workspace · ${label}` } : {}),
          updatedAt: at,
        } as const)
  const runner = createStoreRunner<WorkspaceStore>({
    storage: o.storage,
    key: WORKSPACE_STORE_KEY,
    schema: workspaceStoreSchema,
    starting: () => (o.seed ? withPersonaWorkspace(emptyWorkspace()) : emptyWorkspace()),
    // A store saved before the sample content existed is topped up on read; reading never writes.
    normalize: (stored) => (o.seed ? withPersonaWorkspace(stored) : stored),
    notifications: o.notifications,
    nowMs: () => o.clock.now().epochMilliseconds,
    newId: o.newId,
    onChange: () => listeners.forEach((l) => l()),
  })
  // Another tab of this browser saved Workspace: show it here without a reload (same device only).
  o.storage.onExternalChange((key) => {
    if (key === null || key === WORKSPACE_STORE_KEY) listeners.forEach((l) => l())
  })
  return {
    async load() {
      return runner.read()
    },
    mutate: (rule) => runner.run(rule),
    loadDemo: () =>
      runner.run((s) => ({
        ok: true,
        store: { ...withDemo(s), viewAs: 'demo-u1' },
        value: undefined,
        notices: [],
      })),
    removeDemo: () => runner.run((s) => removeDemo(s)),
    seeded: Boolean(o.seed),
    restoreSamples: () =>
      runner.run((s) => {
        const { seedVersion: _v, ...rest } = s
        void _v
        return { ok: true, store: withPersonaWorkspace(rest), value: undefined, notices: [] }
      }),
    loadTeamProject: () =>
      runner.run((s) => ({ ok: true, store: withTeamProject(s), value: undefined, notices: [] })),
    async availabilityOf(userId, from, to) {
      const store = runner.read()
      if (store.people.some((p) => p.id === userId)) return demoAvailability(userId, from, to)
      return o.meetings().availabilityOf(userId, from, to)
    },
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    bookingRefs(profileId) {
      const s = runner.read()
      return s.meetings
        .filter(
          (m) =>
            m.status === 'confirmed' &&
            !m.calendarMeetingId && // those already appear through the meeting engine
            m.attendees.some((a) => a.userId === profileId && a.rsvp !== 'NO'),
        )
        .map((m) => ({
          id: `ws-${m.id}`,
          ownerProfileId: profileId,
          resource: `Team meeting: ${m.title} (Workspace)`,
          date: m.date,
          start: m.start,
          end: m.end,
          status: 'active' as const,
          category: 'meeting' as const,
          manageRoute: `/workspace/projects/${m.projectId}?tab=calendar`,
          provenance: provenanceOf(m.dataMode, m.createdAt),
        }))
    },
    deadlineRefs(profileId) {
      const s = runner.read()
      return s.tasks
        .filter(
          (t) =>
            t.assigneeId === profileId &&
            t.dueDate &&
            t.status !== 'done' &&
            t.status !== 'canceled' &&
            s.projects.some(
              (p) =>
                p.id === t.projectId &&
                s.members.some(
                  (m) => m.spaceId === p.spaceId && m.userId === profileId && !m.invitation,
                ),
            ),
        )
        .map((t) => ({
          id: `ws-${t.id}`,
          title: `Team task: ${t.title}`,
          kind: 'project' as const,
          dueDate: t.dueDate!,
          audience: { kind: 'profiles' as const, profileIds: [profileId] },
          status: 'scheduled' as const,
          provenance: provenanceOf(
            t.dataMode,
            t.updatedAt,
            s.projects.find((p) => p.id === t.projectId)?.title,
          ),
        }))
    },
    async scheduleTeamMeeting(actor, input) {
      const store = runner.read()
      const project = store.projects.find((p) => p.id === input.projectId)
      const everyone = [actor, ...input.attendees.map((a) => a.userId)]
      const allReal = everyone.every((id) => !store.people.some((p) => p.id === id))
      let calendarMeetingId: string | undefined
      if (project && allReal) {
        // The main Calendar's engine checks everyone's recorded schedule again and holds the room.
        const made = await o.meetings().schedule({
          organizerProfileId: actor,
          title: input.title,
          date: input.date,
          start: input.start,
          end: input.end,
          ...(input.agenda ? { agenda: input.agenda } : {}),
          attendees: input.attendees.map((a) => ({ profileId: a.userId, required: a.required })),
          ...(input.room
            ? {
                room: {
                  roomId: input.room.room.id,
                  purpose: 'Project meeting' as const,
                  groupName: input.title,
                  attendees: input.room.groupSize,
                  ...(input.room.verification ? { asVerificationRequest: true } : {}),
                },
              }
            : {}),
          opId: `ws-${input.opId}`,
        })
        if (!made.ok) return made
        calendarMeetingId = made.value.meeting.id
      }
      const { room, finalizePollId, ...rest } = input
      const result = await runner.run((s, c) => {
        const r = scheduleMeeting(s, c, actor, {
          ...rest,
          ...(room ? { roomLabel: room.room.displayName, roomId: room.room.id } : {}),
          ...(calendarMeetingId ? { calendarMeetingId } : {}),
        })
        if (!r.ok || !finalizePollId) return r
        const done = markPollFinalized(r.store, c, actor, finalizePollId, r.value.id)
        return done.ok ? { ...r, store: done.store } : done
      })
      if (!result.ok && calendarMeetingId) await o.meetings().cancel(actor, calendarMeetingId) // never leave a Calendar meeting the team does not have
      return result
    },
  }
}
