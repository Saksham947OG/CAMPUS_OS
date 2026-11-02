import { ProcessTimeTax } from '../sources/process-time-tax'
import { useServices } from '@/app/services'
import { ExternalLink, UtensilsCrossed } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DataModeBadge } from '@/components/data-mode-badge'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useCampusData } from '@/hooks/use-campus-data'
import {
  addDays,
  formatDateLong,
  formatDateShort,
  formatInstant,
  formatTimeRange,
  startOfWeek,
  type DateOnly,
} from '@/lib/time'
import { feeView, messOccupancy, openMessSession, ownFeedback } from '@/selectors/ess'
import { mealLabel, messForDate } from '@/selectors/mess'
import { Empty, Loading, Pill, SectionCard, SubNav } from './ess-common'
import { useAction, useEss } from './ess-hooks'
import { messTabs } from './ess-nav'
import { MessOps } from './ess-ops'

function MealCard({ date, mealId }: { date: DateOnly; mealId: string }) {
  const { data } = useCampusData()
  const m = messForDate(data, date).find((x) => x.id === mealId)
  if (!m) return null
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold text-ink">{mealLabel[m.meal]}</span>
        <DataModeBadge
          mode={m.provenance.dataMode === 'connected' ? 'provided' : m.provenance.dataMode}
        />
      </div>
      <p className="text-sm">
        {m.start && m.end ? formatTimeRange(m.start, m.end) : 'Serving time not provided'}
      </p>
      <p className="text-sm text-ink-muted">
        {m.items?.length ? m.items.join(', ') : 'Menu items not provided'}
      </p>
      {m.note ? <p className="text-sm text-ink-muted">{m.note}</p> : null}
      <p className="text-xs text-ink-muted">
        {m.provenance.sourceLabel ?? 'Source not stated'}
        {m.provenance.updatedAt
          ? ` · updated ${formatInstant(m.provenance.updatedAt)}`
          : ' · last update not provided'}
      </p>
    </li>
  )
}

