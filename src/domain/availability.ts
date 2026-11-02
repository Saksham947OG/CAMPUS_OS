import type { DateOnly, LocalTime } from '@/lib/time'
import { addDays } from '@/lib/time'
import { isoWeekday } from '@/lib/time/calendar'
import { instantMs, timeToMinutes } from '@/selectors/now'
import { minutesToTime } from '@/lib/time/calendar'

/**
 * The availability engine (COS-V3 §3.3). Pure and deterministic: no clock, no storage, no React.
 * Missing coverage is UNKNOWN, never free. Only real candidates are returned: at most three, and
 * fewer when fewer exist. Weights are implementation defaults, not validated optimization weights.
 */
export interface Interval {
  start: number
  end: number
}

export interface Participant {
  id: string
  label: string
  required: boolean
  /** Known commitments as instants. Private titles never enter this type. */
  busy: Interval[]
  /** `unknown` when nothing is recorded for this person, so they are never assumed free. */
  coverage: 'known' | 'unknown'
}

export interface FindRequest {
  participants: Participant[]
  from: DateOnly
  to: DateOnly
  durationMin: number
  dayWindow: { from: LocalTime; to: LocalTime }
  includeWeekends: boolean
  stepMin: number
  bufferMin: number
  preference: 'any' | 'morning' | 'afternoon'
  nowMs: number
  /** True when at least one suitable room is free for this exact interval. Omit when no room is needed. */
  roomFit?: (c: { date: DateOnly; start: LocalTime; end: LocalTime }) => boolean
}

export interface Candidate {
  id: string
  date: DateOnly
  start: LocalTime
  end: LocalTime
  score: number
  reasons: string[]
  optionalAttending: number
  optionalTotal: number
  /** Required people whose availability is not recorded. Non-empty means "needs availability confirmation". */
  unknownRequired: string[]
}

export interface FindResult {
  suggestions: Candidate[]
  needsConfirmation: Candidate[]
  /** Why nothing fit, in privacy-safe words. Empty when something did. */
  blockers: string[]
}

export const W = { optional: 0.4, preference: 0.25, gaps: 0.2, room: 0.15 } as const
const GAP_CAP = 120

export const clash = (a: Interval, b: Interval, bufferMs = 0) =>
  a.start < b.end + bufferMs && b.start < a.end + bufferMs

export function mergeIntervals(xs: readonly Interval[]): Interval[] {
  const s = [...xs].sort((a, b) => a.start - b.start)
  const out: Interval[] = []
  for (const x of s) {
    const last = out[out.length - 1]
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end)
    else out.push({ ...x })
  }
  return out
}

/** Gaps between merged busy intervals inside a window. Used by the free-gap finder. */
export function freeGaps(busy: readonly Interval[], window: Interval, minMs = 0): Interval[] {
  const out: Interval[] = []
  let cursor = window.start
  for (const b of mergeIntervals(busy)) {
    if (b.end <= window.start) continue
    if (b.start >= window.end) break
    if (b.start > cursor) out.push({ start: cursor, end: Math.min(b.start, window.end) })
    cursor = Math.max(cursor, b.end)
  }
  if (cursor < window.end) out.push({ start: cursor, end: window.end })
  return out.filter((g) => g.end - g.start >= minMs)
}

const daysOf = (from: DateOnly, to: DateOnly): DateOnly[] => {
  const out: DateOnly[] = []
  let d = from
  for (let i = 0; i < 31 && d <= to; i++) {
    out.push(d)
    d = addDays(d, 1)
  }
  return out
}

