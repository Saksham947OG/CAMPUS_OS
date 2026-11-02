import { z } from 'zod'
import { createStorageAdapter, storageKey } from '../storage/storage-adapter'
import { createLocalPreferencesRepository } from './preferences-repository'

const schema = z.object({
  schemaVersion: z.literal(1),
  density: z.enum(['comfortable', 'compact']),
})
type Prefs = z.infer<typeof schema>
const defaults = (): Prefs => ({ schemaVersion: 1, density: 'comfortable' })

function setup() {
  const store = new Map<string, string>()
  const backend = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as unknown as Storage
  const storage = createStorageAdapter({ backend })
  const repo = createLocalPreferencesRepository({
    storage,
    area: 'home',
    version: 1,
    schema,
    defaults,
  })
  return { store, repo }
}

describe('profile-scoped preferences repository', () => {
  it('returns defaults when nothing is stored', async () => {
    const { repo } = setup()
    expect(await repo.load('p1')).toEqual({ source: 'default', value: defaults() })
  })

  it('persists per profile and does not leak across profiles (H-T21)', async () => {
    const { repo, store } = setup()
    await repo.save('p1', { schemaVersion: 1, density: 'compact' })
    expect((await repo.load('p1')).value.density).toBe('compact')
    expect((await repo.load('p2')).value.density).toBe('comfortable')
    expect([...store.keys()]).toEqual([storageKey({ area: 'home', version: 1, profileId: 'p1' })])
  })

  it('recovers from corrupt stored data with defaults, without deleting anything (H-T19)', async () => {
    const { repo, store } = setup()
    const key = storageKey({ area: 'home', version: 1, profileId: 'p1' })
    store.set(key, '{"schemaVersion":1,"density":"huge"}')
    store.set('campusos:domain:v1:p1', '{"tasks":["keep me"]}')
    const loaded = await repo.load('p1')
    expect(loaded.source).toBe('recovered')
    expect(loaded.value).toEqual(defaults())
    expect(store.get(key)).toBe('{"schemaVersion":1,"density":"huge"}')
    expect(store.get('campusos:domain:v1:p1')).toBe('{"tasks":["keep me"]}')
  })

  it('refuses to save invalid values instead of persisting them', async () => {
    const { repo, store } = setup()
    const result = await repo.save('p1', { schemaVersion: 1, density: 'huge' } as unknown as Prefs)
    expect(result.ok).toBe(false)
    expect(store.size).toBe(0)
  })

  it("reset removes only that profile's preferences and notifies subscribers", async () => {
    const { repo } = setup()
    const seen: string[] = []
    repo.subscribe((id) => seen.push(id))
    await repo.save('p1', { schemaVersion: 1, density: 'compact' })
    await repo.save('p2', { schemaVersion: 1, density: 'compact' })
    await repo.reset('p1')
    expect((await repo.load('p1')).source).toBe('default')
    expect((await repo.load('p2')).source).toBe('stored')
    expect(seen).toEqual(['p1', 'p2', 'p1'])
  })
})
