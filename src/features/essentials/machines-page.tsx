import { useState } from 'react'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { reservationStateLabel, type Machine, type Reservation } from '@/domain/ess'
import { addDays, formatDateShort, formatInstant, formatTime, type DateOnly } from '@/lib/time'
import {
  cycleEstimate,
  operationalText,
  pastReservations,
  physicalText,
  reservationWarning,
  slotViews,
  upcomingReservations,
} from '@/selectors/ess'
import { Empty, Loading, Pill, SectionCard, SubNav, TripScenario } from './ess-common'
import { useAction, useEss } from './ess-hooks'
import { laundryTabs } from './ess-nav'
import { MachineOps } from './ess-ops'

function MachineCard({
  m,
  selected,
  onSelect,
}: {
  m: Machine
  selected: boolean
  onSelect: () => void
}) {
  const blocked = m.operationalStatus !== 'working'
  return (
    <li
      className={`rounded-lg border p-3 ${selected ? 'border-coffee bg-coffee-tint' : 'border-border bg-surface'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{m.label}</span>
        <Pill tone="demo">Demo · sample</Pill>
      </div>
      <p className="text-sm text-ink-muted">{m.location}</p>
      <p className="mt-1 text-sm">
        <strong>Operation:</strong> {operationalText[m.operationalStatus]}
      </p>
      <p className="text-sm">
        <strong>Physically:</strong> {physicalText[m.physicalStatus]}
      </p>
      <p className="text-xs text-ink-muted">
        {m.sourceLabel} · as of {formatInstant(m.asOf)}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Reserved does not mean in use, and not reserved does not mean free.
      </p>
      <Button
        variant="outline"
        size="sm"
        className="mt-2 min-h-11"
        aria-pressed={selected}
        disabled={blocked}
        onClick={onSelect}
      >
        {blocked ? 'Not bookable' : selected ? 'Selected' : `Choose ${m.label}`}
      </Button>
      {blocked ? (
        <p className="mt-1 text-xs text-ink-muted">
          {m.operationalStatus === 'outOfService'
            ? 'Out of service: new bookings are paused.'
            : 'Working status unknown: it cannot be booked.'}
        </p>
      ) : null}
    </li>
  )
}

function ReservationRow({ r }: { r: Reservation }) {
  const { ess, repo, profileId, now } = useEss()
  const confirm = useConfirm()
  const { act } = useAction()
  if (!ess) return null
  const m = ess.machines.find((x) => x.id === r.machineId)
  const warn = reservationWarning(ess, r)
  const c = cycleEstimate(r, now.ms)
  const go = (a: 'cancel' | 'checkIn' | 'startCycle' | 'finish', done: string) =>
    act(() => repo.reservationAction(profileId, r.id, a), done)
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">
          {m?.label ?? 'Machine'} · {formatDateShort(r.date)}, {formatTime(r.start)}–
          {formatTime(r.end)}
        </span>
        <Pill>{reservationStateLabel[r.state]}</Pill>
      </div>
      <p className="text-xs text-ink-muted">
        Reservation ID {r.id} · a local reservation, not a campus booking.
      </p>
      {warn ? (
        <p
          role="alert"
          className="mt-1 rounded-md border border-border-strong bg-terracotta-tint p-2 text-sm"
        >
          {warn}
        </p>
      ) : null}
      {c ? (
        <p className="mt-1 text-sm" aria-live="polite">
          {c.reached
            ? 'Estimated finish reached. This is your estimate, not confirmation the machine finished.'
            : `Estimated cycle end ${formatInstant(c.endIso)} (${c.minutes}-minute sample cycle).`}{' '}
          Another person may still need to clear the machine.
        </p>
      ) : null}
      <div className="mt-2 flex flex-wrap gap-2">
        {r.state === 'reserved' ? (
          <>
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => void go('checkIn', 'Checked in (your own report).')}
            >
              Check in
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={async () => {
                const ok = await confirm({
                  title: 'Cancel this reservation?',
                  description:
                    'The slot is released. This does not say anything about the machine itself.',
                  confirmLabel: 'Cancel reservation',
                  danger: true,
                })
                if (ok === 'confirm') await go('cancel', 'Reservation cancelled.')
              }}
            >
              Cancel reservation
            </Button>
          </>
        ) : null}
        {r.state === 'checkedIn' ? (
          <Button
            size="sm"
            className="min-h-11"
            onClick={() => void go('startCycle', 'Cycle start logged (your own report).')}
          >
            Log cycle start
          </Button>
        ) : null}
        {r.state === 'used' || r.state === 'checkedIn' ? (
          <Button
            size="sm"
            variant="outline"
            className="min-h-11"
            onClick={() => void go('finish', 'Marked finished (your own report).')}
          >
            I’m done
          </Button>
        ) : null}
      </div>
    </li>
  )
}

export function MachinesPage() {
  const { ess, status, profileId, now, repo, newId, showDemoOps } = useEss()
  const { act, message } = useAction()
  const [machineId, setMachineId] = useState<string>('')
  const [date, setDate] = useState<DateOnly>(now.today)
  const [slot, setSlot] = useState<string>('')
  const [key, setKey] = useState(() => newId('idem'))
  const [filter, setFilter] = useState<'all' | 'bookable'>('all')
  if (status === 'loading' || !ess) return <Loading />

  const machines = ess.machines.filter((m) => filter === 'all' || m.operationalStatus === 'working')
  const selected = ess.machines.find((m) => m.id === machineId)
  const days = Array.from({ length: ess.rules.horizonDays + 1 }, (_, i) => addDays(now.today, i))
  const slots = selected ? slotViews(ess, selected.id, date, profileId, now.ms) : []
  const upcoming = upcomingReservations(ess, profileId, now.ms)
  const past = pastReservations(ess, profileId, now.ms)
  const chosen = slots.find((s) => s.start === slot)

  const confirmReserve = async () => {
    if (!selected || !chosen) return
    const r = await act(
      () => repo.reserve(profileId, selected.id, date, chosen.start, key),
      `Reserved ${selected.label} on ${date} at ${chosen.start}.`,
    )
    if (r.ok) {
      setSlot('')
      setKey(newId('idem'))
    }
  }

  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Washing machines"
        description="Reserve a slot. A reservation is only a booking on this device's local data: it does not show whether a machine is physically free."
        badge={<Pill tone="demo">Campus data</Pill>}
      />
      <SubNav label="Laundry sections" items={laundryTabs} current="machines" />

      <SectionCard id="rules-h" title="Planning rules (not campus policy)">
        <p>
          {ess.rules.maxActivePerStudent} upcoming booking at a time · {ess.rules.graceMinutes}
          -minute grace period · up to {ess.rules.horizonDays} days ahead · {ess.rules.slotMinutes}
          -minute slots · {ess.rules.cycleMinutes}-minute sample wash cycle. These are sample values
          you can change in the simulator; real rules have not been supplied. Collisions are checked
          only in this browser’s data, not across devices.
        </p>
      </SectionCard>

      <SectionCard
        id="board-h"
        title="Machine board"
        action={
          <label className="flex items-center gap-2 text-sm">
            Show
            <select
              className={`${inputClass} w-40`}
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">All machines</option>
              <option value="bookable">Bookable only</option>
            </select>
          </label>
        }
      >
        {machines.length === 0 ? (
          <Empty>No machines match.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {machines.map((m) => (
              <MachineCard
                key={m.id}
                m={m}
                selected={m.id === machineId}
                onSelect={() => {
                  setMachineId(m.id)
                  setSlot('')
                }}
              />
            ))}
          </ul>
        )}
      </SectionCard>

      {selected ? (
        <SectionCard id="slot-h" title={`Pick a slot on ${selected.label}`}>
          <Field label="Date">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} sm:w-60`}
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
          <fieldset className="mt-3">
            <legend className="mb-1 text-sm font-medium">Demo time slots</legend>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <Button
                  key={s.start}
                  variant="outline"
                  className="min-h-11"
                  aria-pressed={slot === s.start}
                  disabled={s.state !== 'free'}
                  onClick={() => setSlot(s.start)}
                >
                  {formatTime(s.start)}
                  {s.state === 'reserved'
                    ? s.mine
                      ? ' · yours'
                      : ' · reserved'
                    : s.state === 'past'
                      ? ' · past'
                      : ''}
                </Button>
              ))}
            </div>
          </fieldset>
          {chosen ? (
            <div className="mt-3 rounded-md bg-coffee-tint p-3">
              <p className="font-medium">
                Review: {selected.label}, {formatDateShort(date)}, {formatTime(chosen.start)}–
                {formatTime(chosen.end)}
              </p>
              <p className="text-xs text-ink-muted">
                This is a local reservation. It does not tell anyone the machine is free, and it is
                released if you cancel.
              </p>
              <Button className="mt-2 min-h-11" onClick={() => void confirmReserve()}>
                Confirm local reservation
              </Button>
            </div>
          ) : null}
          <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
            {message}
          </output>
        </SectionCard>
      ) : (
        <Empty>Choose a bookable machine above to see its slots.</Empty>
      )}

      <SectionCard id="myres-h" title="My reservations">
        {upcoming.length === 0 && past.length === 0 ? (
          <Empty>You have no machine reservations yet.</Empty>
        ) : (
          <>
            <ul className="flex flex-col gap-2">
              {upcoming.map((r) => (
                <ReservationRow key={r.id} r={r} />
              ))}
            </ul>
            {past.length > 0 ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">Earlier</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {past.map((r) => (
                    <ReservationRow key={r.id} r={r} />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </SectionCard>

      <TripScenario id="wm-tt-h" noun="machine trips and waiting" />
      {showDemoOps ? <MachineOps /> : null}
    </article>
  )
}
