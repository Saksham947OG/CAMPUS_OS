import { BookOpen, Music, PartyPopper } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { equipmentStatusLabel } from '@/domain/sports'
import { LIBRARY_ID } from '@/domain/sports-logic'
import { formatDateShort, formatInstant } from '@/lib/time'
import {
  bookStatusLabel,
  equipmentFor,
  facilityView,
  ownLoans,
  resourcesFor,
  searchCatalogue,
} from '@/selectors/sports'
import {
  Empty,
  Loading,
  PersonMinutesScenario,
  Pill,
  SectionCard,
  SubNav,
} from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { SlotBooker } from './slot-booker'
import { useSports } from './sports-hooks'
import { SportsOps } from './sports-ops'
import { bookingTabs } from './sports-nav'

const BADGE = <Pill tone="demo">Illustrative data</Pill>

const libraryTabs = [
  { id: 'overview', label: 'Overview and study spaces', to: '/bookings/library' },
  { id: 'books', label: 'Books', to: '/bookings/library/books' },
  { id: 'loans', label: 'My loans', to: '/bookings/library/loans' },
]

function LibraryHeader({ current, title = 'Library' }: { current: string; title?: string }) {
  return (
    <>
      <PageHeader
        title={title}
        description="Study-room reservations and a labelled illustrative catalogue. No real library system is connected, and the hours, rooms and books here are fictional."
        badge={BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="library" />
      <SubNav label="Library sections" items={libraryTabs} current={current} />
    </>
  )
}

export function LibraryPage() {
  const { sports, status, profileId, now, repo, showDemoOps } = useSports()
  const { act, message } = useAction()
  if (status === 'loading' || !sports) return <Loading />
  const v = facilityView(sports, profileId, now.ms, LIBRARY_ID)
  const rooms = resourcesFor(sports, 'library').filter((r) => r.bookable !== false)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <LibraryHeader current="overview" />

      <SectionCard
        id="lib-over-h"
        title="Overview"
        action={<Pill tone="demo">Demo hours · not supplied by the campus</Pill>}
      >
        <p>
          <strong>Published hours:</strong> {v.hours ? `${v.hours} (local)` : 'Hours not supplied'}
        </p>
        <p className="mt-1">
          <strong>Occupancy:</strong> {v.snapshot}
        </p>
        <p className="mt-1">
          <strong>Self-reported count:</strong> {v.selfReportedNow}{' '}
          {v.selfReportedNow === 1 ? 'person has' : 'people have'} checked in on this device
          {v.staleForReview ? `, plus ${v.staleForReview} older session set aside for review` : ''}.
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Occupancy not verified. A self-report or simulated snapshot covers only personas, so it is
          not a headcount, a room reservation is not attendance, and no check-ins does not mean the
          library is empty.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            onClick={() =>
              void act(
                () => repo.gymCheckIn(profileId, LIBRARY_ID),
                'Self-reported check-in recorded.',
              )
            }
          >
            {v.mySession ? 'You are checked in' : 'Check in (self-report)'}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void act(() => repo.gymCheckOut(profileId, LIBRARY_ID), 'Checked out.')}
          >
            Check out
          </Button>
          {v.mySession ? (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() =>
                void act(
                  () => repo.gymCorrect(profileId, LIBRARY_ID),
                  'Check-in removed as a correction.',
                )
              }
            >
              Correct: I did not check in
            </Button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-ink-muted">
          You are never checked out automatically when you close the page.
        </p>
        <output className="mt-1 block min-h-5 text-sm font-medium" aria-live="polite">
          {message}
        </output>
      </SectionCard>

      <SectionCard id="lib-spaces-h" title="Study spaces">
        <p className="text-ink-muted">
          General reading areas are information only and cannot be reserved. Only the group rooms
          below can be booked, and only on this device.
        </p>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2">
          {rooms.map((r) => (
            <li key={r.id} className="rounded-md border border-border p-3">
              <p className="font-semibold">{r.label}</p>
              <p className="text-sm text-ink-muted">
                {r.referenceCapacity
                  ? `Study cabin: ${r.referenceCapacity} people at a time (owner-supplied).`
                  : 'Capacity not provided.'}{' '}
                Amenities not supplied.
              </p>
              <Link
                to={`/bookings/library/spaces/${r.id}`}
                className="mt-1 inline-block text-sm font-medium text-coffee underline"
              >
                Details and slots
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SlotBooker activity="library" />
      {sports.resources.find((r) => r.id === LIBRARY_ID)?.referenceCapacity ? (
        <p className="rounded-md bg-mist p-3 text-sm">
          Library capacity: {sports.resources.find((r) => r.id === LIBRARY_ID)?.referenceCapacity}{' '}
          people at a time (owner-supplied). Current occupancy is not known.
        </p>
      ) : null}
      <PersonMinutesScenario id="lib-tt-h" noun="library trips to full or unavailable rooms" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}

export function LibraryBooksPage() {
  const { sports, status } = useSports()
  const [q, setQ] = useState('')
  if (status === 'loading' || !sports) return <Loading />
  const found = searchCatalogue(sports, q)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <LibraryHeader current="books" title="Library books" />
      <p
        role="note"
        className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
      >
        <strong>Catalogue not connected.</strong> The titles below are a fictional illustrative
        catalogue so you can see how search works. They are not the real library’s books, and no
        status here is live or guaranteed on the shelf.
      </p>
      <SectionCard id="books-h" title={`Demo catalogue (${found.length})`}>
        <Field label="Search titles and authors">
          {(a) => (
            <input
              {...a}
              type="search"
              className={inputClass}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </Field>
        {found.length === 0 ? (
          <Empty>No demo book matches “{q}”.</Empty>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {found.map((b) => (
              <li key={b.id} className="rounded-md border border-border p-3">
                <p className="flex items-center gap-2 font-semibold">
                  <BookOpen className="size-4" aria-hidden="true" /> {b.title}
                </p>
                <p className="text-sm text-ink-muted">{b.author}</p>
                <p className="text-sm">{bookStatusLabel[b.status]}</p>
                <p className="text-xs text-ink-muted">
                  {b.sourceLabel} · as of {formatInstant(b.asOf)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </article>
  )
}

export function LibraryLoansPage() {
  const { sports, status, profileId, repo } = useSports()
  const { act, message } = useAction()
  const [notes, setNotes] = useState<Record<string, string>>({})
  if (status === 'loading' || !sports) return <Loading />
  const mine = ownLoans(sports, profileId)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <LibraryHeader current="loans" title="My loans" />
      <p
        role="note"
        className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
      >
        <strong>Not connected to a library system.</strong> Loans appear here only if someone enters
        them on this device simulator. They are not circulation records, no fines are calculated,
        and only the simulator can record a return.
      </p>
      <SectionCard id="loans-h" title={`My loans (${mine.length})`}>
        {mine.length === 0 ? (
          <Empty>You have no loans recorded. Only your own loans would ever be shown here.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {mine.map(({ loan, book }) => (
              <li key={loan.id} className="rounded-md border border-border p-3">
                <p className="font-semibold">{book?.title ?? 'Demo book'}</p>
                <p className="text-sm">
                  Due {formatDateShort(loan.dueDate)}{' '}
                  <span className="text-ink-muted">(date only: no time is implied)</span>
                </p>
                <p className="text-sm text-ink-muted">
                  {loan.returnedOn
                    ? `Return recorded on this device on ${formatDateShort(loan.returnedOn)}.`
                    : 'Not recorded as returned. Only the demo simulator can record a return.'}
                </p>
                <p className="text-xs text-ink-muted">{loan.provenance.sourceLabel}</p>
                <form
                  className="mt-2 flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void act(
                      () =>
                        repo.setLoanNote(
                          profileId,
                          loan.id,
                          notes[loan.id] ?? loan.studentNote ?? '',
                        ),
                      'Your note was saved on this device.',
                    )
                  }}
                >
                  <Field label="Your own note (not library data)">
                    {(a) => (
                      <input
                        {...a}
                        className={`${inputClass} w-72`}
                        maxLength={200}
                        value={notes[loan.id] ?? loan.studentNote ?? ''}
                        onChange={(e) => setNotes({ ...notes, [loan.id]: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button type="submit" variant="outline" className="min-h-11">
                    Save note
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
          {message}
        </output>
      </SectionCard>
    </article>
  )
}

export function MusicRoomPage() {
  const { sports, status, showDemoOps } = useSports()
  if (status === 'loading' || !sports) return <Loading />
  const room = resourcesFor(sports, 'musicRoom')[0]
  const equipment = room ? equipmentFor(sports, room.id) : []
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Music Room"
        description="Reserve a jam session on this device. A reservation holds a time slot in this app’s data; it does not show who is in the room or what equipment works."
        badge={BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="music" />
      <p className="flex items-center gap-2 text-sm text-ink-muted">
        <Music className="size-4" aria-hidden="true" /> Free to reserve in the recorded schedule ·
        Reserved · Closed · physical occupancy unknown
      </p>
      <SlotBooker activity="musicRoom" />
      <SectionCard id="mus-eq-h" title="Equipment and facilities">
        {equipment.length === 0 ? (
          <p>
            Equipment information not supplied. No instruments, amplifiers, microphones or
            sound-proofing are assumed.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {equipment.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span className="font-medium">{e.label}</span>
                <Pill tone={e.status === 'reportedAvailable' ? 'plain' : 'warn'}>
                  {equipmentStatusLabel[e.status]}
                </Pill>
                <span className="w-full text-xs text-ink-muted">
                  {e.sourceLabel} · as of {formatInstant(e.asOf)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          Check in and out is a self-report on your booking’s page. A session ending at its slot
          time is never inferred as checked out, and fault reports will use the complaints feature
          when it exists.
        </p>
      </SectionCard>
      <PersonMinutesScenario id="mus-tt-h" noun="jam-session coordination" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}

export function ChillZonePage() {
  const { sports, status, showDemoOps } = useSports()
  if (status === 'loading' || !sports) return <Loading />
  const spots = resourcesFor(sports, 'chillZone')
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Chill Zone"
        description="Coordinate midnight celebration spots on this device. The three spots are illustrative placeholders, and a demo slot is not a campus allocation."
        badge={BADGE}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="chill" />
      <p
        role="note"
        className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
      >
        <strong>Demo coordination only.</strong> Real celebration spots work first-come-first-served
        and CampusOS cannot change campus access rules or guarantee exclusive use. Reserved here
        never means allocated by the college.
      </p>
      <ul className="grid gap-2 sm:grid-cols-3">
        {spots.map((r) => (
          <li key={r.id} className="rounded-lg border border-border bg-surface p-3">
            <p className="flex items-center gap-2 font-semibold">
              <PartyPopper className="size-4 text-coffee" aria-hidden="true" /> {r.label}
            </p>
            <p className="text-sm text-ink-muted">Placeholder: no real name, place or photo.</p>
            <Link
              to={`/bookings/resources/${r.id}`}
              className="text-sm font-medium text-coffee underline"
            >
              Details
            </Link>
          </li>
        ))}
      </ul>
      <SlotBooker activity="chillZone" />
      <SectionCard id="chill-guide-h" title="Group guidelines">
        <ul className="list-disc pl-5">
          <li>
            Availability shows only “reserved” or “free”. No names, birthdays or occasions are ever
            shown to others.
          </li>
          <li>Slots can cross midnight, and both dates are always shown.</li>
          <li>
            A birthday event is never created from a reservation. Add one yourself in Calendar if
            you want it.
          </li>
        </ul>
      </SectionCard>
      <PersonMinutesScenario id="chill-tt-h" noun="spot-finding and scheduling disputes" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}
