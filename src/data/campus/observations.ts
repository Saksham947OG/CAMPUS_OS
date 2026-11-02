import { z } from 'zod'
import { dateOnlySchema, localTimeSchema } from '@/domain/records'
import type { StorageAdapter } from '@/data/storage/storage-adapter'
export const observationSchema = z.object({
  id: z.string().min(1),
  profileId: z.string().min(1),
  processId: z.string().min(1),
  date: dateOnlySchema,
  time: localTimeSchema.optional(),
  phase: z.enum(['baseline', 'withCampusOS']),
  minutes: z.number().min(0).max(1440),
  method: z.string().trim().min(3).max(300),
  recordedAt: z.iso.datetime({ offset: true }),
})
export type WaitObservation = z.infer<typeof observationSchema>
export function createObservationRepository(storage: StorageAdapter) {
  const listeners = new Set<() => void>()
  const key = (profileId: string) => `campusos:time-observations:v1:${profileId}`
  return {
    load(profileId: string): WaitObservation[] {
      const r = storage.read(key(profileId), z.array(observationSchema))
      return r.status === 'ok' ? r.value.filter((x) => x.profileId === profileId) : []
    },
    save(row: WaitObservation) {
      const parsed = observationSchema.safeParse(row)
      if (!parsed.success)
        return {
          ok: false,
          message: 'Enter a valid date, 0–1440 minutes and a method (at least 3 characters).',
        }
      const rows = this.load(row.profileId)
      const result = storage.write(key(row.profileId), [
        ...rows.filter((x) => x.id !== row.id),
        parsed.data,
      ])
      listeners.forEach((f) => f())
      return {
        ok: true,
        message: result.ok
          ? 'Observation saved.'
          : 'Observation kept for this session; persistent storage is unavailable.',
      }
    },
    reset(profileId: string) {
      storage.remove(key(profileId))
      listeners.forEach((f) => f())
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
