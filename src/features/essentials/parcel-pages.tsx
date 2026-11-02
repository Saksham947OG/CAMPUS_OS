import { ArrowLeft, Package } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { parcelStateLabel, type Parcel } from '@/domain/ess'
import { parcelPath } from '@/domain/ess-logic'
import { formatInstant } from '@/lib/time'
import { collectedParcels, ownParcels, parcelView, pendingParcels } from '@/selectors/ess'
import { Empty, Loading, Pill, SectionCard, TripScenario } from './ess-common'
import { useAction, useEss } from './ess-hooks'
import { ParcelOps } from './ess-ops'

function ParcelCard({ p }: { p: Parcel }) {
  const { ess, now } = useEss()
  if (!ess) return null
  const v = parcelView(p, ess, now.ms)
  return (
    <li className="rounded-lg border border-border bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-semibold text-ink">
          <Package className="size-4" aria-hidden="true" />{' '}
          {p.courier ? `Parcel from ${p.courier}` : 'Parcel'}
          {p.referenceSuffix ? ` · …${p.referenceSuffix}` : ''}
        </span>
        <Pill tone={v.overdue || p.state === 'exception' ? 'warn' : 'plain'}>{v.label}</Pill>
      </div>
      <p className="text-sm text-ink-muted">
        Logged {formatInstant(p.loggedAt)} · {v.where}
      </p>
      <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
        <Link to={parcelPath(p.id)}>
          {p.state === 'collected' ? 'View history' : 'Collect parcel details'}
        </Link>
      </Button>
    </li>
  )
}

export function ParcelsPage() {
  const { ess, status, profileId, showDemoOps } = useEss()
  if (status === 'loading' || !ess) return <Loading />
  const mine = ownParcels(ess, profileId)
  const waiting = pendingParcels(mine)
  const done = collectedParcels(mine)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Parcels"
        description="A private list of parcels the local desk scenario has logged for you. This is a demonstration log, not courier tracking, and it does not protect against theft."
        badge={<Pill tone="demo">Demo · simulated log</Pill>}
      />
      <SectionCard id="wait-h" title="Awaiting collection">
        {waiting.length === 0 ? (
          <Empty>No parcels are logged for you. Nothing is shown for anyone else.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {waiting.map((p) => (
              <ParcelCard key={p.id} p={p} />
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="hist-h" title="Collection history">
        {done.length === 0 ? (
          <Empty>No collected parcels yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {done.map((p) => (
              <ParcelCard key={p.id} p={p} />
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        Office hours and parcel retention rules are not known, so none are shown. A parcel that has
        waited a while gets a reminder when you next open CampusOS; it is not a fine and it is not
        sent when the app is closed.
      </p>
      <TripScenario id="parcel-tt-h" noun="parcel collection trips" />
      {showDemoOps ? <ParcelOps /> : null}
    </article>
  )
}

export function ParcelDetailPage() {
  const { parcelId } = useParams()
  const { ess, status, profileId, repo, now } = useEss()
  const { act, message } = useAction()
  const [text, setText] = useState('')
  const [error, setError] = useState<string>()
  if (status === 'loading' || !ess) return <Loading />
  const p = ownParcels(ess, profileId).find((x) => x.id === parcelId)
  if (!p)
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Parcel not found
        </h1>
        <p className="mt-2 text-ink-muted">
          That parcel does not exist for this persona. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/services/parcels">Back to your parcels</Link>
        </Button>
      </div>
    )
  const v = parcelView(p, ess, now.ms)
  const report = async () => {
    if (!text.trim()) {
      setError('Describe the problem so the desk can look into it')
      return
    }
    setError(undefined)
    const r = await act(
      () => repo.reportParcelIssue(profileId, p.id, text),
      'Your note was added to the history. It does not record a handover.',
    )
    if (r.ok) setText('')
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/services/parcels"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Parcels
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {p.courier ? `Parcel from ${p.courier}` : 'Parcel'}
          </h1>
          <Pill tone={v.overdue || p.state === 'exception' ? 'warn' : 'plain'}>{v.label}</Pill>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          Status: {parcelStateLabel[p.state]} · last updated {formatInstant(p.updatedAt)}
        </p>
      </div>
      {v.overdue ? (
        <p className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm">
          Logged {v.ageDays} days ago and still uncollected. This is a demo reminder, not a campus
          rule or fine.
        </p>
      ) : null}
      {p.state === 'exception' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Needs attention:</strong> {p.exceptionNote}
        </p>
      ) : null}
      <SectionCard id="where-h" title="Where to collect">
        <p className="font-medium">{v.where}</p>
        {p.referenceSuffix ? (
          <p className="text-ink-muted">Reference ends …{p.referenceSuffix}</p>
        ) : null}
        <p className="mt-1 text-xs text-ink-muted">
          {p.provenance.sourceLabel}. A log entry is not courier tracking.
        </p>
      </SectionCard>
      <SectionCard id="tl-h" title="History">
        <ol className="flex flex-col gap-1.5">
          {p.history.map((h) => (
            <li key={h.id} className="flex flex-wrap gap-x-2 border-b border-border pb-1.5">
              <time dateTime={h.at} className="text-ink-muted">
                {formatInstant(h.at)}
              </time>
              <span className="font-medium">{h.action}</span>
              <Pill tone={h.actorKind === 'student' ? 'plain' : 'demo'}>
                {h.actorKind === 'student' ? 'You' : 'Simulated (local desk scenario)'}
              </Pill>
              {h.note ? <span className="text-ink-muted">{h.note}</span> : null}
            </li>
          ))}
        </ol>
      </SectionCard>
      {p.state !== 'collected' ? (
        <SectionCard id="issue-h" title="Report a problem">
          <p className="text-ink-muted">
            Missing, damaged or not yours? Tell the desk. Reporting adds a note; only the local desk
            scenario can record a handover.
          </p>
          <form
            className="mt-2 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void report()
            }}
          >
            <Field label="What is wrong?" error={error}>
              {(a) => (
                <textarea
                  {...a}
                  rows={3}
                  maxLength={300}
                  className={`${inputClass} py-2`}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                />
              )}
            </Field>
            <Button type="submit" className="min-h-11 self-start">
              Add note
            </Button>
          </form>
          <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
            {message}
          </output>
        </SectionCard>
      ) : null}
    </article>
  )
}
