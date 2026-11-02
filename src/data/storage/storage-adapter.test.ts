import { z } from 'zod'
import { createStorageAdapter, storageKey } from './storage-adapter'

const schema = z.object({ n: z.number() })

/** Minimal in-memory Storage for tests, with switchable failure modes. */
function fakeStorage(opts: { failSet?: 'quota' | 'other'; failGet?: boolean } = {}): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i) => [...data.keys()][i] ?? null,
    getItem: (k) => {
      if (opts.failGet) throw new DOMException('denied', 'SecurityError')
      return data.get(k) ?? null
    },
    setItem: (k, v) => {
      if (opts.failSet === 'quota') throw new DOMException('full', 'QuotaExceededError')
      if (opts.failSet === 'other') throw new DOMException('blocked', 'SecurityError')
      data.set(k, v)
    },
    removeItem: (k) => void data.delete(k),
  }
}

describe('storageKey', () => {
  it('matches the key format fixed by COS-HOME-001 §6.5', () => {
    expect(storageKey({ area: 'home', version: 1, profileId: 'demo-student-a' })).toBe(
      'campusos:home:v1:demo-student-a',
    )
    expect(storageKey({ area: 'app', version: 1 })).toBe('campusos:app:v1')
  })
})

describe('StorageAdapter', () => {
  it('round-trips validated data in persistent mode', () => {
    const backend = fakeStorage()
    const s = createStorageAdapter({ backend })
    expect(s.mode).toBe('persistent')
    expect(s.write('k', { n: 1 })).toEqual({ ok: true })
    expect(s.read('k', schema)).toEqual({ status: 'ok', value: { n: 1 } })
    expect(backend.getItem('k')).toBe('{"n":1}')
  })

  it('reports missing keys', () => {
    expect(createStorageAdapter({ backend: fakeStorage() }).read('nope', schema)).toEqual({
      status: 'missing',
    })
  })

  it('reports corrupt JSON and schema mismatches without throwing, and leaves the data in place', () => {
    const backend = fakeStorage()
    const s = createStorageAdapter({ backend })
    backend.setItem('bad-json', '{not json')
    backend.setItem('bad-shape', '{"n":"x"}')
    expect(s.read('bad-json', schema)).toMatchObject({ status: 'invalid', reason: 'parse-error' })
    expect(s.read('bad-shape', schema)).toMatchObject({
      status: 'invalid',
      reason: 'schema-mismatch',
    })
    expect(backend.getItem('bad-json')).toBe('{not json')
  })

  it('degrades to memory on quota errors, says so, and still serves the value this session', () => {
    const s = createStorageAdapter({ backend: fakeStorage({ failSet: 'quota' }) })
    const modes: string[] = []
    s.onModeChange((m) => modes.push(m))
    expect(s.write('k', { n: 2 })).toEqual({ ok: false, reason: 'quota' })
    expect(s.mode).toBe('memory')
    expect(modes).toEqual(['memory'])
    expect(s.read('k', schema)).toEqual({ status: 'ok', value: { n: 2 } })
  })

  it('never returns ok:true when running without persistent storage', () => {
    const s = createStorageAdapter({ backend: null })
    expect(s.mode).toBe('memory')
    expect(s.write('k', { n: 3 })).toEqual({ ok: false, reason: 'unavailable' })
    expect(s.read('k', schema)).toEqual({ status: 'ok', value: { n: 3 } })
  })

  it('survives a storage backend that throws on read', () => {
    const s = createStorageAdapter({ backend: fakeStorage({ failGet: true }) })
    // probe() ran against a throwing backend only if injected via default path; here we injected it directly.
    expect(() => s.read('k', schema)).not.toThrow()
    expect(s.read('k', schema)).toEqual({ status: 'missing' })
    expect(s.mode).toBe('memory')
  })

  it('refuses unserializable values', () => {
    const s = createStorageAdapter({ backend: fakeStorage() })
    const circular: Record<string, unknown> = {}
    circular.self = circular
    expect(s.write('k', circular)).toEqual({ ok: false, reason: 'unserializable' })
    expect(s.write('k', undefined)).toEqual({ ok: false, reason: 'unserializable' })
  })

  it('removes from both backend and memory', () => {
    const backend = fakeStorage()
    const s = createStorageAdapter({ backend })
    s.write('k', { n: 1 })
    s.remove('k')
    expect(s.read('k', schema)).toEqual({ status: 'missing' })
    expect(backend.getItem('k')).toBeNull()
  })
})
