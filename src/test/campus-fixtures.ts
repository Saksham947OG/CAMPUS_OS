import { createCampusRepository } from '@/data/domain/campus-repository'
import { demoProfiles } from '@/data/seeds/demo/profiles'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import type { ProfileData } from '@/domain/records'
import { addDays, fixedClock, startOfWeek, todayIn, type Clock, type DateOnly } from '@/lib/time'
import { makeNow } from '@/selectors/now'
import { createMemoryStorage } from './memory-storage'

/** Monday 2 Nov 2026, 10:00 IST. "Today" is a Monday so week offsets read naturally. */
export const FIXED_NOW = '2026-11-02T04:30:00Z'

export function makeRepo(nowIso: string = FIXED_NOW, memory = createMemoryStorage()) {
  const clock: Clock = fixedClock(nowIso)
  const storage = createStorageAdapter({ backend: memory.storage })
  let n = 0
  const repo = createCampusRepository({
    storage,
    clock,
    profiles: demoProfiles,
    newId: (prefix) => `${prefix}-test-${++n}`,
  })
  const today = todayIn(clock)
  return {
    repo,
    storage,
    memory,
    clock,
    today,
    now: makeNow(clock),
    weekStart: startOfWeek(today),
    d: (offset: number): DateOnly => addDays(today, offset),
    w: (offset: number): DateOnly => addDays(startOfWeek(today), offset),
    load: (profileId = 'demo-student-a'): Promise<ProfileData> => repo.load(profileId),
  }
}
