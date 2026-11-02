import { ProcessTimeTax } from '../sources/process-time-tax'
import { useServices } from '@/app/services'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  PURPOSES,
  reservationLabel,
  type Reservation,
  type Room,
  type SlotStatus,
} from '@/domain/classrooms'
import { DISPLAY_WINDOW, ribbon, slotStatus } from '@/domain/classrooms-logic'
import {
  addDays,
  formatDateShort,
  formatInstant,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { minutesToTime } from '@/lib/time/calendar'
import { timeToMinutes } from '@/selectors/now'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { bookingTabs } from '../sports/sports-nav'
import { useClassrooms } from './classroom-hooks'
import { ClassroomOps } from './classroom-ops'
import { statusText } from './classroom-text'

const T = (m: number) => minutesToTime(m) as LocalTime

const tone: Record<SlotStatus['kind'], string> = {
  available: 'bg-teal-tint',
  booked: 'bg-terracotta-tint',
  pending: 'bg-mist',
  blocked: 'bg-terracotta-tint',
  unknown: 'bg-surface border-dashed',
}

export function ClassroomsPage() {
  const { sourceData } = useServices()
  const { classrooms, status, profileId, now, repo, newId, showDemoOps } = useClassrooms()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const { act } = useAction()
  const slot = classrooms?.config.slotMinutes ?? 60
  const [date, setDate] = useState<string>(() =>
    isDateOnly(params.get('date') ?? '') ? params.get('date')! : '',
  )
  const [startMin, setStartMin] = useState<number>(() =>
    params.get('start') ? timeToMinutes(params.get('start') as LocalTime) : 14 * 60,
  )
  const [slots, setSlots] = useState(1)
  const [selected, setSelected] = useState<string | null>(params.get('room'))
  const [purpose, setPurpose] = useState<(typeof PURPOSES)[number]>(PURPOSES[0])
  const [group, setGroup] = useState('')
  const [people, setPeople] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [key] = useState(() => newId('idem'))
  const day = (isDateOnly(date) ? date : now.today) as DateOnly
  const span = useMemo(
    () => ({ date: day, start: T(startMin), end: T(startMin + slots * slot) }),
    [day, startMin, slots, slot],
  )
  if (status === 'loading' || !classrooms) return <Loading />
  const starts = Array.from(
    { length: Math.floor((DISPLAY_WINDOW.to - DISPLAY_WINDOW.from) / slot) },
    (_, i) => DISPLAY_WINDOW.from + i * slot,
  )
  const room = (id: string) => classrooms.rooms.find((r) => r.id === id) as Room
  const picked = selected ? room(selected) : null
  const pickedStatus = picked ? slotStatus(classrooms, picked.id, span, profileId) : null
  const freeElsewhere = picked
    ? classrooms.rooms.filter(
        (r) =>
          r.id !== picked.id && slotStatus(classrooms, r.id, span, profileId).kind === 'available',
      )
    : []

  const submit = async () => {
    if (!picked || !pickedStatus) return
    setError('')
    const r = await act(
      () =>
        repo.reserve(
          profileId,
          {
            roomId: picked.id,
            ...span,
            purpose,
            ...(group ? { groupName: group } : {}),
            ...(people ? { attendees: Number(people) } : {}),
            ...(notes ? { notes } : {}),
            ...(pickedStatus.kind === 'unknown' ? { asVerificationRequest: true } : {}),
          },
          key,
        ),
      picked.bookingMode === 'instant' && pickedStatus.kind === 'available'
        ? 'Classroom reserved on this device.'
        : 'Request recorded on this device.',
    )
    if (r.ok) nav(`/bookings/classrooms/bookings/${r.value.reservation.id}`)
    else setError(r.error.message)
  }

  const action = (r: Room, s: SlotStatus) => {
    if (s.kind === 'available')
      return r.bookingMode === 'instant' ? 'Book this room' : 'Request this room'
    if (s.kind === 'unknown') return 'Request verification'
    return null
  }

  return (
    <article className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Classrooms"
        description="Compare CR Conference Hall, CR1, CR3 and G12 for one time, then book straight from a free slot."
        badge={<Pill tone="demo">Reference schedule · not a live college timetable</Pill>}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="classrooms" />
      <p
        role="note"
        className="rounded-md border border-border-strong bg-mist p-3 text-sm text-ink"
      >
        Booked, blocked and available mean “recorded on this device”. A room can be reserved and
        still empty, or free on this device and occupied in real life. Capacity, equipment, hours
        and approval rules have not been supplied.
      </p>
      <form
        className="flex flex-wrap items-end gap-3"
        aria-label="Choose a time"
        onSubmit={(e) => e.preventDefault()}
      >
        <Field label="Date">
          {(a) => (
            <input
              {...a}
              type="date"
              className={`${inputClass} w-44`}
              value={date || now.today}
              min={now.today}
              max={addDays(now.today, classrooms.config.horizonDays)}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>
        <Field label="Start">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-36`}
              value={startMin}
              onChange={(e) => setStartMin(Number(e.target.value))}
            >
              {starts.map((m) => (
                <option key={m} value={m}>
                  {T(m)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Duration">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-36`}
              value={slots}
              onChange={(e) => setSlots(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n * slot} min
                </option>
              ))}
            </select>
          )}
        </Field>
        <p className="min-h-11 py-2 text-sm text-ink-muted">
          {formatDateShort(day)}, {span.start}–{span.end}
        </p>
      </form>

      <ul className="grid gap-3 md:grid-cols-2" aria-label="Rooms">
        {classrooms.rooms.map((r) => {
          const s = slotStatus(classrooms, r.id, span, profileId)
          const t = statusText(s)
          const act1 = action(r, s)
          const rb = ribbon(classrooms, r.id, day, profileId)
          const next =
            s.kind === 'booked' || s.kind === 'blocked'
              ? rb.find(
                  (x) =>
                    timeToMinutes(x.start) >= timeToMinutes(span.end) &&
                    x.status.kind === 'available',
                )
              : undefined
          return (
            <li
              key={r.id}
              data-room={r.id}
              className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 shadow-card ${selected === r.id ? 'border-coffee border-2' : 'border-border'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-ink">{r.displayName}</h2>
                <span className="text-xs text-ink-muted">{r.kindLabel}</span>
              </div>
              <p className={`rounded-md border border-border px-2 py-1.5 text-sm ${tone[s.kind]}`}>
                <strong>{t.label}</strong>
                <span className="block text-xs text-ink-muted">{t.detail}</span>
              </p>
              {next ? (
                <p className="text-xs text-ink-muted">Next recorded opening: {next.start}.</p>
              ) : null}
              <p className="text-xs text-ink-muted">
                Capacity {r.capacity ?? 'not provided'} ·{' '}
                {r.features?.join(', ') ?? 'equipment not provided'} ·{' '}
                {r.bookingMode === 'approval'
                  ? 'requests need a (simulated) review'
                  : 'instant local booking'}
              </p>
              <ol
                aria-label={`${r.displayName} availability`}
                className="grid grid-cols-6 gap-1 sm:grid-cols-12"
              >
                {rb.map((x) => {
                  const k = x.status.kind
                  return (
                    <li key={x.start}>
                      <button
                        type="button"
                        className={`min-h-11 w-full rounded border border-border px-0.5 text-[11px] leading-tight ${tone[k]}`}
                        aria-label={`${r.displayName} ${x.start} to ${x.end}: ${statusText(x.status).label}${k === 'available' ? '. Choose this time.' : ''}`}
                        disabled={k !== 'available'}
                        onClick={() => {
                          setStartMin(timeToMinutes(x.start))
                          setSlots(1)
                          setSelected(r.id)
                        }}
                      >
                        {x.start.slice(0, 5)}
                        <span className="block">
                          {
                            {
                              available: 'Free',
                              booked: 'Busy',
                              pending: 'Pend.',
                              blocked: 'Block',
                              unknown: '?',
                            }[k]
                          }
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ol>
              {act1 ? (
                <Button className="min-h-11 self-start" onClick={() => setSelected(r.id)}>
                  {act1}
                  <span className="sr-only"> {r.displayName}</span>
                </Button>
              ) : s.kind === 'pending' ? (
                <p className="text-sm">You already asked for this time. See My bookings.</p>
              ) : (
                <Button disabled className="min-h-11 self-start">
                  Not available for this slot
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      {picked && pickedStatus ? (
        <SectionCard
          id="cr-book-h"
          title={`${action(picked, pickedStatus) ?? 'Choose another room'}: ${picked.displayName}`}
        >
          <p className="mb-2 text-sm">
            {formatDateShort(day)}, {span.start}–{span.end} · {statusText(pickedStatus).label}
          </p>
          {pickedStatus.kind === 'booked' ||
          pickedStatus.kind === 'blocked' ||
          pickedStatus.kind === 'pending' ? (
            <p
              role="alert"
              className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
            >
              {statusText(pickedStatus).detail} Choose another room or time; your answers below are
              kept.
            </p>
          ) : null}
          {pickedStatus.kind === 'unknown' ? (
            <p className="mb-2 text-sm">
              This time is outside the reference schedule. You can send a request for verification;
              it is not a reservation.
            </p>
          ) : null}
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              void submit()
            }}
          >
            <Field label="Purpose">
              {(a) => (
                <select
                  {...a}
                  className={inputClass}
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as typeof purpose)}
                >
                  {PURPOSES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              )}
            </Field>
            <div className="flex flex-wrap gap-3">
              <Field label="Group name (optional)">
                {(a) => (
                  <input
                    {...a}
                    className={`${inputClass} w-56`}
                    maxLength={60}
                    value={group}
                    onChange={(e) => setGroup(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Attendees (optional)">
                {(a) => (
                  <input
                    {...a}
                    inputMode="numeric"
                    className={`${inputClass} w-32`}
                    value={people}
                    onChange={(e) => setPeople(e.target.value.replace(/\D/g, ''))}
                  />
                )}
              </Field>
            </div>
            <Field label="Notes (optional, only you and reviewers see them)">
              {(a) => (
                <textarea
                  {...a}
                  rows={2}
                  maxLength={300}
                  className={inputClass}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              )}
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                className="min-h-11"
                disabled={
                  pickedStatus.kind === 'booked' ||
                  pickedStatus.kind === 'blocked' ||
                  pickedStatus.kind === 'pending'
                }
              >
                {pickedStatus.kind === 'unknown'
                  ? 'Send request for verification'
                  : picked.bookingMode === 'instant'
                    ? 'Confirm booking'
                    : 'Request this room'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => setSelected(null)}
              >
                Close
              </Button>
            </div>
          </form>
          {freeElsewhere.length > 0 ? (
            <div className="mt-3 text-sm">
              <p className="font-medium">Free for the same time on this device schedule:</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {freeElsewhere.map((r) => (
                  <li key={r.id}>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => setSelected(r.id)}
                    >
                      Switch to {r.displayName}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </SectionCard>
      ) : null}
      <p className="text-sm">
        <Link to="/bookings/my" className="font-medium text-coffee underline">
          My bookings
        </Link>
      </p>
      {showDemoOps ? <ClassroomOps /> : null}
      {sourceData ? <ProcessTimeTax service="classrooms" /> : null}
    </article>
  )
}

export function ClassroomBookingPage() {
  const { bookingId = '' } = useParams()
  const { classrooms, status, profileId, now, repo, showDemoOps } = useClassrooms()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [moveRoom, setMoveRoom] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [moveStart, setMoveStart] = useState('')
  const [moveEnd, setMoveEnd] = useState('')
  if (status === 'loading' || !classrooms) return <Loading />
  const r = classrooms.reservations.find(
    (x) => x.id === bookingId && x.ownerProfileId === profileId,
  )
  if (!r)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Booking not found" />
        <Empty>
          This booking is not in your records.{' '}
          <Link to="/bookings/classrooms" className="underline">
            Back to Classrooms
          </Link>
        </Empty>
      </article>
    )
  const room = classrooms.rooms.find((x) => x.id === r.roomId)!
  const open = r.state === 'pendingApproval' || r.state === 'confirmedDemo'
  const target = {
    roomId: moveRoom || r.roomId,
    date: (moveDate || r.date) as DateOnly,
    start: (moveStart || r.start) as LocalTime,
    end: (moveEnd || r.end) as LocalTime,
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={`${room.displayName} booking`}
        badge={<Pill tone="demo">Local · not a campus booking</Pill>}
      />
      <div className="flex flex-wrap gap-3 text-sm font-medium text-coffee">
        <Link to="/bookings/my" className="underline">
          View My bookings
        </Link>
        <Link
          to={`/bookings/classrooms?room=${r.roomId}&date=${r.date}&start=${r.start}`}
          className="underline"
        >
          Back to this room and time
        </Link>
        {r.state === 'confirmedDemo' ? (
          <Link to={`/calendar?view=day&date=${r.date}`} className="underline">
            Open in Calendar
          </Link>
        ) : null}
      </div>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard
        id="cb-sum-h"
        title="Booking"
        action={
          <Pill
            tone={
              r.state === 'rejected' || r.state === 'cancelled' || r.state === 'disrupted'
                ? 'warn'
                : 'plain'
            }
          >
            {reservationLabel[r.state]}
          </Pill>
        }
      >
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Reference</dt>
            <dd>{r.id}</dd>
          </div>
          <div>
            <dt className="font-medium">When</dt>
            <dd>
              {formatDateShort(r.date)}, {r.start}–{r.end} (Asia/Kolkata)
            </dd>
          </div>
          <div>
            <dt className="font-medium">Purpose</dt>
            <dd>
              {r.purpose}
              {r.groupName ? ` · ${r.groupName}` : ''}
            </dd>
          </div>
          <div>
            <dt className="font-medium">Attendees</dt>
            <dd>{r.attendees ?? 'Not given'}</dd>
          </div>
        </dl>
        {r.state === 'pendingApproval' ? (
          <p className="mt-2 rounded-md bg-mist p-2">
            {r.needsVerification ? 'Sent for verification. ' : ''}Requested, not reserved. Nothing
            is held until a simulated reviewer approves it.
          </p>
        ) : null}
        {r.decisionReason ? <p className="mt-2">Reason: {r.decisionReason}</p> : null}
        {r.state === 'disrupted' ? (
          <p className="mt-2 rounded-md bg-terracotta-tint p-2">
            A simulated closure overlaps this time. Check the room before relying on it.
          </p>
        ) : null}
        {r.state === 'cancelled' ? (
          <p className="mt-2">
            Cancelling frees the recorded slot. It does not mean anyone checked the physical room.
          </p>
        ) : null}
        {open ? (
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={async () => {
              const c = await confirm({
                title: 'Cancel this reservation?',
                description: <p>The recorded slot becomes free again. Your history is kept.</p>,
                confirmLabel: 'Cancel reservation',
                danger: true,
              })
              if (c === 'confirm')
                await act(() => repo.cancel(profileId, r.id), 'Reservation cancelled.')
            }}
          >
            Cancel reservation
          </Button>
        ) : null}
      </SectionCard>
      {open ? (
        <SectionCard id="cb-move-h" title="Move to another time or room">
          <p className="text-sm text-ink-muted">
            The new time is checked first. If it fails, this booking stays exactly as it is.
          </p>
          <form
            className="mt-2 flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void act(() => repo.reschedule(profileId, r.id, target), 'Reservation moved.')
            }}
          >
            <Field label="Room">
              {(a) => (
                <select
                  {...a}
                  className={`${inputClass} w-44`}
                  value={moveRoom || r.roomId}
                  onChange={(e) => setMoveRoom(e.target.value)}
                >
                  {classrooms.rooms.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.displayName}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Date">
              {(a) => (
                <input
                  {...a}
                  type="date"
                  min={now.today}
                  className={`${inputClass} w-40`}
                  value={moveDate || r.date}
                  onChange={(e) => setMoveDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="From">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={`${inputClass} w-32`}
                  value={moveStart || r.start}
                  onChange={(e) => setMoveStart(e.target.value)}
                />
              )}
            </Field>
            <Field label="To">
              {(a) => (
                <input
                  {...a}
                  type="time"
                  className={`${inputClass} w-32`}
                  value={moveEnd || r.end}
                  onChange={(e) => setMoveEnd(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" className="min-h-11">
              Move booking
            </Button>
          </form>
        </SectionCard>
      ) : null}
      <SectionCard id="cb-hist-h" title="History">
        <ol className="flex flex-col gap-1">
          {r.history.map((h) => (
            <li key={h.id}>
              {formatInstant(h.at)} · {h.actor === 'student' ? 'You' : `Simulated (${h.actor})`} ·{' '}
              {h.type}
              {h.reason ? ` · ${h.reason}` : ''}
            </li>
          ))}
        </ol>
      </SectionCard>
      {showDemoOps ? <ClassroomOps /> : null}
    </article>
  )
}

/** The classroom part of My bookings. Each row opens its own booking. */
export function MyClassroomBookings() {
  const { classrooms, profileId } = useClassrooms()
  if (!classrooms) return null
  const mine = classrooms.reservations.filter((r) => r.ownerProfileId === profileId)
  const label = (r: Reservation) => classrooms.rooms.find((x) => x.id === r.roomId)?.displayName
  return (
    <SectionCard
      id="my-cr-h"
      title={`Classrooms (${mine.length})`}
      action={
        <Link to="/bookings/classrooms" className="text-sm font-medium text-coffee underline">
          Find a classroom
        </Link>
      }
    >
      {mine.length === 0 ? (
        <Empty>No classroom bookings or requests yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {mine.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
            >
              <span>
                <strong>{label(r)}</strong> · {formatDateShort(r.date)}, {r.start}–{r.end} ·{' '}
                {r.purpose}
              </span>
              <span className="flex items-center gap-2">
                <Pill
                  tone={
                    r.state === 'rejected' || r.state === 'cancelled' || r.state === 'disrupted'
                      ? 'warn'
                      : 'plain'
                  }
                >
                  {reservationLabel[r.state]}
                </Pill>
                <Button asChild size="sm" variant="outline" className="min-h-11">
                  <Link to={`/bookings/classrooms/bookings/${r.id}`}>Open booking</Link>
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  )
}
