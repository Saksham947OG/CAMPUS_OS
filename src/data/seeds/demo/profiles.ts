import type { Profile } from '@/domain/profile'

/**
 * Fictional demo profiles (DEC-020). They carry no real student information and exist to
 * verify profile isolation and honest empty states. Records for them arrive in Phase 1.
 */
export const demoProfiles: readonly Profile[] = [
  {
    id: 'demo-student-a',
    displayName: 'Demo Student A',
    description: 'Fictional student with the fullest sample data set.',
    dataMode: 'demoSeed',
    cohortId: 'sample-section-1',
    purpose: 'full',
  },
  {
    id: 'demo-student-b',
    displayName: 'Demo Student B',
    description: 'Fictional student in a different section; used to verify profile isolation.',
    dataMode: 'demoSeed',
    cohortId: 'sample-section-2',
    purpose: 'alternateSection',
  },
  {
    id: 'demo-student-empty',
    displayName: 'Demo Student (no schedule)',
    description: 'Fictional student with no supplied schedule; shows honest empty states.',
    dataMode: 'demoSeed',
    cohortId: 'sample-section-none',
    purpose: 'empty',
  },
]

export const DEFAULT_PROFILE_ID = 'demo-student-a'
