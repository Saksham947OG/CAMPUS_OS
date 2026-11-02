import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { useCampusData } from '@/hooks/use-campus-data'
import { activityLabel, resourceNoun, type Activity, type Resource } from '@/domain/sports'
import { policyFor } from '@/domain/sports-logic'
import { addDays, formatDateShort, formatInstant, formatTime, type DateOnly } from '@/lib/time'
import {
  capacityText,
  hoursText,
  resourcesFor,
  scheduleWarnings,
  slotViews,
  spanText,
  unitStateLabel,
  unitSummary,
  type SlotView,
} from '@/selectors/sports'
import { Empty, Pill, SectionCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useSports } from './sports-hooks'

const keyOf = (s: SlotView) => `${s.startDate}|${s.start}`
const ANY = 'any'
/** Facilities with several distinguishable units get an "any available" choice and a per-unit status list. */
const UNIT_ACTIVITIES: readonly Activity[] = ['badminton', 'tableTennis', 'snooker']

/** One slot per interval across every unit: free if any unit is free, reserved only when all are taken. */
function mergeUnits(perUnit: SlotView[][]): SlotView[] {
  const [first = []] = perUnit
  return first.map((slot, i) => {
    const same = perUnit.map((u) => u[i]).filter((x): x is SlotView => Boolean(x))
    const state = same.some((x) => x.state === 'free')
      ? 'free'
      : same.every((x) => x.state === 'past')
        ? 'past'
        : same.every((x) => x.state === 'closed')
          ? 'closed'
          : 'reserved'
    return {
      ...slot,
      state,
      mine: same.some((x) => x.mine),
      taken: same.reduce((n, x) => n + x.taken, 0),
      places: same.reduce((n, x) => n + x.places, 0),
    }
  })
}

/** The short suffix on a slot button: whose it is, how full it is, or why it cannot be chosen. */
function slotNote(s: SlotView): string {
  if (s.state === 'past') return ' · past'
  if (s.state === 'closed') return ' · closed'
  if (s.mine) return ' · yours'
  if (s.state === 'reserved') return s.places > 1 ? ' · full' : ' · reserved'
  return s.places > 1 && s.taken > 0 ? ` · ${s.places - s.taken} left` : ''
}

const ACCESS_NOTE: Partial<Record<Activity, string>> = {
  chillZone:
    'This is a demo coordination record. It is not campus approval, gives no right to occupy any area, and “reserved” does not mean the spot is allocated by the college.',
  library:
    'A demo room reservation: it does not create seats, and nobody has verified the room will be free or open.',
  musicRoom:
    'A local reservation: it does not guarantee equipment, and a session running past its slot is not authorised.',
}

function ResourceInfo({ r, activity }: { r: Resource; activity: Activity }) {
  const { sports } = useSports()
  if (!sports) return null
  const p = policyFor(sports, r)
  return (
    <div className="text-sm">
      <p className="text-ink-muted">{r.location}</p>
      <p>
        <strong>Published hours:</strong> {hoursText(r.hours)}
      </p>
      <p>
        <strong>Capacity:</strong> {capacityText(sports, r)}
      </p>
      <p>
        <strong>Status:</strong>{' '}
        {r.status === 'open'
          ? 'Open (demo report)'
          : r.status === 'closed'
            ? `Closed: ${r.closureNote ?? 'no reason recorded'}`
            : 'Unknown'}
      </p>
      <p className="text-xs text-ink-muted">
        {r.sourceLabel} · as of {formatInstant(r.asOf)}
      </p>
      <p className="text-xs text-ink-muted">
        Planning rules for {activityLabel[activity].toLowerCase()}:{' '}
        {p.bookable
          ? `${p.slotMinutes}-minute slots, up to ${p.horizonDays} days ahead, ${p.maxActive} upcoming at a time, ${p.graceMinutes}-minute grace${p.participantMax ? `, up to ${p.participantMax} participants` : (r.slotCapacity ?? 1) > 1 ? `, up to ${r.slotCapacity} reservations per slot` : ', participant limit not provided'}.`
          : 'booking is not configured.'}
      </p>
    </div>
  )
}

/**
 * The one student-facing booking surface for every bookable activity (COS-SPORTS-001 §5, §6): pick
 * a resource, a date and a published slot, review the rules and any Calendar overlap, then confirm.
 * Rules come from each activity's own policy. A failed save keeps the selection and the form.
 */
