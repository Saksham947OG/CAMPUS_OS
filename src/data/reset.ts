import type { Profile } from '@/domain/profile'
import type { CampusDataRepository } from './domain/campus-repository'
import type { ChillRepository } from './chill/chill-repository'
import type { EssRepository } from './ess/ess-repository'
import type { SportsRepository } from './sports/sports-repository'
import type { AdminRepository } from './admin/admin-repository'
import type { AcademicsRepository } from './academics/academics-repository'
import type { CommunityRepository } from './community/community-repository'
import type { SharedRepository } from './shared/shared-repository'
import type { PrefsRepositories } from './prefs/prefs'

/**
 * "Reset demo" (C-A25): restores seed data by removing everything the demo profiles created or
 * saved on this device — records, reminders, the inbox, layouts and filters, plus demo café orders and carts. It is a separate,
 * deliberately confirmed operation and is never triggered by "Reset filters" or "Reset layout".
 * The active-profile choice is kept.
 */
export async function resetDemoData(
  profiles: readonly Profile[],
  campus: CampusDataRepository,
  prefs: PrefsRepositories,
  chill?: ChillRepository,
  ess?: EssRepository,
  sports?: SportsRepository,
  admin?: AdminRepository,
  shared?: SharedRepository,
  academics?: AcademicsRepository,
  community?: CommunityRepository,
): Promise<void> {
  for (const p of profiles) {
    await campus.resetUserData(p.id)
    await Promise.all(Object.values(prefs).map((repo) => repo.reset(p.id)))
  }
  // The café store is one global store (DEC-048), so it is cleared once, together with every cart.
  await chill?.resetAll(profiles)
  // Campus Essentials is one global store too; it is cleared separately from Chill Spot and from Home/Calendar data.
  await ess?.resetAll()
  // Sports is the third global service store; it is cleared on its own and never touches Home or Calendar data.
  await sports?.resetAll()
  // Administration requests are a fourth global store, cleared on their own and never touching source fixtures.
  await admin?.resetAll()
  // Exam seating and Time Tax scenarios live in the Shared store, cleared on its own.
  await shared?.resetAll()
  // Meetings, project groups and mentorship invitations are the Academics store, cleared on its own.
  await academics?.resetAll()
  // Lost & Found reports and claims, club follows and sports teams are the Community store, cleared on its own.
  await community?.resetAll()
}
