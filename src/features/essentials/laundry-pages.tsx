import { ArrowLeft, Shirt, WashingMachine } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useConfirm } from '@/components/confirm-context'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { loadStageChip, loadStageLabel, type LaundryLoad } from '@/domain/ess'
import { loadPath } from '@/domain/ess-logic'
import {
  formatDateShort,
  formatInstant,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import {
  activeLoads,
  expectedReturnText,
  finishedLoads,
  ownLoads,
  upcomingReservations,
  visitText,
} from '@/selectors/ess'
import { Empty, Loading, Pill, SectionCard, SubNav, TripScenario } from './ess-common'
import { useAction, useEss } from './ess-hooks'
import { laundryTabs } from './ess-nav'
import { LaundryOps } from './ess-ops'

function VisitBanner() {
  const { ess } = useEss()
  const v = visitText(ess?.visit ?? null)
  return (
    <SectionCard
      id="visit-h"
      title="Provider visit"
      action={ess?.visit ? <Pill tone="demo">Demo · simulated</Pill> : undefined}
    >
      <p className="font-medium">{v.headline}</p>
      {v.detail.map((d) => (
        <p key={d} className="text-ink-muted">
          {d}
        </p>
      ))}
      <p className="mt-2 text-xs text-ink-muted">
        The “every alternate day” idea is context, not a schedule: no dates are generated until a
        real schedule is supplied. A visit never changes any individual load.
      </p>
    </SectionCard>
  )
}

function LoadCard({ l }: { l: LaundryLoad }) {
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">
          {l.reference ? `Load ${l.reference}` : 'Laundry load'}
        </span>
        <span className="flex flex-wrap gap-1.5">
          <Pill>{l.cancelled ? 'Withdrawn' : loadStageChip[l.stage]}</Pill>
          {l.delayFlag ? <Pill tone="warn">Delayed</Pill> : null}
          {l.discrepancyFlag ? <Pill tone="warn">Discrepancy under review</Pill> : null}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Handed over {formatDateShort(l.handedOverDate)}
        {l.itemCount ? ` · ${l.itemCount} items` : ''} · Return: {expectedReturnText(l)}
      </p>
      <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
        <Link to={loadPath(l.id)}>View my load</Link>
      </Button>
    </li>
  )
}

export function LaundryHubPage() {
  const { ess, status, profileId, now } = useEss()
  if (status === 'loading' || !ess) return <Loading />
  const loads = activeLoads(ownLoads(ess, profileId))
  const res = upcomingReservations(ess, profileId, now.ms)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Laundry"
        description="Two different services: SS Laundry (an outside provider you hand clothes to) and the self-service washing machines. A demonstration with sample data."
        badge={<Pill tone="demo">Campus data</Pill>}
      />
      <SubNav label="Laundry sections" items={laundryTabs} current="hub" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SectionCard id="ss-h" title="SS Laundry">
          <p className="flex items-center gap-2 text-ink-muted">
            <Shirt className="size-4" aria-hidden="true" /> Register a load and follow it.
          </p>
          <p className="mt-2">
            {loads.length === 0
              ? 'You have no active loads.'
              : `${loads.length} active ${loads.length === 1 ? 'load' : 'loads'}.`}
          </p>
          <Button asChild className="mt-2 min-h-11">
            <Link to="/services/laundry/ss">
              {loads.length ? 'View my load' : 'See next reported visit'}
            </Link>
          </Button>
        </SectionCard>
        <SectionCard id="wm-h" title="Washing machines">
          <p className="flex items-center gap-2 text-ink-muted">
            <WashingMachine className="size-4" aria-hidden="true" /> Reserve a slot on a machine.
          </p>
          <p className="mt-2">
            {res.length === 0
              ? 'No upcoming machine reservation.'
              : `Next: ${formatDateShort(res[0]!.date)}, ${res[0]!.start}.`}
          </p>
          <Button asChild className="mt-2 min-h-11">
            <Link to="/services/laundry/machines">Find machine slot</Link>
          </Button>
        </SectionCard>
      </div>
      <VisitBanner />
    </article>
  )
}

