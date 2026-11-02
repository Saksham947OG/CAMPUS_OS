import { defaultHomePrefs, layoutForPreset } from '@/data/prefs/home-prefs'
import { z, type ZodType } from 'zod'
import type { StorageAdapter, ReadResult } from '@/data/storage/storage-adapter'
import { IMPORT_VERSION } from './catalogue'
import { oldStoreBuilders, sourceStoreBuilders } from './stores'

const markerSchema = z.literal(IMPORT_VERSION)
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const idOf = (value: unknown) => (record(value) && typeof value.id === 'string' ? value.id : null)
const sourceKey = (area: string) => `campusos:source-import:v1:${area}`

/** Merge source fixtures exactly once per service, preserving user-created records and corrupted data. */
export function withCampusSources(base: StorageAdapter): StorageAdapter {
  const areaOf = (key: string) => /^campusos:([^:]+):v1$/.exec(key)?.[1]
  const pending = new Set<string>()
  return {
    get mode() {
      return base.mode
    },
    onModeChange: (listener) => base.onModeChange(listener),
    read<T>(key: string, schema: ZodType<T>): ReadResult<T> {
      const saved = base.read(key, schema)
      const homeProfile = /^campusos:home:v1:(.+)$/.exec(key)?.[1]
      if (homeProfile && saved.status === 'missing') {
        const academic = homeProfile === 'demo-student-a'
        const prefs = defaultHomePrefs()
        prefs.preset = academic ? 'academic' : 'balanced'
        prefs.widgets = layoutForPreset(academic ? 'academic' : 'balanced').map((w) => ({
          ...w,
          visible: w.visible || w.id === 'timeTax' || w.id === 'messPreview',
        }))
        prefs.quickActions = academic
          ? ['calendar', 'academics-courses', 'laundry-machines', 'mess']
          : homeProfile === 'demo-student-b'
            ? ['calendar-find-a-time', 'bookings-gym', 'community-clubs', 'chill-spot']
            : ['bookings-classrooms', 'parcels', 'laundry-ss', 'bookings-library']
        const parsed = schema.safeParse(prefs)
        if (parsed.success) return { status: 'ok', value: parsed.data }
      }
      const area = areaOf(key)
      if (!area || !(area in sourceStoreBuilders) || saved.status === 'invalid') return saved
      if (base.read(sourceKey(area), markerSchema).status === 'ok') return saved
      const kind = area as keyof typeof sourceStoreBuilders
      const incoming = sourceStoreBuilders[kind]() as unknown as Record<string, unknown>
      const old = oldStoreBuilders[kind]() as unknown as Record<string, unknown>
      const stored: Record<string, unknown> =
        saved.status === 'ok' && record(saved.value) ? saved.value : {}
      const referencedIds = new Set<string>()
      for (const list of Object.values(stored))
        if (Array.isArray(list))
          for (const entry of list)
            if (record(entry))
              for (const [field, value] of Object.entries(entry))
                if (
                  /^(resourceId|machineId|bookId|roomId|equipmentId|clubId|teamId|examId)$/.test(
                    field,
                  ) &&
                  typeof value === 'string'
                )
                  referencedIds.add(value)
      const result: Record<string, unknown> = { ...incoming, ...stored }
      for (const [field, value] of Object.entries(incoming)) {
        const previous = stored[field]
        if (Array.isArray(value)) {
          const oldIds = new Set(
            Array.isArray(old[field]) ? old[field].map(idOf).filter(Boolean) : [],
          )
          const incomingIds = new Set(value.map(idOf).filter(Boolean))
          const retained = Array.isArray(previous)
            ? previous.filter((entry) => {
                const id = idOf(entry)
                if (!id) return true
                if (incomingIds.has(id)) return false
                if (referencedIds.has(id)) return true
                if (
                  area === 'mail' &&
                  oldIds.has(id) &&
                  record(entry) &&
                  entry.provenance === 'DEMO_SIMULATED'
                )
                  return false
                return (
                  !oldIds.has(id) ||
                  !record(entry) ||
                  !record(entry.provenance) ||
                  entry.provenance.dataMode !== 'demoSeed'
                )
              })
            : []
          const sourceRows = value.map((entry) => {
            if (!record(entry)) return entry
            const prior = Array.isArray(previous)
              ? previous.find((p) => idOf(p) === idOf(entry))
              : undefined
            if (!record(prior)) return entry
            const result = { ...entry }
            for (const state of ['status', 'operationalStatus', 'physicalStatus', 'closureNote'])
              if (state in prior && state in entry) result[state] = prior[state]
            return result
          })
          result[field] = [...sourceRows, ...retained]
        } else if (record(value) && record(previous)) {
          result[field] =
            JSON.stringify(previous) === JSON.stringify(old[field])
              ? value
              : { ...value, ...previous }
        } else if (
          previous === undefined ||
          JSON.stringify(previous) === JSON.stringify(old[field])
        )
          result[field] = value
      }
      // Source records change names and hours, while an existing closure stays effective.
      if (area === 'sports' && Array.isArray(result.resources) && Array.isArray(stored.resources)) {
        const existing = stored.resources.filter(record)
        result.resources = result.resources.map((r) => {
          if (!record(r)) return r
          const prior = existing.find((x) => x.id === r.id)
          return prior?.status === 'closed'
            ? { ...r, status: prior.status, closureNote: prior.closureNote }
            : r
        })
      }
      const parsed = schema.safeParse(result)
      if (!parsed.success)
        throw new Error(`Campus source import failed for ${area}: ${parsed.error.message}`)
      pending.add(area)
      return { status: 'ok', value: parsed.data }
    },
    write(key, value) {
      const result = base.write(key, value)
      const area = areaOf(key)
      // The store is written first. Its source marker is never committed ahead of its records.
      if (area && pending.has(area)) {
        base.write(sourceKey(area), IMPORT_VERSION)
        pending.delete(area)
      }
      return result
    },
    remove(key) {
      const area = areaOf(key)
      base.remove(key)
      if (area) {
        base.remove(sourceKey(area))
        pending.delete(area)
      }
    },
  }
}
