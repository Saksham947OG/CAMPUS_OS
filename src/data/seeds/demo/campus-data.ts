import type { Provenance, Verification } from '@/domain/provenance'
import type {
  Announcement,
  Audience,
  BirthdayReminder,
  BookingRef,
  CalendarEvent,
  Course,
  Deadline,
  MessMeal,
  OccurrenceException,
  PersonalTask,
  RecurrenceSeries,
  TimeTaxScenario,
} from '@/domain/records'
import { addDays, startOfWeek, type DateOnly, type LocalTime } from '@/lib/time'
import { monthDayOf } from '@/lib/time/calendar'

/**
 * ILLUSTRATIVE DEMO DATA (`demoSeed`, DEC-020). Every name, time, room and deadline below is
 * fictional and exists only so the prototype has something to show. None of it is institutional.
 * Dates are expressed as offsets from the real current date so Home is never stale; the offsets
 * (and therefore record IDs) are stable, so tests with a fixed clock are deterministic.
 */

export interface DemoDataset {
  courses: Course[]
  events: CalendarEvent[]
  series: RecurrenceSeries[]
  exceptions: OccurrenceException[]
  deadlines: Deadline[]
  tasks: PersonalTask[]
  birthdays: BirthdayReminder[]
  mess: MessMeal[]
  bookings: BookingRef[]
  announcements: Announcement[]
  timeTax: TimeTaxScenario[]
}

export const DEMO_SOURCE_LABEL = 'Illustrative sample (not institutional)'

const demo = (verification: Verification = 'unknown'): Provenance => ({
  dataMode: 'demoSeed',
  verification,
  authority: 'demoIllustration',
  sourceLabel: DEMO_SOURCE_LABEL,
})

const t = (value: string) => value as LocalTime

const section = (n: 1 | 2): Audience => ({ kind: 'cohort', cohortIds: [`sample-section-${n}`] })
const everyone: Audience = { kind: 'all' }

