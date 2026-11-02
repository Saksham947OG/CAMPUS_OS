import type { Course } from '@/domain/academic-tools'

/**
 * FICTIONAL academic fixtures for the calculators. They are not anyone's record, they are keyed by
 * persona so one profile never sees another's, and the third profile has none, so the empty
 * state is real. Grades use the demo scale in `academic-tools`.
 */
export interface Semester {
  id: string
  label: string
  courses: Course[]
}
export interface AcademicRecord {
  /** Earlier semesters, finalized. */
  past: Semester[]
  /** The current semester: some grades pending. */
  current: Semester
}
export interface AttendanceCourse {
  code: string
  name: string
  attended: number
  held: number
  /** A demo target, labelled as such wherever shown. */
  target: number
  remaining?: number
}

const c = (code: string, name: string, credits: number, grade?: string): Course => ({
  code,
  name,
  credits,
  ...(grade ? { grade } : {}),
})

export const academicRecords: Record<string, AcademicRecord> = {
  'demo-student-a': {
    past: [
      {
        id: 's1',
        label: 'Semester 1 (local)',
        courses: [
          c('DEMO-001', 'Sample foundations', 4, 'A'),
          c('DEMO-002', 'Sample quantitative methods', 4, 'B+'),
          c('DEMO-003', 'Sample communication', 2, 'A+'),
        ],
      },
      {
        id: 's2',
        label: 'Semester 2 (local)',
        courses: [
          c('DEMO-011', 'Sample economics', 4, 'B'),
          c('DEMO-012', 'Sample statistics', 4, 'A'),
          c('DEMO-013', 'Sample accounting', 3, 'B+'),
        ],
      },
    ],
    current: {
      id: 's3',
      label: 'Semester 3 (demo, in progress)',
      courses: [
        c('DEMO-101', 'Sample Course A', 4, 'A'),
        c('DEMO-102', 'Sample Course B', 4),
        c('DEMO-103', 'Sample Course C', 3),
      ],
    },
  },
  'demo-student-b': {
    past: [
      {
        id: 's1',
        label: 'Semester 1 (local)',
        courses: [
          c('DEMO-001', 'Sample foundations', 4, 'B'),
          c('DEMO-002', 'Sample quantitative methods', 4, 'B'),
          c('DEMO-003', 'Sample communication', 2, 'A'),
        ],
      },
    ],
    current: {
      id: 's2',
      label: 'Semester 2 (demo, in progress)',
      courses: [c('DEMO-102', 'Sample Course B', 4), c('DEMO-101', 'Sample Course A', 4)],
    },
  },
}

export const attendanceRecords: Record<string, AttendanceCourse[]> = {
  'demo-student-a': [
    {
      code: 'DEMO-101',
      name: 'Sample Course A',
      attended: 16,
      held: 20,
      target: 0.75,
      remaining: 20,
    },
    {
      code: 'DEMO-102',
      name: 'Sample Course B',
      attended: 12,
      held: 20,
      target: 0.75,
      remaining: 20,
    },
    {
      code: 'DEMO-103',
      name: 'Sample Course C',
      attended: 15,
      held: 20,
      target: 0.75,
      remaining: 16,
    },
  ],
  'demo-student-b': [
    {
      code: 'DEMO-101',
      name: 'Sample Course A',
      attended: 9,
      held: 10,
      target: 0.75,
      remaining: 30,
    },
  ],
}
