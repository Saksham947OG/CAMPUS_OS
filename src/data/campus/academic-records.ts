import type { AcademicRecord, AttendanceCourse } from '@/data/seeds/demo/academic-records'
import type { GradeScale } from '@/domain/academic-tools'
import { curriculum, campusProfiles } from './catalogue'

export const BMS_SCALE: GradeScale = {
  label: 'BMS Programme Manual 2026–27 · supplied 10-point scale',
  points: { 'A+': 10, A: 9, 'A-': 8, 'B+': 7, B: 6, 'B-': 5, 'C+': 4, C: 3, 'C-': 2, D: 1, F: 0 },
}
// These letters come from the anonymous grade screenshots. They are examples, not a named student's transcript.
const suppliedGrades: Record<string, string> = {
  BL: 'A',
  IPS: 'B-',
  'IPL-I': 'A-',
  POM: 'B+',
  'YM-II': 'A-',
}
export const campusAcademicRecords: Record<string, AcademicRecord> = Object.fromEntries(
  campusProfiles.map((p) => [
    p.id,
    {
      past:
        p.id === 'demo-student-a'
          ? []
          : [
              {
                id: 'bms-s2',
                label: 'Semester 2 · anonymized supplied grade examples',
                courses: curriculum[2]!.map((c) => ({ ...c, grade: suppliedGrades[c.code] })),
              },
            ],
      current: {
        id: p.id === 'demo-student-a' ? 'bms-s1' : 'bms-s3',
        label:
          p.id === 'demo-student-a'
            ? 'Semester 1 · current courses'
            : 'Semester 3 · current courses',
        courses: curriculum[p.id === 'demo-student-a' ? 1 : 3]!.map((c) => ({ ...c })),
      },
    },
  ]),
)
const held: Record<string, number> = {
  'IPL-II': 15,
  FI: 15,
  ED: 15,
  OB: 29,
  ME: 30,
  FA: 30,
  SC: 30,
  IBO: 28,
  IO: 30,
}
export const campusAttendanceRecords: Record<string, AttendanceCourse[]> = Object.fromEntries(
  campusProfiles.map((p, i) => [
    p.id,
    curriculum[p.id === 'demo-student-a' ? 1 : 3]!.map((c, n) => {
      const total = held[c.code] ?? 20
      const absent = (n + i) % 5
      return { code: c.code, name: c.name, held: total, attended: total - absent, target: 0.8 }
    }),
  ]),
)
