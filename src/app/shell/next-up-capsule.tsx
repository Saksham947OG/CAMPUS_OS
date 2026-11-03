import { Clock } from 'lucide-react'
import { Link } from 'react-router'
import { calendarLink } from '@/features/calendar/calendar-url'
import { itemTimeText } from '@/features/calendar/describe'
import { useCampusData } from '@/hooks/use-campus-data'
import { useNow } from '@/hooks/use-now'
import { itemsOnDate } from '@/selectors/occurrences'
import { upNext } from '@/selectors/up-next'
import { cn } from '@/lib/utils'

/** The next relevant calendar record, from the same selector Home uses. Omitted when nothing is left today. */
export function NextUpCapsule({ compact }: { compact: boolean }) {
  const { data, status } = useCampusData()
  const now = useNow()
  if (status !== 'ready') return null
  const first = upNext(itemsOnDate(data, now.today), now)[0]
  if (!first) return null
  const text = itemTimeText(first.item)
  return (
    <Link
      to={calendarLink({ date: first.item.date, event: first.item.key })}
      aria-label={`${first.state === 'ongoing' ? 'Happening now' : 'Next up'}: ${first.item.title}, ${text}`}
      className={cn(
        'press flex items-center gap-2 rounded-2xl bg-teal-tint p-2.5 text-ink hover:brightness-95',
        compact && 'justify-center p-2',
      )}
    >
      <Clock className="size-4 shrink-0 text-teal-strong" aria-hidden="true" />
      {compact ? null : (
        <span className="min-w-0 text-xs leading-snug">
          <span className="block font-semibold text-teal-strong">
            {first.state === 'ongoing' ? 'Happening now' : 'Next up'}
          </span>
          <span className="block truncate font-medium">{first.item.title}</span>
          <span className="block text-ink-muted">{text}</span>
        </span>
      )}
    </Link>
  )
}
