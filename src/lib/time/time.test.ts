import { Temporal } from 'temporal-polyfill'
import {
  addDays,
  compareDateOnly,
  fixedClock,
  isDateOnly,
  isLocalTime,
  makeInterval,
  overlaps,
  parseDateOnly,
  parseLocalTime,
  startOfWeek,
  todayIn,
  toZonedDateTime,
} from './index'

describe('date-only values', () => {
  it('accepts real calendar dates', () => {
    expect(isDateOnly('2026-11-01')).toBe(true)
    expect(isDateOnly('2028-02-29')).toBe(true) // leap day
  })

  it('rejects impossible or malformed dates instead of normalizing them', () => {
    expect(isDateOnly('2026-02-30')).toBe(false)
    expect(isDateOnly('2027-02-29')).toBe(false)
    expect(isDateOnly('2026-13-01')).toBe(false)
    expect(isDateOnly('2026-11-01T10:00')).toBe(false)
    expect(isDateOnly('')).toBe(false)
    expect(() => parseDateOnly('2026-02-30')).toThrow(RangeError)
  })

  it('validates local times strictly as HH:mm', () => {
    expect(isLocalTime('00:00')).toBe(true)
    expect(isLocalTime('23:59')).toBe(true)
    expect(isLocalTime('24:00')).toBe(false)
    expect(isLocalTime('9:30')).toBe(false)
    expect(() => parseLocalTime('12:60')).toThrow(RangeError)
  })

  it('crosses month and year boundaries correctly', () => {
    expect(addDays(parseDateOnly('2026-10-31'), 1)).toBe('2026-11-01')
    expect(addDays(parseDateOnly('2026-12-31'), 1)).toBe('2027-01-01')
    expect(addDays(parseDateOnly('2028-02-28'), 1)).toBe('2028-02-29')
    expect(addDays(parseDateOnly('2026-03-01'), -1)).toBe('2026-02-28')
  })

  it('starts weeks on Monday', () => {
    // 2026-11-01 is a Sunday → its week started Monday 2026-10-26
    expect(startOfWeek(parseDateOnly('2026-11-01'))).toBe('2026-10-26')
    expect(startOfWeek(parseDateOnly('2026-10-26'))).toBe('2026-10-26')
    expect(startOfWeek(parseDateOnly('2026-11-02'))).toBe('2026-11-02')
  })

  it('compares chronologically', () => {
    expect(compareDateOnly(parseDateOnly('2026-11-01'), parseDateOnly('2026-11-02'))).toBeLessThan(
      0,
    )
    expect(compareDateOnly(parseDateOnly('2026-11-02'), parseDateOnly('2026-11-02'))).toBe(0)
  })
})

describe('campus "today" in Asia/Kolkata', () => {
  it('rolls over at IST midnight, not UTC midnight', () => {
    // 18:29:59Z = 23:59:59 IST on 31 Oct; one second later it is 1 Nov in IST.
    expect(todayIn(fixedClock('2026-10-31T18:29:59Z'))).toBe('2026-10-31')
    expect(todayIn(fixedClock('2026-10-31T18:30:00Z'))).toBe('2026-11-01')
  })

  it('is unaffected by the process timezone because it uses the named campus zone', () => {
    expect(todayIn(fixedClock('2026-12-31T19:00:00Z'))).toBe('2027-01-01')
  })

  it('builds a zoned instant only from an explicit date AND time', () => {
    const z = toZonedDateTime(parseDateOnly('2026-11-12'), parseLocalTime('14:30'))
    expect(z.toString()).toBe('2026-11-12T14:30:00+05:30[Asia/Kolkata]')
  })
})

describe('half-open interval overlap', () => {
  const at = (iso: string) => Temporal.Instant.from(iso)
  const iv = (a: string, b: string) => makeInterval(at(a), at(b))

  it('detects true overlap', () => {
    expect(
      overlaps(
        iv('2026-11-02T04:30:00Z', '2026-11-02T06:30:00Z'),
        iv('2026-11-02T05:30:00Z', '2026-11-02T07:00:00Z'),
      ),
    ).toBe(true)
  })

  it('treats end-at-start adjacency as NOT overlapping (C-T08)', () => {
    expect(
      overlaps(
        iv('2026-11-02T04:30:00Z', '2026-11-02T05:30:00Z'),
        iv('2026-11-02T05:30:00Z', '2026-11-02T06:30:00Z'),
      ),
    ).toBe(false)
  })

  it('treats containment as overlap and is symmetric', () => {
    const outer = iv('2026-11-02T04:00:00Z', '2026-11-02T08:00:00Z')
    const inner = iv('2026-11-02T05:00:00Z', '2026-11-02T06:00:00Z')
    expect(overlaps(outer, inner)).toBe(true)
    expect(overlaps(inner, outer)).toBe(true)
  })

  it('refuses zero-length or inverted intervals', () => {
    expect(() => iv('2026-11-02T05:00:00Z', '2026-11-02T05:00:00Z')).toThrow(RangeError)
    expect(() => iv('2026-11-02T06:00:00Z', '2026-11-02T05:00:00Z')).toThrow(RangeError)
  })
})
