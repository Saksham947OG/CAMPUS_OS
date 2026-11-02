import { z } from 'zod'

/**
 * A persona is a data filter, not an authenticated identity (IA §4). Every profile in this
 * prototype is fictional (`demoSeed`).
 */
export const profileSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]*$/, 'profile ids are lowercase kebab-case'),
  displayName: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(200),
  dataMode: z.enum(['demoSeed', 'provided']),
  /** Fictional cohort (section) used for audience filtering of shared records. */
  cohortId: z.string().min(1),
  /** What this profile exists to demonstrate/verify. */
  purpose: z.enum(['full', 'alternateSection', 'empty']),
})
export type Profile = z.infer<typeof profileSchema>
