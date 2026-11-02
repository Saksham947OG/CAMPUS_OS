import { createServices } from '@/app/services'
import { createStorageAdapter } from '@/data/storage/storage-adapter'
import { createMemoryStorage } from '@/test/memory-storage'
import { fixedClock, type DateOnly } from '@/lib/time'
import { buildCampusDataset } from './dataset'
import { compositeRange, personaEvidence } from './evidence'
import { sourceLibrary } from './source-library'
import { campusMenu } from './menu'
import { campusProfiles } from './catalogue'
import { createObservationRepository } from './observations'
import { SPORTS_STORE_KEY } from '@/data/sports/sports-repository'
import { initialSportsStore } from '@/data/seeds/demo/sports-data'

const now = fixedClock('2026-11-03T04:30:00Z')
const setup = () => {
  const memory = createMemoryStorage()
  const storage = createStorageAdapter({ backend: memory.storage })
  const services = createServices({ clock: now, storage, sourceData: true })
  return { memory, storage, services }
}

it('loads every source-backed service and all three personas without schema errors', async () => {
  const { services } = setup()
  const profiles = await services.profiles.list()
  expect(profiles.map((p) => p.displayName)).toEqual([
    'Ananya Sharma',
    'Abeer Sethi',
    'Myra Kapoor',
  ])
  for (const profile of campusProfiles) {
    const data = await services.campus.load(profile.id)
    expect(data.importWarnings).toEqual([])
    expect(data.events.length).toBeGreaterThan(20)
    expect(data.tasks.every((t) => t.ownerProfileId === profile.id)).toBe(true)
    expect(data.mess).toHaveLength(28)
  }
  await Promise.all([
    services.ess.load(),
    services.sports.load(),
    services.shared.load(),
    services.academics.load(),
    services.community.load(),
    services.classrooms.load(),
    services.chill.load(),
    services.admin.load(),
    services.mail.load(),
    services.meetings.load(),
  ])
  expect((await services.shared.load()).seats[0]).toMatchObject({
    hall: 'Conference Hall',
    column: '3',
    row: '5',
    provenance: { dataMode: 'demoSeed' },
  })
  expect((await services.sports.load()).reservations.some((r) => r.id.startsWith('DEMO-EX-'))).toBe(
    false,
  )
  expect((await services.community.load()).clubEvents).toHaveLength(13)
})
it('preserves personal bookings through the first source import and repeated reloads', async () => {
  const { memory, storage } = setup()
  const old = initialSportsStore(now.now().epochMilliseconds)
  old.resources.find((r) => r.id === 'DEMO-GYM')!.status = 'closed'
  old.resources.find((r) => r.id === 'DEMO-GYM')!.closureNote = 'Maintenance'
  memory.storage.setItem(SPORTS_STORE_KEY, JSON.stringify(old))
  let n = 0
  const s = createServices({ clock: now, storage, sourceData: true, newId: (p) => `${p}-${++n}` })
  const first = await s.sports.reserve('demo-student-a', {
    resourceId: 'DEMO-TT-1',
    date: '2026-11-04' as DateOnly,
    start: '12:00' as never,
    idempotencyKey: 'source-preserve',
  })
  expect(first.ok).toBe(true)
  const saved = await createServices({ clock: now, storage, sourceData: true }).sports.load()
  expect(saved.reservations.filter((r) => r.idempotencyKey === 'source-preserve')).toHaveLength(1)
  expect(saved.resources.find((r) => r.id === 'DEMO-GYM')).toMatchObject({
    status: 'closed',
    closureNote: 'Maintenance',
  })
  expect(saved.resources.filter((r) => r.id === 'DEMO-TT-1')).toHaveLength(1)
})
it('keeps source dates fixed, inventories every source and calculates the documented range once', () => {
  expect(sourceLibrary).toHaveLength(28)
  expect(new Set(sourceLibrary.map((s) => s.id)).size).toBe(28)
  expect(compositeRange(personaEvidence('demo-student-a'))).toEqual([53, 69])
  expect(personaEvidence('demo-student-b').find((p) => p.id === 'gym')!.basis).toBe('illustrative')
  expect(compositeRange(personaEvidence('demo-student-b'))).not.toBeNull()
  expect(compositeRange(personaEvidence('demo-student-empty'))).not.toBeNull()
  expect(buildCampusDataset('2026-11-03' as DateOnly)).toEqual(
    buildCampusDataset('2026-11-04' as DateOnly),
  )
  expect(campusMenu().items).toHaveLength(41)
  expect(campusMenu().items.find((i) => i.name === 'Masala Maggi')?.priceMinor).toBe(3900)
})
it('validates timed observations and isolates them between personas', () => {
  const { storage } = setup()
  const repo = createObservationRepository(storage)
  const row = {
    id: 'wait-1',
    profileId: 'demo-student-a',
    processId: 'lunch',
    date: '2026-11-03' as DateOnly,
    phase: 'baseline' as const,
    minutes: 15,
    method: 'Timed with stopwatch',
    recordedAt: now.now().toString(),
  }
  expect(repo.save(row).ok).toBe(true)
  expect(repo.load('demo-student-a')).toHaveLength(1)
  expect(repo.load('demo-student-b')).toHaveLength(0)
  expect(repo.save({ ...row, id: 'bad', minutes: -1 }).ok).toBe(false)
  expect(createObservationRepository(storage).load('demo-student-a')[0]!.minutes).toBe(15)
})
