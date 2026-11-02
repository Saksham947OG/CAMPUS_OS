import { statusLabel, type ChillOrder } from '@/domain/chill'
import type { DataMode } from '@/domain/provenance'
import type { ProfileData, TimeTaxScenario } from '@/domain/records'
import {
  addDays,
  formatDateShort,
  formatDayMonth,
  formatInstant,
  formatTime,
  formatTimeRange,
  timeToMinutes,
  type DateOnly,
} from '@/lib/time'
import { activeOrders, historyOrders, lastChangeAt, orderPath } from './chill'
import { deadlineFocus } from './deadlines'
import { isCancelled, isTimed } from './items'
import { messForDate, mealLabel } from './mess'
import { instantMs, type Now } from './now'
import { itemsInRange, itemsOnDate } from './occurrences'

/** `05:00–11:59` morning, `12:00–16:59` afternoon, otherwise evening (COS-HOME-001 §5.1). */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export interface Briefing {
  hasData: boolean
  summary: string
}

/**
 * Deterministic daily summary from today's actual records. With nothing recorded it says so; it
 * never concludes "you have a free day".
 */
export function dailyBriefing(data: ProfileData, now: Now): Briefing {
  const items = itemsOnDate(data, now.today).filter((i) => !isCancelled(i))
  const classes = items.filter((i) => i.category === 'class').length
  const otherTimed = items.filter((i) => isTimed(i) && i.category !== 'class').length
  const tasksDue = data.tasks.filter(
    (t) => t.dueDate === now.today && t.state !== 'personallyCompleted',
  ).length
  const deadlinesDue = data.deadlines.filter(
    (d) => d.dueDate === now.today && d.status !== 'cancelled',
  ).length
  const parts = [
    classes ? plural(classes, 'scheduled class', 'scheduled classes') : null,
    otherTimed ? plural(otherTimed, 'other timed item', 'other timed items') : null,
    tasksDue ? plural(tasksDue, 'personal task due', 'personal tasks due') : null,
    deadlinesDue ? plural(deadlinesDue, 'deadline due', 'deadlines due') : null,
  ].filter(Boolean)
  return parts.length
    ? { hasData: true, summary: parts.join(' · ') }
    : { hasData: false, summary: 'No schedule data available for today.' }
}

export interface Suggestion {
  id: string
  text: string
  detail?: string
  /** Where the record lives; every suggestion is traceable to a stored record and actionable. */
  href: string
  rule: 1 | 2 | 3 | 4 | 5
}

const dayLink = (date: DateOnly, key?: string) =>
  `/calendar?view=day&date=${date}${key ? `&event=${encodeURIComponent(key)}&panel=details` : ''}`

/**
 * At most one suggestion, from fixed rules over real records (COS-HOME-001 §7.2). No generative
 * guesses: no "leave now", "best time", "court is free" or "your friend will be there".
 */
