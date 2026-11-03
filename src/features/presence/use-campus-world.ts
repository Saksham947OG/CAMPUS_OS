import { createContext, useContext } from 'react'
import type { NPC } from './world'

export interface FacilityLoad {
  id: string
  label: string
  icon: string
  path: string
  count: number
  capacity: number
  /** Classrooms count rooms in use from the recorded schedule; every other place counts simulated people. */
  unit: 'people' | 'rooms' | 'machines'
  capacityKey?: string
  /** True when the number comes from the simulation rather than a record. */
  simulated: boolean
}

export interface WorldValue {
  world: readonly NPC[]
  loads: readonly FacilityLoad[]
  paused: boolean
  setPaused: (p: boolean | ((p: boolean) => boolean)) => void
}

export const WorldContext = createContext<WorldValue | null>(null)

/** Null outside source-data mode, where no simulation runs. */
export const useCampusWorld = () => useContext(WorldContext)
