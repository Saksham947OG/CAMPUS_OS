import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { useServices } from '@/app/services'
import {
  HANDLING_KINDS,
  handlingLabel,
  type HandlingNote,
  type OrderStatus,
  type ReportedState,
} from '@/domain/chill'
import { canTransition } from '@/domain/chill-logic'
import type { ChillStore } from '@/domain/chill'
import { formatInstant } from '@/lib/time'
import { recordedBacklog } from '@/selectors/chill'
import { OriginBadges, StatusChip } from './orders'

const NEXT: { to: OrderStatus; label: string }[] = [
  { to: 'queued', label: 'Accept' },
  { to: 'preparing', label: 'Start preparing' },
  { to: 'ready', label: 'Mark ready' },
  { to: 'collected', label: 'Mark collected' },
]

/**
 * LOCAL DEMO OPERATIONS (DEC-046). This is a single-browser presentation tool — not the café's system,
 * not a staff account, not live and not synchronised with any other device. It only changes state when
 * a person presses a button; nothing here has a timer. Every change is simulated, timestamped and logged.
 */
export function DemoOpsPanel({ café }: { café: ChillStore }) {
  const { chill } = useServices()
  const toast = useToast()
  const confirm = useConfirm()
  const [message, setMessage] = useState('')
  const [counter, setCounter] = useState('')
  const [pauseReason, setPauseReason] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [walkInItem, setWalkInItem] = useState('hot-a')
  const [handling, setHandling] = useState<HandlingNote['kind'] | ''>('')
  const [handlingText, setHandlingText] = useState('')
  const [flagText, setFlagText] = useState('')
  const menu = chill.getMenu()
  const backlog = recordedBacklog(café.orders)

  const run = async (
    fn: () => Promise<{ ok: boolean; error?: { message: string } }>,
    done: string,
  ) => {
    const r = await fn()
    if (r.ok) {
      setMessage(done)
      toast.notify('info', `${done} (simulated)`)
    } else setMessage(r.error?.message ?? 'That could not be done.')
  }

  const events = café.orders
    .flatMap((o) => o.history.map((h) => ({ o, h })))
    .sort((a, b) =>
      a.h.occurredAt < b.h.occurredAt ? 1 : a.h.occurredAt > b.h.occurredAt ? -1 : 0,
    )
    .slice(0, 12)

  return (
    <section
      aria-labelledby="ops-h"
      className="rounded-lg border-2 border-dashed border-border-strong bg-mist p-4"
      data-testid="demo-ops"
    >
      <h2 id="ops-h" className="flex items-center gap-2 text-base font-semibold text-ink">
        <FlaskConical className="size-4" aria-hidden="true" /> Demo operations · local simulator
      </h2>
      <p className="mt-1 text-sm text-ink">
        For presentations only. This is <strong>not</strong> the real café, a staff login or a live
        system, and it does not sync with other devices. Nothing changes unless you press a button.
        Everything you do here is recorded as <strong>simulated</strong>.
      </p>
      <output className="mt-2 block min-h-5 text-sm font-medium text-ink" aria-live="polite">
        {message}
      </output>

      <div className="mt-3 grid gap-4 lg:grid-cols-2">
        <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-semibold text-ink">
            2. Queue snapshot (manual reports)
          </legend>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="People at the counter" className="w-40">
              {(a) => (
                <input
                  {...a}
                  type="number"
                  min={0}
                  max={500}
                  className={inputClass}
                  value={counter}
                  onChange={(e) => setCounter(e.target.value)}
                />
              )}
            </Field>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={
                counter === '' ||
                !Number.isInteger(Number(counter)) ||
                Number(counter) < 0 ||
                Number(counter) > 500
              }
              onClick={() =>
                void run(
                  () => chill.setCounterObservation(Number(counter), 'reportedComplete'),
                  `Counter line reported as ${counter}`,
                )
              }
            >
              Report line
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void run(
                  () => chill.setCounterObservation(null, 'unknown'),
                  'Counter line set to unknown',
                )
              }
            >
              Set unknown
            </Button>
          </div>
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-ink-muted">Busy indicator</legend>
            <div className="flex flex-wrap gap-1.5">
              {(['quiet', 'moderate', 'busy', 'unknown'] as ReportedState[]).map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  className="min-h-11 capitalize"
                  aria-pressed={café.busy?.reportedState === s}
                  onClick={() =>
                    void run(() => chill.setReportedState(s), `Reported state set to ${s}`)
                  }
                >
                  {s}
                </Button>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Reason shown to students" className="min-w-48 flex-1">
              {(a) => (
                <input
                  {...a}
                  className={inputClass}
                  value={pauseReason}
                  onChange={(e) => setPauseReason(e.target.value)}
                  placeholder="Sample reason"
                />
              )}
            </Field>
            <Button
              className="min-h-11"
              disabled={!!café.pause}
              onClick={() => void run(() => chill.setPause(pauseReason), 'New requests paused')}
            >
              Pause new requests
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              disabled={!café.pause}
              onClick={() => void run(() => chill.setPause(null), 'New requests resumed')}
            >
              Resume
            </Button>
          </div>
          <p className="text-xs text-ink-muted">
            Backlog now: {backlog.unfinished} recorded unfinished ({backlog.walkInRecorded} walk-in,{' '}
            {backlog.digital} digital). Moving orders never edits the reported counter line.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3">
          <legend className="px-1 text-sm font-semibold text-ink">1. Demand</legend>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-sm text-ink">
              Sample walk-in item
              <select
                className={inputClass}
                value={walkInItem}
                onChange={(e) => setWalkInItem(e.target.value)}
              >
                {menu.items
                  .filter(
                    (i) => i.visible && i.priceMinor !== null && i.availability === 'available',
                  )
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name}
                    </option>
                  ))}
              </select>
            </label>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void run(() => chill.recordSampleWalkIn([walkInItem]), 'Sample walk-in recorded')
              }
            >
              Record walk-in
            </Button>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3 rounded-md border border-border bg-surface p-3 lg:col-span-2">
          <legend className="px-1 text-sm font-semibold text-ink">4. Presentation scenarios</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              className="size-5"
              checked={!!café.requireHandlingNote}
              onChange={(e) =>
                void run(
                  () => chill.setRequireHandlingNote(e.target.checked),
                  e.target.checked
                    ? 'A logged reason is now required to start an order ahead of an older accepted one'
                    : 'Starting out of sequence no longer needs a reason',
                )
              }
            />
            Require a logged reason when an order starts ahead of an older accepted one
          </label>
          <details className="text-sm text-ink">
            <summary className="min-h-11 cursor-pointer py-2 font-medium">
              Manual demo script (nothing here runs by itself)
            </summary>
            <ol className="mt-1 list-decimal pl-5">
              <li>
                Point out the counter line (people) and the recorded backlog (orders): different
                units.
              </li>
              <li>
                As a student, submit a request. It stays pending and the backlog does not change.
              </li>
              <li>Accept it here. It joins the backlog behind earlier recorded walk-ins.</li>
              <li>Optionally start a later order first and give the reason; the log keeps it.</li>
              <li>Mark an earlier order ready. The counter report does not move.</li>
              <li>
                Advance the student order to preparing, then ready, and show the pickup ticket.
              </li>
              <li>Record collection. Payment is not verified.</li>
              <li>Pause new requests; existing orders continue. Resume.</li>
              <li>Open the Time Tax views: a scenario is not a measurement.</li>
              <li>Let the counter report go stale and show how it is qualified.</li>
            </ol>
          </details>
          <Button
            variant="outline"
            className="min-h-11 self-start border-danger text-danger"
            onClick={async () => {
              const c = await confirm({
                title: 'Reset the café scenario?',
                description:
                  'This removes every Chill Spot local order on this device (yours and simulated walk-ins) and restores the starting queue and counter report. It does not touch your Home, Calendar, tasks or settings.',
                confirmLabel: 'Reset café scenario',
                danger: true,
              })
              if (c === 'confirm') void run(() => chill.resetScenario(), 'Café scenario reset')
            }}
          >
            Reset café scenario…
          </Button>
        </fieldset>
      </div>

      <h3 className="mt-4 text-sm font-semibold text-ink">3. Order operations</h3>
      <div className="mt-1 flex flex-wrap items-end gap-3">
        <Field label="Reason for starting ahead of an older order (if asked)" className="w-72">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={handling}
              onChange={(e) => setHandling(e.target.value as typeof handling)}
            >
              <option value="">No reason chosen</option>
              {HANDLING_KINDS.map((k) => (
                <option key={k} value={k}>
                  {handlingLabel[k]}
                </option>
              ))}
            </select>
          )}
        </Field>
        {handling === 'other' ? (
          <Field label="Describe the reason" className="w-72">
            {(a) => (
              <input
                {...a}
                className={inputClass}
                value={handlingText}
                onChange={(e) => setHandlingText(e.target.value)}
              />
            )}
          </Field>
        ) : null}
        <Field label="Note for “Needs attention” flag" className="w-72">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              value={flagText}
              onChange={(e) => setFlagText(e.target.value)}
            />
          )}
        </Field>
      </div>
      <Field label="Reason for declining (optional)" className="mt-1 max-w-sm">
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        )}
      </Field>
      <ul className="mt-2 flex flex-col gap-2">
        {café.orders.length === 0 ? <li className="text-sm text-ink-muted">No orders.</li> : null}
        {[...café.orders].reverse().map((o) => (
          <li
            key={o.id}
            className="rounded-md border border-border bg-surface p-2.5 text-sm"
            data-ops-order={o.id}
          >
            <div className="flex flex-wrap items-center gap-2">
              <strong>{o.displayNumber}</strong>
              <span className="text-xs text-ink-muted">
                {o.channel === 'walkInRecorded' ? 'Walk-in (recorded)' : 'Digital request'}
                {o.queueSequence ? ` · sequence ${o.queueSequence}` : ''}
              </span>
              <StatusChip status={o.status} />
              <OriginBadges order={o} />
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {NEXT.map(({ to, label }) => {
                const ok = canTransition(o.status, to, 'demoOperator').ok
                return (
                  <Button
                    key={to}
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    disabled={!ok}
                    aria-label={`${label} ${o.displayNumber}`}
                    onClick={() =>
                      void run(
                        () =>
                          chill.operatorTransition(
                            o.id,
                            to,
                            undefined,
                            to === 'preparing' && handling
                              ? { kind: handling, ...(handlingText ? { text: handlingText } : {}) }
                              : undefined,
                          ),
                        `${o.displayNumber}: ${label.toLowerCase()}`,
                      )
                    }
                  >
                    {label}
                  </Button>
                )
              })}
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={!canTransition(o.status, 'rejected', 'demoOperator').ok}
                aria-label={`Decline ${o.displayNumber}`}
                onClick={() =>
                  void run(
                    () => chill.operatorTransition(o.id, 'rejected', rejectReason),
                    `${o.displayNumber}: declined`,
                  )
                }
              >
                Decline
              </Button>
              {o.queueSequence && !['collected', 'rejected', 'cancelled'].includes(o.status) ? (
                o.exceptionFlag ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Clear flag on ${o.displayNumber}`}
                    onClick={() =>
                      void run(() => chill.clearException(o.id), `${o.displayNumber}: flag cleared`)
                    }
                  >
                    Clear flag
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    aria-label={`Flag ${o.displayNumber} as needs attention`}
                    disabled={!flagText.trim()}
                    onClick={() =>
                      void run(
                        () => chill.flagException(o.id, flagText),
                        `${o.displayNumber}: flagged (the order did not move)`,
                      )
                    }
                  >
                    Flag needs attention
                  </Button>
                )
              ) : null}
            </div>
            {!NEXT.some(({ to }) => canTransition(o.status, to, 'demoOperator').ok) ? (
              <p className="mt-1 text-xs text-ink-muted">
                No further step: this order is {o.status}.
              </p>
            ) : null}
            {o.exceptionFlag ? (
              <p className="mt-1 text-xs text-ink">Flag: {o.exceptionFlag.note}</p>
            ) : null}
            {o.studentReportedArrivalAt ? (
              <p className="mt-1 text-xs text-ink-muted">
                Student self-reported arrival (not verified) at{' '}
                {formatInstant(o.studentReportedArrivalAt)}.
              </p>
            ) : null}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-sm font-semibold text-ink">Recent changes (newest first)</h3>
      <ol
        className="mt-1 flex flex-col gap-0.5 text-xs text-ink-muted"
        aria-label="Recent order changes"
      >
        {events.map(({ o, h }) => (
          <li key={h.transitionId}>
            {formatInstant(h.occurredAt)} · {o.displayNumber}: {h.from} → {h.to} ·{' '}
            {h.actor === 'student' ? 'student' : 'simulated operator'}
            {h.reason ? ` · ${h.reason}` : ''}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-ink-muted">
        Data coverage: recorded orders only, all demonstration data. The counter line is a separate
        manual report.
      </p>
    </section>
  )
}
