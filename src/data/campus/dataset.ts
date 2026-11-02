import type { DemoDataset } from '@/data/seeds/demo/campus-data'
import type {
  CalendarEvent,
  PersonalTask,
  Audience,
  EventCategory,
  Deadline,
} from '@/domain/records'
import { addDays, type DateOnly } from '@/lib/time'
import {
  campusProfiles,
  curriculum,
  courseId,
  supplied,
  illustrative,
  t,
  MANUAL,
  TIMETABLE,
  MENU,
  messMenu,
  proposedEvents,
  CLUB_CALENDAR,
} from './catalogue'

const privateTo = (id: string): Audience => ({ kind: 'profiles', profileIds: [id] })
type Block = [string, string, string, EventCategory?, string?]
export const personaBlocks: Record<string, Block[]> = {
  'demo-student-a': [
    ['08:30', '09:15', 'Breakfast and morning preparation', 'personal'],
    ['09:15', '11:30', 'Morning classes', 'class'],
    ['11:30', '11:40', 'Walk to quiz venue', 'personal'],
    ['12:10', '12:45', 'Break and walk to mess', 'personal'],
    ['12:45', '13:30', 'Lunch at the mess', 'personal'],
    ['13:30', '15:00', 'Afternoon classes', 'class'],
    ['15:00', '16:15', 'Rest and personal time', 'personal'],
    ['16:15', '17:15', 'Laundry load', 'personal'],
    ['17:15', '17:45', 'Snacks at Chill Spot', 'personal'],
    ['17:45', '18:30', 'Assignment focus block', 'focus'],
    [
      '18:30',
      '19:15',
      'Find group availability',
      'meeting',
      'Illustrative 45-minute coordination window; source gives no end time.',
    ],
    [
      '19:15',
      '20:30',
      'Group assignment meeting',
      'meeting',
      'Illustrative plan after availability check.',
    ],
    ['20:45', '21:20', 'Dinner at the mess', 'personal'],
    [
      '21:30',
      '22:30',
      'Group work with friends',
      'meeting',
      'End time is an illustrative planning assumption.',
    ],
    [
      '22:45',
      '23:59',
      'Self-study',
      'focus',
      'Source ends at midnight; final minute omitted because calendar events cannot cross midnight.',
    ],
  ],
  'demo-student-b': [
    ['08:30', '09:00', 'Morning preparation', 'personal'],
    ['09:00', '09:30', 'Bath and get ready', 'personal'],
    ['09:30', '10:00', 'Breakfast and travel', 'personal'],
    ['11:30', '11:45', 'Cultural vendor call', 'club'],
    [
      '13:15',
      '13:50',
      'Lunch: queue and meal',
      'personal',
      'Source records 15 minutes waiting plus 20 minutes eating.',
    ],
    ['13:50', '14:15', 'Change into formals and return', 'personal'],
    [
      '15:45',
      '16:00',
      'Sponsor outreach',
      'club',
      '15-minute planning window; exact call duration not supplied.',
    ],
    ['17:30', '18:00', 'French group project', 'project'],
    [
      '18:00',
      '18:30',
      'Economics group project',
      'project',
      'Moved earlier as a planning assumption to protect dinner and the committee meeting.',
    ],
    [
      '18:30',
      '19:30',
      'Off-peak gym plan',
      'sports',
      'Proposed 60-minute workout from the supplied corrected schedule; original 18:45–20:45 visit conflicted with dinner. This is a plan, not measured savings.',
    ],
    [
      '20:00',
      '20:20',
      'Dinner before club meeting',
      'personal',
      'Adjusted to the supplied mess opening time.',
    ],
    [
      '20:20',
      '20:55',
      'Marketing Club meeting',
      'club',
      'Proposed 35-minute meeting from source corrected plan.',
    ],
    ['21:00', '22:30', 'Cultural Committee event planning', 'club'],
    ['22:30', '23:00', 'Jal Club meeting', 'club'],
    [
      '23:00',
      '23:59',
      'IBO preparation and personal time',
      'focus',
      'Source combines preparation, personal time and study until 03:00; split is illustrative.',
    ],
  ],
  'demo-student-empty': [
    ['09:00', '09:20', 'Review day plan and announcements', 'personal'],
    ['09:20', '10:00', 'Breakfast and travel', 'personal'],
    ['11:30', '11:50', 'Collect parcel from guard room', 'personal'],
    ['11:50', '12:40', 'Group assignment meeting', 'meeting'],
    ['12:40', '13:20', 'Lunch at the mess', 'personal'],
    ['13:20', '14:00', 'Library research', 'focus'],
    ['14:00', '14:15', 'Walk to next class', 'personal'],
    ['15:45', '16:15', 'Assignment work', 'focus'],
    ['16:15', '17:00', 'Club event planning', 'club'],
    ['17:00', '17:30', 'Collect laundry', 'personal'],
    ['17:30', '18:00', 'Free time and transition', 'personal'],
    ['18:00', '18:40', 'Gym workout', 'sports'],
    ['18:40', '20:00', 'Personal time and buffer', 'personal'],
    ['20:00', '20:20', 'Dinner before booked meeting', 'personal'],
    ['21:45', '23:00', 'Club follow-ups and messages', 'club'],
    [
      '23:00',
      '23:59',
      'Plan birthday gathering at Chill Spot',
      'personal',
      'Planning activity, not a café booking or birthday record; no friend identity was supplied.',
    ],
  ],
}

