import { personaEvidence } from '@/data/campus/evidence'
import type { DateOnly, LocalTime } from '@/lib/time'
import type { CalendarItem } from './items'
import { dayBottleneck, flagItems, type LoadLite } from './process-bottleneck'

const today = '2026-11-03' as DateOnly
let n = 0
const item = (title: string, start: string, end: string, extra: Partial<CalendarItem> = {}) =>
  ({
    key: `k${n++}`,
    recordId: `r${n}`,
    recordKind: 'event',
    title,
    category: 'personal',
    layer: 'personal',
    date: today,
    time: { kind: 'timed', start: start as LocalTime, end: end as LocalTime },
    status: 'scheduled',
    verification: 'confirmed',
    blocksTime: true,
    editable: false,
    ...extra,
  }) as CalendarItem

const ananya = personaEvidence('demo-student-a')
const ctx = (nowMinutes: number, loads: LoadLite[] | null = null) => ({
  evidence: ananya,
  loads,
  today,
  nowMinutes,
})
const mess: LoadLite = { id: 'mess', label: 'Mess', count: 95, capacity: 100, unit: 'people' }

describe('process bottlenecks', () => {
  it('flags the lunch queue from the baseline wait, not from how long the item is', () => {
    const lunch = item('Lunch at the mess', '12:45', '13:30')
    const class_ = item('Morning classes', '09:15', '12:30', { category: 'class' })
    const flags = flagItems([lunch, class_], ctx(2 * 60))
    expect(flags.has(class_.key)).toBe(false) // a long class is not a process bottleneck
    expect(flags.get(lunch.key)).toMatchObject({
      level: 'high',
      process: 'Lunch queue',
      waitText: '20–30 min',
      capacityText: '100 people at a time',
      fill: null,
    })
  })

  it('uses the live fill only for something happening now or within the hour', () => {
    const lunch = item('Lunch at the mess', '12:45', '13:30')
    const soon = flagItems([lunch], ctx(12 * 60, [mess])).get(lunch.key)
    expect(soon?.fill).toBe(0.95)
    expect(soon?.fillText).toMatch(/95% full now/)
    const far = flagItems([lunch], ctx(8 * 60, [mess])).get(lunch.key)
    expect(far?.fill).toBeNull()
  })

  it('does not use live fill for another day, and ignores cancelled items', () => {
    const tomorrow = item('Lunch at the mess', '12:45', '13:30', { date: '2026-11-04' as DateOnly })
    expect(flagItems([tomorrow], ctx(12 * 60, [mess])).get(tomorrow.key)?.fill).toBeNull()
    const gone = item('Lunch at the mess', '12:45', '13:30', { status: 'cancelled' })
    expect(flagItems([gone], ctx(12 * 60)).size).toBe(0)
  })

  it('a short reported wait is not flagged; machines and the chill spot are', () => {
    const dinner = item('Dinner', '20:00', '20:20') // 7-8 min baseline
    const wash = item('Wash clothes at the hostel machines', '17:00', '17:45')
    const chill = item('Chill Spot snack', '16:00', '16:20')
    const flags = flagItems([dinner, wash, chill], ctx(2 * 60))
    expect(flags.has(dinner.key)).toBe(false)
    expect(flags.get(wash.key)?.process).toBe('Waiting for a washer')
    expect(flags.get(chill.key)?.level).toBe('high')
  })

  it('the day headline is the highest-scoring flagged process, with the least-room place named', () => {
    const lunch = item('Lunch at the mess', '12:45', '13:30')
    const wash = item('Pick up laundry from the machines', '17:00', '17:30')
    const gym = item('Gym', '18:00', '18:40')
    const flags = flagItems([lunch, wash, gym], ctx(2 * 60))
    const d = dayBottleneck([lunch, wash, gym], flags)
    expect(d.top?.item.title).toBe('Pick up laundry from the machines') // 30 min wait beats lunch at 25
    expect(d.tightest).toMatchObject({
      label: 'Laundry',
      capacityText: '2 machines for about 60 students',
    })
  })

  it('says nothing is flagged when no mapped process has a wait', () => {
    const exam = item('FMS · reference quiz 3', '11:40', '12:00', { category: 'exam' })
    const d = dayBottleneck([exam], flagItems([exam], ctx(2 * 60)))
    expect(d.top).toBeNull()
    expect(d.tightest).toBeNull()
  })
})
