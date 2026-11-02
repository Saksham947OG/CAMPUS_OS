import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { CampusDataRepository } from '@/data/domain/campus-repository'
import type { ClassroomRepository } from '@/data/classrooms/classroom-repository'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import type { Interval } from '@/domain/availability'
import { clash } from '@/domain/availability'
import {
  meetingStoreSchema,
  type Meeting,
  type MeetingStore,
  type Poll,
  type Rsvp,
  type Vote,
} from '@/domain/meetings'
import {
  cancelMeeting,
  castVote,
  closePoll,
  createMeeting,
  createPoll,
  finalizePoll,
  meetingPath,
  reschedule,
  respond,
  type NewPoll,
  type Span,
} from '@/domain/meetings-logic'
import type { ReservationInput } from '@/domain/classrooms-logic'
import type { BookingRef } from '@/domain/records'
import type { Clock, DateOnly } from '@/lib/time'
import { instantMs } from '@/selectors/now'
import { busyOf } from '@/selectors/availability'

/**
 * The owner of group meetings and polls. Room holds belong to the Classrooms store; this repository
 * coordinates the two, revalidating people and room at confirmation, and undoing the room when the
 * meeting cannot be written. Local demo only: it makes no claim about separate devices.
 */
export const MEETING_STORE_KEY = storageKey({ area: 'meetings', version: 1 })
type Out<T> = Promise<Result<T>>

export interface RoomChoice {
  roomId: string
  purpose: ReservationInput['purpose']
  groupName?: string
  attendees?: number
  asVerificationRequest?: boolean
}

export interface ScheduleInput extends Span {
  organizerProfileId: string
  title: string
  purpose?: string
  agenda?: string
  links?: string[]
  attendees: { profileId: string; required: boolean }[]
  room?: RoomChoice
  scope?: Meeting['scope']
  opId: string
}

export interface MeetingRepository {
  load(): Promise<MeetingStore>
  bookingRefs(profileId: string): BookingRef[]
  /** Known busy time for one person, without any private titles. `ignoreMeetingId` skips a meeting being moved. */
  availabilityOf(
    profileId: string,
    from: DateOnly,
    to: DateOnly,
    ignoreMeetingId?: string,
  ): Promise<{ busy: Interval[]; coverage: 'known' | 'unknown' }>
  schedule(input: ScheduleInput): Out<{ meeting: Meeting; created: boolean }>
  respond(profileId: string, meetingId: string, response: Exclude<Rsvp, 'INVITED'>): Out<Meeting>
  reschedule(
    actor: string,
    meetingId: string,
    expectedRevision: number,
    to: Span,
    roomId?: string,
  ): Out<Meeting>
  cancel(actor: string, meetingId: string): Out<Meeting>
  createPoll(input: NewPoll): Out<Poll>
  vote(pollId: string, profileId: string, votes: Record<string, Vote>): Out<Poll>
  closePoll(pollId: string, actor: string): Out<Poll>
  finalizePoll(
    pollId: string,
    actor: string,
    candidateId: string,
    input: Omit<ScheduleInput, 'date' | 'start' | 'end' | 'opId' | 'organizerProfileId'>,
  ): Out<Meeting>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface MeetingRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  /** A function, because the campus repository is created after this one and itself reads meeting projections. */
  campus: () => CampusDataRepository
  classrooms: ClassroomRepository
}

const err = (message: string): Result<never> => ({
  ok: false,
  error: { code: 'validation', message },
})

