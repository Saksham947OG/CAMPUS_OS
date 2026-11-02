import { BookOpen, Dumbbell, Music, PartyPopper, Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { activityLabel, OTHER_SPORTS, type Activity } from '@/domain/sports'
import { policyFor } from '@/domain/sports-logic'
import { addDays, formatDateShort, formatInstant, formatTime, type DateOnly } from '@/lib/time'
import {
  hoursText,
  cancelledReservations,
  ownReservations,
  slotViews,
  capacityText,
  upcomingReservations,
} from '@/selectors/sports'
import { Empty, Loading, Pill, SectionCard, SubNav, TripScenario } from '../essentials/ess-common'
import { SlotBooker } from './slot-booker'
import { bookingTabs } from './sports-nav'
import { useSports } from './sports-hooks'
import { SportsOps } from './sports-ops'

const DEMO_BADGE = <Pill tone="demo">Demo · sample facilities</Pill>

export function BookingsHubPage() {
  const { sports, status, profileId, now } = useSports()
  if (status === 'loading' || !sports) return <Loading />
  const next = upcomingReservations(sports, profileId, now.ms).slice(0, 3)
  const card = (to: string, title: string, text: string, icon?: React.ReactNode) => (
    <li key={to}>
      <Link
        to={to}
        className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-ink">
          {icon} {title}
        </span>
        <span className="text-sm text-ink-muted">{text}</span>
      </Link>
    </li>
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Bookings"
        description="Facility information and demo reservations for the gym, badminton and other sports. Nothing here is a real campus booking, and no hours, counts or rules are real."
        badge={DEMO_BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="hub" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {card(
          '/bookings/gym',
          'Gym',
          '6 AM–10 PM in 30-minute slots, demo reservations, equipment notices and self-check-in.',
          <Dumbbell className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/bookings/badminton',
          'Badminton',
          'Pick a court, date and slot. Optional partner note and a demo waitlist.',
          <Trophy className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/bookings/sports?activity=tableTennis',
          'Table Tennis',
          'Reserve a table in short demo slots.',
        )}
        {card(
          '/bookings/sports?activity=pool',
          'Pool',
          'Information only: no booking rules are configured.',
        )}
        {card(
          '/bookings/sports?activity=snooker',
          'Snooker',
          'Two tables: reserve a specific one, or let the demo pick an available table.',
        )}
        {card(
          '/bookings/sports?activity=basketball',
          'Basketball',
          'Reserve the court for a group.',
        )}
        {card(
          '/bookings/library',
          'Library',
          'Study-room reservations, a self-reported occupancy sample and a labelled demo catalogue.',
          <BookOpen className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/bookings/music-room',
          'Music Room',
          'Reserve a jam session. Equipment is shown only if it was supplied.',
          <Music className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/bookings/classrooms',
          'Classrooms',
          'Check CR Conference Hall, CR1, CR3 and G12 for a time, then book from a free slot.',
        )}
        {card(
          '/bookings/chill-zone',
          'Chill Zone',
          'Midnight-aware demo coordination for three placeholder celebration spots.',
          <PartyPopper className="size-5 text-coffee" aria-hidden="true" />,
        )}
      </ul>
      <SectionCard
        id="next-h"
        title="Your next bookings"
        action={
          <Link to="/bookings/my" className="text-sm font-medium text-coffee underline">
            My bookings
          </Link>
        }
      >
        {next.length === 0 ? (
          <Empty>You have no upcoming sports bookings.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {next.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  <strong>{sports.resources.find((x) => x.id === r.resourceId)?.label}</strong> ·{' '}
                  {formatDateShort(r.date)}, {formatTime(r.start)}
                  {r.disrupted ? ' · may be affected' : ''}
                </span>
                <Button asChild size="sm" variant="outline" className="min-h-11">
                  <Link to={`/bookings/my/${r.id}`}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        Team sign-ups, fixtures and results are a separate, later feature and are not part of this
        page. Fault reports are local demo notes, not complaint tickets.
      </p>
    </article>
  )
}

export function BadmintonPage() {
  const { sports, status, showDemoOps } = useSports()
  if (status === 'loading' || !sports) return <Loading />
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Badminton"
        description="Reserve a court slot in this demonstration. A reservation holds a time slot in this app's data; it does not show who is on the court."
        badge={DEMO_BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="badminton" />
      <SlotBooker activity="badminton" />
      <p className="text-sm">
        <Link to="/bookings/waitlist" className="font-medium text-coffee underline">
          See my waitlists and offers
        </Link>
      </p>
      <TripScenario id="bad-tt-h" noun="badminton court trips" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}

export function OtherSportsPage() {
  const { sports, status, showDemoOps } = useSports()
  const [params, setParams] = useSearchParams()
  if (status === 'loading' || !sports) return <Loading />
  const raw = params.get('activity')
  const activity = (OTHER_SPORTS as readonly string[]).includes(raw ?? '')
    ? (raw as Activity)
    : 'tableTennis'
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Other sports"
        description="Table tennis, pool, snooker and basketball each have their own rules. Where booking is not configured you only see information."
        badge={DEMO_BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="sports" />
      <fieldset>
        <legend className="mb-1 text-sm font-medium">Activity</legend>
        <div className="flex flex-wrap gap-2">
          {OTHER_SPORTS.map((a) => (
            <Button
              key={a}
              variant="outline"
              className="min-h-11"
              aria-pressed={a === activity}
              onClick={() => setParams({ activity: a })}
            >
              {activityLabel[a]}
              {sports.config.policies[a].bookable ? '' : ' (information only)'}
            </Button>
          ))}
        </div>
      </fieldset>
      <SlotBooker key={activity} activity={activity} />
      <TripScenario id="sp-tt-h" noun="table and court trips" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}

export function ResourcePage() {
  const { resourceId } = useParams()
  const { sports, status, profileId, now } = useSports()
  const [date, setDate] = useState<DateOnly>(now.today)
  if (status === 'loading' || !sports) return <Loading />
  const r = sports.resources.find((x) => x.id === resourceId)
  if (!r)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Resource not found
        </h1>
        <p className="mt-2 text-ink-muted">
          That facility does not exist in this demo. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/bookings">Back to Bookings</Link>
        </Button>
      </div>
    )
  const p = policyFor(sports, r)
  const days = Array.from({ length: p.horizonDays + 1 }, (_, i) => addDays(now.today, i))
  const slots = slotViews(sports, r, date, profileId, now.ms)
  const mine = ownReservations(sports, profileId).filter((x) => x.resourceId === r.id)
  const bookTo = {
    badminton: '/bookings/badminton',
    gym: '/bookings/gym',
    library: '/bookings/library',
    musicRoom: '/bookings/music-room',
    chillZone: '/bookings/chill-zone',
    tableTennis: '/bookings/sports?activity=tableTennis',
    pool: '/bookings/sports?activity=pool',
    snooker: '/bookings/sports?activity=snooker',
    basketball: '/bookings/sports?activity=basketball',
  }[r.activity]
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {r.label}
          </h1>
          <Pill tone={r.status === 'open' ? 'plain' : 'warn'}>
            {r.status === 'open'
              ? 'Open (demo report)'
              : r.status === 'closed'
                ? 'Closed'
                : 'Status unknown'}
          </Pill>
          <Pill tone="demo">Demo · sample facility</Pill>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {activityLabel[r.activity]} · {r.location}
        </p>
      </div>
      {r.status === 'closed' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Closed:</strong> {r.closureNote}
        </p>
      ) : null}
      <SectionCard id="info-h" title="Opening information and rules">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-muted">Published hours</dt>
          <dd>{hoursText(r.hours)}</dd>
          <dt className="text-ink-muted">Capacity</dt>
          <dd>{capacityText(sports, r)}</dd>
          <dt className="text-ink-muted">Booking</dt>
          <dd>{p.bookable ? 'Configured (demo rules)' : 'Not configured'}</dd>
          {p.bookable ? (
            <>
              <dt className="text-ink-muted">Slot length</dt>
              <dd>{p.slotMinutes} minutes</dd>
              <dt className="text-ink-muted">Advance booking</dt>
              <dd>up to {p.horizonDays} days</dd>
              <dt className="text-ink-muted">Upcoming limit</dt>
              <dd>{p.maxActive} per student for this activity</dd>
              <dt className="text-ink-muted">Check-in grace</dt>
              <dd>{p.graceMinutes} minutes</dd>
              <dt className="text-ink-muted">Participants</dt>
              <dd>{p.participantMax ? `up to ${p.participantMax}` : 'Limit not provided'}</dd>
            </>
          ) : null}
          <dt className="text-ink-muted">Source</dt>
          <dd>
            {r.sourceLabel} · as of {formatInstant(r.asOf)}
          </dd>
        </dl>
        <p className="mt-2 text-xs text-ink-muted">
          All values are demo defaults, not campus policy. Published availability is not verified
          vacancy.
        </p>
      </SectionCard>
      {p.bookable ? (
        <SectionCard
          id="avail-h"
          title="Published availability"
          action={
            <select
              aria-label="Date"
              className="min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm"
              value={date}
              onChange={(e) => setDate(e.target.value as DateOnly)}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDateShort(d)}
                </option>
              ))}
            </select>
          }
        >
          {slots.length === 0 ? (
            <Empty>No slot rules are available, so none are shown.</Empty>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <li
                  key={s.start}
                  className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
                >
                  {formatTime(s.start)} ·{' '}
                  {s.state === 'free'
                    ? 'unreserved'
                    : s.state === 'reserved'
                      ? s.mine
                        ? 'yours'
                        : 'reserved'
                      : s.state}
                </li>
              ))}
            </ul>
          )}
          <Button asChild className="mt-3 min-h-11">
            <Link to={bookTo}>Book this activity</Link>
          </Button>
        </SectionCard>
      ) : (
        <Button disabled className="min-h-11 self-start">
          Booking not configured
        </Button>
      )}
      <SectionCard id="mine-h" title="Your bookings here">
        {mine.length === 0 ? (
          <Empty>You have no bookings on this resource.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map((b) => (
              <li key={b.id}>
                <Link to={`/bookings/my/${b.id}`} className="font-medium text-coffee underline">
                  {formatDateShort(b.date)}, {formatTime(b.start)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        Cancelled bookings:{' '}
        {cancelledReservations(sports, profileId).filter((x) => x.resourceId === r.id).length}
      </p>
    </article>
  )
}
