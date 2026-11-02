import { dayOfMonth, formatDateLong, formatWeekday, type DateOnly } from '@/lib/time'
import { cn } from '@/lib/utils'

/** Seven-day strip used instead of a 7-column timetable on narrow screens. */
export function DayStrip({
  dates,
  today,
  selectedDate,
  counts,
  onSelectDate,
}: {
  dates: readonly DateOnly[]
  today: DateOnly
  selectedDate: DateOnly
  counts: ReadonlyMap<DateOnly, number>
  onSelectDate: (d: DateOnly) => void
}) {
  return (
    <fieldset className="grid grid-cols-7 gap-1">
      <legend className="sr-only">Days of the week</legend>
      {dates.map((d) => {
        const n = counts.get(d) ?? 0
        const selected = d === selectedDate
        return (
          <button
            key={d}
            type="button"
            onClick={() => onSelectDate(d)}
            aria-pressed={selected}
            aria-label={`${formatDateLong(d)}. ${n} ${n === 1 ? 'item' : 'items'}${d === today ? '. Today' : ''}`}
            className={cn(
              'flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-md border border-border bg-surface text-xs',
              selected && 'border-teal bg-teal-tint ring-2 ring-teal',
            )}
          >
            <span className="text-ink-muted">{formatWeekday(d)}</span>
            <span
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full text-sm font-semibold text-ink',
                d === today && 'bg-teal text-surface',
              )}
            >
              {dayOfMonth(d)}
            </span>
            <span className="text-[10px] text-ink-muted">
              {n > 0 ? `${n} item${n === 1 ? '' : 's'}` : '—'}
            </span>
          </button>
        )
      })}
    </fieldset>
  )
}
