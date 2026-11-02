import { GraduationCap } from 'lucide-react'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { addDays, formatDateShort } from '@/lib/time'
import { isCancelled, isTimed } from '@/selectors/items'
import { itemsInRange } from '@/selectors/occurrences'
import { formatTime, timeToMinutes } from '@/lib/time'

/**
 * Optional context only (COS-CHILL-001 §8): the next RECORDED class from the shared Calendar selector.
 * It makes no promise that an order will be ready in time, never schedules pickup, and never implies
 * skipping class. The Calendar may be incomplete, and the note says so.
 */
export function NextClassNote() {
  const { data } = useCampusData()
  const now = useNow()
  const next = itemsInRange(data, now.today, addDays(now.today, 7))
    .filter((i) => i.category === 'class' && isTimed(i) && !isCancelled(i))
    .find(
      (i) =>
        i.time.kind === 'timed' &&
        (i.date > now.today || timeToMinutes(i.time.start) > now.minutes),
    )
  return (
    <p className="flex items-start gap-2 rounded-md border border-border bg-canvas p-3 text-sm text-ink-muted">
      <GraduationCap className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>
        {next && next.time.kind === 'timed' ? (
          <>
            Next class in your Calendar: <strong className="text-ink">{next.title}</strong>,{' '}
            {next.date === now.today ? 'today' : formatDateShort(next.date)} at{' '}
            {formatTime(next.time.start)}. Your Calendar may be incomplete, and this is not a
            promise that an order will be ready by then.
          </>
        ) : (
          <>
            No upcoming class found in your recorded Calendar. This is not a promise about order
            timing.
          </>
        )}
      </span>
    </p>
  )
}
