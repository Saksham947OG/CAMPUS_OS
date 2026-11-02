import { defaultAdminConfig, type AdminStore } from '@/domain/admin'

/** The starting Administration scenario: nothing submitted and no real team, person or SLA anywhere. */
export function initialAdminStore(): AdminStore {
  return { schemaVersion: 1, config: defaultAdminConfig(), leaves: [], tickets: [] }
}
