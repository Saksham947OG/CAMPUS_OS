import { sniff, type EvidenceMeta } from '@/domain/evidence'

/**
 * Local evidence blobs. Videos are never stored as text in localStorage: they go into IndexedDB, and
 * only the small metadata is kept with the report. "Saved on this device" is all this means; no staff
 * member receives anything. A full or blocked browser store is reported, never hidden.
 */
const DB = 'campusos-evidence'
const STORE = 'blobs'

const open = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined')
      return reject(new Error('This browser has no local file storage available.'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(new Error('Local file storage could not be opened.'))
  })

const tx = async <T>(
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> => {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const r = fn(t.objectStore(STORE))
    t.oncomplete = () => resolve(r.result)
    t.onerror = () =>
      reject(
        new Error(
          t.error?.name === 'QuotaExceededError'
            ? 'This device has no room left to save that file.'
            : 'The file could not be saved on this device.',
        ),
      )
    t.onabort = () =>
      reject(
        new Error(
          t.error?.name === 'QuotaExceededError'
            ? 'This device has no room left to save that file.'
            : 'The file could not be saved on this device.',
        ),
      )
  })
}

export const saveBlob = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const loadBlob = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const removeBlob = (id: string) => tx('readwrite', (s) => s.delete(id))

/** Reads the first bytes, checks them, and saves the file. Returns the metadata to keep with the report. */
export async function attach(
  file: File,
  newId: (p: string) => string,
  nowIso: string,
): Promise<EvidenceMeta> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const real = sniff(head)
  if (!real) throw new Error(`${file.name} is not a supported picture or video.`)
  const id = newId('evd')
  await saveBlob(id, file)
  return {
    id,
    name: file.name.slice(0, 120),
    type: real,
    size: file.size,
    storage: 'device',
    addedAt: nowIso,
  }
}