export function SlotBooker({ activity }: { activity: Activity }) {
  const { sports, profileId, now, repo, newId } = useSports()
  const { data } = useCampusData()
  const { act, message, setMessage } = useAction()
  const [resourceId, setResourceId] = useState('')
  const [date, setDate] = useState<DateOnly>(now.today)
  const [slot, setSlot] = useState('')
  const [partner, setPartner] = useState('')
  const [people, setPeople] = useState('')
  const [key, setKey] = useState(() => newId('idem'))
  const [busy, setBusy] = useState(false)
  const [lastId, setLastId] = useState<string>()

  const resources = useMemo(
    () => (sports ? resourcesFor(sports, activity).filter((r) => r.bookable !== false) : []),
    [sports, activity],
  )
  if (!sports) return null
  const policy = sports.config.policies[activity]
  const unitAware = UNIT_ACTIVITIES.includes(activity) && resources.length > 1
  const anyUnit = unitAware && resourceId === ANY
  const resource = resources.find((r) => r.id === resourceId) ?? resources[0]
  if (!resource)
    return <Empty>No {activityLabel[activity].toLowerCase()} resources are configured.</Empty>

  if (!policy.bookable) {
    return (
      <SectionCard id={`book-${activity}`} title={`${activityLabel[activity]}: information only`}>
        {resources.map((r) => (
          <div key={r.id} className="mb-3 rounded-md border border-border p-3">
            <p className="font-semibold">{r.label}</p>
            <ResourceInfo r={r} activity={activity} />
            <Link
              to={`/bookings/resources/${r.id}`}
              className="mt-1 inline-block text-sm font-medium text-coffee underline"
            >
              Resource details
            </Link>
          </div>
        ))}
        <Button disabled className="min-h-11">
          Booking not configured
        </Button>
        <p className="mt-1 text-xs text-ink-muted">
          No booking rules have been supplied for {activityLabel[activity].toLowerCase()}, so no
          slot is offered and nothing can be reserved.
        </p>
      </SectionCard>
    )
  }

  const days = Array.from({ length: policy.horizonDays + 1 }, (_, i) => addDays(now.today, i))
  const slots = anyUnit
    ? mergeUnits(resources.map((r) => slotViews(sports, r, date, profileId, now.ms)))
    : slotViews(sports, resource, date, profileId, now.ms)
  const chosen = slots.find((s) => keyOf(s) === slot && s.state === 'free')
  const units =
    unitAware && chosen
      ? unitSummary(sports, activity, date, chosen.startDate, chosen.start, profileId, now.ms)
      : null
  // "Any" allocates the first eligible unit and says which one. Nothing is hidden from the student.
  const target = anyUnit
    ? (units?.units.find((u) => u.state === 'available')?.resource ?? resource)
    : resource
  const warnings = chosen
    ? scheduleWarnings(data, chosen.startDate, chosen.start, chosen.end, chosen.endDate)
    : []

  const confirm = async () => {
    if (!chosen || busy) return
    setBusy(true)
    const r = await act(
      () =>
        repo.reserve(profileId, {
          resourceId: target.id,
          date: chosen.startDate,
          start: chosen.start,
          idempotencyKey: key,
          ...(partner.trim() ? { partnerNote: partner.trim() } : {}),
          ...(people ? { participants: Number(people) } : {}),
        }),
      `Reservation saved on this device: ${target.label}, ${spanText(chosen)}.`,
    )
    setBusy(false)
    if (r.ok) {
      setLastId(r.value.reservation.id)
      setSlot('')
      setPartner('')
      setPeople('')
      setKey(newId('idem'))
    }
  }

  const waitlist = async (s: SlotView) => {
    await act(
      () => repo.joinWaitlist(profileId, resource.id, s.startDate, s.start),
      'Added to the recorded local waitlist. This is not a reservation.',
    )
  }

  return (
    <SectionCard
      id={`book-${activity}`}
      title={`Book a ${resourceNoun[activity]}`}
      action={<Pill tone="demo">Local reservation</Pill>}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label={
            activity === 'musicRoom'
              ? 'Room'
              : `${activityLabel[activity]} ${resourceNoun[activity]}`
          }
        >
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={anyUnit ? ANY : resource.id}
              onChange={(e) => {
                setResourceId(e.target.value)
                setSlot('')
              }}
            >
              {unitAware ? (
                <option value={ANY}>Any available {resourceNoun[activity]} (demo picks one)</option>
              ) : null}
              {resources.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                  {r.status !== 'open' ? ` (${r.status})` : ''}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Date">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={date}
              onChange={(e) => {
                setDate(e.target.value as DateOnly)
                setSlot('')
              }}
            >
              {days.map((d) => (
                <option key={d} value={d}>
                  {formatDateShort(d)}
                </option>
              ))}
            </select>
          )}
        </Field>
      </div>
      <div className="mt-3 rounded-md bg-mist p-3">
        <ResourceInfo r={resource} activity={activity} />
        <Link
          to={`/bookings/resources/${resource.id}`}
          className="text-sm font-medium text-coffee underline"
        >
          Resource details
        </Link>
      </div>
      {resource.status === 'closed' ? (
        <p
          role="alert"
          className="mt-3 rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Closed.</strong> {resource.closureNote} New bookings are paused. Existing bookings
          are flagged, not cancelled.
        </p>
      ) : null}

      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-medium">
          Published slots for {formatDateShort(date)}
        </legend>
        {slots.length === 0 ? (
          <Empty>No slot rules are available for this resource, so none are offered.</Empty>
        ) : (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <Button
                key={keyOf(s)}
                variant="outline"
                className="min-h-11"
                aria-pressed={slot === keyOf(s)}
                disabled={s.state !== 'free' || s.mine}
                onClick={() => {
                  setSlot(keyOf(s))
                  setMessage('')
                }}
              >
                {formatTime(s.start)}
                {s.startDate !== date ? ` (${formatDateShort(s.startDate)})` : ''}
                {slotNote(s)}
              </Button>
            ))}
          </div>
        )}
        <p className="mt-1 text-xs text-ink-muted">
          “Free” means no recorded booking in this reference data. It does not show whether anyone
          is physically using the {resourceNoun[activity]}.
        </p>
      </fieldset>

      {policy.allowWaitlist ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {slots
            .filter((s) => s.state === 'reserved' && !s.mine)
            .map((s) => (
              <Button
                key={keyOf(s)}
                variant="ghost"
                size="sm"
                className="min-h-11"
                onClick={() => void waitlist(s)}
              >
                Join local waitlist for {formatTime(s.start)}
              </Button>
            ))}
        </div>
      ) : null}

      {chosen ? (
        <div className="mt-3 rounded-md border border-border bg-coffee-tint p-3">
          <p className="font-medium">
            Review: {target.label}, {spanText(chosen)}
          </p>
          {anyUnit ? (
            <p className="mt-1 text-sm">
              You chose any {resourceNoun[activity]}, so the demo will reserve{' '}
              <strong>{target.label}</strong>. Only that one is held.
            </p>
          ) : null}
          {units ? (
            <div data-testid="unit-status" className="mt-2 rounded-md bg-surface p-2 text-sm">
              <p className="font-medium">
                {units.reservable} of {units.total} {resourceNoun[activity]}s reservable locally
                schedule
              </p>
              <ul className="mt-1 space-y-0.5">
                {units.units.map((u) => (
                  <li key={u.resource.id}>
                    {u.resource.label}: {unitStateLabel[u.state]}
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-ink-muted">
                {units.total} {resourceNoun[activity]}s are listed in the reference data.
                Maintenance on one changes what can be reserved, not how many exist. This is a
                recorded schedule, not live availability.
              </p>
            </div>
          ) : null}
          {warnings.length ? (
            <p role="alert" className="mt-1 rounded-md bg-terracotta-tint p-2 text-sm">
              This overlaps with {warnings.join(', ')} in your Calendar. You can still book it.
            </p>
          ) : null}
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {policy.allowPartner ? (
              <Field
                label={
                  activity === 'musicRoom' || activity === 'chillZone'
                    ? 'Private session label (optional)'
                    : 'Partner or group note (optional)'
                }
                hint={
                  activity === 'musicRoom' || activity === 'chillZone'
                    ? 'Only you can see this. It is never shown on availability.'
                    : 'A personal note only. Nobody is invited or verified.'
                }
              >
                {(a) => (
                  <input
                    {...a}
                    className={inputClass}
                    maxLength={80}
                    value={partner}
                    onChange={(e) => setPartner(e.target.value)}
                  />
                )}
              </Field>
            ) : null}
            <Field
              label="Participants (optional)"
              hint={
                policy.participantMax
                  ? `Up to ${policy.participantMax} on this device.`
                  : 'No participant limit has been provided.'
              }
            >
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={1}
                  className={inputClass}
                  value={people}
                  onChange={(e) => setPeople(e.target.value)}
                />
              )}
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            A local reservation: it gives no rights at a real facility and does not show who will be
            there. Reminders are in-app only.
          </p>
          {ACCESS_NOTE[activity] ? (
            <p className="mt-1 text-xs font-medium text-ink">{ACCESS_NOTE[activity]}</p>
          ) : null}
          <Button className="mt-2 min-h-11" disabled={busy} onClick={() => void confirm()}>
            Confirm local reservation
          </Button>
        </div>
      ) : null}

      <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
      {lastId ? (
        <Link to={`/bookings/my/${lastId}`} className="text-sm font-medium text-coffee underline">
          View this booking
        </Link>
      ) : null}
    </SectionCard>
  )
}
