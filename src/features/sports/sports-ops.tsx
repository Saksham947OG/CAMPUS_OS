import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { useConfirm } from '@/components/confirm-context'
import { Button } from '@/components/ui/button'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { EQUIPMENT_STATUSES, equipmentStatusLabel, reservationStateLabel } from '@/domain/sports'
import { offerExpired } from '@/domain/sports-logic'
import {
  formatDateShort,
  formatInstant,
  formatTime,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { OpsCard, Pill } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useSports } from './sports-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

/**
 * LOCAL DEMO CONTROLS for Sports (COS-SPORTS-001 §7). A single-browser presentation tool, not staff
 * software and not a security boundary. Every action is one visible click, simulated and logged.
 */
export function SportsOps() {
  const { sports, repo, now } = useSports()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [count, setCount] = useState('')
  const [level, setLevel] = useState<'' | 'quiet' | 'moderate' | 'busy'>('')
  const [offerLife, setOfferLife] = useState('')
  const [grace, setGrace] = useState('')
  const [facility, setFacility] = useState('DEMO-GYM')
  const [eqName, setEqName] = useState('')
  const [loanProfile, setLoanProfile] = useState(demoProfiles[0]!.id)
  const [loanBook, setLoanBook] = useState('DEMO-BOOK-1')
  const [loanDue, setLoanDue] = useState('')
  const [dueEdit, setDueEdit] = useState<Record<string, string>>({})
  if (!sports) return null

  const slotsWithWaiters = Array.from(
    new Map(
      sports.waitlist
        .filter((w) => w.state === 'waiting')
        .map((w) => [`${w.resourceId}|${w.date}|${w.start}`, w] as const),
    ).values(),
  )
  const lapsed = sports.waitlist.filter((w) => offerExpired(w, now.ms))

  return (
    <OpsCard id="ops-sports-h" title="Local Controls: Sports" message={message}>
      <div>
        <h3 className="mb-1 text-sm font-semibold">
          Resources (closure blocks new bookings and flags existing ones)
        </h3>
        <ul className="flex flex-col gap-2">
          {sports.resources.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3"
            >
              <span className="min-w-48 font-medium">
                {r.label} <Pill>{r.status}</Pill>
              </span>
              {r.status === 'closed' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.reopenResource(r.id),
                      `${r.label} reopened (simulated). Existing flags stay until resolved.`,
                    )
                  }
                >
                  Reopen
                </Button>
              ) : (
                <>
                  <Field label="Closure reason">
                    {(a) => (
                      <input
                        {...a}
                        className={`${inputClass} w-56`}
                        value={notes[r.id] ?? ''}
                        onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(
                        () => repo.closeResource(r.id, notes[r.id] ?? ''),
                        `${r.label} closed (simulated).`,
                      )
                    }
                  >
                    Close
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Reservations (all personas)</h3>
        {sports.reservations.length === 0 ? (
          <p className="text-sm text-ink-muted">None yet. Book a slot as a student first.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {sports.reservations.map((r) => (
            <li key={r.id} className="rounded-md border border-border bg-surface p-3">
              <p className="font-medium">
                {nameOf(r.ownerProfileId)} ·{' '}
                {sports.resources.find((x) => x.id === r.resourceId)?.label} ·{' '}
                {formatDateShort(r.date)} {formatTime(r.start)}{' '}
                <Pill>{reservationStateLabel[r.state]}</Pill>
                {r.disrupted ? <Pill tone="warn">disrupted</Pill> : null}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {r.state === 'confirmedDemo' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(
                        () => repo.processNoShow(r.id),
                        'Marked no-show. The booking claim was released; physical use is unknown.',
                      )
                    }
                  >
                    Process no-show
                  </Button>
                ) : null}
                {r.disrupted ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () => repo.resolveDisruption(r.id, 'resolve'),
                          'Disruption resolved.',
                        )
                      }
                    >
                      Resolve disruption
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () => repo.resolveDisruption(r.id, 'cancel'),
                          'Booking cancelled because of the closure.',
                        )
                      }
                    >
                      Cancel because of closure
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">
          Waitlist offers (nothing is promoted automatically)
        </h3>
        {slotsWithWaiters.length === 0 && lapsed.length === 0 ? (
          <p className="text-sm text-ink-muted">No one is waiting.</p>
        ) : null}
        <ul className="flex flex-col gap-2">
          {slotsWithWaiters.map((w) => (
            <li key={w.id}>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void act(
                    () => repo.issueOffer(w.resourceId, w.date as DateOnly, w.start as LocalTime),
                    'Offer issued to the earliest recorded entry.',
                  )
                }
              >
                Offer {sports.resources.find((x) => x.id === w.resourceId)?.label}{' '}
                {formatDateShort(w.date)} {formatTime(w.start)}
              </Button>
            </li>
          ))}
          {lapsed.map((w) => (
            <li key={w.id}>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void act(() => repo.expireOffer(w.id), 'Lapsed offer marked expired.')
                }
              >
                Mark lapsed offer expired ({nameOf(w.profileId)})
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void act(
            () =>
              repo.setOccupancy(
                {
                  count: count === '' ? null : Number(count),
                  ...(level ? { level } : {}),
                },
                facility,
              ),
            'Occupancy snapshot recorded (simulated).',
          )
        }}
      >
        <legend className="sr-only">Occupancy snapshot</legend>
        <Field label="Facility">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-44`}
              value={facility}
              onChange={(e) => setFacility(e.target.value)}
            >
              <option value="DEMO-GYM">Gym</option>
              <option value="DEMO-LIBRARY">Library</option>
            </select>
          )}
        </Field>
        <Field label="Active check-ins (blank = unknown)">
          {(a) => (
            <input
              {...a}
              type="number"
              min={0}
              className={`${inputClass} w-44`}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Level (optional)">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-40`}
              value={level}
              onChange={(e) => setLevel(e.target.value as typeof level)}
            >
              <option value="">none</option>
              <option value="quiet">quiet</option>
              <option value="moderate">moderate</option>
              <option value="busy">busy</option>
            </select>
          )}
        </Field>
        <Button type="submit" className="min-h-11">
          Record simulated snapshot
        </Button>
        <p className="w-full text-xs text-ink-muted">
          Last:{' '}
          {sports.occupancy
            ? `${sports.occupancy.count ?? 'unknown'} as of ${formatInstant(sports.occupancy.asOf)}`
            : 'none'}
        </p>
      </form>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Equipment status (separate from any closure)</h3>
        <ul className="flex flex-col gap-2">
          {sports.equipment.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-1.5">
              <span className="min-w-44 text-sm font-medium">{e.label}</span>
              {EQUIPMENT_STATUSES.map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  aria-pressed={e.status === s}
                  onClick={() =>
                    void act(
                      () => repo.setEquipmentStatus(e.id, s),
                      `${e.label}: ${equipmentStatusLabel[s]} (simulated).`,
                    )
                  }
                >
                  {equipmentStatusLabel[s]}
                </Button>
              ))}
            </li>
          ))}
        </ul>
      </div>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={async (e) => {
          e.preventDefault()
          if (offerLife)
            await act(() => repo.setOfferLifetime(Number(offerLife)), 'Offer lifetime updated.')
          if (grace)
            await act(
              () => repo.setPolicy('badminton', { graceMinutes: Number(grace) }),
              'Badminton grace updated.',
            )
        }}
      >
        <legend className="sr-only">Local sports configuration</legend>
        <Field label={`Offer lifetime, minutes (now ${sports.config.offerLifetimeMinutes})`}>
          {(a) => (
            <input
              {...a}
              type="number"
              min={1}
              className={`${inputClass} w-40`}
              value={offerLife}
              onChange={(e) => setOfferLife(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={`Badminton grace, minutes (now ${sports.config.policies.badminton.graceMinutes})`}
        >
          {(a) => (
            <input
              {...a}
              type="number"
              min={0}
              className={`${inputClass} w-44`}
              value={grace}
              onChange={(e) => setGrace(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" className="min-h-11">
          Apply demo config
        </Button>
      </form>

      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void act(
            () => repo.addEquipment('DEMO-MUSIC-1', eqName),
            'Equipment entry added (simulated). It starts as status unknown.',
          ).then((r) => {
            if (r.ok) setEqName('')
          })
        }}
      >
        <legend className="sr-only">Music room equipment</legend>
        <Field label="Music room equipment (only what you type is shown)">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-64`}
              maxLength={60}
              value={eqName}
              onChange={(e) => setEqName(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="outline" className="min-h-11">
          Add equipment entry
        </Button>
      </form>

      <div>
        <h3 className="mb-1 text-sm font-semibold">
          Library loans (local records, date-only due dates)
        </h3>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act(
              () =>
                repo.addDemoLoan({
                  profileId: loanProfile,
                  bookId: loanBook,
                  dueDate: loanDue as DateOnly,
                }),
              'Demo loan added (simulated). It is not library data.',
            )
          }}
        >
          <Field label="Profile">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} w-48`}
                value={loanProfile}
                onChange={(e) => setLoanProfile(e.target.value)}
              >
                {demoProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Demo book">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} w-56`}
                value={loanBook}
                onChange={(e) => setLoanBook(e.target.value)}
              >
                {sports.catalogue.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Due date (date only)">
            {(a) => (
              <input
                {...a}
                type="date"
                className={`${inputClass} w-44`}
                value={loanDue}
                onChange={(e) => setLoanDue(e.target.value)}
              />
            )}
          </Field>
          <Button
            type="submit"
            variant="outline"
            className="min-h-11"
            disabled={!isDateOnly(loanDue)}
          >
            Add demo loan
          </Button>
        </form>
        <ul className="mt-2 flex flex-col gap-2">
          {sports.loans.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-3"
            >
              <span className="min-w-56 font-medium">
                {nameOf(l.profileId)} · {sports.catalogue.find((b) => b.id === l.bookId)?.title} ·
                due {l.dueDate} {l.returnedOn ? <Pill>returned</Pill> : null}
              </span>
              {!l.returnedOn ? (
                <>
                  <Field label="New due date">
                    {(a) => (
                      <input
                        {...a}
                        type="date"
                        className={`${inputClass} w-44`}
                        value={dueEdit[l.id] ?? ''}
                        onChange={(e) => setDueEdit({ ...dueEdit, [l.id]: e.target.value })}
                      />
                    )}
                  </Field>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={!isDateOnly(dueEdit[l.id] ?? '')}
                    onClick={() =>
                      void act(
                        () => repo.updateLoanDue(l.id, dueEdit[l.id] as DateOnly),
                        'Due date updated on the same loan.',
                      )
                    }
                  >
                    Update due date
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(() => repo.recordLoanReturn(l.id), 'Return recorded (simulated).')
                    }
                  >
                    Record return
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-semibold">Operation log (simulated, latest first)</h3>
        {sports.operations.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <ol className="flex flex-col gap-1 text-sm">
            {sports.operations.slice(0, 8).map((o) => (
              <li key={o.id}>
                <time dateTime={o.at} className="text-ink-muted">
                  {formatInstant(o.at)}
                </time>{' '}
                · {o.action} · {o.entityId}: {o.previous} → {o.next}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="border-t border-border-strong pt-3">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            const c = await confirm({
              title: 'Reset the Sports local records?',
              description:
                'This removes every local sports booking, waitlist entry, gym self-report and fault note, and restores the sample facilities. Home, Calendar, Chill Spot and Essentials data are not touched.',
              confirmLabel: 'Reset Sports records',
              danger: true,
            })
            if (c === 'confirm')
              await act(() => repo.resetScenario(), 'Sports local records were reset.')
          }}
        >
          Reset Sports local records…
        </Button>
        <p className="mt-1 text-xs text-ink-muted">
          Scoped: only Sports. Your imported academic data and widget preferences are not affected.
        </p>
      </div>
    </OpsCard>
  )
}
