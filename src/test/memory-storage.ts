/** Minimal in-memory Storage for tests. Exposes the raw map so tests can inspect/seed keys. */
export function createMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  const storage = {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } satisfies Storage
  return { storage, data }
}