export function contextSuggestion(data: ProfileData, now: Now): Suggestion | undefined {
  // 1. Deadline: timed within 24h, or date-only due today/tomorrow; not personally complete.
  const deadline = deadlineFocus(data, now, { hideCompleted: true }).find((e) => {
    if (e.standing === 'overdue') return false
    if (e.dueTime) {
      const delta = instantMs(e.dueDate, e.dueTime) - now.ms
      return delta > 0 && delta <= 24 * 3_600_000
    }
    return e.dueDate === now.today || e.dueDate === now.tomorrow
  })
  if (deadline) {
    return {
      id: `s1-${deadline.key}`,
      rule: 1,
      text: `Upcoming deadline: ${deadline.title}`,
      detail: deadline.dueTime
        ? `Due ${formatDateShort(deadline.dueDate)} at ${formatTime(deadline.dueTime)}`
        : `Due ${deadline.dueDate === now.today ? 'today' : 'tomorrow'} (date only)`,
      href: dayLink(deadline.dueDate, deadline.calendarKey),
    }
  }

  const today = itemsOnDate(data, now.today).filter((i) => !isCancelled(i))

  // 2. A recorded booking starting within 2 hours.
  const booking = today.find(
    (i) =>
      i.recordKind === 'booking' &&
      isTimed(i) &&
      (() => {
        const delta = timeToMinutes(i.time.start) - now.minutes
        return delta > 0 && delta <= 120
      })(),
  )
  if (booking && booking.time.kind === 'timed') {
    return {
      id: `s2-${booking.key}`,
      rule: 2,
      text: `You have a booking at ${formatTime(booking.time.start)}`,
      detail: booking.title,
      href: dayLink(booking.date, booking.key),
    }
  }

  // 3. A timed class within 60 minutes with a known venue.
  const klass = today.find(
    (i) =>
      i.category === 'class' &&
      isTimed(i) &&
      !!i.location &&
      (() => {
        const delta = timeToMinutes(i.time.start) - now.minutes
        return delta > 0 && delta <= 60
      })(),
  )
  if (klass) {
    return {
      id: `s3-${klass.key}`,
      rule: 3,
      text: `Next class: ${klass.title} at ${klass.location}`,
      href: dayLink(klass.date, klass.key),
    }
  }

  // 4. A meal window approaching, with a menu on record.
  const meal = messForDate(data, now.today).find((m) => {
    if (!m.start || !m.items?.length) return false
    const delta = timeToMinutes(m.start) - now.minutes
    return delta > 0 && delta <= 60
  })
  if (meal) {
    return {
      id: `s4-${meal.id}`,
      rule: 4,
      text: `See the upcoming ${mealLabel[meal.meal].toLowerCase()} menu`,
      href: '/services/mess',
    }
  }

  // 5. A consented birthday today.
  const bday = today.find((i) => i.recordKind === 'birthday')
  if (bday) {
    const name = bday.title.replace(/'s birthday$/, '')
    return {
      id: `s5-${bday.key}`,
      rule: 5,
      text: `It's ${name}'s birthday`,
      href: dayLink(bday.date, bday.key),
    }
  }
  return undefined
}

export interface ActivityEntry {
  id: string
  type:
    | 'Booking'
    | 'Café order'
    | 'Laundry load'
    | 'Parcel'
    | 'Machine cycle'
    | 'Waitlist offer'
    | 'Leave request'
    | 'Complaint'
    | 'Teaching-aid report'
    | 'Meeting request'
    | 'Lost & found'
    | 'Claim'
    | 'Team request'
  label: string
  status: string
  when: string
  mode: DataMode
  href: string
  active: boolean
  /** True when the record comes from the local demo simulator rather than a source system. */
  simulated?: boolean
}

/**
 * Active records from other modules: sample bookings and, from the same canonical store the Chill Spot
 * tracker reads, the profile's own café orders (DEC-049). Everything else is honestly absent (DEC-023).
 */
export function activityEntries(
  data: ProfileData,
  now: Now,
  orders: readonly ChillOrder[] = [],
  extra: readonly ActivityEntry[] = [],
): { active: ActivityEntry[]; history: ActivityEntry[] } {
  const entries: ActivityEntry[] = data.bookings.map((b) => {
    const endsOn = b.endDate ?? b.date
    const past = endsOn < now.today || (endsOn === now.today && timeToMinutes(b.end) <= now.minutes)
    return {
      id: b.id,
      type: 'Booking' as const,
      label: b.resource,
      status:
        b.status === 'cancelled'
          ? b.provenance.dataMode === 'demoSeed'
            ? 'Cancelled (sample)'
            : 'Cancelled'
          : past
            ? b.provenance.dataMode === 'demoSeed'
              ? 'Past (sample)'
              : 'Past'
            : b.provenance.dataMode === 'demoSeed'
              ? 'Booked (sample record)'
              : 'Reserved (local reservation)',
      when: b.endDate
        ? `${formatDateShort(b.date)}, ${formatTime(b.start)} → ${formatDateShort(b.endDate)}, ${formatTime(b.end)}`
        : `${formatDateShort(b.date)}, ${formatTimeRange(b.start, b.end)}`,
      mode: b.provenance.dataMode,
      href: dayLink(b.date, `${b.id}@${b.date}`),
      active: b.status === 'active' && !past,
    }
  })
  const bookingDate = (id: string) => data.bookings.find((b) => b.id === id)
  const byWhen = (a: ActivityEntry, b: ActivityEntry) => {
    const A = bookingDate(a.id)!
    const B = bookingDate(b.id)!
    const au = A.updatedAt ?? ''
    const bu = B.updatedAt ?? ''
    if (au !== bu) return au < bu ? 1 : -1 // lastUpdatedAt descending when known
    return `${A.date}${A.start}` < `${B.date}${B.start}` ? -1 : 1
  }
  const cafe = (o: ChillOrder, active: boolean): ActivityEntry => ({
    id: o.id,
    type: 'Café order',
    label: `Chill Spot order ${o.displayNumber}`,
    status: statusLabel[o.status],
    when: `Updated ${formatInstant(lastChangeAt(o))}`,
    mode: o.provenance.dataMode,
    href: orderPath(o.id),
    active,
    simulated: o.provenance.dataMode === 'simulated',
  })
  return {
    active: [
      ...activeOrders(orders).map((o) => cafe(o, true)),
      ...extra.filter((e) => e.active),
      ...entries.filter((e) => e.active).sort(byWhen),
    ],
    history: [
      ...historyOrders(orders).map((o) => cafe(o, false)),
      ...extra.filter((e) => !e.active),
      ...entries.filter((e) => !e.active).sort(byWhen),
    ],
  }
}

export interface PulseEntry {
  id: string
  kind: 'announcement' | 'birthday' | 'event'
  title: string
  when: string
  mode: DataMode
  important?: boolean
  href: string
}

/** Up to four audience-appropriate items; fixed priority, stable-ID ties, no popularity ranking. */
export function campusPulse(data: ProfileData, now: Now, limit = 4): PulseEntry[] {
  const important: PulseEntry[] = data.announcements
    .filter((a) => a.importance === 'important')
    .map((a) => ({
      id: a.id,
      kind: 'announcement',
      title: a.title,
      when: `Published ${formatDayMonth(a.publishedOn)}`,
      mode: a.provenance.dataMode,
      important: true,
      href: '/community',
    }))
  const upcoming = itemsInRange(data, now.today, addDays(now.today, 14)).filter(
    (i) => !isCancelled(i),
  )
  const birthdays: PulseEntry[] = upcoming
    .filter((i) => i.recordKind === 'birthday' && i.date === now.today)
    .map((i) => ({
      id: i.key,
      kind: 'birthday',
      title: i.title,
      when: 'Today',
      mode: i.provenance.dataMode,
      href: dayLink(i.date, i.key),
    }))
  const events: PulseEntry[] = upcoming
    .filter((i) => ['campusEvent', 'club', 'sports'].includes(i.category))
    .map((i) => ({
      id: i.key,
      kind: 'event',
      title: i.title,
      when: formatDateShort(i.date),
      mode: i.provenance.dataMode,
      href: dayLink(i.date, i.key),
    }))
  const recent: PulseEntry[] = data.announcements
    .filter((a) => a.importance === 'normal')
    .map((a) => ({
      id: a.id,
      kind: 'announcement',
      title: a.title,
      when: `Published ${formatDayMonth(a.publishedOn)}`,
      mode: a.provenance.dataMode,
      href: '/community',
    }))
  const stable = (list: PulseEntry[]) => [...list].sort((a, b) => (a.id < b.id ? -1 : 1))
  return [...stable(important), ...stable(birthdays), ...stable(events), ...stable(recent)].slice(
    0,
    limit,
  )
}

export interface TimeTaxResult {
  /** Signed: baseline − scenario. Negative means the scenario would add waiting. */
  netChangeMinutes: number
  /** max(0, net). Hypothetical potential only; never hides the signed value. */
  minutesSavedPerVisit: number
  hoursPerWeek: number
}

/**
 * IA S32 model: hours = students × visits × max(0, baseline − scenario) / 60 (per week). This is a
 * what-if on assumptions, never a measurement (H-T17).
 */
export function timeTaxHours(s: TimeTaxScenario): TimeTaxResult {
  const netChangeMinutes = s.baselineWaitMinutes - s.scenarioWaitMinutes
  const minutesSavedPerVisit = Math.max(0, netChangeMinutes)
  return {
    netChangeMinutes,
    minutesSavedPerVisit,
    hoursPerWeek: (s.students * s.visitsPerStudentPerWeek * minutesSavedPerVisit) / 60,
  }
}
