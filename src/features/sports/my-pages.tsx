import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { BookingTicket } from '@/components/booking-ticket'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { reservationStateLabel } from '@/domain/sports'
import { offerExpired } from '@/domain/sports-logic'
import { formatDateShort, formatInstant, formatTime } from '@/lib/time'
import {
  bookingSummaries,
  ownWaitlist,
  waitlistLabel,
  type BookingSummary,
} from '@/selectors/sports'
import { waitlistPosition } from '@/domain/sports-logic'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { MyClassroomBookings } from '../classrooms/classroom-pages'
import { useSports } from './sports-hooks'
import { bookPathFor, bookingTabs } from './sports-nav'

function Row({ b }: { b: BookingSummary }) {
  return (
    <li>
      <BookingTicket
        title={b.title}
        day={formatDateShort(b.date)}
        time={`${formatTime(b.start)}–${formatTime(b.end)}`}
        place={
          b.kind === 'machine' ? 'Washing machine, managed under Laundry' : 'Sports reservation'
        }
        status={b.disrupted ? `${b.stateLabel}, may be affected` : b.stateLabel}
        source="Saved on this device"
        category={b.kind === 'machine' ? 'booking' : 'sports'}
        to={b.href}
        tone={b.disrupted ? 'warn' : b.active ? 'good' : 'muted'}
      >
        <div className="mt-1 flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline" className="min-h-11">
            <Link to={b.href}>
              {b.kind === 'machine' ? 'Manage under Laundry' : 'Open booking'}
            </Link>
          </Button>
          {!b.active && b.activity && bookPathFor[b.activity] ? (
            <Button asChild size="sm" variant="ghost" className="min-h-11">
              <Link to={bookPathFor[b.activity]!}>Book again</Link>
            </Button>
          ) : null}
        </div>
      </BookingTicket>
    </li>
  )
}

export function MyBookingsPage() {
  const { sports, ess, status, profileId, now } = useSports()
  if (status === 'loading' || !sports) return <Loading />
  const all = bookingSummaries(sports, ess, profileId, now.ms)
  const active = all.filter((b) => b.active && !b.disrupted)
  const disrupted = all.filter((b) => b.active && b.disrupted)
  const past = all.filter((b) => !b.active && !b.cancelled)
  const cancelled = all.filter((b) => b.cancelled)
  const group = (id: string, title: string, list: BookingSummary[], empty: string) => (
    <SectionCard id={id} title={`${title} (${list.length})`}>
      {list.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((b) => (
            <Row key={b.id} b={b} />
          ))}
        </ul>
      )}
    </SectionCard>
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="My bookings"
        description="Every local reservation you hold, in one place. These are not campus bookings and give no rights at a real facility."
        badge={<Pill tone="demo">Local · your records only</Pill>}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="my" />
      <MyClassroomBookings />
      {disrupted.length ? group('dis-h', 'Needs your attention', disrupted, '') : null}
      {group('act-h', 'Upcoming', active, 'No upcoming bookings. Pick a facility from Bookings.')}
      {group('past-h', 'Past', past, 'No past bookings.')}
      {group('can-h', 'Cancelled or released', cancelled, 'Nothing cancelled.')}
    </article>
  )
}