function RegisterForm() {
  const { repo, profileId, now, newId } = useEss()
  const { act } = useAction()
  const [key, setKey] = useState(() => newId('idem'))
  const [date, setDate] = useState<string>(now.today)
  const [time, setTime] = useState('')
  const [reference, setReference] = useState('')
  const [count, setCount] = useState('')
  const [point, setPoint] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<{ date?: string; count?: string }>({})
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (busy) return
    const e: typeof errors = {}
    if (!isDateOnly(date)) e.date = 'Choose the date you handed the clothes over'
    if (count !== '' && (!Number.isInteger(Number(count)) || Number(count) < 1))
      e.count = 'Enter a whole number of at least 1'
    setErrors(e)
    if (e.date || e.count) return
    setBusy(true)
    const r = await act(
      () =>
        repo.registerLoad({
          profileId,
          handedOverDate: date as DateOnly,
          ...(time ? { handedOverTime: time as LocalTime } : {}),
          ...(reference.trim() ? { reference: reference.trim() } : {}),
          ...(count ? { itemCount: Number(count) } : {}),
          ...(point.trim() ? { collectionPoint: point.trim() } : {}),
          ...(notes.trim() ? { notes: notes.trim() } : {}),
          idempotencyKey: key,
        }),
      'Load registered in your list.',
    )
    setBusy(false)
    if (r.ok) {
      setDone(true)
      setKey(newId('idem'))
      setReference('')
      setCount('')
      setPoint('')
      setNotes('')
      setTime('')
    }
  }

  return (
    <SectionCard id="reg-h" title="Register a load">
      <p className="text-ink-muted">
        You are recording that <strong>you</strong> handed clothes over. This is self-reported: it
        does not mean the provider received them, and nothing is sent anywhere.
      </p>
      {done ? (
        <output className="mt-3 block rounded-md border border-border-strong bg-coffee-tint p-3 font-medium">
          Registered as <strong>Student reported</strong>. Receipt is only recorded later, by the
          local provider scenario simulator.
        </output>
      ) : null}
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(ev) => {
          ev.preventDefault()
          void submit()
        }}
        noValidate
      >
        <Field label="Date handed over" error={errors.date}>
          {(a) => (
            <input
              {...a}
              type="date"
              className={inputClass}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          )}
        </Field>
        <Field label="Time (optional)">
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </Field>
        <Field label="Receipt or bag reference (optional)" hint="Not a secret or ID number.">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={40}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          )}
        </Field>
        <Field label="Item count (optional)" error={errors.count}>
          {(a) => (
            <input
              {...a}
              type="number"
              min={1}
              className={inputClass}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          )}
        </Field>
        <Field label="Where you will collect it (optional)">
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
        <Field label="Notes (optional)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={300}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Button type="submit" className="min-h-11" disabled={busy}>
            Register load (self-reported)
          </Button>
        </div>
      </form>
    </SectionCard>
  )
}

export function SsLaundryPage() {
  const { ess, status, profileId, showDemoOps } = useEss()
  if (status === 'loading' || !ess) return <Loading />
  const mine = ownLoads(ess, profileId)
  const active = activeLoads(mine)
  const done = finishedLoads(mine)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="SS Laundry"
        description="Register your own loads and follow what the local provider scenario records. Your registration and the provider's records are kept separate."
        badge={<Pill tone="demo">Campus data</Pill>}
      />
      <SubNav label="Laundry sections" items={laundryTabs} current="ss" />
      <VisitBanner />
      <SectionCard id="mine-h" title="My loads">
        {mine.length === 0 ? (
          <Empty>
            You have not registered any loads. Use the form below when you hand clothes over.
          </Empty>
        ) : (
          <>
            {active.length === 0 ? <p className="text-ink-muted">No active loads.</p> : null}
            <ul className="mt-2 flex flex-col gap-2">
              {active.map((l) => (
                <LoadCard key={l.id} l={l} />
              ))}
            </ul>
            {done.length > 0 ? (
              <>
                <h3 className="mt-4 text-sm font-semibold">Finished</h3>
                <ul className="mt-2 flex flex-col gap-2">
                  {done.map((l) => (
                    <LoadCard key={l.id} l={l} />
                  ))}
                </ul>
              </>
            ) : null}
          </>
        )}
      </SectionCard>
      <RegisterForm />
      <TripScenario id="ss-tt-h" noun="SS Laundry collection trips" />
      {showDemoOps ? <LaundryOps /> : null}
    </article>
  )
}

