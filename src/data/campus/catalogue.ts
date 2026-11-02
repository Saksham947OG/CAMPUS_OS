import type { Profile } from '@/domain/profile'
import type { Provenance } from '@/domain/provenance'
import type { LocalTime, DateOnly } from '@/lib/time'

export const IMPORT_VERSION = 'campus-2026-11-v1'
export const REFERENCE_WEEK = { start: '2026-11-02' as DateOnly, end: '2026-11-08' as DateOnly }
export const t = (value: string) => value as LocalTime
export const supplied = (sourceLabel: string, sourceRecordId?: string): Provenance => ({
  dataMode: 'provided',
  verification: 'tentative',
  authority: 'unverifiedProvided',
  sourceLabel,
  ...(sourceRecordId ? { sourceRecordId } : {}),
  importBatchId: IMPORT_VERSION,
})
export const illustrative = (sourceLabel: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel,
  importBatchId: IMPORT_VERSION,
})

// Stable IDs preserve every existing profile's personal records across this import.
export const campusProfiles: readonly Profile[] = [
  {
    id: 'demo-student-a',
    displayName: 'Ananya Sharma',
    description: 'Year 1 · Academic focus · Quizzes, quiet study and fewer queues',
    dataMode: 'provided',
    cohortId: 'bms-year-1',
    purpose: 'full',
  },
  {
    id: 'demo-student-b',
    displayName: 'Rohan Mehta',
    description: 'Year 2 · Committee organiser · Name illustrative; routine supplied in Profile 2',
    dataMode: 'provided',
    cohortId: 'bms-year-2-b',
    purpose: 'alternateSection',
  },
  {
    id: 'demo-student-empty',
    displayName: 'Aanya Sharma',
    description: 'Year 2 · Club planner · Rooms, parcels, laundry and protected focus time',
    dataMode: 'provided',
    cohortId: 'bms-year-2-a',
    purpose: 'full',
  },
]

export interface CurriculumCourse {
  code: string
  name: string
  credits: number
}
const rows = (semester: number, list: [string, string, number][]): CurriculumCourse[] =>
  list.map(([code, name, credits]) => ({ code: code || `S${semester}`, name, credits }))
