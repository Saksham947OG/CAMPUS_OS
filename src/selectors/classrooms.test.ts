import { campusClassrooms } from '@/data/campus/stores'
import type { DateOnly } from '@/lib/time'
import { roomsInUse } from './classrooms'

const day = '2026-11-03' as DateOnly

describe('roomsInUse', () => {
  it('counts rooms with a timetabled class right now out of every room on record', () => {
    const s = campusClassrooms()
    expect(s.rooms).toHaveLength(6)
    expect(roomsInUse(s, day, 10 * 60 + 30)).toEqual({ inUse: 2, total: 6 }) // sections A and B, 10:00–11:30
    expect(roomsInUse(s, day, 11 * 60 + 40)).toEqual({ inUse: 0, total: 6 }) // the gap between the two blocks
    expect(roomsInUse(s, day, 3 * 60)).toEqual({ inUse: 0, total: 6 }) // nothing recorded at 3 am
  })
})
