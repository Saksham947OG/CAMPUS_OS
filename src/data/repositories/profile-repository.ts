import type { Profile } from '@/domain/profile'

export interface ProfileRepository {
  list(): Promise<readonly Profile[]>
  get(id: string): Promise<Profile | undefined>
}

/** Initial adapter: validated seed profiles. A future backend adapter implements the same interface. */
export function createSeedProfileRepository(profiles: readonly Profile[]): ProfileRepository {
  return {
    async list() {
      return profiles
    },
    async get(id) {
      return profiles.find((p) => p.id === id)
    },
  }
}