// The actual current-week rows can be read unambiguously from the supplied timetable.
export const currentClasses: [string, string, string, string, string, string][] = [
  ['2026-11-02', '10:00', '11:30', 'FI', 'B', 'Dr. Vanessa Gaitree Gowreesunkar'],
  ['2026-11-02', '11:45', '13:15', 'FI', 'A', 'Dr. Vanessa Gaitree Gowreesunkar'],
  ['2026-11-03', '10:00', '11:30', 'IBO', 'B', 'Dr. Safiul Alom'],
  ['2026-11-03', '10:00', '11:30', 'OB', 'A', 'Dr. Sumagna Bhowmick'],
  ['2026-11-03', '11:45', '13:15', 'IBO', 'A', 'Dr. Safiul Alom'],
  ['2026-11-03', '11:45', '13:15', 'OB', 'B', 'Dr. Sonakshi Gupta'],
  ['2026-11-03', '14:15', '15:45', 'IBO', 'A', 'Dr. Safiul Alom'],
  ['2026-11-03', '14:15', '15:45', 'OB', 'B', 'Dr. Sonakshi Gupta'],
  ['2026-11-03', '16:00', '17:30', 'IBO', 'B', 'Dr. Safiul Alom'],
  ['2026-11-04', '11:45', '13:15', 'FI', 'B', 'Dr. Vanessa Gaitree Gowreesunkar'],
  ['2026-11-04', '14:15', '15:45', 'FI', 'B', 'Dr. Vanessa Gaitree Gowreesunkar'],
  ['2026-11-05', '10:00', '11:30', 'OB', 'B', 'Dr. Sonakshi Gupta'],
]

