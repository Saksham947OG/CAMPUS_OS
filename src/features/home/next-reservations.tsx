import { Link } from 'react-router'
import { BookingTicket } from '@/components/booking-ticket'
import type { ProfileData } from '@/domain/records'
import { formatDateShort, formatTimeRange } from '@/lib/time'
import type { Now } from '@/selectors/now'

/** The next reservations as tickets. Status and source are words; nothing here implies a live room or a scan. */
export function NextReservations({ data, now }: { data: ProfileData; now: Now }) {
  const upcoming = data.bookings
    .filter(
      (b) =>
        b.status === 'active' &&
        (b.date > now.today || (b.date === now.today && timeMinutes(b.end) > now.minutes)),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start))
    .slice(0, 2)
  return (
    <section aria-labelledby="tickets-h" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="tickets-h" className="font-display text-xl font-semibold text-ink">
          Next reservations
        </h2>
        <Link
          to="/bookings/my"
          className="inline-flex min-h-9 items-center text-sm font-medium text-coffee underline"
        >
          All bookings
        </Link>
      </div>
      {upcoming.length ? (
        <ul className="flex flex-col gap-3">
          {upcoming.map((b) => (
            <li key={b.id}>
              <BookingTicket
                title={b.resource}
                day={b.date === now.today ? 'Today' : formatDateShort(b.date)}
                time={formatTimeRange(b.start, b.end)}
                place={b.location}
                status={
                  b.provenance.dataMode === 'userCreated'
                    ? 'Reserved on this device'
                    : 'Confirmed (local)'
                }
                source={b.provenance.sourceLabel ?? 'CampusOS bookings'}
                category={b.category ?? 'booking'}
                to={b.manageRoute ?? '/bookings/my'}
                tone="good"
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl bg-mist p-4 text-sm text-ink-muted">
          No upcoming reservations. A booking made in Bookings appears here as a ticket.
        </p>
      )}
    </section>
  )
}

const timeMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