export function buildDemoDataset(today: DateOnly): DemoDataset {
  const d = (offset: number) => addDays(today, offset)
  const weekStart = startOfWeek(today)
  const w = (offset: number) => addDays(weekStart, offset)
  const termStart = w(-35)
  const termEnd = w(84)

  const courses: Course[] = [
    { id: 'course-a', code: 'DEMO-101', title: 'Sample Course A', provenance: demo() },
    { id: 'course-b', code: 'DEMO-102', title: 'Sample Course B', provenance: demo() },
    { id: 'course-c', code: 'DEMO-103', title: 'Sample Course C', provenance: demo() },
  ]

  const classSeries = (
    id: string,
    title: string,
    courseId: string,
    weekdays: number[],
    start: string,
    end: string,
    sectionNo: 1 | 2,
    verification: Verification,
  ): RecurrenceSeries => ({
    id,
    title,
    category: 'class',
    timing: { kind: 'timed', start: t(start), end: t(end) },
    location: 'Sample Room (fictional)',
    courseId,
    blocksTime: true,
    audience: section(sectionNo),
    status: 'scheduled',
    provenance: demo(verification),
    rule: { freq: 'weekly', interval: 1, weekdays, startDate: termStart, endDate: termEnd },
  })

  const series: RecurrenceSeries[] = [
    classSeries(
      's1-course-a',
      'Sample Course A — lecture',
      'course-a',
      [1, 3],
      '09:00',
      '10:00',
      1,
      'confirmed',
    ),
    classSeries(
      's1-course-b',
      'Sample Course B — lecture',
      'course-b',
      [2],
      '11:00',
      '12:30',
      1,
      'confirmed',
    ),
    classSeries(
      's1-course-c',
      'Sample Course C — tutorial',
      'course-c',
      [4],
      '14:00',
      '15:30',
      1,
      'tentative',
    ),
    classSeries(
      's2-course-a',
      'Sample Course A — lecture',
      'course-a',
      [2, 4],
      '09:00',
      '10:00',
      2,
      'confirmed',
    ),
    classSeries(
      's2-course-b',
      'Sample Course B — lecture',
      'course-b',
      [5],
      '10:00',
      '11:30',
      2,
      'confirmed',
    ),
  ]

  const exceptions: OccurrenceException[] = [
    {
      id: 'ex-s1-b-cancel',
      seriesId: 's1-course-b',
      originalDate: w(8),
      action: 'cancelled',
      reason: 'Sample cancellation (illustrative)',
      provenance: demo(),
    },
    {
      id: 'ex-s1-c-move',
      seriesId: 's1-course-c',
      originalDate: w(10),
      action: 'rescheduled',
      replacement: { date: w(11), start: t('10:00'), end: t('11:30') },
      reason: 'Sample reschedule (illustrative)',
      provenance: demo(),
    },
  ]

  const ev = (
    e: Omit<CalendarEvent, 'status' | 'provenance'> & { v?: Verification },
  ): CalendarEvent => {
    const { v, ...rest } = e
    return { ...rest, status: 'scheduled', provenance: demo(v ?? 'unknown') }
  }

  const events: CalendarEvent[] = [
    ev({
      id: 'ev-exam-midterm',
      title: 'Sample Course A — midterm (time not provided)',
      category: 'exam',
      date: d(10),
      timing: { kind: 'unknownTime' },
      courseId: 'course-a',
      blocksTime: false,
      audience: section(1),
      v: 'tentative',
    }),
    ev({
      id: 'ev-exam-final',
      title: 'Sample Course B — final',
      category: 'exam',
      date: d(17),
      timing: { kind: 'timed', start: t('10:00'), end: t('12:00') },
      courseId: 'course-b',
      blocksTime: true,
      audience: section(1),
      v: 'confirmed',
    }),
    ev({
      id: 'ev-campus-open-house',
      title: 'Sample campus open house',
      category: 'campusEvent',
      date: d(2),
      timing: { kind: 'unknownTime' },
      blocksTime: false,
      audience: everyone,
    }),
    ev({
      id: 'ev-club-meetup',
      title: 'Sample club meetup',
      category: 'club',
      date: d(1),
      timing: { kind: 'timed', start: t('17:00'), end: t('18:00') },
      location: 'Sample Hall (fictional)',
      blocksTime: false,
      audience: everyone,
    }),
    ev({
      id: 'ev-sports-fixture',
      title: 'Sample sports fixture',
      category: 'sports',
      date: w(8),
      timing: { kind: 'timed', start: t('16:00'), end: t('17:30') },
      blocksTime: false,
      audience: everyone,
    }),
    ev({
      id: 'ev-holiday',
      title: 'Sample holiday (does not cancel classes)',
      category: 'holiday',
      date: w(9),
      timing: { kind: 'allDay' },
      blocksTime: false,
      audience: everyone,
      v: 'confirmed',
    }),
    ev({
      id: 'ev-s1-project-meeting',
      title: 'Sample project meeting',
      category: 'meeting',
      date: d(0),
      timing: { kind: 'timed', start: t('15:00'), end: t('16:00') },
      location: 'Sample Room (fictional)',
      courseId: 'course-c',
      blocksTime: true,
      audience: section(1),
      v: 'confirmed',
    }),
  ]

  const dl = (x: Omit<Deadline, 'status' | 'provenance'> & { v?: Verification }): Deadline => {
    const { v, ...rest } = x
    return { ...rest, status: 'scheduled', provenance: demo(v ?? 'unknown') }
  }

  const deadlines: Deadline[] = [
    dl({
      id: 'dl-assign-1',
      title: 'Sample Assignment 1',
      kind: 'assignment',
      dueDate: d(2),
      courseId: 'course-a',
      audience: section(1),
      v: 'tentative',
    }),
    dl({
      id: 'dl-homework-1',
      title: 'Sample Homework 1',
      kind: 'homework',
      dueDate: d(4),
      dueTime: t('17:00'),
      courseId: 'course-b',
      audience: section(1),
      v: 'confirmed',
    }),
    dl({
      id: 'dl-project-1',
      title: 'Sample Project milestone',
      kind: 'project',
      dueDate: d(9),
      courseId: 'course-c',
      audience: section(1),
      v: 'tentative',
    }),
    dl({
      id: 'dl-assign-2',
      title: 'Sample Assignment 2',
      kind: 'assignment',
      dueDate: d(3),
      courseId: 'course-a',
      audience: section(2),
      v: 'confirmed',
    }),
  ]

  const task = (
    x: Omit<PersonalTask, 'provenance' | 'subtasks'> & { subtasks?: PersonalTask['subtasks'] },
  ): PersonalTask => ({
    subtasks: [],
    ...x,
    provenance: demo(),
  })

  const tasks: PersonalTask[] = [
    task({
      id: 'task-a-outline',
      ownerProfileId: 'demo-student-a',
      title: 'Draft sample report outline',
      courseId: 'course-a',
      dueDate: d(1),
      relatedDeadlineId: 'dl-assign-1',
      state: 'inProgress',
      priority: 'high',
      subtasks: [
        { id: 'st-1', title: 'List the headings', done: true },
        { id: 'st-2', title: 'Collect two sources', done: false },
      ],
    }),
    task({
      id: 'task-a-reading',
      ownerProfileId: 'demo-student-a',
      title: 'Read sample chapter',
      courseId: 'course-b',
      dueDate: d(0),
      state: 'notStarted',
    }),
    task({
      id: 'task-a-overdue',
      ownerProfileId: 'demo-student-a',
      title: 'Review sample notes',
      dueDate: d(-1),
      state: 'notStarted',
    }),
    task({
      id: 'task-a-undated',
      ownerProfileId: 'demo-student-a',
      title: 'Plan sample group meeting',
      state: 'notStarted',
    }),
    task({
      id: 'task-a-done',
      ownerProfileId: 'demo-student-a',
      title: 'Tidy sample desk (personal check)',
      dueDate: d(-2),
      state: 'personallyCompleted',
    }),
    task({
      id: 'task-b-1',
      ownerProfileId: 'demo-student-b',
      title: 'Sample task for Student B',
      dueDate: d(2),
      state: 'notStarted',
    }),
  ]

  const bday = (
    id: string,
    name: string,
    offset: number,
    over: Partial<BirthdayReminder>,
  ): BirthdayReminder => {
    const { month, day } = monthDayOf(d(offset))
    return {
      id,
      displayName: name,
      month,
      day,
      visibility: 'campusPublic',
      audience: everyone,
      provenance: demo(),
      ...over,
    }
  }

  const birthdays: BirthdayReminder[] = [
    bday('bd-1', 'Sample Person One', 0, {}),
    bday('bd-2', 'Sample Person Two', 3, {
      visibility: 'selectedAudience',
      audience: { kind: 'profiles', profileIds: ['demo-student-b'] },
    }),
    bday('bd-3', 'Sample Person Three (private)', 5, {
      visibility: 'private',
      ownerProfileId: 'demo-student-a',
    }),
    bday('bd-4', 'Sample Person Four', 8, { audience: section(1) }),
  ]

  const meals: [MessMeal['meal'], string | null, string | null][] = [
    ['breakfast', '07:30', '09:00'],
    ['lunch', '12:30', '14:00'],
    ['snacks', null, null], // windows deliberately unknown: a menu is not evidence of a serving time
    ['dinner', '19:30', '21:00'],
  ]
  const mess: MessMeal[] = []
  for (let offset = -1; offset <= 8; offset++) {
    for (const [meal, start, end] of meals) {
      if (offset === 5 && meal === 'lunch') continue // "menu not supplied" example
      mess.push({
        id: `mess-${offset}-${meal}`,
        date: d(offset),
        meal,
        ...(start && end ? { start: t(start), end: t(end) } : {}),
        items: [`Sample ${meal} item 1`, `Sample ${meal} item 2`, `Sample ${meal} item 3`],
        provenance: demo(),
      })
    }
  }

  const bookings: BookingRef[] = [
    {
      id: 'bk-a-1',
      ownerProfileId: 'demo-student-a',
      resource: 'Sample badminton court 1',
      date: d(1),
      start: t('18:30'),
      end: t('19:30'),
      status: 'active',
      location: 'Sample Sports Hall (fictional)',
      provenance: demo(),
    },
    {
      id: 'bk-a-2',
      ownerProfileId: 'demo-student-a',
      resource: 'Sample study room',
      date: d(4),
      start: t('13:00'),
      end: t('14:00'),
      status: 'cancelled',
      provenance: demo(),
    },
    {
      id: 'bk-b-1',
      ownerProfileId: 'demo-student-b',
      resource: 'Sample music room',
      date: d(2),
      start: t('16:00'),
      end: t('17:00'),
      status: 'active',
      provenance: demo(),
    },
  ]

  const announcements: Announcement[] = [
    {
      id: 'an-1',
      title: 'Sample notice: illustrative schedule change',
      summary: 'Fictional notice used to demonstrate Campus Pulse.',
      publishedOn: d(-1),
      importance: 'important',
      audience: everyone,
      provenance: demo(),
    },
    {
      id: 'an-2',
      title: 'Sample notice: illustrative club recruitment',
      publishedOn: d(-3),
      importance: 'normal',
      audience: everyone,
      provenance: demo(),
    },
  ]

  const timeTax: TimeTaxScenario[] = [
    {
      id: 'tt-illustrative-1',
      label: 'Illustrative scenario: pre-ordering at a campus café',
      service: 'Sample café',
      basis: 'illustrative',
      students: 400,
      visitsPerStudentPerWeek: 2,
      baselineWaitMinutes: 30,
      scenarioWaitMinutes: 4,
      provenance: demo(),
    },
  ]

  return {
    courses,
    events,
    series,
    exceptions,
    deadlines,
    tasks,
    birthdays,
    mess,
    bookings,
    announcements,
    timeTax,
  }
}
