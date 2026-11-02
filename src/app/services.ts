import { createObservationRepository } from '@/data/campus/observations'
import { campusProfiles, curriculum, courseId } from '@/data/campus/catalogue'
import { buildCampusDataset } from '@/data/campus/dataset'
import { campusMenu } from '@/data/campus/menu'
import { withCampusSources } from '@/data/campus/source-storage'
import { createReportRepository, type ReportRepository } from '@/data/reports/report-repository'
import { createMeetingRepository, type MeetingRepository } from '@/data/meetings/meeting-repository'
import { createMailRepository, type MailRepository } from '@/data/mail/mail-repository'
import {
  createClassroomRepository,
  type ClassroomRepository,
} from '@/data/classrooms/classroom-repository'
import {
  createCommunityRepository,
  type CommunityRepository,
} from '@/data/community/community-repository'
import {
  createAcademicsRepository,
  type AcademicsRepository,
} from '@/data/academics/academics-repository'
import { createContext, useContext } from 'react'
import { createPrefsRepositories, type PrefsRepositories } from '@/data/prefs/prefs'
import { createSharedRepository, type SharedRepository } from '@/data/shared/shared-repository'
import { createAdminRepository, type AdminRepository } from '@/data/admin/admin-repository'
import { createSportsRepository, type SportsRepository } from '@/data/sports/sports-repository'
import { createEssRepository, type EssRepository } from '@/data/ess/ess-repository'
import { createChillRepository, type ChillRepository } from '@/data/chill/chill-repository'
import { createCampusRepository, type CampusDataRepository } from '@/data/domain/campus-repository'
import {
  createAppStateRepository,
  type AppStateRepository,
} from '@/data/repositories/app-state-repository'
import {
  createSeedProfileRepository,
  type ProfileRepository,
} from '@/data/repositories/profile-repository'
import { demoProfiles } from '@/data/seeds/demo/profiles'
import { createStorageAdapter, type StorageAdapter } from '@/data/storage/storage-adapter'
import { systemClock, type Clock } from '@/lib/time'

/**
 * Composition root: the one place that picks concrete adapters. Components get these through
 * context, so swapping in the final-phase demo-backend adapters changes this file, not the UI.
 */
export interface Services {
  clock: Clock
  sourceData: boolean
  observations: ReturnType<typeof createObservationRepository>
  storage: StorageAdapter
  profiles: ProfileRepository
  appState: AppStateRepository
  campus: CampusDataRepository
  prefs: PrefsRepositories
  chill: ChillRepository
  ess: EssRepository
  sports: SportsRepository
  admin: AdminRepository
  shared: SharedRepository
  academics: AcademicsRepository
  community: CommunityRepository
  classrooms: ClassroomRepository
  mail: MailRepository
  meetings: MeetingRepository
  reports: ReportRepository
  /** Id factory for user-created records (injected so tests are deterministic). */
  newId: (prefix: string) => string
}

const randomId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export function createServices(
  overrides: Partial<Pick<Services, 'clock' | 'storage' | 'newId'>> & {
    /** Presentation fixtures such as the example bookings. Tests that need a clean engine baseline turn this off. */
    demoExamples?: boolean
    /** Source-backed data is the production default; fixture tests opt out explicitly. */
    sourceData?: boolean
  } = {},
): Services {
  const sourceData = overrides.sourceData ?? true
  const baseStorage = overrides.storage ?? createStorageAdapter()
  const storage = sourceData ? withCampusSources(baseStorage) : baseStorage
  const profiles = sourceData ? campusProfiles : demoProfiles
  const clock = overrides.clock ?? systemClock
  const newId = overrides.newId ?? randomId
  const prefs = createPrefsRepositories(storage)
  const ess = createEssRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    profileIds: profiles.map((p) => p.id),
  })
  const sports = createSportsRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    examples: overrides.demoExamples ?? !sourceData,
  })
  const admin = createAdminRepository({ storage, clock, newId, notifications: prefs.notifications })
  const shared = createSharedRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    profileIds: profiles.map((p) => p.id),
  })
  const community = createCommunityRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
  })
  const reports = createReportRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
  })
  const mail = createMailRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    shared,
  })
  const classrooms = createClassroomRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
  })
  // The campus repository is created last (it reads these projections), so meetings take it lazily.
  let campusRepo: CampusDataRepository | null = null
  const meetings = createMeetingRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    campus: () => campusRepo!,
    classrooms,
  })
  const academics = createAcademicsRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    clubIds: () => community.clubIds(),
  })
  const campus = createCampusRepository({
    storage,
    clock,
    profiles,
    ...(sourceData
      ? {
          dataset: buildCampusDataset,
          enrolledCourseIds: (profileId: string) =>
            curriculum[profileId === 'demo-student-a' ? 1 : 3]!.map((c) => courseId(c.code)),
        }
      : {}),
    newId,
    extraBookings: (profileId) => [
      ...ess.bookingRefs(profileId),
      ...sports.bookingRefs(profileId),
      ...academics.bookingRefs(profileId),
      ...community.bookingRefs(profileId),
      ...classrooms.bookingRefs(profileId),
      ...meetings.bookingRefs(profileId),
    ],
  })
  campusRepo = campus
  return {
    sourceData,
    observations: createObservationRepository(storage),
    ess,
    academics,
    community,
    classrooms,
    mail,
    meetings,
    reports,
    sports,
    admin,
    shared,
    clock,
    storage,
    newId,
    chill: createChillRepository({
      storage,
      clock,
      newId,
      notifications: prefs.notifications,
      ...(sourceData ? { menu: campusMenu } : {}),
    }),
    profiles: createSeedProfileRepository(profiles),
    appState: createAppStateRepository(storage),
    prefs,
    campus,
  }
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used inside <AppProviders>')
  return services
}
