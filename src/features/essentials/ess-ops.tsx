import { useState } from 'react'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import {
  LOAD_STAGES,
  loadStageChip,
  parcelStateLabel,
  reservationStateLabel,
  type Confidence,
  type Machine,
} from '@/domain/ess'
import { formatDateShort, isDateOnly, isoFromMs, type DateOnly, type LocalTime } from '@/lib/time'
import { graceExpired } from '@/selectors/ess'
import { OpsCard, Pill } from './ess-common'
import { useAction, useEss } from './ess-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

function ResetEssentials() {
  const { repo } = useEss()
  const confirm = useConfirm()
  const { act } = useAction()
  return (
    <div className="border-t border-border-strong pt-3">
      <Button
        variant="outline"
        className="min-h-11"
        onClick={async () => {
          const c = await confirm({
            title: 'Reset the Campus Essentials local records?',
            description:
              'This removes laundry loads, the visit, machine reservations, mess check-ins and feedback, the illustrative fee and parcels for every persona. Home, Calendar, Chill Spot and your other data are not touched.',
            confirmLabel: 'Reset Essentials records',
            danger: true,
          })
          if (c === 'confirm')
            await act(() => repo.resetScenario(), 'Campus Essentials local records were reset.')
        }}
      >
        Reset Essentials local records…
      </Button>
      <p className="mt-1 text-xs text-ink-muted">
        Scoped: only laundry, machine, mess and parcel local records.
      </p>
    </div>
  )
}

/* ───────────────────────────── Laundry ───────────────────────────── */

