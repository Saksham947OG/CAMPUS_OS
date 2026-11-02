import type { Provenance } from '@/domain/provenance'
import type { AcademicsStore, Announcement, Availability, Faculty } from '@/domain/academics'
import { addDays, fixedClock, isoFromMs, type DateOnly, type LocalTime } from '@/lib/time'
import { makeNow } from '@/selectors/now'

const demo = (nowIso: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: 'Illustrative sample record (not a real person or office)',
  updatedAt: nowIso,
})

/**
 * The starting Academics scenario. Three fictional courses (they come from the Calendar seeds),
 * three fictional faculty profiles with generic names, a fictional office, and some published
 * demo windows. Faculty C publishes nothing, so "no published availability" and the optional
 * "propose a time" path are both visible. One course has no resources, so "Resource not
 * provided" is visible. No real professor, link, room or schedule appears.
 */
export function initialAcademicsStore(nowMs: number): AcademicsStore {
  const nowIso = isoFromMs(nowMs)
  const today: DateOnly = makeNow(fixedClock(nowIso)).today
  const label = 'Illustrative sample record (not a real notice)'
  const note = (
    id: string,
    courseId: string,
    title: string,
    body: string,
    noticeType: Announcement['noticeType'],
    offset?: number,
  ): Announcement => ({
    id,
    courseId,
    title,
    body,
    noticeType,
    ...(offset === undefined ? {} : { publishedOn: addDays(today, offset) }),
    authorLabel: 'Demo course staff',
    audienceLabel: 'Everyone in this sample course',
    sourceLabel: label,
  })
  const fac = (
    id: string,
    displayName: string,
    courseIds: string[],
    extra: Partial<Faculty> = {},
  ): Faculty => ({
    id,
    displayName,
    courseIds,
    sourceLabel: 'Illustrative sample faculty profile (not a real person)',
    provenance: demo(nowIso),
    ...extra,
  })
  const slot = (
    id: string,
    actorKind: Availability['actorKind'],
    actorId: string,
    offset: number,
    start: string,
    end: string,
    capacity = 1,
  ): Availability => ({
    id,
    actorKind,
    actorId,
    date: addDays(today, offset),
    start: start as LocalTime,
    end: end as LocalTime,
    capacity,
    sourceLabel: 'Demonstration window (not official availability)',
  })
  return {
    schemaVersion: 1,
    config: { allowProposals: true },
    announcements: [
      note(
        'ann-1',
        'course-a',
        'Sample reading for next week',
        'A sample notice. Real course notices are not connected yet.',
        'material',
        -1,
      ),
      note(
        'ann-2',
        'course-a',
        'Sample lecture venue reminder',
        'A sample reminder with no confirmed venue.',
        'reminder',
        -3,
      ),
      note(
        'ann-3',
        'course-b',
        'Sample quiz topics',
        'A sample notice about quiz topics.',
        'general',
      ),
    ],
    resources: [
      {
        id: 'res-1',
        courseId: 'course-a',
        title: 'Sample slide deck (no link in this demo)',
        kind: 'slides',
        sourceLabel: label,
      },
      {
        id: 'res-2',
        courseId: 'course-a',
        title: 'Example reading list',
        kind: 'reading',
        uri: 'https://example.com/reading',
        accessLabel: 'Example link only',
        sourceLabel: label,
      },
    ],
    faculty: [
      fac('fac-a', 'Demo Faculty A', ['course-a'], {
        officeHoursText: 'Published in this demo: see windows below',
        locationText: 'Demo Block, office 1',
      }),
      fac('fac-b', 'Demo Faculty B', ['course-b']),
      fac('fac-c', 'Demo Faculty C', ['course-c']),
    ],
    office: {
      id: 'office-bms',
      name: 'Demo BMS Office',
      hoursText: 'Demonstration hours only',
      locationText: 'Demo Block, ground floor',
      topics: ['Forms and documents', 'Fee or account question', 'General query'],
      sourceLabel: 'Illustrative sample office (not the real office)',
      provenance: demo(nowIso),
    },
    availability: [
      slot('av-a-1', 'faculty', 'fac-a', 2, '15:00', '15:30'),
      slot('av-a-2', 'faculty', 'fac-a', 3, '11:00', '11:30'),
      slot('av-b-1', 'faculty', 'fac-b', 4, '14:00', '14:30'),
      slot('av-o-1', 'office', 'office-bms', 1, '10:00', '10:30', 2),
      slot('av-o-2', 'office', 'office-bms', 2, '10:00', '10:30', 2),
    ],
    read: {},
    notes: [],
    groups: [],
    invites: [],
    meetings: [],
  }
}
