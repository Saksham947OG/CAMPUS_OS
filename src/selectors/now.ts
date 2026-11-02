import {
  addDays,
  nowIn,
  timeToMinutes,
  toZonedDateTime,
  type Clock,
  type DateOnly,
  type LocalTime,
  fromPlainDate,
} from '@/lib/time'
import { minutesToTime } from '@/lib/time/calendar'

/** A snapshot of "now" in the campus timezone, derived once from the injected Clock. */
export interface Now {
  today: DateOnly
  tomorrow: DateOnly
  /** Minutes since local midnight. */
  minutes: number
  time: LocalTime
  /** Epoch milliseconds of the real instant. */
  ms: number
  hour: number
}

export function makeNow(clock: Clock): Now {
  const zdt = nowIn(clock)
  const today = fromPlainDate(zdt.toPlainDate())
  const minutes = zdt.hour * 60 + zdt.minute
  return {
    today,
    tomorrow: addDays(today, 1),
    minutes,
    time: minutesToTime(minutes),
    ms: zdt.epochMilliseconds,
    hour: zdt.hour,
  }
}

/** Epoch ms of an explicit local date + time. There is deliberately no date-only overload. */
export const instantMs = (date: DateOnly, time: LocalTime) =>
  toZonedDateTime(date, time).epochMilliseconds

export { timeToMinutes }