export function BookingDetailPage() {
  const { bookingId } = useParams()
  const { sports, status, profileId, repo, now } = useSports()
  const confirm = useConfirm()
  const { act, message } = useAction()
  if (status === 'loading' || !sports) return <Loading />
  const r = sports.reservations.find((x) => x.id === bookingId && x.ownerProfileId === profileId)
  if (!r)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Booking not found
        </h1>
        <p className="mt-2 text-ink-muted">
          We could not find that booking for this persona. It may not exist, or it may belong to
          another profile. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/bookings/my">Back to My bookings</Link>
        </Button>
      </div>
    )
  const res = sports.resources.find((x) => x.id === r.resourceId)
  const cancel = async () => {
    const c = await confirm({
      title: 'Cancel this local booking?',
      description:
        'The slot is released for others on this device. This does not say anything about whether the facility is empty.',
      confirmLabel: 'Cancel booking',
      danger: true,
    })
    if (c === 'confirm') await act(() => repo.act(profileId, r.id, 'cancel'), 'Booking cancelled.')
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/bookings/my"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> My bookings
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {res?.label ?? 'Booking'}
          </h1>
          <Pill>{reservationStateLabel[r.state]}</Pill>
          {r.disrupted ? <Pill tone="warn">May be affected</Pill> : null}
        </div>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          {formatDateShort(r.date)}, {formatTime(r.start)}–{formatTime(r.end)} · booking ID {r.id}
        </p>
      </div>
      {r.disrupted ? (
        <div
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <p className="font-semibold">Your reservation may be affected.</p>
          <p>
            {res?.label}{' '}
            {res?.status === 'closed' ? 'is reported closed' : 'had a closure reported'}
            {r.disruptionNote ? `: ${r.disruptionNote}` : ''}. Nothing was cancelled for you.
          </p>
          <p className="mt-1">
            Next steps: keep the booking and check before you go, cancel it yourself, or wait for
            the operations view to resolve or cancel it.
          </p>
        </div>
      ) : null}
      <SectionCard id="bd-h" title="Details">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-muted">Facility</dt>
          <dd>
            <Link
              to={`/bookings/resources/${r.resourceId}`}
              className="font-medium text-coffee underline"
            >
              {res?.label}
            </Link>{' '}
            · {res?.location}
          </dd>
          {r.partnerNote ? (
            <>
              <dt className="text-ink-muted">Partner</dt>
              <dd>
                {r.partnerNote}{' '}
                <span className="text-ink-muted">
                  (Partner listed, unverified. Nobody was invited.)
                </span>
              </dd>
            </>
          ) : null}
          {r.participants ? (
            <>
              <dt className="text-ink-muted">Participants</dt>
              <dd>{r.participants}</dd>
            </>
          ) : null}
          <dt className="text-ink-muted">Check-in</dt>
          <dd>
            {r.state === 'checkedIn' || r.state === 'completed'
              ? 'Self-reported (not verified)'
              : r.state === 'checkInExpired'
                ? 'Expired when the booking ended; physical use unconfirmed'
                : 'Not checked in'}
          </dd>
          <dt className="text-ink-muted">Record</dt>
          <dd>
            {r.provenance.sourceLabel} · {r.provenance.dataMode}
          </dd>
        </dl>
        <p className="mt-2 text-sm">
          <Link
            to={`/calendar?view=day&date=${r.date}`}
            className="font-medium text-coffee underline"
          >
            Open this day in Calendar
          </Link>{' '}
          (the Calendar entry is a view of this booking, not a copy).
        </p>
      </SectionCard>
      <SectionCard id="tl-h" title="Timeline">
        <ol className="flex flex-col gap-1.5">
          {r.history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2 border-b border-border pb-1.5">
              <time dateTime={h.at} className="text-ink-muted">
                {formatInstant(h.at)}
              </time>
              <span className="font-medium">{h.action}</span>
              <Pill tone={h.actorKind === 'student' ? 'plain' : 'demo'}>
                {h.actorKind === 'student'
                  ? 'You'
                  : h.actorKind === 'system'
                    ? 'Automatic (when the app runs)'
                    : 'Simulated (local)'}
              </Pill>
              {h.note ? <span className="text-ink-muted">{h.note}</span> : null}
            </li>
          ))}
        </ol>
      </SectionCard>
      <div className="flex flex-wrap gap-2">
        {r.state === 'confirmedDemo' ? (
          <>
            <Button
              className="min-h-11"
              onClick={() =>
                void act(
                  () => repo.act(profileId, r.id, 'checkIn'),
                  'Self-reported check-in recorded.',
                )
              }
            >
              Check in (self-report)
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => void cancel()}>
              Cancel booking
            </Button>
          </>
        ) : null}
        {r.state === 'checkedIn' || r.state === 'checkInExpired' ? (
          <Button
            className="min-h-11"
            onClick={() =>
              void act(
                () => repo.act(profileId, r.id, 'finish'),
                'Marked finished (your own report).',
              )
            }
          >
            I’m finished (self-report)
          </Button>
        ) : null}
      </div>
      {r.state === 'confirmedDemo' && now.ms ? (
        <p className="text-xs text-ink-muted">
          Check-in opens 15 minutes before the slot. A slot ending does not show the facility is
          clear.
        </p>
      ) : null}
      <output className="block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
    </article>
  )
}

export function WaitlistPage() {
  const { sports, status, profileId, repo, now } = useSports()
  const { act, message } = useAction()
  if (status === 'loading' || !sports) return <Loading />
  const mine = ownWaitlist(sports, profileId)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="My waitlists"
        description="A waitlist entry is not a reservation. You only get a slot if an offer is made and you accept it in time."
        badge={<Pill tone="demo">Local · recorded entries only</Pill>}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="waitlist" />
      <SectionCard id="wl-h" title={`Entries (${mine.length})`}>
        {mine.length === 0 ? (
          <Empty>
            You are not on any waitlist. A full badminton slot offers “Join local waitlist”.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((w) => {
              const res = sports.resources.find((x) => x.id === w.resourceId)
              const pos = waitlistPosition(sports, w)
              const lapsed = offerExpired(w, now.ms)
              return (
                <li key={w.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">
                      {res?.label} · {formatDateShort(w.date)}, {formatTime(w.start)}
                    </span>
                    <Pill tone={w.state === 'offered' ? 'warn' : 'plain'}>
                      {waitlistLabel(w, now.ms)}
                    </Pill>
                  </div>
                  {pos ? (
                    <p className="text-sm text-ink-muted">
                      Position {pos.position} of {pos.of} recorded entries. This is not a
                      campus-wide rank.
                    </p>
                  ) : null}
                  {w.state === 'offered' && w.offerExpiresAt ? (
                    <p className="text-sm">
                      Offer {lapsed ? 'lapsed at' : 'open until'} {formatInstant(w.offerExpiresAt)}.
                      It is not yours until you accept.
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {w.state === 'offered' && !lapsed ? (
                      <>
                        <Button
                          className="min-h-11"
                          onClick={() =>
                            void act(
                              () => repo.respondToOffer(profileId, w.id, true),
                              'Offer accepted. A local reservation was saved.',
                            )
                          }
                        >
                          Accept offer
                        </Button>
                        <Button
                          variant="outline"
                          className="min-h-11"
                          onClick={() =>
                            void act(
                              () => repo.respondToOffer(profileId, w.id, false),
                              'Offer declined.',
                            )
                          }
                        >
                          Decline
                        </Button>
                      </>
                    ) : null}
                    {w.state === 'waiting' ? (
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () => repo.leaveWaitlist(profileId, w.id),
                            'You left the waitlist.',
                          )
                        }
                      >
                        Leave waitlist
                      </Button>
                    ) : null}
                    {w.resultingReservationId ? (
                      <Button asChild variant="outline" className="min-h-11">
                        <Link to={`/bookings/my/${w.resultingReservationId}`}>View booking</Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
          {message}
        </output>
      </SectionCard>
    </article>
  )
}