function Feedback({ date }: { date: DateOnly }) {
  const { data } = useCampusData()
  const { ess, repo, profileId } = useEss()
  const { act, message } = useAction()
  const meals = messForDate(data, date)
  const [mealId, setMealId] = useState('')
  const [rating, setRating] = useState('4')
  const [comment, setComment] = useState('')
  if (!ess) return null
  const mine = ownFeedback(ess, profileId).slice(0, 5)
  const chosen = mealId || meals[0]?.id || ''
  return (
    <SectionCard id="fb-h" title="Meal feedback (local)">
      <p className="text-ink-muted">
        Meal feedback: it is stored only in this browser under your persona and goes nowhere.
      </p>
      {meals.length === 0 ? (
        <Empty>
          There is no meal listed for this day, so there is nothing to give feedback on.
        </Empty>
      ) : (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault()
            void act(
              () =>
                repo.addMessFeedback(
                  profileId,
                  chosen,
                  Number(rating),
                  comment.trim() || undefined,
                ),
              'Feedback saved on this device.',
            ).then((r) => {
              if (r.ok) setComment('')
            })
          }}
        >
          <Field label="Meal">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={chosen}
                onChange={(e) => setMealId(e.target.value)}
              >
                {meals.map((m) => (
                  <option key={m.id} value={m.id}>
                    {mealLabel[m.meal]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Rating (1 to 5)">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Comment (optional)">
            {(a) => (
              <input
                {...a}
                className={inputClass}
                maxLength={300}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            )}
          </Field>
          <div className="sm:col-span-3">
            <Button type="submit" className="min-h-11">
              Save illustrative feedback
            </Button>
          </div>
        </form>
      )}
      <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
      {mine.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-ink-muted">
          {mine.map((f) => (
            <li key={f.id}>
              Rated {f.rating}/5 · {formatInstant(f.at)}
              {f.comment ? ` · ${f.comment}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </SectionCard>
  )
}

function Crowd() {
  const { ess, repo, profileId, now } = useEss()
  const { act, message } = useAction()
  if (!ess) return null
  const joined = ess.messOptIn.includes(profileId)
  const open = openMessSession(ess, profileId)
  const occ = messOccupancy(ess, now.ms)
  const busy = ess.messBusy
  return (
    <SectionCard
      id="crowd-h"
      title="How busy is the mess?"
      action={<Pill tone="demo">Self-reported sample</Pill>}
    >
      <p>
        <strong>Busy indicator:</strong>{' '}
        {busy && busy.state !== 'unknown'
          ? `${busy.state} · ${busy.sourceLabel} · reported ${formatInstant(busy.asOf)}`
          : 'Unknown. No report has been made.'}
      </p>
      <p className="mt-1">{occ.text}</p>
      {occ.staleForReview > 0 ? (
        <p className="text-ink-muted">
          {occ.staleForReview} older {occ.staleForReview === 1 ? 'session is' : 'sessions are'}{' '}
          flagged for review and not counted.
        </p>
      ) : null}
      <p className="mt-1 text-xs text-ink-muted">{occ.caveat}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {!joined ? (
          <Button
            className="min-h-11"
            onClick={() =>
              void act(() => repo.setMessOptIn(profileId, true), 'You joined self-reporting.')
            }
          >
            Join self-reporting
          </Button>
        ) : (
          <>
            <Button
              className="min-h-11"
              onClick={async () => {
                const r = await act(
                  () => repo.messCheckIn(profileId),
                  'Checked in (your own report).',
                )
                if (r.ok && !r.value.created) {
                  /* idempotent: already checked in */
                }
              }}
            >
              {open ? 'You are checked in' : 'Check in (self-report)'}
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => void act(() => repo.messCheckOut(profileId), 'Checked out.')}
            >
              Check out
            </Button>
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() =>
                void act(() => repo.setMessOptIn(profileId, false), 'You left self-reporting.')
              }
            >
              Leave self-reporting
            </Button>
          </>
        )}
      </div>
      <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
        {message}
      </output>
    </SectionCard>
  )
}

export function MessPage() {
  const { sourceData } = useServices()
  const { data, status: dataStatus } = useCampusData()
  const { ess, status, showDemoOps, now } = useEss()
  const [date, setDate] = useState<DateOnly | null>(null)
  const [mode, setMode] = useState<'day' | 'week'>('day')
  if (status === 'loading' || !ess || dataStatus === 'loading') return <Loading />
  const day = date ?? now.today
  const weekStart = startOfWeek(day)
  const week = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const meals = messForDate(data, day)

  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Mess"
        description="Menus and serving windows exactly as supplied. Anything missing stays unknown: no days are filled in and no menu cycle is assumed."
        badge={<Pill tone="demo">Campus data</Pill>}
      />
      <SubNav label="Mess sections" items={messTabs} current="menu" />

      <SectionCard
        id="menu-h"
        title={mode === 'day' ? formatDateLong(day) : `Week of ${formatDateShort(weekStart)}`}
        action={
          <div className="flex flex-wrap gap-1.5">
            <Button
              variant="outline"
              className="min-h-11"
              aria-pressed={mode === 'day'}
              onClick={() => setMode('day')}
            >
              Day
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              aria-pressed={mode === 'week'}
              onClick={() => setMode('week')}
            >
              Week
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              aria-label="Previous"
              onClick={() => setDate(addDays(day, mode === 'day' ? -1 : -7))}
            >
              ‹
            </Button>
            <Button variant="outline" className="min-h-11" onClick={() => setDate(now.today)}>
              Today
            </Button>
            <Button
              variant="outline"
              className="min-h-11"
              aria-label="Next"
              onClick={() => setDate(addDays(day, mode === 'day' ? 1 : 7))}
            >
              ›
            </Button>
          </div>
        }
      >
        {mode === 'day' ? (
          meals.length === 0 ? (
            <Empty>
              No menu has been provided for this day. It is not guessed from other days.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {meals.map((m) => (
                <MealCard key={m.id} date={day} mealId={m.id} />
              ))}
            </ul>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {week.map((d) => {
              const list = messForDate(data, d)
              return (
                <div key={d}>
                  <h3 className="text-sm font-semibold">{formatDateShort(d)}</h3>
                  {list.length === 0 ? (
                    <p className="text-ink-muted">No menu provided.</p>
                  ) : (
                    <ul className="mt-1 flex flex-col gap-2">
                      {list.map((m) => (
                        <MealCard key={m.id} date={d} mealId={m.id} />
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          <UtensilsCrossed className="mr-1 inline size-3.5" aria-hidden="true" />
          The same records feed your Calendar’s meal context and optional dining overlay and Home’s
          mess preview, which never reserve time.{' '}
          <Link to={`/calendar?view=day&date=${day}`} className="font-medium text-coffee underline">
            Open this day in Calendar
          </Link>
          .
        </p>
      </SectionCard>

      <Crowd />
      <Feedback date={day} />
      {showDemoOps ? <MessOps /> : null}
      {sourceData ? <ProcessTimeTax service="mess" /> : null}
    </article>
  )
}

export function MessFeesPage() {
  const { ess, status, profileId, repo, now } = useEss()
  const { act, message } = useAction()
  if (status === 'loading' || !ess) return <Loading />
  const f = feeView(ess, profileId)
  const daysLeft = ess.fee?.dueDate
    ? Math.round(
        (Date.parse(`${ess.fee.dueDate}T00:00:00Z`) - Date.parse(`${now.today}T00:00:00Z`)) /
          86_400_000,
      )
    : null
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Mess fees"
        description="Fee details appear only if someone supplies them. CampusOS never invents an amount, a late charge or a payment link, and it cannot see whether you paid."
        badge={<Pill tone="demo">Demo · no real fee data</Pill>}
      />
      <SubNav label="Mess sections" items={messTabs} current="fees" />
      {!f.supplied ? (
        <SectionCard id="nofee-h" title="No fee details available">
          <p>
            No amount, deadline or payment form has been supplied for this prototype, so none is
            shown and there is no payment link. Your fee status is <strong>unknown</strong>.
          </p>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            id="fee-h"
            title="Supplied fee details"
            action={<Pill tone="demo">Demo · entered in the simulator</Pill>}
          >
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-ink-muted">Amount</dt>
              <dd>{f.amountText ?? 'Not supplied'}</dd>
              <dt className="text-ink-muted">Due</dt>
              <dd>
                {f.dueText ?? 'Not supplied'}
                {daysLeft !== null && daysLeft >= 0
                  ? ` (in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'})`
                  : daysLeft !== null
                    ? ' (date has passed)'
                    : ''}
              </dd>
              <dt className="text-ink-muted">Late fee</dt>
              <dd>{f.lateFee ?? 'Not supplied'}</dd>
              <dt className="text-ink-muted">Instructions</dt>
              <dd>{f.instructions ?? 'Not supplied'}</dd>
            </dl>
            <p className="mt-2 text-xs text-ink-muted">{f.sourceText}</p>
          </SectionCard>
          <SectionCard id="pay-h" title="Payment form">
            {f.formUrl ? (
              <>
                <a
                  href={f.formUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 font-medium text-coffee underline"
                >
                  Open the supplied payment form{' '}
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
                <p className="text-xs text-ink-muted">
                  Opens an external site. Opening it does not record any payment, here or anywhere.
                </p>
              </>
            ) : (
              <p>No payment form link has been supplied, so there is nothing to open.</p>
            )}
          </SectionCard>
          <SectionCard id="st-h" title="Your submission status">
            <p>
              <strong>{f.statusLabel}</strong>
            </p>
            <p className="text-xs text-ink-muted">
              “Verified paid” only exists once an authorised source confirms it, and none is
              connected. Your report is a note for yourself, not a receipt.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {f.status !== 'studentReportedSubmitted' ? (
                <Button
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.reportFeeSubmitted(profileId, true),
                      'Noted as your own report.',
                    )
                  }
                >
                  I submitted it (self-report)
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void act(() => repo.reportFeeSubmitted(profileId, false), 'Report removed.')
                  }
                >
                  Undo my report
                </Button>
              )}
            </div>
            <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
              {message}
            </output>
          </SectionCard>
        </>
      )}
    </article>
  )
}
