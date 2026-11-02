import type {
  AcademicsStore,
  Announcement,
  Availability,
  Meeting,
  MeetingActorKind,
  Resource,
} from '@/domain/academics'
import { MEETING_OPEN, meetingStatusLabel } from '@/domain/academics'
import type { Course, ProfileData } from '@/domain/records'
import type { DateOnly } from '@/lib/time'
import { formatInstant } from '@/lib/time'
import type { ActivityEntry } from './home'
import { allDeadlineEntries, type DeadlineEntry } from './deadlines'
import { profileCourseIds } from './exams'
import { instantMs, type Now } from './now'

/** Courses this profile really has, read off its own schedule and deadlines. Nothing is guessed. */
export function coursesFor(data: ProfileData): Course[] {
  const ids = new Set([...profileCourseIds(data), ...(data.enrolledCourseIds ?? [])])
  return data.courses.filter((c) => ids.has(c.id)).sort((a, b) => a.code.localeCompare(b.code))
}

export const courseById = (data: ProfileData, id: string) => data.courses.find((c) => c.id === id)

export const announcementsFor = (s: AcademicsStore, courseId: string): Announcement[] =>
  s.announcements
    .filter((a) => a.courseId === courseId)
    // Undated notices sort last; dated ones newest first.
    .sort((a, b) =>
      a.publishedOn && b.publishedOn
        ? a.publishedOn < b.publishedOn
          ? 1
          : -1
        : a.publishedOn
          ? -1
          : b.publishedOn
            ? 1
            : a.id.localeCompare(b.id),
    )

export const resourcesFor = (s: AcademicsStore, courseId: string): Resource[] =>
  s.resources.filter((r) => r.courseId === courseId)

export const isRead = (s: AcademicsStore, profileId: string, id: string) =>
  (s.read[profileId] ?? []).includes(id)

export function unreadAnnouncements(s: AcademicsStore, profileId: string, courseIds: Set<string>) {
  return s.announcements.filter((a) => courseIds.has(a.courseId) && !isRead(s, profileId, a.id))
}

/** Canonical deadlines for one course. This is the same record Calendar and Home show, not a copy. */
export const courseDeadlines = (data: ProfileData, now: Now, courseId: string): DeadlineEntry[] =>
  allDeadlineEntries(data, now)
    .filter((d) => d.courseId === courseId && d.source === 'deadline')
    .sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0))

export const linkedTasks = (data: ProfileData, courseId: string) =>
  data.tasks.filter((t) => t.courseId === courseId)

export const noteFor = (s: AcademicsStore, profileId: string, courseId: string) =>
  s.notes.find((n) => n.ownerProfileId === profileId && n.courseId === courseId)

export const facultyForCourse = (s: AcademicsStore, courseId: string) =>
  s.faculty.filter((f) => f.courseIds.includes(courseId))

/** A published window that is still in the future and not already accepted up to its capacity. */
export function openWindows(
  s: AcademicsStore,
  kind: MeetingActorKind,
  actorId: string,
  nowMs: number,
): Availability[] {
  return s.availability
    .filter((a) => a.actorKind === kind && a.actorId === actorId)
    .filter((a) => instantMs(a.date, a.end) > nowMs)
    .filter(
      (a) =>
        s.meetings.filter((m) => m.slotId === a.id && m.status === 'acceptedDemo').length <
        a.capacity,
    )
    .sort((a, b) => (a.date === b.date ? a.start.localeCompare(b.start) : a.date < b.date ? -1 : 1))
}

export const myMeetings = (
  s: AcademicsStore,
  profileId: string,
  kind?: MeetingActorKind,
): Meeting[] =>
  s.meetings
    .filter((m) => m.ownerProfileId === profileId && (kind ? m.actorKind === kind : true))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))

export const isOpenMeeting = (m: Meeting) => MEETING_OPEN.includes(m.status)

export const meetingWith = (s: AcademicsStore, m: Meeting) =>
  m.actorLabel ??
  (m.actorKind === 'faculty'
    ? (s.faculty.find((f) => f.id === m.actorId)?.displayName ?? 'Faculty')
    : m.actorKind === 'office'
      ? s.office.name
      : 'Club')

export const myGroups = (s: AcademicsStore, profileId: string) =>
  s.groups.filter((g) => g.ownerProfileId === profileId)

export const myInvites = (s: AcademicsStore, profileId: string, groupId?: string) =>
  s.invites.filter(
    (i) => i.ownerProfileId === profileId && (groupId ? i.groupId === groupId : true),
  )

/** Typed in the fictional-alias field. A milestone date never changes the official deadline. */
export const milestoneSummary = (g: { milestones: { status: string }[] }) => {
  const done = g.milestones.filter((m) => m.status === 'done').length
  return `${done} of ${g.milestones.length} milestones done`
}

export const isPast = (date: DateOnly, now: Now) => date < now.today

/**
 * Requests still waiting on an answer. An accepted meeting is already a Calendar entry and shows
 * up as a booking, so it is not listed twice.
 */
export function academicsActivity(s: AcademicsStore, profileId: string): ActivityEntry[] {
  return myMeetings(s, profileId)
    .filter((m) => ['requested', 'alternativeProposed', 'alternativeAccepted'].includes(m.status))
    .map((m) => ({
      id: m.id,
      type: 'Meeting request' as const,
      label: `Meeting with ${meetingWith(s, m)}`,
      status: meetingStatusLabel[m.status],
      when: `Updated ${formatInstant(m.updatedAt)}`,
      mode: 'userCreated' as const,
      href: `/academics/appointments/${m.id}`,
      active: true,
      simulated: m.status === 'alternativeProposed' || m.status === 'alternativeAccepted',
    }))
}