export function createMeetingRepository(o: MeetingRepositoryOptions): MeetingRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<MeetingStore>({
    storage: o.storage,
    key: MEETING_STORE_KEY,
    schema: meetingStoreSchema,
    starting: () => ({ schemaVersion: 1, meetings: [], polls: [] }),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: () => listeners.forEach((l) => l()),
  })
  const { read, run } = runner

  const availabilityOf: MeetingRepository['availabilityOf'] = async (
    profileId,
    from,
    to,
    ignore,
  ) => {
    const data = await o.campus().load(profileId)
    return busyOf(data, from, to, ignore)
  }

  /** Every required person with recorded time must be free for the interval, except the meeting being moved. */
  const revalidate = async (s: ScheduleInput, ignore?: string): Promise<string | null> => {
    const slot = { start: instantMs(s.date, s.start), end: instantMs(s.date, s.end) }
    for (const a of [{ profileId: s.organizerProfileId, required: true }, ...s.attendees]) {
      if (!a.required) continue
      const av = await availabilityOf(a.profileId, s.date, s.date, ignore)
      if (av.busy.some((b) => clash(slot, b)))
        return a.profileId === s.organizerProfileId
          ? 'You now have a recorded commitment at that time.'
          : 'A required person now has a recorded commitment at that time. Pick another time.'
    }
    return null
  }

  const schedule: MeetingRepository['schedule'] = async (input) => {
    const prior = read().meetings.find(
      (m) => m.opId === input.opId && m.organizerProfileId === input.organizerProfileId,
    )
    if (prior) return { ok: true, value: { meeting: prior, created: false } }
    const problem = await revalidate(input)
    if (problem) return err(problem)
    const id = o.newId('mtg')
    let reservationId: string | undefined
    if (input.room) {
      const r = await o.classrooms.reserve(
        input.organizerProfileId,
        {
          roomId: input.room.roomId,
          date: input.date,
          start: input.start,
          end: input.end,
          purpose: input.room.purpose,
          groupName: input.room.groupName ?? input.title,
          attendees: input.room.attendees,
          asVerificationRequest: input.room.asVerificationRequest,
          meetingId: id,
        },
        `${input.opId}:room`,
      )
      if (!r.ok) return err(`The room could not be reserved: ${r.error.message}`)
      reservationId = r.value.reservation.id
    }
    const made = await run((s, c) =>
      createMeeting(
        s,
        {
          ...input,
          ...(reservationId
            ? { roomReservationId: reservationId, roomId: input.room!.roomId }
            : {}),
        },
        { ...c, newId: (p) => (p === 'mtg' ? id : c.newId(p)) },
        nowMs(),
      ),
    )
    if (!made.ok && reservationId)
      await o.classrooms.cancel(input.organizerProfileId, reservationId) // never leave a room held for a meeting that does not exist
    return made
  }

  return {
    async load() {
      return read()
    },
    bookingRefs(profileId) {
      return read()
        .meetings.filter(
          (m) =>
            m.status !== 'COMPLETED' &&
            m.attendees.some((a) => a.profileId === profileId && a.rsvp !== 'DECLINED'),
        )
        .map((m) => ({
          id: m.id,
          ownerProfileId: profileId,
          resource: `Meeting: ${m.title} (demo)`,
          date: m.date,
          start: m.start,
          end: m.end,
          status: m.status === 'CANCELLED' ? ('cancelled' as const) : ('active' as const),
          category: 'meeting' as const,
          manageRoute: meetingPath(m.id),
          updatedAt: m.updatedAt,
          provenance: m.provenance,
        }))
    },
    availabilityOf,
    schedule,
    respond: (profileId, id, response) => run((s, c) => respond(s, id, profileId, response, c)),
    async reschedule(actor, id, expectedRevision, to, roomId) {
      const m = read().meetings.find((x) => x.id === id)
      if (!m) return err('That meeting was not found.')
      if (m.organizerProfileId !== actor) return err('Only the organizer can move this meeting.')
      if (m.revision !== expectedRevision)
        return err('This meeting changed since you opened it. Refresh and try again.')
      const problem = await revalidate(
        {
          ...m,
          ...to,
          organizerProfileId: m.organizerProfileId,
          title: m.title,
          attendees: m.attendees
            .filter((a) => a.profileId !== m.organizerProfileId)
            .map((a) => ({ profileId: a.profileId, required: a.required })),
          opId: '',
        },
        m.id,
      )
      if (problem) return err(problem)
      let moved = false
      if (m.roomReservationId) {
        // The new room slot is secured first. If it fails, the old reservation is untouched.
        const r = await o.classrooms.reschedule(actor, m.roomReservationId, {
          roomId: roomId ?? m.roomId ?? '',
          ...to,
        })
        if (!r.ok)
          return err(
            `The room could not be moved, so the meeting stays where it was: ${r.error.message}`,
          )
        moved = true
      }
      const res = await run((s, c) =>
        reschedule(
          s,
          id,
          actor,
          expectedRevision,
          { ...to, roomReservationId: m.roomReservationId, roomId: roomId ?? m.roomId },
          c,
          nowMs(),
        ),
      )
      if (!res.ok && moved && m.roomReservationId)
        await o.classrooms.reschedule(actor, m.roomReservationId, {
          roomId: m.roomId ?? '',
          date: m.date,
          start: m.start,
          end: m.end,
        })
      return res
    },
    async cancel(actor, id) {
      const m = read().meetings.find((x) => x.id === id)
      if (!m) return err('That meeting was not found.')
      const res = await run((s, c) => cancelMeeting(s, id, actor, c))
      if (res.ok && m.roomReservationId)
        await o.classrooms.cancel(m.organizerProfileId, m.roomReservationId) // an already-finished room hold is not an error here
      return res
    },
    createPoll: (input) => run((s, c) => createPoll(s, input, c)),
    vote: (pollId, profileId, votes) => run((s, c) => castVote(s, pollId, profileId, votes, c)),
    closePoll: (pollId, actor) => run((s, c) => closePoll(s, pollId, actor, c)),
    async finalizePoll(pollId, actor, candidateId, input) {
      const p = read().polls.find((x) => x.id === pollId)
      if (!p) return err('That poll was not found.')
      if (p.organizerProfileId !== actor) return err('Only the organizer can finalize this poll.')
      if (p.status === 'FINALIZED') return err('This poll already produced a meeting.')
      const cand = p.candidates.find((x) => x.id === candidateId)
      if (!cand) return err('That time is not part of this poll.')
      // Voting is a preference. The time is re-checked against everyone's recorded schedule now.
      const made = await schedule({
        ...input,
        organizerProfileId: actor,
        date: cand.date,
        start: cand.start,
        end: cand.end,
        opId: `poll-${pollId}`,
        scope: p.scope,
      })
      if (!made.ok) return made
      const done = await run((s, c) => finalizePoll(s, pollId, made.value.meeting.id, actor, c))
      return done.ok ? { ok: true, value: made.value.meeting } : done
    },
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
