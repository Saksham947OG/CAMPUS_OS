import type { MeetingStore } from '@/domain/meetings'
import type { SportsStore } from '@/domain/sports'

/**
 * Counts of coordination work recorded in THIS browser for one persona (COS-V3 §11). These are event
 * counts from local demo records. They are not time saved, not measured outcomes and not campus results:
 * an event log alone cannot establish the counterfactual, so no minutes or percentages are derived here.
 */
export interface CoordinationCounts {
  meetingsOrganized: number
  meetingsInvitedTo: number
  pollsCreated: number
  pollsFinalizedToMeeting: number
  meetingsWithRoom: number
  /** Digital check-ins the app closed for a person because the lease ended. Says nothing about occupancy. */
  staleCheckInsClosed: number
  /** Reservations on facilities with more than one unit (courts, tables), counted by facility. */
  unitReservations: Record<string, number>
}

export function coordinationCounts(
  meetings: MeetingStore | null,
  sports: SportsStore | null,
  profileId: string,
): CoordinationCounts {
  const mine = meetings?.meetings.filter((m) => m.organizerProfileId === profileId) ?? []
  const polls = meetings?.polls.filter((p) => p.organizerProfileId === profileId) ?? []
  const unitReservations: Record<string, number> = {}
  for (const r of sports?.reservations ?? []) {
    if (r.ownerProfileId !== profileId) continue
    const res = sports!.resources.find((x) => x.id === r.resourceId)
    if (!res) continue
    const same = sports!.resources.filter(
      (x) => x.activity === res.activity && x.bookable !== false,
    )
    if (same.length < 2) continue
    unitReservations[res.activity] = (unitReservations[res.activity] ?? 0) + 1
  }
  return {
    meetingsOrganized: mine.length,
    meetingsInvitedTo:
      meetings?.meetings.filter(
        (m) =>
          m.organizerProfileId !== profileId && m.attendees.some((a) => a.profileId === profileId),
      ).length ?? 0,
    pollsCreated: polls.length,
    pollsFinalizedToMeeting: polls.filter((p) => p.status === 'FINALIZED').length,
    meetingsWithRoom: mine.filter((m) => m.roomReservationId).length,
    staleCheckInsClosed:
      (sports?.gymSessions.filter(
        (g) => g.profileId === profileId && g.closeReason === 'AUTO_EXPIRED',
      ).length ?? 0) +
      (sports?.reservations.filter(
        (r) => r.ownerProfileId === profileId && r.state === 'checkInExpired',
      ).length ?? 0),
    unitReservations,
  }
}
