import { z } from 'zod'

/**
 * Provenance vocabulary (DEC-016). Canonical names follow COS-HOME-001 §8 / the IA / CLAUDE.md;
 * `authority` is carried over from COS-CAL-001 §4.1. Lifecycle status is separate from
 * verification: "cancelled" is not a degree of confirmation.
 *
 * Data mode is NOT verification: a `provided` record can still be `tentative`, and a `demoSeed`
 * record must never be presented as institutional.
 */
export const DATA_MODES = ['provided', 'demoSeed', 'userCreated', 'simulated', 'connected'] as const
export const dataModeSchema = z.enum(DATA_MODES)
export type DataMode = z.infer<typeof dataModeSchema>

export const verificationSchema = z.enum(['confirmed', 'tentative', 'unknown', 'notApplicable'])
export type Verification = z.infer<typeof verificationSchema>

export const lifecycleStatusSchema = z.enum(['scheduled', 'cancelled', 'rescheduled'])
export type LifecycleStatus = z.infer<typeof lifecycleStatusSchema>

export const authoritySchema = z.enum([
  'authorizedInstitutional',
  'unverifiedProvided',
  'personal',
  'demoIllustration',
])
export type Authority = z.infer<typeof authoritySchema>

const nonEmpty = z.string().trim().min(1)

export const provenanceSchema = z
  .object({
    dataMode: dataModeSchema,
    verification: verificationSchema,
    authority: authoritySchema,
    /** Human-readable file name / provider / user attribution. */
    sourceLabel: nonEmpty.optional(),
    sourceRecordId: nonEmpty.optional(),
    importBatchId: nonEmpty.optional(),
    /** ISO timestamp with offset. Left unset when the source did not provide one — never invented. */
    updatedAt: z.iso.datetime({ offset: true }).optional(),
  })
  .superRefine((p, ctx) => {
    const fail = (message: string, path: string) =>
      ctx.addIssue({ code: 'custom', message, path: [path] })

    if (p.dataMode === 'connected') {
      fail('dataMode "connected" is reserved: no authorized integration exists yet', 'dataMode')
    }
    if (
      (p.dataMode === 'demoSeed' || p.dataMode === 'simulated') &&
      p.authority !== 'demoIllustration'
    ) {
      fail(`${p.dataMode} records must have authority "demoIllustration"`, 'authority')
    }
    if (p.dataMode === 'userCreated' && p.authority !== 'personal') {
      fail('userCreated records must have authority "personal"', 'authority')
    }
    if (
      p.dataMode === 'provided' &&
      p.authority !== 'unverifiedProvided' &&
      p.authority !== 'authorizedInstitutional'
    ) {
      fail(
        'provided records must be "unverifiedProvided" or "authorizedInstitutional"',
        'authority',
      )
    }
    if (p.dataMode === 'provided' && !p.sourceLabel) {
      fail('provided records must retain a sourceLabel (provenance)', 'sourceLabel')
    }
  })
export type Provenance = z.infer<typeof provenanceSchema>