export function LaundryOps() {
  const { ess, repo, now } = useEss()
  const { act, message } = useAction()
  const [visitStatus, setVisitStatus] = useState<
    'tentative' | 'confirmed' | 'rescheduled' | 'cancelled'
  >('tentative')
  const [visitDate, setVisitDate] = useState<string>(now.tomorrow)
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('12:00')
  const [dates, setDates] = useState<Record<string, string>>({})
  const [conf, setConf] = useState<Record<string, Confidence>>({})
  if (!ess) return null

  const dateFor = (id: string) => dates[id] ?? now.tomorrow
  const confFor = (id: string) => conf[id] ?? 'tentative'

  return (
    <OpsCard id="ops-laundry-h" title="Local Operations: SS Laundry" message={message}>
      <fieldset className="flex flex-wrap items-end gap-2">
        <legend className="mb-1 text-sm font-semibold">
          Provider visit (simulated announcement)
        </legend>
        <Field label="Status">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-40`}
              value={visitStatus}
              onChange={(e) => setVisitStatus(e.target.value as typeof visitStatus)}
            >
              {['tentative', 'confirmed', 'rescheduled', 'cancelled'].map((s) => (
                <option key={s} value={s}>
                  {s}
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
              className={`${inputClass} w-44`}
              value={visitDate}
              onChange={(e) => setVisitDate(e.target.value)}
            />
          )}
        </Field>
        <Field label="From">
          {(a) => (
            <input
              {...a}
              type="time"
              className={`${inputClass} w-32`}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          )}
        </Field>
        <Field label="To">
          {(a) => (
            <input
              {...a}
              type="time"
              className={`${inputClass} w-32`}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          )}
        </Field>
        <Button
          className="min-h-11"
          disabled={visitStatus !== 'cancelled' && !isDateOnly(visitDate)}
          onClick={() =>
            void act(
              () =>
                repo.announceVisit({
                  status: visitStatus,
                  ...(visitStatus !== 'cancelled' && isDateOnly(visitDate)
                    ? {
                        date: visitDate,
                        windowStart: start as LocalTime,
                        windowEnd: end as LocalTime,
                      }
                    : {}),
                }),
              'Visit announcement recorded.',
            )
          }
        >
          Announce visit
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={() =>
            void act(
              () => repo.recordVisitArrival(),
              'Provider arrival recorded. No load was changed.',
            )
          }
        >
          Record provider on campus
        </Button>
      </fieldset>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Loads (all personas)</h3>
        {ess.loads.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No loads registered yet. Register one as a student first.
          </p>
        ) : null}
        <ul className="flex flex-col gap-3">
          {ess.loads.map((l) => {
            const next = LOAD_STAGES[LOAD_STAGES.indexOf(l.stage) + 1]
            const finished = l.cancelled || l.stage === 'collected'
            return (
              <li key={l.id} className="rounded-md border border-border bg-surface p-3">
                <p className="font-medium">
                  {nameOf(l.ownerProfileId)} · {l.reference ?? l.id}{' '}
                  <Pill>{l.cancelled ? 'Withdrawn' : loadStageChip[l.stage]}</Pill>
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  {next && !finished ? (
                    <Button
                      size="sm"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () => repo.advanceLoad(l.id, next),
                          `Marked “${loadStageChip[next]}”.`,
                        )
                      }
                    >
                      Mark {loadStageChip[next].toLowerCase()}
                    </Button>
                  ) : null}
                  {!finished ? (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () => repo.setLoadDelay(l.id, true),
                            'Marked delayed with no new date.',
                          )
                        }
                      >
                        Delay (no new date)
                      </Button>
                      <Field label="Revised date">
                        {(a) => (
                          <input
                            {...a}
                            type="date"
                            className={`${inputClass} w-44`}
                            value={dateFor(l.id)}
                            onChange={(e) => setDates({ ...dates, [l.id]: e.target.value })}
                          />
                        )}
                      </Field>
                      <Field label="Confidence">
                        {(a) => (
                          <select
                            {...a}
                            className={`${inputClass} w-36`}
                            value={confFor(l.id)}
                            onChange={(e) =>
                              setConf({ ...conf, [l.id]: e.target.value as Confidence })
                            }
                          >
                            <option value="tentative">tentative</option>
                            <option value="confirmed">confirmed</option>
                          </select>
                        )}
                      </Field>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        disabled={!isDateOnly(dateFor(l.id))}
                        onClick={() =>
                          void act(
                            () =>
                              repo.scheduleLoadReturn(
                                l.id,
                                dateFor(l.id) as DateOnly,
                                confFor(l.id),
                              ),
                            'Return date recorded (an expectation only).',
                          )
                        }
                      >
                        Set return date
                      </Button>
                      {l.delayFlag ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="min-h-11"
                          onClick={() =>
                            void act(() => repo.setLoadDelay(l.id, false), 'Delay cleared.')
                          }
                        >
                          Clear delay
                        </Button>
                      ) : null}
                    </>
                  ) : null}
                  {!l.cancelled ? (
                    l.discrepancyFlag ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () => repo.setLoadDiscrepancy(l.id, false),
                            'Discrepancy resolved.',
                          )
                        }
                      >
                        Resolve discrepancy
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () =>
                              repo.setLoadDiscrepancy(
                                l.id,
                                true,
                                'Only part of the load has been returned',
                              ),
                            'Partial return flagged.',
                          )
                        }
                      >
                        Flag partial return
                      </Button>
                    )
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
      <ResetEssentials />
    </OpsCard>
  )
}

/* ───────────────────────────── Machines ───────────────────────────── */

function MachineRow({ m }: { m: Machine }) {
  const { repo } = useEss()
  const { act } = useAction()
  const op = (s: Machine['operationalStatus']) =>
    act(() => repo.setMachineStatus(m.id, { operationalStatus: s }), `${m.label}: ${s}.`)
  const ph = (s: Machine['physicalStatus']) =>
    act(() => repo.setMachineStatus(m.id, { physicalStatus: s }), `${m.label}: physically ${s}.`)
  return (
    <li className="rounded-md border border-border bg-surface p-3">
      <p className="font-medium">{m.label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(['working', 'outOfService', 'unknown'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className="min-h-11"
            aria-pressed={m.operationalStatus === s}
            onClick={() => void op(s)}
          >
            Operation: {s}
          </Button>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {(['available', 'occupied', 'unknown'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            className="min-h-11"
            aria-pressed={m.physicalStatus === s}
            onClick={() => void ph(s)}
          >
            Physical: {s}
          </Button>
        ))}
      </div>
    </li>
  )
}

export function MachineOps() {
  const { ess, repo, now } = useEss()
  const { act, message } = useAction()
  const [rules, setRules] = useState<Record<string, string>>({})
  if (!ess) return null
  const field = (key: keyof typeof ess.rules, label: string) => (
    <Field label={label} key={key}>
      {(a) => (
        <input
          {...a}
          type="number"
          className={`${inputClass} w-28`}
          value={rules[key] ?? String(ess.rules[key])}
          onChange={(e) => setRules({ ...rules, [key]: e.target.value })}
        />
      )}
    </Field>
  )
  return (
    <OpsCard id="ops-machines-h" title="Local Operations: machines" message={message}>
      <div>
        <h3 className="mb-1 text-sm font-semibold">
          Machine status (operation and physical state are separate)
        </h3>
        <ul className="flex flex-col gap-2">
          {ess.machines.map((m) => (
            <MachineRow key={m.id} m={m} />
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Reservations (all personas)</h3>
        {ess.reservations.length === 0 ? <p className="text-sm text-ink-muted">None yet.</p> : null}
        <ul className="flex flex-col gap-2">
          {ess.reservations.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-surface p-3">
              <p className="font-medium">
                {nameOf(r.ownerProfileId)} · {ess.machines.find((m) => m.id === r.machineId)?.label}{' '}
                · {formatDateShort(r.date)} {r.start} <Pill>{reservationStateLabel[r.state]}</Pill>
              </p>
              {r.state === 'reserved' ? (
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={!graceExpired(ess, r, now.ms)}
                    onClick={() =>
                      void act(
                        () => repo.simulateReservation(r.id, 'noShow'),
                        'Marked no-show. The machine’s physical status was not changed.',
                      )
                    }
                  >
                    Release as no-show
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(
                        () => repo.simulateReservation(r.id, 'blockedByOutage'),
                        'Marked as affected by an outage.',
                      )
                    }
                  >
                    Mark affected by outage
                  </Button>
                  {!graceExpired(ess, r, now.ms) ? (
                    <span className="self-center text-xs text-ink-muted">
                      No-show needs the {ess.rules.graceMinutes}-minute grace period to pass.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const patch = Object.fromEntries(Object.entries(rules).map(([k, v]) => [k, Number(v)]))
          void act(() => repo.setRules(patch), 'Planning rules updated.')
        }}
      >
        <legend className="sr-only">Planning rules</legend>
        {field('maxActivePerStudent', 'Active bookings')}
        {field('graceMinutes', 'Grace (min)')}
        {field('horizonDays', 'Days ahead')}
        {field('slotMinutes', 'Slot (min)')}
        {field('cycleMinutes', 'Cycle (min)')}
        {field('parcelReminderHours', 'Parcel reminder (h)')}
        {field('messSessionStaleMinutes', 'Mess stale (min)')}
        <Button type="submit" className="min-h-11">
          Apply planning rules
        </Button>
      </form>
      <ResetEssentials />
    </OpsCard>
  )
}

/* ───────────────────────────── Mess ───────────────────────────── */

export function MessOps() {
  const { ess, repo } = useEss()
  const { act, message } = useAction()
  const [rupees, setRupees] = useState('')
  const [due, setDue] = useState('')
  const [instructions, setInstructions] = useState('')
  const [late, setLate] = useState('')
  const [url, setUrl] = useState('')
  if (!ess) return null
  const amountMinor = rupees === '' ? undefined : Math.round(Number(rupees) * 100)
  const badAmount = rupees !== '' && (!Number.isFinite(Number(rupees)) || Number(rupees) < 0)
  const badUrl = url !== '' && !/^https:\/\/[^\s]+$/.test(url)
  return (
    <OpsCard id="ops-mess-h" title="Local Operations: mess" message={message}>
      <fieldset>
        <legend className="mb-1 text-sm font-semibold">
          Busy indicator (a manual report, not a count)
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {(['quiet', 'moderate', 'busy', 'unknown'] as const).map((s) => (
            <Button
              key={s}
              variant="outline"
              className="min-h-11 capitalize"
              aria-pressed={ess.messBusy?.state === s}
              onClick={() => void act(() => repo.setBusyReport(s), `Reported ${s}.`)}
            >
              {s}
            </Button>
          ))}
        </div>
      </fieldset>
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (badAmount || badUrl) return
          void act(
            () =>
              repo.supplyFee({
                ...(amountMinor !== undefined ? { amountMinor } : {}),
                ...(isDateOnly(due) ? { dueDate: due } : {}),
                ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
                ...(late.trim() ? { lateFee: late.trim() } : {}),
                ...(url ? { authorizedFormUrl: url } : {}),
              }),
            'Fee details entered. Nothing was invented: only what you typed is shown.',
          )
        }}
      >
        <p className="text-sm sm:col-span-2">
          <strong>Enter fee details yourself.</strong> CampusOS has no real amount, deadline or form
          link, so it shows only what you type here.
        </p>
        <Field
          label="Amount in rupees (optional)"
          error={badAmount ? 'Enter a number, or leave blank' : undefined}
        >
          {(a) => (
            <input
              {...a}
              inputMode="decimal"
              className={inputClass}
              value={rupees}
              onChange={(e) => setRupees(e.target.value)}
            />
          )}
        </Field>
        <Field label="Due date (optional)">
          {(a) => (
            <input
              {...a}
              type="date"
              className={inputClass}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          )}
        </Field>
        <Field label="Instructions (optional)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          )}
        </Field>
        <Field label="Late fee note (optional)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={late}
              onChange={(e) => setLate(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Payment form link (optional, https only)"
          error={badUrl ? 'Use a full https:// address, or leave blank' : undefined}
        >
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Field>
        <div className="flex items-end gap-2">
          <Button type="submit" className="min-h-11" disabled={badAmount || badUrl}>
            Save fee details
          </Button>
          {ess.fee ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => void act(() => repo.clearFee(), 'Fee details cleared.')}
            >
              Clear fee details
            </Button>
          ) : null}
        </div>
      </form>
      <ResetEssentials />
    </OpsCard>
  )
}

/* ───────────────────────────── Parcels ───────────────────────────── */

export function ParcelOps() {
  const { ess, repo, now } = useEss()
  const { act, message } = useAction()
  const [recipient, setRecipient] = useState(demoProfiles[0]!.id)
  const [courier, setCourier] = useState('')
  const [suffix, setSuffix] = useState('')
  const [point, setPoint] = useState('')
  const [aged, setAged] = useState(false)
  const [notes, setNotes] = useState<Record<string, string>>({})
  if (!ess) return null
  const hours = ess.rules.parcelReminderHours + 24
  return (
    <OpsCard id="ops-parcel-h" title="Local Operations: parcels" message={message}>
      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          const loggedAt = aged ? isoFromMs(now.ms - hours * 3_600_000) : undefined
          void act(
            () =>
              repo.logParcel({
                recipientProfileId: recipient,
                ...(courier.trim() ? { courier: courier.trim() } : {}),
                ...(suffix.trim() ? { referenceSuffix: suffix.trim() } : {}),
                ...(point.trim() ? { collectionPoint: point.trim() } : {}),
                ...(loggedAt ? { loggedAt } : {}),
              }),
            `Parcel logged for ${nameOf(recipient)}.`,
          )
        }}
      >
        <p className="text-sm sm:col-span-2">
          Stands in for a gate or office log. Only the chosen persona will see it.
        </p>
        <Field label="Recipient profile">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
            >
              {demoProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Courier (optional)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={40}
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
            />
          )}
        </Field>
        <Field label="Reference suffix (optional, max 8)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={8}
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
            />
          )}
        </Field>
        <Field label="Collection point (optional)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={80}
              value={point}
              onChange={(e) => setPoint(e.target.value)}
            />
          )}
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input
            type="checkbox"
            className="size-5"
            checked={aged}
            onChange={(e) => setAged(e.target.checked)}
          />
          Backdate the simulated arrival by {Math.round(hours / 24)} days, to demonstrate an
          uncollected reminder
        </label>
        <div>
          <Button type="submit" className="min-h-11">
            Log parcel
          </Button>
        </div>
      </form>
      <div>
        <h3 className="mb-1 text-sm font-semibold">Parcels (all personas)</h3>
        {ess.parcels.length === 0 ? <p className="text-sm text-ink-muted">None logged.</p> : null}
        <ul className="flex flex-col gap-2">
          {ess.parcels.map((p) => (
            <li key={p.id} className="rounded-md border border-border bg-surface p-3">
              <p className="font-medium">
                {nameOf(p.recipientProfileId)} · {p.courier ?? 'Parcel'}{' '}
                <Pill>{parcelStateLabel[p.state]}</Pill>
              </p>
              {p.state !== 'collected' ? (
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() =>
                      void act(() => repo.recordParcelCollected(p.id), 'Handover recorded.')
                    }
                  >
                    Record collected
                  </Button>
                  <Field label="Exception note">
                    {(a) => (
                      <input
                        {...a}
                        className={`${inputClass} w-60`}
                        value={notes[p.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [p.id]: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={!(notes[p.id] ?? '').trim()}
                    onClick={() =>
                      void act(
                        () => repo.markParcelException(p.id, (notes[p.id] ?? '').trim()),
                        'Marked as needing attention.',
                      )
                    }
                  >
                    Mark exception
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
      <ResetEssentials />
    </OpsCard>
  )
}
