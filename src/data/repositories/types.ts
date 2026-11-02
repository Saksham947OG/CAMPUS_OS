/**
 * Repository contracts. UI and selectors depend on these interfaces only — never on fixtures or
 * browser storage directly — so the final-phase demo backend can be swapped in as a new adapter
 * without rewriting components (CLAUDE.md "Architecture and implementation guardrails").
 *
 * All methods are async even though the initial adapters are local, so a networked adapter does not
 * change any call site. Phase 0 ships only the profile + preferences adapters; record repositories
 * (events, deadlines, tasks, …) are declared here and implemented from Phase 1.
 */

export type Unsubscribe = () => void

export type RepositoryErrorCode = 'notFound' | 'validation' | 'forbidden' | 'storage' | 'conflict'

export interface RepositoryError {
  code: RepositoryErrorCode
  message: string
  issues?: string[]
  /** Form-friendly map of field path → message (validation errors). */
  fieldErrors?: Record<string, string>
}

export type Result<T, E = RepositoryError> = { ok: true; value: T } | { ok: false; error: E }

export interface RepositoryChange {
  /** Collection name, e.g. 'events'. */
  collection: string
  profileId?: string
  ids?: string[]
}

export interface ReadableRepository<T extends { id: string }, Query = void> {
  list(profileId: string, query?: Query): Promise<readonly T[]>
  get(profileId: string, id: string): Promise<T | undefined>
  subscribe(listener: (change: RepositoryChange) => void): Unsubscribe
}

/**
 * Writable repositories accept only `userCreated` records for user-owned kinds. Attempts to mutate
 * `provided`, `demoSeed` or `simulated` records must return `{ ok: false, error: { code: 'forbidden' } }`
 * (COS-CAL-001 §7.3, C-T17). Source records stay immutable; user changes are stored as separate deltas.
 */
export interface WritableRepository<
  T extends { id: string },
  Draft,
  Patch = Partial<Draft>,
  Query = void,
> extends ReadableRepository<T, Query> {
  create(profileId: string, draft: Draft): Promise<Result<T>>
  update(profileId: string, id: string, patch: Patch): Promise<Result<T>>
  remove(profileId: string, id: string): Promise<Result<void>>
}