export function findTimes(r: FindRequest): FindResult {
  const dur = r.durationMin * 60_000
  const buffer = r.bufferMin * 60_000
  const required = r.participants.filter((p) => p.required)
  const optional = r.participants.filter((p) => !p.required)
  const merged = new Map(r.participants.map((p) => [p.id, mergeIntervals(p.busy)]))
  const eligible: Candidate[] = []
  const unsure: Candidate[] = []
  const reasonCount = { weekend: 0, past: 0, requiredBusy: new Map<string, number>() }
  for (const date of daysOf(r.from, r.to)) {
    if (!r.includeWeekends && isoWeekday(date) >= 6) {
      reasonCount.weekend++
      continue
    }
    const wFrom = timeToMinutes(r.dayWindow.from)
    const wTo = timeToMinutes(r.dayWindow.to)
    for (let m = wFrom; m + r.durationMin <= wTo; m += r.stepMin) {
      const start = minutesToTime(m) as LocalTime
      const end = minutesToTime(m + r.durationMin) as LocalTime
      const slot: Interval = { start: instantMs(date, start), end: instantMs(date, start) + dur }
      if (slot.start < r.nowMs) {
        reasonCount.past++
        continue
      }
      let free = true
      const unknownRequired: string[] = []
      for (const p of required) {
        if (p.coverage === 'unknown') {
          unknownRequired.push(p.label)
          continue
        }
        if (merged.get(p.id)!.some((b) => clash(slot, b, buffer))) {
          free = false
          reasonCount.requiredBusy.set(p.label, (reasonCount.requiredBusy.get(p.label) ?? 0) + 1)
        }
      }
      if (!free) continue
      const attending = optional.filter(
        (p) => p.coverage === 'known' && !merged.get(p.id)!.some((b) => clash(slot, b, buffer)),
      ).length
      const optFit = optional.length ? attending / optional.length : 1
      const prefFit =
        r.preference === 'any'
          ? 1
          : r.preference === 'morning'
            ? m < 720
              ? 1
              : 0
            : m >= 720
              ? 1
              : 0
      const gaps = required
        .filter((p) => p.coverage === 'known')
        .map((p) => {
          const prev = merged
            .get(p.id)!
            .filter((b) => b.end <= slot.start && b.end > slot.start - 86_400_000)
            .at(-1)
          const gapMin = prev ? (slot.start - prev.end) / 60_000 : GAP_CAP
          return { gapMin, label: p.label }
        })
      const idleFit = gaps.length
        ? gaps.reduce((a, g) => a + (1 - Math.min(g.gapMin, GAP_CAP) / GAP_CAP), 0) / gaps.length
        : 0
      const roomOk = r.roomFit ? r.roomFit({ date, start, end }) : true
      const score =
        W.optional * optFit + W.preference * prefFit + W.gaps * idleFit + W.room * (roomOk ? 1 : 0)
      const reasons = [
        `${required.length - unknownRequired.length} of ${required.length} required people free`,
        ...(optional.length ? [`${attending} of ${optional.length} optional can attend`] : []),
        ...(r.preference !== 'any' && prefFit
          ? [`${r.preference === 'morning' ? 'Morning' : 'Afternoon'}, as preferred`]
          : []),
        ...(gaps.some((g) => g.gapMin <= 30)
          ? ['Close to an existing commitment (small idle gap)']
          : []),
        ...(r.roomFit
          ? [roomOk ? 'A suitable room is free' : 'No suitable room is free then']
          : []),
      ]
      const c: Candidate = {
        id: `${date}T${start}`,
        date,
        start,
        end,
        score,
        reasons,
        optionalAttending: attending,
        optionalTotal: optional.length,
        unknownRequired,
      }
      ;(unknownRequired.length ? unsure : eligible).push(c)
    }
  }
  const order = (a: Candidate, b: Candidate) => b.score - a.score || a.id.localeCompare(b.id)
  const pick = (list: Candidate[]) => {
    const out: Candidate[] = []
    for (const c of [...list].sort(order)) {
      const s = { start: instantMs(c.date, c.start), end: instantMs(c.date, c.end) }
      if (
        out.every(
          (o) => !clash(s, { start: instantMs(o.date, o.start), end: instantMs(o.date, o.end) }),
        )
      )
        out.push(c)
      if (out.length === 3) break
    }
    return out
  }
  const suggestions = pick(eligible)
  const blockers: string[] = []
  if (suggestions.length === 0) {
    for (const [label, n] of [...reasonCount.requiredBusy].sort((a, b) => b[1] - a[1]))
      blockers.push(
        `${label} has recorded commitments across ${n} possible start time${n === 1 ? '' : 's'}.`,
      )
    if (reasonCount.weekend) blockers.push('Weekends are switched off.')
    if (reasonCount.past) blockers.push('Some start times were already in the past.')
  }
  return { suggestions, needsConfirmation: suggestions.length ? [] : pick(unsure), blockers }
}
