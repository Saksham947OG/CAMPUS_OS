import { defaultDemoRules, type EssStore, type Machine } from '@/domain/ess'
import type { Provenance } from '@/domain/provenance'
import { isoFromMs } from '@/lib/time'

const demo = (nowIso: string): Provenance => ({
  dataMode: 'demoSeed',
  verification: 'unknown',
  authority: 'demoIllustration',
  sourceLabel: 'Illustrative sample machine (not a real campus machine)',
  updatedAt: nowIso,
})

/**
 * The starting Campus Essentials scenario. Everything is fictional and labelled. Deliberately empty
 * where the spec says nothing may be invented: no SS Laundry visit or loads, no fee, no parcels.
 */
export function initialEssStore(nowMs: number): EssStore {
  const nowIso = isoFromMs(nowMs)
  const machine = (
    id: string,
    label: string,
    operationalStatus: Machine['operationalStatus'],
    physicalStatus: Machine['physicalStatus'],
  ): Machine => ({
    id,
    label,
    location: 'Sample location (fictional)',
    operationalStatus,
    physicalStatus,
    sourceLabel: 'Demo sample report (not a sensor reading)',
    asOf: nowIso,
    provenance: demo(nowIso),
  })
  return {
    schemaVersion: 1,
    rules: defaultDemoRules(),
    visit: null,
    loads: [],
    machines: [
      machine('machine-1', 'Sample washer 1', 'working', 'unknown'),
      machine('machine-2', 'Sample washer 2', 'working', 'occupied'),
      machine('machine-3', 'Sample washer 3', 'outOfService', 'unknown'),
      machine('machine-4', 'Sample dryer 1', 'unknown', 'unknown'),
    ],
    reservations: [],
    messOptIn: [],
    messSessions: [],
    messBusy: null,
    messFeedback: [],
    fee: null,
    feeStatus: {},
    parcels: [],
    nextSequence: 1,
  }
}
