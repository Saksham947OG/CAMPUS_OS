import type { ProcessEvidence } from '@/data/campus/evidence'
import { capacityOf } from '@/domain/capacity'
import { timeToMinutes, type DateOnly } from '@/lib/time'
import { isCancelled, isTimed, type CalendarItem } from './items'

/**
 * Process bottlenecks on the Calendar: which things on a day are likely to cost waiting time, how full the
 * place is, and how little room it has. A flag comes from the persona's Time Tax baseline (reported or a
 * planning figure) and, only for something happening now or within the hour, the simulated headcount. It
 * never says a queue exists: it says where one is likely, and where the figure came from.
 */
export interface LoadLite {
  id: string
  label: string
  count: number
  capacity: number
  unit: 'people' | 'rooms' | 'machines'
}

export interface ProcessFlag {
  processId: string
  process: string
  level: 'high' | 'medium'
  score: number
  /** Typical wait from the baseline, such as "20–30 min". Null when none is recorded. */
  waitText: string | null
  waitHigh: number
  /** Share full right now, only for an item happening now or within the hour. */
  fill: number | null
  fillText: string | null
  capacityText: string | null
  basis: 'reported' | 'estimated' | 'illustrative' | 'missing'
  advice: string
  link: { to: string; label: string }
  /** One sentence for tooltips and screen readers. */
  summary: string
}

interface Rule {
  re: RegExp
  process: string
  load?: string
  cap?: string
  advice: string
  link: { to: string; label: string }
}

const RULES: Rule[] = [
  {
    re: /breakfast/i,
    process: 'breakfast',
    load: 'mess',
    cap: 'mess',
    advice: 'Check the serving window in Mess before you leave.',
    link: { to: '/services/mess', label: 'Open Mess' },
  },
  {
    re: /lunch/i,
    process: 'lunch',
    load: 'mess',
    cap: 'mess',
    advice: 'Check the serving window in Mess before you leave.',
    link: { to: '/services/mess', label: 'Open Mess' },
  },
  {
    re: /dinner/i,
    process: 'dinner',
    load: 'mess',
    cap: 'mess',
    advice: 'Check the serving window in Mess before you leave.',
    link: { to: '/services/mess', label: 'Open Mess' },
  },
  {
    re: /wash(er|ing)|machine/i,
    process: 'machines',
    load: 'laundry',
    cap: 'laundry',
    advice: 'Reserve a washer slot instead of waiting for one.',
    link: { to: '/services/laundry/machines', label: 'Open washing machines' },
  },
  {
    re: /laundry/i,
    process: 'ss-laundry',
    advice: 'Check your load status before you walk over.',
    link: { to: '/services/laundry', label: 'Open Laundry' },
  },
  {
    re: /parcel/i,
    process: 'parcels',
    advice: 'Check the parcel is ready before the trip.',
    link: { to: '/services/parcels', label: 'Open Parcels' },
  },
  {
    re: /library|study cabin/i,
    process: 'library',
    load: 'library',
    cap: 'library',
    advice: 'Book a cabin before you walk over.',
    link: { to: '/bookings/library', label: 'Open Library' },
  },
  {
    re: /gym|workout/i,
    process: 'gym',
    load: 'gym',
    cap: 'gym',
    advice: 'Reserve a half-hour slot.',
    link: { to: '/bookings/gym', label: 'Open Gym' },
  },
  {
    re: /chill spot|café|cafe/i,
    process: 'chill-spot',
    load: 'cafe',
    cap: 'chillSpot',
    advice: 'Order ahead and pay at pickup.',
    link: { to: '/services/chill-spot', label: 'Open Chill Spot' },
  },
  {
    re: /classroom|\bcr[- ]?\d|conference hall|\bg12\b|(group|project|committee)( assignment)? meeting|room booking/i,
    process: 'classrooms',
    load: 'classrooms',
    cap: 'classroom',
    advice: 'Check Classrooms for a free slot before the meeting.',
    link: { to: '/bookings/classrooms', label: 'Open Classrooms' },
  },
]