export const exams = [
  [
    'OB',
    'Organizational Behaviour',
    '2026-09-07',
    '10:00',
    '13:00',
    'Closed book and notes; pen only.',
  ],
  [
    'FA',
    'Financial Accounting',
    '2026-09-08',
    '10:00',
    '12:30',
    'Open book; closed notes; one handwritten rough notebook allowed; pen and calculator.',
  ],
  [
    'ME',
    'Microeconomics',
    '2026-09-09',
    '10:00',
    '12:00',
    'Closed book and notes; pen and basic calculator.',
  ],
  [
    'IBO',
    'Introduction to Business Operations',
    '2026-09-10',
    '10:00',
    '11:00',
    'Closed book and notes; pen and calculator.',
  ],
  ['SC', 'Sociology', '2026-09-11', '10:00', '11:30', 'Closed book and notes; pen only.'],
  [
    'IO',
    'Introduction to Optimization',
    '2026-09-12',
    '10:00',
    '13:00',
    'Closed book and notes; pen and calculators.',
  ],
] as const
export const historicalQuizzes = [
  ['IIS', '2025-09-08', '15:00', '15:15', 'CR-II, VI, VIII', 'Pen only.'],
  ['PoE', '2025-09-30', '14:00', '14:15', 'CR-II, VI, VIII', 'Pen and calculator.'],
  ['FMS', '2025-10-04', '14:00', '14:20', 'CR-II, VI, VIII', 'Pen and scientific calculator.'],
  ['PSY', '2025-10-16', '10:30', '10:50', 'CR-II, VI, Conference Hall', 'Pen only.'],
  ['FMS', '2025-11-29', '10:00', '10:20', 'CR-IV, V, VI', 'Pen only.'],
  ['IIS', '2025-12-08', '14:30', '15:00', 'CR-V, VI, VIII', 'Laptop, charger and pen.'],
  ['PoE', '2025-12-08', '16:00', '16:15', 'CR-VI, VIII, Conference Hall', 'Pen and calculator.'],
  ['FMS', '2025-12-11', '16:10', '16:30', 'CR-VI, VIII, Conference Hall', 'Pen only.'],
  ['IKS', '2025-12-11', '17:00', '17:20', 'CR-VI, VIII, Conference Hall', 'Pen only.'],
  ['PSY', '2025-12-12', '16:10', '16:30', 'CR-III, Conference Hall', 'Section A; pen only.'],
  ['PSY', '2025-12-12', '16:10', '16:25', 'CR-VI, VIII', 'Section B; pen only.'],
  ['PHI-I', '2025-12-16', '10:00', '10:20', 'CR-II, Conference Hall', 'Section A; pen only.'],
] as const

