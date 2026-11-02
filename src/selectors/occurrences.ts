import { categoryLayer } from '@/domain/categories'
import { occurrenceKey } from '@/domain/ids'
import type {
  BirthdayReminder,
  CalendarEvent,
  Deadline,
  FocusBlock,
  PersonalTask,
  ProfileData,
  RecurrenceRule,
  RecurrenceSeries,
  BookingRef,
} from '@/domain/records'
import {
  addDays,
  addMonths,
  dateInYear,
  daysBetween,
  isoWeekday,
  monthDayOf,
  startOfMonth,
  startOfWeek,
  yearOf,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { compareItems, type CalendarItem, type ItemTime } from './items'

const MAX_GENERATED_DATES = 4000

/** Original (pre-exception) dates of a bounded recurrence rule. Never unbounded (COS-CAL-001 §10). */
export function ruleDates(rule: RecurrenceRule): DateOnly[] {
  const out: DateOnly[] = []
  const { startDate, endDate, interval } = rule

  if (rule.freq === 'daily') {
    for (
      let d = startDate;
      d <= endDate && out.length < MAX_GENERATED_DATES;
      d = addDays(d, interval)
    )
      out.push(d)
  } else if (rule.freq === 'weekly') {
    const weekdays = new Set(rule.weekdays ?? [isoWeekday(startDate)])
    const firstWeek = startOfWeek(startDate)
    for (let d = startDate; d <= endDate && out.length < MAX_GENERATED_DATES; d = addDays(d, 1)) {
      const weeksSince = Math.floor(daysBetween(firstWeek, startOfWeek(d)) / 7)
      if (weekdays.has(isoWeekday(d)) && weeksSince % interval === 0) out.push(d)
    }
  } else if (rule.freq === 'monthly') {
    const { day } = monthDayOf(startDate)
    for (let step = 0; out.length < MAX_GENERATED_DATES; step += interval) {
      const anchor = addMonths(startOfMonth(startDate), step)
      if (anchor > endDate) break
      const d = dateInYear(yearOf(anchor), Number(anchor.slice(5, 7)), day) // skips months lacking that day
      if (d && d >= startDate && d <= endDate) out.push(d)
    }
  } else {
    const { month, day } = monthDayOf(startDate)
    for (
      let y = yearOf(startDate);
      y <= yearOf(endDate) && out.length < MAX_GENERATED_DATES;
      y += interval
    ) {
      const d = dateInYear(y, month, day)
      if (d && d >= startDate && d <= endDate) out.push(d)
    }
  }
  return out
}

const timeOf = (t: CalendarEvent['timing']): ItemTime =>
  t.kind === 'timed' ? { kind: 'timed', start: t.start, end: t.end } : { kind: t.kind }

function eventItem(e: CalendarEvent): CalendarItem {
  return {
    key: occurrenceKey(e.id, e.date),
    recordId: e.id,
    recordKind: 'event',
    title: e.title,
    category: e.category,
    layer: categoryLayer[e.category],
    date: e.date,
    time: timeOf(e.timing),
    status: e.status,
    verification: e.provenance.verification,
    provenance: e.provenance,
    blocksTime: e.blocksTime,
    editable: e.provenance.dataMode === 'userCreated',
    location: e.location,
    instructor: e.instructor,
    courseId: e.courseId,
    description: e.description,
  }
}

function seriesItems(series: RecurrenceSeries, data: ProfileData): CalendarItem[] {
  const exceptions = new Map(
    data.exceptions
      .filter((x) => x.seriesId === series.id)
      .map((x) => [x.originalDate, x] as const),
  )
  const items: CalendarItem[] = []
  for (const originalDate of ruleDates(series.rule)) {
    const base: CalendarItem = {
      ...eventItem({ ...series, date: originalDate }),
      key: occurrenceKey(series.id, originalDate),
      recordId: series.id,
      recordKind: 'series',
      seriesId: series.id,
    }
    const ex = exceptions.get(originalDate)
    if (!ex) {
      items.push(base)
    } else if (ex.action === 'cancelled') {
      // Stays addressable by deep link, shown subdued; never a ghost duplicate (C-T05).
      items.push({
        ...base,
        status: 'cancelled',
        changeReason: ex.reason,
        changeUpdatedAt: ex.updatedAt,
      })
    } else {
      const r = ex.replacement ?? {}
      const baseTime = base.time
      const time: ItemTime =
        baseTime.kind === 'timed'
          ? { kind: 'timed', start: r.start ?? baseTime.start, end: r.end ?? baseTime.end }
          : baseTime
      const moved = ex.action === 'rescheduled'
      items.push({
        ...base,
        title: r.title ?? base.title,
        location: r.location ?? base.location,
        date: r.date ?? originalDate,
        time,
        status: moved ? 'rescheduled' : base.status,
        changedFrom: moved
          ? {
              date: originalDate,
              ...(baseTime.kind === 'timed' ? { start: baseTime.start, end: baseTime.end } : {}),
            }
          : undefined,
        changeReason: ex.reason,
        changeUpdatedAt: ex.updatedAt,
      })
    }
  }
  return items
}

function deadlineItem(d: Deadline): CalendarItem {
  const category = d.kind === 'project' ? 'project' : 'assignment'
  return {
    key: occurrenceKey(d.id, d.dueDate),
    recordId: d.id,
    recordKind: 'deadline',
    title: d.title,
    category,
    layer: categoryLayer[category],
    date: d.dueDate,
    time: { kind: 'deadline', dueTime: d.dueTime },
    status: d.status,
    verification: d.provenance.verification,
    provenance: d.provenance,
    blocksTime: false,
    editable: false,
    courseId: d.courseId,
    description: d.details,
  }
}

function taskItem(t: PersonalTask & { dueDate: DateOnly }): CalendarItem {
  return {
    key: occurrenceKey(t.id, t.dueDate),
    recordId: t.id,
    recordKind: 'task',
    title: t.title,
    category: 'task',
    layer: categoryLayer.task,
    date: t.dueDate,
    time: { kind: 'deadline', dueTime: t.dueTime },
    status: 'scheduled',
    verification: 'notApplicable',
    provenance: t.provenance,
    blocksTime: false,
    editable: true,
    courseId: t.courseId,
    description: t.description,
    taskState: t.state,
  }
}

function focusItem(f: FocusBlock): CalendarItem {
  return {
    key: occurrenceKey(f.id, f.date),
    recordId: f.id,
    recordKind: 'focus',
    title: f.title,
    category: 'focus',
    layer: categoryLayer.focus,
    date: f.date,
    time: { kind: 'timed', start: f.start, end: f.end },
    status: 'scheduled',
    verification: 'notApplicable',
    provenance: f.provenance,
    blocksTime: true,
    editable: true,
    description: f.description,
    taskId: f.taskId,
  }
}

/**
 * A booking that crosses midnight is ONE record shown on BOTH dates: the first portion runs to the end
 * of the start day and the second begins at midnight, each with its own occurrence key. Personal
 * events still cannot cross midnight (DEC-033); this only affects how a booking is drawn.
 */
function bookingItems(b: BookingRef): CalendarItem[] {
  const first = bookingItem(b)
  if (!b.endDate || b.endDate <= b.date) return [first]
  if (b.end === '00:00')
    return [{ ...first, time: { kind: 'timed', start: b.start, end: '23:59' as LocalTime } }]
  return [
    { ...first, time: { kind: 'timed', start: b.start, end: '23:59' as LocalTime } },
    {
      ...first,
      key: occurrenceKey(b.id, b.endDate),
      title: `${b.resource} (continued)`,
      date: b.endDate,
      time: { kind: 'timed', start: '00:00' as LocalTime, end: b.end },
    },
  ]
}

function bookingItem(b: BookingRef): CalendarItem {
  return {
    key: occurrenceKey(b.id, b.date),
    recordId: b.id,
    recordKind: 'booking',
    title: b.resource,
    category: b.category ?? 'booking',
    layer: categoryLayer[b.category ?? 'booking'],
    date: b.date,
    time: { kind: 'timed', start: b.start, end: b.end },
    status: b.status === 'cancelled' ? 'cancelled' : 'scheduled',
    verification: b.provenance.verification,
    provenance: b.provenance,
    blocksTime: b.status === 'active',
    editable: false,
    location: b.location,
    manageRoute: b.manageRoute ?? '/bookings',
  }
}

function birthdayItems(b: BirthdayReminder, from: DateOnly, to: DateOnly): CalendarItem[] {
  const out: CalendarItem[] = []
  for (let year = yearOf(from); year <= yearOf(to); year++) {
    // 29 Feb is observed only in leap years: no silent 28 Feb / 1 Mar substitute (COS-CAL-001 §10).
    const date = dateInYear(year, b.month, b.day)
    if (!date || date < from || date > to) continue
    out.push({
      key: occurrenceKey(b.id, date),
      recordId: b.id,
      recordKind: 'birthday',
      title: `${b.displayName}'s birthday`,
      category: 'birthday',
      layer: categoryLayer.birthday,
      date,
      time: { kind: 'allDay' },
      status: 'scheduled',
      verification: 'notApplicable',
      provenance: b.provenance,
      blocksTime: false,
      editable: b.provenance.dataMode === 'userCreated',
    })
  }
  return out
}

const cache = new WeakMap<ProfileData, Map<string, CalendarItem[]>>()

/** All schedule items falling on [from, to] (inclusive), sorted deterministically. Memoized per data snapshot. */
export function itemsInRange(data: ProfileData, from: DateOnly, to: DateOnly): CalendarItem[] {
  let byRange = cache.get(data)
  if (!byRange) cache.set(data, (byRange = new Map()))
  const cacheKey = `${from}|${to}`
  const hit = byRange.get(cacheKey)
  if (hit) return hit

  const inRange = (i: CalendarItem) => i.date >= from && i.date <= to
  const all: CalendarItem[] = [
    ...data.events.map(eventItem),
    ...data.series.flatMap((s) => seriesItems(s, data)),
    ...data.deadlines.map(deadlineItem),
    ...data.tasks
      .filter((t): t is PersonalTask & { dueDate: DateOnly } => !!t.dueDate)
      .map(taskItem),
    ...data.focusBlocks.map(focusItem),
    ...data.bookings.flatMap(bookingItems),
  ].filter(inRange)
  for (const b of data.birthdays) all.push(...birthdayItems(b, from, to))

  const sorted = all.sort(compareItems)
  byRange.set(cacheKey, sorted)
  return sorted
}

export const itemsOnDate = (data: ProfileData, date: DateOnly) => itemsInRange(data, date, date)

/**
 * Resolve an occurrence key (from a deep link or reminder) to its current item, searching around the
 * key's own date and, for moved occurrences, wherever the occurrence now lives.
 */
export function findItemByKey(data: ProfileData, key: string): CalendarItem | undefined {
  const at = key.indexOf('@')
  if (at < 0) return undefined
  const original = key.slice(at + 1, at + 11)
  if (original.length !== 10) return undefined
  const first = itemsInRange(
    data,
    addDays(original as DateOnly, -1),
    addDays(original as DateOnly, 1),
  ).find((i) => i.key === key)
  if (first) return first
  const series = data.series.find((s) => s.id === key.slice(0, at))
  if (!series) return undefined
  return itemsInRange(data, series.rule.startDate, addDays(series.rule.endDate, 366)).find(
    (i) => i.key === key,
  )
}