export const curriculum: Record<number, CurriculumCourse[]> = {
  1: rows(1, [
    ['FMS', 'Fundamentals of Mathematics', 3],
    ['PoE', 'Principles of Economics', 3],
    ['OC-I', 'Oral Communication - I', 1.5],
    ['PSY', 'Introduction to Psychology', 3],
    ['PHI-I', 'Philosophy - I', 1.5],
    ['EHV', 'Ethics and Human Values', 1.5],
    ['IIS', 'Introduction to Information Systems', 3],
    ['YM-I', 'Yoga and Meditation - I', 1.5],
    ['IKS', 'Indian Knowledge Systems', 3],
  ]),
  2: rows(2, [
    ['MAC', 'Macroeconomics', 3],
    ['IPS', 'Introduction to Probability and Statistics', 3],
    ['POM', 'Principles of Management', 3],
    ['OC-II', 'Oral Communication - II', 1.5],
    ['IPL-I', 'Introduction to Programming Languages-I', 1.5],
    ['PHI-II', 'Philosophy - II', 1.5],
    ['MM', 'Marketing Management', 3],
    ['YM-II', 'Yoga and Meditation - II', 1.5],
    ['BL', 'Business Laws', 3],
  ]),
  3: rows(3, [
    ['ME', 'Microeconomics', 3],
    ['FA', 'Financial Accounting', 3],
    ['IBO', 'Introduction to Business Operations', 3],
    ['OB', 'Organizational Behaviour', 3],
    ['IO', 'Introduction to Optimization', 3],
    ['FI', 'French - I', 1.5],
    ['IPL-II', 'Introduction to Programming Languages-II', 1.5],
    ['SC', 'Sociology', 3],
    ['ED', 'Environment & Development', 1.5],
  ]),
  4: rows(4, [
    ['IP', 'Industrial Psychology', 3],
    ['PP-I', 'Introduction to Public Policy - I', 1.5],
    ['CTPS', 'Critical Thinking and Problem Solving', 3],
    ['IST', 'Introduction to Strategic Thinking', 3],
    ['WC', 'Written Communication', 3],
    ['IPR', 'Intellectual Property Rights', 1.5],
    ['F-II', 'French - II', 1.5],
    ['DV', 'Data Visualization', 1.5],
    ['FSCM', 'Foundations of Supply Chain Management', 3],
    ['FMI', 'Financial Markets & Institutions', 1.5],
  ]),
  5: rows(5, [
    ['HMW', 'Happiness and Mental Wellbeing', 1.5],
    ['PP-II', 'Introduction to Public Policy - II', 1.5],
    ['BSR', 'Business Sustainability and Responsibility', 3],
    ['CMA', 'Cost and Management Accounting', 3],
    ['TM', 'Tourism Management', 3],
    ['RM', 'Research Methods', 3],
    ['CF', 'Corporate Finance', 3],
    ['IR', 'Industrial Relations', 1.5],
    ['IE', 'Indian Economy', 1.5],
  ]),
  6: rows(6, [
    ['INT', 'Industry Internship / International Exchange / International Immersion', 12],
  ]),
  7: rows(7, [
    ['ENT', 'Entrepreneurship', 3],
    ['BSQP', 'Business Standards & Quality Principles', 1.5],
    ['MP', 'Movies & Philosophy', 1.5],
    ['DIS-I', 'Dissertation', 6],
    ...Array.from({ length: 4 }, (_, i): [string, string, number] => [
      `ELE-${i + 1}`,
      `Elective ${i + 1}`,
      3,
    ]),
  ]),
  8: rows(8, [
    ...Array.from({ length: 4 }, (_, i): [string, string, number] => [
      `ELE-${i + 5}`,
      `Elective ${i + 5}`,
      3,
    ]),
    ['CAP', 'Capstone Project', 6],
    ['DIS-II', 'Dissertation', 6],
  ]),
}
export const courseId = (code: string) => `bms-${code.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
export const MANUAL = 'BMS Programme Manual 2026–27 · supplied copy'
export const TIMETABLE = 'BMS Batch 02 Semester III timetable · supplied copy'
export const MENU = 'October mess menu · reused for Nov 2–8 by owner request'
export const CLUB_CALENDAR = 'Clubs & Committees Event Calendar Nov 2026–Mar 2027 · proposal'

// Full seven-day menu, transcribed from its rendered table, preserving alternating-week choices.
export const messMenu = [
  [
    'Idli, sambar and chutney; chocos; bread, butter and jam; fruit; bread omelette',
    'Manchurian; masoor dal; fried rice / egg fried rice; roti; fryums; curd; salad and pickle',
    'Honey chilli potato; coffee, tea and milk',
    'Black channa gravy; dal tadka; plain rice; roti / puri; fruit custard; salad and pickle',
  ],
  [
    'Paneer paratha and tomato chutney; cornflakes; bread, butter and jam; fruit',
    'Aloo matar; dal tadka; rice; roti; roasted papad; boondi raita; sprouts',
    'Chole and kulcha; coffee, tea and milk',
    'Bhindi; dal makhni; rice; roti; salad; pickle; besan laddoo',
  ],
  [
    'Upma and chutney; cornflakes; bread, butter and jam; bread omelette',
    'Kadhi pakoda; aloo masala; rice; roti; fryums; boondi raita; sprouts',
    'Kachodi with mint and tamarind chutney; coffee, tea and milk',
    'Veg / chicken biryani; salaan; kadhai paneer; roti; kulfi / chocobar; raita; salad and pickle',
  ],
  [
    'Vada sambar and chutney; cornflakes; bread, butter and jam; boiled eggs; fruit',
    'Lauki; dal fry; rice; roti; roasted papad; raita; salad',
    'Pasta; coffee, tea and milk',
    'Pindi chole; puri; rice; roti; basundi; salad and pickle',
  ],
  [
    'Aloo paratha and tomato chutney; chocos; bread, butter and jam; boiled eggs',
    'Paneer butter masala & egg curry / paneer bhurji & egg bhurji (alternate weeks); dal fry; jeera rice; roti; fryums; veg raita; sprouts',
    'Aloo sandwich with mint and tamarind chutney; coffee, tea and milk',
    'Dal tadka; veg handi; jeera rice; roti; salad and pickle; gulab jamun',
  ],
  [
    'Masala dosa, sambar and coconut chutney; cornflakes; bread, butter and jam; boiled eggs; fruit',
    'Chole bhature; roti; masoor dal; rice; roasted papad; lassi; salad and pickle',
    'Vada with mint and tamarind chutney; coffee, tea and milk',
    'Soya chunks; dal makhni; jeera rice; roti; jalebi; salad and pickle',
  ],
  [
    'Poha with peanuts and sev; cornflakes; bread, butter and jam; boiled eggs; fruit',
    'Mixed vegetables; toor dal; rice; roti; potato wedges; curd; salad and pickle',
    'Pani puri with sweet and spicy chutney; coffee, tea and milk',
    'Paneer butter masala; butter chicken; dal fry; veg pulao; naan / roti; ice cream; salad and pickle',
  ],
]

export const proposedEvents = [
  [
    '2026-11-14',
    'kalakriti',
    'Rangrez: Open Mic & Creative Showcase',
    'Music, poetry, stand-up, dance and student performances.',
  ],
  [
    '2026-11-28',
    'econyx',
    'The Bull Run: Market Simulation',
    'Teams respond to market news and economic indicators.',
  ],
  [
    '2026-12-09',
    'markaizen',
    'Brandstorm: The Rebranding Challenge',
    'Pitch a refreshed brand identity, positioning and campaign.',
  ],
  [
    '2026-12-19',
    'sports-committee',
    'Winter Inter-Hostel Football Cup',
    'Short-format hostel football tournament.',
  ],
  [
    '2027-01-10',
    'sankalp',
    'Project Warmth: Winter Donation Drive',
    'Winter clothing and essential supplies collection.',
  ],
  [
    '2027-01-24',
    'dialectical',
    'Clash of Claims: Parliamentary Debate',
    'Surprise motions, speeches and rebuttals.',
  ],
  [
    '2027-01-30',
    'sapient',
    'Case in Point: Live Consulting Challenge',
    'Analyse a business problem and present recommendations.',
  ],
  [
    '2027-02-07',
    'markaizen',
    'Ad Mad: The 60-Second Campaign',
    'Create an advertisement for an unexpected product.',
  ],
  [
    '2027-02-20',
    'sports-committee',
    'Smash It: Inter-Batch Badminton Tournament',
    'Singles and doubles knockout tournament.',
  ],
  [
    '2027-02-27',
    'kalakriti',
    'Alaap: Acoustic & Unplugged Night',
    'Acoustic performances and collaborations.',
  ],
  [
    '2027-03-06',
    'econyx',
    'PolicyLab: The Budget Room',
    'Budget policy discussion and team challenge.',
  ],
  [
    '2027-03-14',
    'sankalp',
    'Green Campus: Sustainability Action Day',
    'Waste segregation awareness and clean-up.',
  ],
  [
    '2027-03-26',
    'sapient',
    'The Boardroom: Strategy Showdown',
    'Respond to business disruption and defend strategy.',
  ],
] as const