export function LoadDetailPage() {
  const { loadId } = useParams()
  const { ess, status, profileId, repo } = useEss()
  const confirm = useConfirm()
  const { act } = useAction()
  const [editing, setEditing] = useState(false)
  if (status === 'loading' || !ess) return <Loading />
  const l = ownLoads(ess, profileId).find((x) => x.id === loadId)
  if (!l)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Load not found
        </h1>
        <p className="mt-2 text-ink-muted">
          That load does not exist for this persona. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/services/laundry/ss">Back to SS Laundry</Link>
        </Button>
      </div>
    )

  const withdraw = async () => {
    const c = await confirm({
      title: 'Withdraw this registration?',
      description:
        'It has not been recorded as received, so you can withdraw it. This cannot be undone.',
      confirmLabel: 'Withdraw',
      danger: true,
    })
    if (c === 'confirm')
      await act(() => repo.withdrawLoad(profileId, l.id), 'Registration withdrawn.')
  }

  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/services/laundry/ss"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> SS Laundry
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {l.reference ? `Load ${l.reference}` : 'Laundry load'}
          </h1>
          <Pill>{l.cancelled ? 'Withdrawn' : loadStageChip[l.stage]}</Pill>
        </div>
        <p className="mt-1 text-sm text-ink-muted" aria-live="polite">
          {l.cancelled ? 'You withdrew this registration.' : loadStageLabel[l.stage]}
        </p>
      </div>

      {l.stage === 'registered' && !l.cancelled ? (
        <p className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm">
          <strong>Student reported.</strong> You recorded this yourself. Nothing shows that the
          provider has received it.
        </p>
      ) : null}
      {l.delayFlag ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Delayed.</strong>{' '}
          {l.expectedReturnConfidence === 'unknown' || !l.expectedReturnDate
            ? 'New date unknown. Awaiting confirmation.'
            : `New date: ${expectedReturnText(l)}.`}
        </p>
      ) : null}
      {l.discrepancyFlag ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Discrepancy under review.</strong> {l.discrepancyNote} The outstanding part has
          not been closed as collected.
        </p>
      ) : null}

      <SectionCard id="exp-h" title="Expected return">
        <p className="font-medium">{expectedReturnText(l)}</p>
        <p className="text-xs text-ink-muted">
          A provided date is an expectation, not proof the laundry moved. A visit to campus does not
          mark any load returned.
        </p>
      </SectionCard>

      <SectionCard
        id="det-h"
        title="Details"
        action={
          l.stage === 'registered' && !l.cancelled ? (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => setEditing((v) => !v)}
            >
              {editing ? 'Close edit' : 'Edit my details'}
            </Button>
          ) : undefined
        }
      >
        {editing ? <EditForm l={l} onDone={() => setEditing(false)} /> : null}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-ink-muted">Handed over</dt>
          <dd>
            {formatDateShort(l.handedOverDate)}
            {l.handedOverTime ? `, ${l.handedOverTime}` : ''}
          </dd>
          <dt className="text-ink-muted">Items</dt>
          <dd>{l.itemCount ?? 'Not given'}</dd>
          <dt className="text-ink-muted">Collect from</dt>
          <dd>{l.collectionPoint ?? 'Not given'}</dd>
          {l.notes ? (
            <>
              <dt className="text-ink-muted">Notes</dt>
              <dd>{l.notes}</dd>
            </>
          ) : null}
          <dt className="text-ink-muted">Record</dt>
          <dd>
            {l.provenance.sourceLabel} · {l.provenance.dataMode}
          </dd>
        </dl>
      </SectionCard>

      <SectionCard id="tl-h" title="Timeline">
        <ol className="flex flex-col gap-1.5">
          {l.history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2 border-b border-border pb-1.5">
              <time dateTime={h.at} className="text-ink-muted">
                {formatInstant(h.at)}
              </time>
              <span className="font-medium">{h.action}</span>
              <Pill tone={h.actorKind === 'student' ? 'plain' : 'demo'}>
                {h.actorKind === 'student' ? 'You' : 'Simulated (local provider scenario)'}
              </Pill>
              {h.note ? <span className="text-ink-muted">{h.note}</span> : null}
            </li>
          ))}
        </ol>
      </SectionCard>

      <div className="flex flex-wrap gap-2">
        {l.stage === 'registered' && !l.cancelled ? (
          <Button variant="outline" className="min-h-11" onClick={() => void withdraw()}>
            Withdraw registration
          </Button>
        ) : null}
        {(l.stage === 'readyForCollection' || l.stage === 'returnedToCampus') &&
        !l.studentReportedCollected ? (
          <Button
            className="min-h-11"
            onClick={() =>
              void act(
                () => repo.reportLoadCollected(profileId, l.id),
                'Recorded as your own report.',
              )
            }
          >
            I collected this (self-report)
          </Button>
        ) : null}
        {l.studentReportedCollected && l.stage !== 'collected' ? (
          <p className="text-sm text-ink-muted">
            You reported collecting this. It stays self-reported until a handover is recorded by the
            local provider scenario.
          </p>
        ) : null}
      </div>
    </article>
  )
}

function EditForm({ l, onDone }: { l: LaundryLoad; onDone: () => void }) {
  const { repo, profileId } = useEss()
  const { act } = useAction()
  const [reference, setReference] = useState(l.reference ?? '')
  const [count, setCount] = useState(l.itemCount ? String(l.itemCount) : '')
  const [point, setPoint] = useState(l.collectionPoint ?? '')
  const [notes, setNotes] = useState(l.notes ?? '')
  const save = async () => {
    const r = await act(
      () =>
        repo.editLoad(profileId, l.id, {
          reference: reference.trim() || undefined,
          itemCount: count ? Number(count) : undefined,
          collectionPoint: point.trim() || undefined,
          notes: notes.trim() || undefined,
        }),
      'Details updated.',
    )
    if (r.ok) onDone()
  }
  return (
    <form
      className="mb-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <Field label="Reference">
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        )}
      </Field>
      <Field label="Item count">
        {(a) => (
          <input
            {...a}
            type="number"
            min={1}
            className={inputClass}
            value={count}
            onChange={(e) => setCount(e.target.value)}
          />
        )}
      </Field>
      <Field label="Collect from">
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={point}
            onChange={(e) => setPoint(e.target.value)}
          />
        )}
      </Field>
      <Field label="Notes">
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </Field>
      <Button type="submit" className="min-h-11 self-end">
        Save changes
      </Button>
    </form>
  )
}
