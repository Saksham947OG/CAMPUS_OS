import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Guardrails from CLAUDE.md turned into tests, so they cannot erode silently:
 *  - only src/lib/time may read the clock or construct Dates (date-only vs timed discipline)
 *  - only the StorageAdapter may touch browser storage (no scattered localStorage keys)
 */
const SRC = join(process.cwd(), 'src')
const SELF = 'test/architecture.test.ts'

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const files = walk(SRC)
  .map((f) => relative(SRC, f))
  .filter((f) => /\.(ts|tsx)$/.test(f) && f !== SELF)

const isTest = (f: string) => /\.test\.tsx?$/.test(f) || f.startsWith('test/')

describe('architecture guardrails', () => {
  it('finds source files to check', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it('no Date construction or clock reads outside src/lib/time', () => {
    const banned = /\bnew Date\(|\bDate\.now\(|\bTemporal\.Now\b|\bperformance\.now\(/
    const offenders = files.filter(
      (f) =>
        !f.startsWith('lib/time/') && !isTest(f) && banned.test(readFileSync(join(SRC, f), 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('browser storage is only touched by the StorageAdapter', () => {
    const banned = /\blocalStorage\b|\bsessionStorage\b|\bindexedDB\b/
    // The evidence store is the one documented exception (DEC-141): video and photo blobs do not fit in
    // localStorage, so they go to IndexedDB. Only small metadata is kept with the report.
    const allowed = new Set(['data/storage/storage-adapter.ts', 'data/evidence/evidence-store.ts'])
    const offenders = files.filter(
      (f) => !allowed.has(f) && !isTest(f) && banned.test(readFileSync(join(SRC, f), 'utf8')),
    )
    expect(offenders).toEqual([])
  })

  it('no hidden timers simulating server or operator behaviour', () => {
    const banned = /\bsetTimeout\(|\bsetInterval\(/
    // use-now.ts is the single real-clock tick for the UI and in-app reminders (re-reads the Clock;
    // it never fabricates operator or server events); toaster.tsx auto-dismisses UI feedback.
    // Anything else needs a documented decision.
    // DEC-159: visible NPC simulation and opted-in presence heartbeat only; neither writes operator events.
    const allowed = new Set([
      'hooks/use-now.ts',
      'components/toaster.tsx',
      'features/presence/campus-life.tsx',
      'features/presence/real-presence.tsx',
    ])
    const offenders = files.filter(
      (f) => !allowed.has(f) && !isTest(f) && banned.test(readFileSync(join(SRC, f), 'utf8')),
    )
    expect(offenders).toEqual([])
  })
})