export const processRuleFor = (item: CalendarItem) => RULES.find((r) => r.re.test(item.title))

const range = (r: [number, number]) => (r[0] === r[1] ? `${r[0]} min` : `${r[0]}–${r[1]} min`)

export interface FlagContext {
  evidence: readonly ProcessEvidence[]
  loads: readonly LoadLite[] | null
  today: DateOnly
  nowMinutes: number
}

export function flagItems(
  items: readonly CalendarItem[],
  ctx: FlagContext,
): Map<string, ProcessFlag> {
  const out = new Map<string, ProcessFlag>()
  for (const item of items) {
    if (isCancelled(item) || item.layer === 'administration') continue
    const rule = processRuleFor(item)
    if (!rule) continue
    const ev = ctx.evidence.find((e) => e.id === rule.process)
    const waitHigh = ev?.baseline ? ev.baseline[1] : 0
    const waitMid = ev?.baseline ? (ev.baseline[0] + ev.baseline[1]) / 2 : 0
    const load = rule.load ? ctx.loads?.find((l) => l.id === rule.load) : undefined
    let fill: number | null = null
    if (load && load.capacity > 0 && item.date === ctx.today && isTimed(item)) {
      const start = timeToMinutes(item.time.start as never)
      const end = timeToMinutes(item.time.end as never)
      if (start - 60 <= ctx.nowMinutes && ctx.nowMinutes <= end) fill = load.count / load.capacity
    }
    const level =
      (fill !== null && fill >= 0.9) || waitHigh >= 25
        ? 'high'
        : (fill !== null && fill >= 0.7) || waitHigh >= 10
          ? 'medium'
          : null
    if (!level) continue
    const waitText = ev?.baseline ? range(ev.baseline) : null
    const fillText =
      fill !== null && load
        ? `${Math.round(fill * 100)}% full now (${load.count}/${load.capacity} ${load.unit === 'rooms' ? 'rooms booked' : load.unit === 'machines' ? 'machines in use' : 'people, simulated'})`
        : null
    const capacityText = rule.cap ? (capacityOf(rule.cap)?.text ?? null) : null
    out.set(item.key, {
      processId: rule.process,
      process: ev?.label ?? rule.process,
      level,
      score: waitMid + (fill ?? 0) * 20,
      waitText,
      waitHigh,
      fill,
      fillText,
      capacityText,
      basis: ev?.basis ?? 'missing',
      advice: rule.advice,
      link: rule.link,
      summary: `${level === 'high' ? 'Likely queue' : 'Possible wait'}${waitText ? `: typically ${waitText}` : ''}${fillText ? `, ${fillText}` : ''}.`,
    })
  }
  return out
}

export interface DayBottleneck {
  top: { item: CalendarItem; flag: ProcessFlag } | null
  others: { item: CalendarItem; flag: ProcessFlag }[]
  /** The place with the least room among everything the day touches, flagged or not. */
  tightest: { item: CalendarItem; label: string; capacityText: string } | null
}

const rank = (key: string): number | null => {
  const c = capacityOf(key)
  return c ? (c.units ?? c.people ?? null) : null
}

export function dayBottleneck(
  dayItems: readonly CalendarItem[],
  flags: ReadonlyMap<string, ProcessFlag>,
): DayBottleneck {
  const flagged = dayItems
    .filter((i) => flags.has(i.key))
    .map((item) => ({ item, flag: flags.get(item.key)! }))
    .sort((a, b) => b.flag.score - a.flag.score)
  let tightest: DayBottleneck['tightest'] = null
  let best = Infinity
  for (const item of dayItems) {
    if (isCancelled(item)) continue
    const rule = processRuleFor(item)
    const r = rule?.cap ? rank(rule.cap) : null
    const c = rule?.cap ? capacityOf(rule.cap) : undefined
    if (r !== null && c && r < best) {
      best = r
      tightest = { item, label: c.label, capacityText: c.text }
    }
  }
  return { top: flagged[0] ?? null, others: flagged.slice(1, 4), tightest }
}
