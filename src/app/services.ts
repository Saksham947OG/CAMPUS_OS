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
  /** Id factory for user-created records (injected so tests are deterministic). */
  newId: (prefix: string) => string
}

const randomId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`

export function createServices(
  overrides: Partial<Pick<Services, 'clock' | 'storage' | 'newId'>> = {},
): Services {
  const storage = overrides.storage ?? createStorageAdapter()
  const clock = overrides.clock ?? systemClock
  const newId = overrides.newId ?? randomId
  const prefs = createPrefsRepositories(storage)
  const ess = createEssRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    profileIds: demoProfiles.map((p) => p.id),
  })
  const sports = createSportsRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
  })
  const admin = createAdminRepository({ storage, clock, newId, notifications: prefs.notifications })
  const shared = createSharedRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    profileIds: demoProfiles.map((p) => p.id),
  })
  const community = createCommunityRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
  })
  const academics = createAcademicsRepository({
    storage,
    clock,
    newId,
    notifications: prefs.notifications,
    clubIds: () => community.clubIds(),
  })
  return {
    ess,
    academics,
    community,
    sports,
    admin,
    shared,
    clock,
    storage,
    newId,
    chill: createChillRepository({ storage, clock, newId, notifications: prefs.notifications }),
    profiles: createSeedProfileRepository(demoProfiles),
    appState: createAppStateRepository(storage),
    prefs,
    campus: createCampusRepository({
      storage,
      clock,
      profiles: demoProfiles,
      newId,
      extraBookings: (profileId) => [
        ...ess.bookingRefs(profileId),
        ...sports.bookingRefs(profileId),
        ...academics.bookingRefs(profileId),
        ...community.bookingRefs(profileId),
      ],
    }),
  }
}

export const ServicesContext = createContext<Services | null>(null)

export function useServices(): Services {
  const services = useContext(ServicesContext)
  if (!services) throw new Error('useServices must be used inside <AppProviders>')
  return services
}
