import { clash, type Participant } from '@/domain/availability'
import type { ClassroomStore, Room } from '@/domain/classrooms'
import { slotStatus, type Span } from '@/domain/classrooms-logic'
import { instantMs } from '@/selectors/now'
import type { DateOnly } from '@/lib/time'
import type { WorkspaceApi } from './use-workspace'

export const isDemoMember = (w: WorkspaceApi, id: string) => w.ws.people.some((p) => p.id === id)

/** Known busy time for each person, plus team meetings already booked that they have not declined. */
export async function loadParticipants(
  w: WorkspaceApi,
  ids: string[],
  required: (id: string) => boolean,
  from: DateOnly,
  to: DateOnly,
): Promise<Participant[]> {
  return Promise.all(
    ids.map(async (id) => {
      const av = await w.services.workspace.availabilityOf(id, from, to)
      const theirs = w.ws.meetings
        .filter(
          (x) =>
            x.status === 'confirmed' &&
            x.date >= from &&
            x.date <= to &&
            x.attendees.some((a) => a.userId === id && a.rsvp !== 'NO'),
        )
        .map((x) => ({ start: instantMs(x.date, x.start), end: instantMs(x.date, x.end) }))
      return {
        id,
        label: w.name(id),
        required: required(id),
        busy: [...av.busy, ...theirs],
        coverage: av.coverage,
      }
    }),
  )
}

/** Required people who now have something recorded at that time. */
export const clashing = (people: Participant[], span: Span) => {
  const slot = { start: instantMs(span.date, span.start), end: instantMs(span.date, span.end) }
  return people.filter(
    (p) => p.required && p.coverage === 'known' && p.busy.some((b) => clash(slot, b)),
  )
}

export interface RoomOption {
  room: Room
  kind: 'available' | 'unknown' | 'blocked'
  text: string
}

/** Campus rooms for one slot: free ones, those the schedule does not cover (a request), and busy ones left out. */
export function roomOptions(
  rooms: ClassroomStore | null,
  span: Span,
  profileId: string,
  groupSize: number,
): RoomOption[] {
  if (!rooms) return []
  return rooms.rooms
    .filter((r) => !r.capacity || r.capacity >= groupSize)
    .map((room): RoomOption | null => {
      const s = slotStatus(rooms, room.id, span, profileId)
      if (s.kind === 'available')
        return { room, kind: 'available', text: `${room.displayName}: free` }
      if (s.kind === 'unknown')
        return {
          room,
          kind: 'unknown',
          text: `${room.displayName}: schedule not covered, sent as a request`,
        }
      return null
    })
    .filter((x): x is RoomOption => !!x)
}