/** Source-backed records are immutable. Personal tasks and service bookings remain owned by their repositories. */
export function buildCampusDataset(_today: DateOnly): DemoDataset {
  const events: CalendarEvent[] = []
  const tasks: PersonalTask[] = []
  const deadlines: Deadline[] = []
  const add = (profileId: string, day: DateOnly, key: string, block: Block, source: string) => {
    const [start, end, title, category = 'personal', note] = block
    events.push({
      id: `campus-${profileId}-${day}-${key}`,
      title,
      category: category === 'club' ? 'meeting' : category === 'sports' ? 'personal' : category,
      date: day,
      timing: { kind: 'timed', start: t(start), end: t(end) },
      blocksTime: true,
      audience: privateTo(profileId),
      status: 'scheduled',
      description:
        note ??
        'Persona routine mapped to Nov 2–8, 2026; a planning reference, not a newly issued campus schedule.',
      provenance: note?.startsWith('Illustrative')
        ? illustrative(`${source} · planning assumption`)
        : { ...supplied(source), verification: 'confirmed' },
    })
  }
  for (const profile of campusProfiles) {
    const source =
      profile.id === 'demo-student-a'
        ? 'Profile 01 Ananya v2 · supplied persona'
        : profile.id === 'demo-student-b'
          ? 'Student Planner and Frictions · supplied persona'
          : 'Aanya Sharma Persona · supplied persona'
    for (let i = 0; i < 5; i++) {
      const day = addDays('2026-11-02' as DateOnly, i)
      personaBlocks[profile.id]!.forEach((b, n) => {
        if (day < '2026-11-06' || b[3] !== 'class') add(profile.id, day, String(n), b, source)
      })
      if (profile.id === 'demo-student-empty' && day < '2026-11-06') {
        // A supplied persona assumes two lectures daily. Use actual timetable rows where available.
        const actual = currentClasses.filter((row) => row[0] === day && row[4] === 'A')
        if (!actual.some((r) => r[1] === '10:00'))
          add(
            profile.id,
            day,
            'morning-anchor',
            [
              '10:00',
              '11:30',
              'BMS lecture (persona plan)',
              'class',
              'Illustrative placement from persona; no corresponding supplied timetable session.',
            ],
            source,
          )
        if (!actual.some((r) => r[1] === '14:15'))
          add(
            profile.id,
            day,
            'afternoon-anchor',
            [
              '14:15',
              '15:45',
              'BMS tutorial (persona plan)',
              'class',
              'Illustrative placement from persona; verify with course staff.',
            ],
            source,
          )
      }
      if (profile.id === 'demo-student-b')
        add(
          profile.id,
          addDays(day, 1),
          'overnight-study',
          [
            '01:00',
            '03:00',
            'Late-night self-study',
            'focus',
            'Illustrative two-hour allocation within the source’s combined late-night block.',
          ],
          source,
        )
    }
    const titles =
      profile.id === 'demo-student-a'
        ? [
            'Check quiz venue and syllabus',
            'Prepare group assignment outline',
            'Reserve a washing machine',
          ]
        : profile.id === 'demo-student-b'
          ? ['Call cultural event vendor', 'Complete IBO presentation', 'Confirm sponsor follow-up']
          : ['Collect parcel from guard room', 'Pick up laundry', 'Assign club event owners']
    titles.forEach((title, i) =>
      tasks.push({
        id: `campus-task-${profile.id}-${i}`,
        ownerProfileId: profile.id,
        title,
        dueDate: addDays('2026-11-03' as DateOnly, i),
        state: i === 1 ? 'inProgress' : 'notStarted',
        priority: i === 0 ? 'high' : 'normal',
        subtasks: [],
        provenance: illustrative(
          `Action item derived from ${source}; due date is a planning assumption`,
        ),
      }),
    )
    deadlines.push({
      id: `campus-deadline-${profile.id}`,
      title:
        profile.id === 'demo-student-b'
          ? 'IBO group presentation plan'
          : 'Group assignment planning target',
      kind: 'project',
      dueDate: '2026-11-05' as DateOnly,
      audience: privateTo(profile.id),
      status: 'scheduled',
      details:
        'Personal planning target for this reference week; an official submission deadline was not supplied.',
      provenance: illustrative('Persona planning assumption · verify actual due date'),
    })
  }
  currentClasses.forEach(([day, start, end, code, section, instructor], i) =>
    events.push({
      id: `campus-class-${i}`,
      title: `${curriculum[3]!.find((c) => c.code === code)!.name} · Section ${section}`,
      category: 'class',
      date: day as DateOnly,
      timing: { kind: 'timed', start: t(start), end: t(end) },
      courseId: courseId(code),
      instructor,
      location: section === 'A' ? 'CR-04' : 'CR-05',
      blocksTime: true,
      audience: privateTo(section === 'A' ? 'demo-student-empty' : 'demo-student-b'),
      status: 'scheduled',
      provenance: { ...supplied(TIMETABLE, `nov-row-${i}`), verification: 'confirmed' },
    }),
  )
  // The workshop row does not supply a fully reliable end-time mapping: preserve it as unknown-time.
  for (const day of ['2026-11-02', '2026-11-04'])
    events.push({
      id: `campus-workshop-${day}`,
      title: 'Statistics and Data Analysis workshop',
      category: 'class',
      date: day as DateOnly,
      timing: { kind: 'unknownTime' },
      location: 'CR-04',
      instructor: 'Dr. Pradipta Patra',
      description:
        'Workshop appears in the supplied table; merged row layout makes the exact interval ambiguous. Confirm the time.',
      blocksTime: false,
      audience: { kind: 'profiles', profileIds: ['demo-student-b', 'demo-student-empty'] },
      status: 'scheduled',
      provenance: supplied(TIMETABLE),
    })
  // Historical assessment dates are consciously adapted, never described as a newly confirmed schedule.
  exams.forEach(([code, name, original, start, end, instructions], i) => {
    const duration =
      Number(end.slice(0, 2)) * 60 +
      Number(end.slice(3)) -
      Number(start.slice(0, 2)) * 60 -
      Number(start.slice(3))
    const finish = 18 * 60 + duration
    events.push({
      id: `campus-exam-${code}`,
      title: `${name} · reference assessment`,
      category: 'exam',
      courseId: courseId(code),
      date: addDays('2026-11-02' as DateOnly, i),
      timing: {
        kind: 'timed',
        start: t('18:00'),
        end: t(
          `${String(Math.floor(finish / 60)).padStart(2, '0')}:${String(finish % 60).padStart(2, '0')}`,
        ),
      },
      location: 'CR-II / CR-V / Conference Hall · allocation not supplied',
      description: `Original: ${original}, ${start}–${end}. Adapted to this reference week at 18:00 by owner request. Duration is tentative. ${instructions}`,
      blocksTime: true,
      audience: { kind: 'profiles', profileIds: ['demo-student-b', 'demo-student-empty'] },
      status: 'scheduled',
      provenance: supplied('Semester III mid-semester exam PDF · date/time adapted'),
    })
  })
  historicalQuizzes.forEach(([code, original, start, end, venue, instructions], i) => {
    const day = addDays('2026-11-02' as DateOnly, Math.floor(i / 2))
    const from = i % 2 === 0 ? 11 * 60 + 40 : 18 * 60
    const duration =
      (Number(end.slice(0, 2)) - Number(start.slice(0, 2))) * 60 +
      Number(end.slice(3)) -
      Number(start.slice(3))
    const time = (n: number) =>
      t(`${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`)
    events.push({
      id: `campus-quiz-${i}`,
      title: `${code} · reference quiz ${i + 1}`,
      category: 'exam',
      courseId: courseId(code),
      date: day,
      timing: { kind: 'timed', start: time(from), end: time(from + duration) },
      location: venue,
      blocksTime: true,
      audience: privateTo('demo-student-a'),
      status: 'scheduled',
      description: `Original ${original}, ${start}–${end}; adapted to Nov 2–7 for this planning scenario. Closed books and notes. ${instructions} Individual seat and syllabus not supplied.`,
      provenance: supplied('2025–26 quiz schedule · date/time adapted'),
    })
  })
  for (const [date, club, title, description] of proposedEvents)
    events.push({
      id: `campus-club-event-${club}-${date}`,
      title,
      category: 'club',
      date: date as DateOnly,
      timing: { kind: 'unknownTime' },
      blocksTime: false,
      audience: { kind: 'all' },
      status: 'scheduled',
      description: `${description} Proposed date; time and venue not supplied.`,
      provenance: supplied(CLUB_CALENDAR),
    })
  for (let i = 0; i < 7; i++)
    events.push({
      id: `campus-diwali-day-${i}`,
      title: 'Diwali break',
      category: 'holiday',
      date: addDays('2026-11-06' as DateOnly, i),
      timing: { kind: 'allDay' },
      blocksTime: false,
      audience: { kind: 'all' },
      status: 'scheduled',
      description:
        'Nov 6–12 break from the supplied programme manual. Adapted reference assessments are separately labelled.',
      provenance: supplied(MANUAL),
    })
  const meals = ['breakfast', 'lunch', 'snacks', 'dinner'] as const
  const hours = [
    ['08:00', '09:30'],
    ['12:30', '14:00'],
    ['17:00', '18:30'],
    ['20:00', '21:30'],
  ]
  return {
    courses: Object.values(curriculum)
      .flat()
      .filter((c, i, all) => all.findIndex((x) => x.code === c.code) === i)
      .map((c) => ({
        id: courseId(c.code),
        code: c.code,
        title: c.name,
        provenance: supplied(MANUAL),
      })),
    events,
    series: [],
    exceptions: [],
    deadlines,
    tasks,
    birthdays: [],
    bookings: [],
    mess: messMenu.flatMap((menu, i) =>
      menu.map((items, m) => ({
        id: `campus-meal-${i}-${m}`,
        date: addDays('2026-11-02' as DateOnly, i),
        meal: meals[m]!,
        start: t(hours[m]![0]!),
        end: t(hours[m]![1]!),
        items: items.split('; '),
        note: 'October menu reused for this reference week; current menu requires confirmation.',
        provenance: supplied(MENU),
      })),
    ),
    announcements: [
      {
        id: 'campus-import-note',
        title: 'Your campus week · November 2–8',
        summary:
          'Timetable, menus, assessments and three persona routines are now in one place. Adapted dates and planning assumptions have source labels.',
        publishedOn: '2026-11-02' as DateOnly,
        importance: 'important',
        audience: { kind: 'all' },
        provenance: supplied('CampusOS source import · Nov 3, 2026'),
      },
      {
        id: 'campus-diwali',
        title: 'Diwali break · November 6–12',
        summary:
          'The programme manual lists these holidays. Persona plans and adapted assessment scenarios on those dates are reference activities; verify institutional notices.',
        publishedOn: '2026-11-02' as DateOnly,
        importance: 'important',
        audience: { kind: 'all' },
        provenance: supplied(MANUAL),
      },
    ],
    timeTax: [],
  }
}
