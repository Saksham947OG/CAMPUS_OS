import { EVIDENCE_LIMITS, sniff, validateEvidence } from './evidence'

const bytes = (...xs: number[]) => new Uint8Array([...xs, ...new Array(16).fill(0)])
const MP4 = bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70)
const WEBM = bytes(0x1a, 0x45, 0xdf, 0xa3)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47)
const JPG = bytes(0xff, 0xd8, 0xff)

describe('evidence validation', () => {
  it('recognises real files by their first bytes, not their names', () => {
    expect(sniff(MP4)).toBe('video/mp4')
    expect(sniff(WEBM)).toBe('video/webm')
    expect(sniff(PNG)).toBe('image/png')
    expect(sniff(JPG)).toBe('image/jpeg')
    expect(sniff(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe(
      'image/webp',
    )
    expect(sniff(bytes(1, 2, 3, 4))).toBeNull()
  })

  it('accepts a real video and photo within the limits', () => {
    expect(
      validateEvidence({ name: 'leak.mp4', type: 'video/mp4', size: 5_000_000 }, MP4, 0),
    ).toBeNull()
    expect(
      validateEvidence({ name: 'leak.png', type: 'image/png', size: 200_000 }, PNG, 2),
    ).toBeNull()
  })

  it('refuses a wrong type, a renamed file, an oversize video, an empty file and a fourth attachment, each with a reason', () => {
    expect(validateEvidence({ name: 'a.gif', type: 'image/gif', size: 100 }, bytes(1), 0)).toMatch(
      /only JPEG, PNG, WebP, MP4 and WebM/,
    )
    expect(
      validateEvidence({ name: 'fake.mp4', type: 'video/mp4', size: 100 }, bytes(9, 9, 9, 9), 0),
    ).toMatch(/does not look like a real video/)
    expect(validateEvidence({ name: 'pic.mp4', type: 'video/mp4', size: 100 }, PNG, 0)).toMatch(
      /contents are a image/,
    )
    expect(
      validateEvidence(
        { name: 'big.mp4', type: 'video/mp4', size: EVIDENCE_LIMITS.maxVideoBytes + 1 },
        MP4,
        0,
      ),
    ).toMatch(/larger than 25 MB/)
    expect(validateEvidence({ name: 'e.png', type: 'image/png', size: 0 }, PNG, 0)).toMatch(/empty/)
    expect(validateEvidence({ name: 'x.png', type: 'image/png', size: 10 }, PNG, 3)).toMatch(
      /up to 3 files/,
    )
  })
})
