import { demoProfiles } from '@/data/seeds/demo/profiles'
import { occurrenceKey } from './ids'
import { profileSchema } from './profile'
import { provenanceSchema } from './provenance'
import { parseDateOnly, parseLocalTime } from '@/lib/time'

const valid = {
  demoSeed: { dataMode: 'demoSeed', verification: 'unknown', authority: 'demoIllustration' },
  user: { dataMode: 'userCreated', verification: 'notApplicable', authority: 'personal' },
  provided: {
    dataMode: 'provided',
    verification: 'tentative',
    authority: 'unverifiedProvided',
    sourceLabel: 'timetable.pdf',
  },
} as const

describe('provenance schema', () => {
  it('accepts coherent combinations', () => {
    for (const p of Object.values(valid)) expect(provenanceSchema.safeParse(p).success).toBe(true)
  })

  it('lets a provided record be tentative — data mode is not verification', () => {
    expect(provenanceSchema.safeParse(valid.provided).success).toBe(true)
  })

  it('rejects the reserved "connected" mode', () => {
    const r = provenanceSchema.safeParse({ ...valid.provided, dataMode: 'connected' })
    expect(r.success).toBe(false)
  })

  it('never lets demo or simulated data claim institutional authority', () => {
    for (const dataMode of ['demoSeed', 'simulated'] as const) {
      expect(
        provenanceSchema.safeParse({
          ...valid.demoSeed,
          dataMode,
          authority: 'authorizedInstitutional',
        }).success,
      ).toBe(false)
    }
  })

  it('requires user-created records to be personal and provided records to keep a source label', () => {
    expect(
      provenanceSchema.safeParse({ ...valid.user, authority: 'unverifiedProvided' }).success,
    ).toBe(false)
    const { sourceLabel: _omitted, ...noLabel } = valid.provided
    expect(provenanceSchema.safeParse(noLabel).success).toBe(false)
  })

  it('does not invent timestamps: updatedAt is optional but must be a real offset datetime when present', () => {
    expect(provenanceSchema.safeParse(valid.demoSeed).success).toBe(true)
    expect(provenanceSchema.safeParse({ ...valid.demoSeed, updatedAt: 'yesterday' }).success).toBe(
      false,
    )
    expect(
      provenanceSchema.safeParse({ ...valid.demoSeed, updatedAt: '2026-11-01T10:00:00+05:30' })
        .success,
    ).toBe(true)
  })
})

describe('demo profiles', () => {
  it('are valid, uniquely identified and all labelled demoSeed', () => {
    const ids = new Set(demoProfiles.map((p) => p.id))
    expect(ids.size).toBe(demoProfiles.length)
    for (const p of demoProfiles) {
      expect(profileSchema.safeParse(p).success).toBe(true)
      expect(p.dataMode).toBe('demoSeed')
    }
  })

  it('include an empty profile and a second profile for isolation tests', () => {
    expect(demoProfiles.some((p) => p.purpose === 'empty')).toBe(true)
    expect(demoProfiles.some((p) => p.purpose === 'alternateSection')).toBe(true)
  })
})

describe('occurrence keys', () => {
  it('are deterministic and match the recurrence-exception key shape', () => {
    const d = parseDateOnly('2026-11-09')
    expect(occurrenceKey('series-1', d)).toBe('series-1@2026-11-09')
    expect(occurrenceKey('series-1', d, parseLocalTime('09:30'))).toBe('series-1@2026-11-09T09:30')
  })
})
