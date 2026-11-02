import { FACILITY_CAPACITY, capacityOf, participantLimit, resourceCapacity } from './capacity'

describe('owner-supplied capacity table (3 Nov 2026)', () => {
  it('carries every supplied row exactly as given', () => {
    expect(FACILITY_CAPACITY.map((c) => [c.label, c.text])).toEqual([
      ['Mess', '100 people at a time'],
      ['Library', '130 people at a time'],
      ['Gym', 'about 20 people at a time'],
      ['Laundry', '2 machines for about 60 students'],
      ['Library cabin', '8 people at a time'],
      ['Classroom', '70 people at a time'],
      ['Chill Spot', '30–40 people at a time'],
      ['Music room', '40 people at a time'],
      ['Basketball court', '10 people at a time'],
      ['Badminton court', '4 people at a time'],
      ['Table tennis', '2 people at a time'],
      ['Pool', '2 people at a time'],
      ['Snooker', '2 people at a time'],
    ])
    expect(capacityOf('chillSpot')?.approximate).toBe(true)
  })

  it('the library figure belongs to the library facility; its group rooms are the 8-person cabins', () => {
    expect(resourceCapacity({ id: 'DEMO-LIBRARY', activity: 'library' })?.people).toBe(130)
    expect(resourceCapacity({ id: 'DEMO-LIB-ROOM-1', activity: 'library' })?.people).toBe(8)
    expect(resourceCapacity({ id: 'DEMO-GYM', activity: 'gym' })).toEqual({
      people: 20,
      approximate: true,
    })
    expect(resourceCapacity({ id: 'DEMO-CHILL-1', activity: 'chillZone' })).toBeUndefined()
  })

  it('limits one reservation per court, table or room, never the gym or the whole library', () => {
    expect(participantLimit('badminton')).toBe(4)
    expect(participantLimit('basketball')).toBe(10)
    expect(participantLimit('musicRoom')).toBe(40)
    expect(participantLimit('library')).toBe(8)
    expect(participantLimit('gym')).toBeUndefined()
    expect(participantLimit('chillZone')).toBeUndefined()
  })
})
