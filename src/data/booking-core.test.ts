import {
  checkSlot,
  generateSlots,
  overlaps,
  spanMs,
  type ActiveBooking,
} from '@/domain/booking-core'
import type { DateOnly, LocalTime } from '@/lib/time'

const D = '2026-11-02' as DateOnly
const t = (v: string) => v as LocalTime
const NOW = Date.parse('2026-11-02T04:30:00Z') // 10:00 IST
const booking = (
  ownerId: string,
  resourceId: string,
  start: string,
  end: string,
): ActiveBooking => ({
  ownerId,
  resourceId,
  span: { date: D, start: t(start), end: t(end) },
})
const base = {
  span: { date: D, start: t('12:00'), end: t('13:00') },
  nowMs: NOW,
  today: D,
  horizonDays: 7,
  ownerId: 'a',
  resourceId: 'r1',
  maxActivePerOwner: 1,
}

describe('shared booking core (SP-T31)', () => {
  it('SP-T31: half-open intervals overlap only when max(start) < min(end), and a buffer widens the check', () => {
    const a = spanMs({ date: D, start: t('12:00'), end: t('13:00') })
    const adjacent = spanMs({ date: D, start: t('13:00'), end: t('14:00') })
    const inside = spanMs({ date: D, start: t('12:30'), end: t('13:30') })
    expect(overlaps(a, adjacent)).toBe(false)
    expect(overlaps(a, inside)).toBe(true)
    expect(overlaps(a, adjacent, 15 * 60_000)).toBe(true)
  })

  it('SP-T31: slots are generated from published hours, and a zero or negative length yields none', () => {
    expect(generateSlots(7 * 60, 10 * 60, 60).map((s) => s.start)).toEqual([
      '07:00',
      '08:00',
      '09:00',
    ])
    expect(generateSlots(7 * 60, 9 * 60, 30)).toHaveLength(4)
    expect(generateSlots(8 * 60, 8 * 60 + 30, 60)).toEqual([])
    expect(generateSlots(8 * 60, 12 * 60, 0)).toEqual([])
  })

  it('SP-T31: one function gives machines and courts the same verdicts', () => {
    expect(checkSlot({ ...base, active: [] })).toBeNull()
    expect(
      checkSlot({ ...base, span: { date: D, start: t('08:00'), end: t('09:00') }, active: [] }),
    ).toBe('past')
    expect(
      checkSlot({
        ...base,
        span: { date: '2026-12-30' as DateOnly, start: t('12:00'), end: t('13:00') },
        active: [],
      }),
    ).toBe('beyondHorizon')
    expect(checkSlot({ ...base, active: [booking('b', 'r1', '12:00', '13:00')] })).toBe('conflict')
    expect(checkSlot({ ...base, active: [booking('b', 'r2', '12:00', '13:00')] })).toBeNull() // another resource
    expect(checkSlot({ ...base, active: [booking('a', 'r2', '15:00', '16:00')] })).toBe(
      'ownerLimit',
    )
    expect(
      checkSlot({ ...base, maxActivePerOwner: 2, active: [booking('a', 'r2', '15:00', '16:00')] }),
    ).toBeNull()
  })

  it('SP-T31: capacity above one allows concurrent bookings up to the limit, and the owner limit can be scoped', () => {
    const two = [booking('b', 'r1', '12:00', '13:00'), booking('c', 'r1', '12:00', '13:00')]
    expect(checkSlot({ ...base, capacity: 2, active: [two[0]!] })).toBeNull()
    expect(checkSlot({ ...base, capacity: 2, active: two })).toBe('conflict')
    expect(
      checkSlot({
        ...base,
        active: [booking('a', 'r2', '15:00', '16:00')],
        countsTowardLimit: (b) => b.resourceId === 'r1',
      }),
    ).toBeNull()
  })
})
