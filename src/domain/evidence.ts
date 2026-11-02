import { z } from 'zod'

/**
 * Evidence attachments (COS-V3 §5.4): photos and short videos on a report. Limits are configurable
 * DEMO defaults. A file is checked by its first bytes, not only its name or declared type.
 */
export const EVIDENCE_LIMITS = {
  maxFiles: 3,
  maxImageBytes: 10 * 1024 * 1024,
  maxVideoBytes: 25 * 1024 * 1024,
  types: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'] as const,
}
export type EvidenceType = (typeof EVIDENCE_LIMITS.types)[number]

export interface EvidenceMeta {
  id: string
  name: string
  type: EvidenceType
  size: number
  /** `device` means it is saved in this browser only. Nothing reaches maintenance staff. */
  storage: 'device'
  addedAt: string
}

/** The real type, from the first bytes. Null when the bytes match none of the allowed types. */
export function sniff(b: Uint8Array): EvidenceType | null {
  const at = (i: number, ...xs: number[]) => xs.every((x, k) => b[i + k] === x)
  if (at(0, 0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return 'image/webp'
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return 'video/mp4' // "ftyp"
  if (at(0, 0x1a, 0x45, 0xdf, 0xa3)) return 'video/webm' // EBML
  return null
}

export function validateEvidence(
  file: { name: string; type: string; size: number },
  head: Uint8Array,
  alreadyHave: number,
): string | null {
  if (alreadyHave >= EVIDENCE_LIMITS.maxFiles)
    return `You can attach up to ${EVIDENCE_LIMITS.maxFiles} files.`
  if (file.size <= 0) return `${file.name} is empty.`
  if (!EVIDENCE_LIMITS.types.includes(file.type as EvidenceType))
    return `${file.name}: only JPEG, PNG, WebP, MP4 and WebM files are accepted.`
  const real = sniff(head)
  if (!real) return `${file.name} does not look like a real ${file.type.split('/')[0]} file.`
  if (real.split('/')[0] !== file.type.split('/')[0])
    return `${file.name} says it is a ${file.type.split('/')[0]} but its contents are a ${real.split('/')[0]}.`
  const max = real.startsWith('video/')
    ? EVIDENCE_LIMITS.maxVideoBytes
    : EVIDENCE_LIMITS.maxImageBytes
  if (file.size > max) return `${file.name} is larger than ${Math.round(max / 1024 / 1024)} MB.`
  return null
}

/** The saved-on-this-device record kept with a report, ticket or fault note. The file itself lives in the evidence store. */
export const evidenceMetaSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  type: z.enum(EVIDENCE_LIMITS.types),
  size: z.number().int().min(0),
  storage: z.literal('device'),
  addedAt: z.string(),
})
