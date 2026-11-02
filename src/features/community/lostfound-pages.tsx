import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/confirm-context'
import {
  AREAS,
  CLAIM_ACTIVE,
  ITEM_CATEGORIES,
  categoryLabel,
  claimStatusLabel,
  reportStatusLabel,
  validatePhoto,
  type PhotoMeta,
  type Report,
} from '@/domain/community'
import { findDuplicate, matchCandidates } from '@/domain/community-logic'
import { formatDateShort, formatInstant, isDateOnly, type DateOnly } from '@/lib/time'
import { listReports, myClaims, viewReport, waitingClaimCount } from '@/selectors/community'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { ItemIcon } from './community-common'
import { communityTabs } from './community-nav'
import { useCommunity } from './community-hooks'
import { CommunityOps } from './community-ops'

const TABS = [
  { id: 'lost', label: 'Lost' },
  { id: 'found', label: 'Found' },
  { id: 'mine', label: 'My reports' },
] as const

export function LostFoundPage() {
  const { community, status, profileId, showDemoOps } = useCommunity()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.find((t) => t.id === params.get('tab'))?.id ?? 'found') as
    'lost' | 'found' | 'mine'
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [area, setArea] = useState('')
  const [since, setSince] = useState('')
  const [view, setView] = useState<'grid' | 'list'>('grid')
  if (status === 'loading' || !community) return <Loading />
  const rows = listReports(community, profileId, { tab, q, category, area, since })
  const filtered = !!(q || category || area || since)
  const claims = myClaims(community, profileId)
  return (
    <article className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Lost & Found"
        description="Report something lost or found. Reports here are samples and your own; nothing is sent to anyone."
        badge={<Pill tone="demo">Demo · not a campus lost-property office</Pill>}
      />
      <SubNav label="Community sections" items={communityTabs} current="lost-found" />
      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <Link to="/community/lost-found/new?type=lost">Report something lost</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to="/community/lost-found/new?type=found">Report something found</Link>
        </Button>
      </div>
      <div
        role="tablist"
        aria-label="Report lists"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`min-h-11 border-b-4 px-4 py-2 text-sm font-medium ${tab === t.id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist'}`}
            onClick={() => setParams({ tab: t.id })}
          >
            {t.label}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => e.preventDefault()}
        aria-label="Filters"
      >
        <Field label="Search">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-52`}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          )}
        </Field>
        <Field label="Category">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-44`}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Any</option>
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="General area">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-44`}
              value={area}
              onChange={(e) => setArea(e.target.value)}
            >
              <option value="">Any</option>
              {AREAS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field
          label="Seen on or after"
          hint="Reports with an unknown date are left out when this is set."
        >
          {(a) => (
            <input
              {...a}
              type="date"
              className={`${inputClass} w-44`}
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          )}
        </Field>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!filtered}
          onClick={() => {
            setQ('')
            setCategory('')
            setArea('')
            setSince('')
          }}
        >
          Reset filters
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-pressed={view === 'list'}
          onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
        >
          {view === 'grid' ? 'Switch to list' : 'Switch to cards'}
        </Button>
      </form>
      {rows.length === 0 ? (
        <Empty>
          {filtered
            ? 'No report matches these filters. '
            : tab === 'mine'
              ? 'You have not reported anything yet. '
              : 'There are no published reports here. '}
          Try resetting the filters, or report something yourself.
        </Empty>
      ) : (
        <ul
          className={
            view === 'grid' ? 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3' : 'flex flex-col gap-2'
          }
        >
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                to={`/community/lost-found/${r.id}`}
                className="flex h-full gap-3 rounded-lg border border-border bg-surface p-3 shadow-card hover:bg-mist"
              >
                <ItemIcon category={r.category} />
                <span className="flex flex-col gap-1">
                  <span className="font-semibold text-ink">{r.title}</span>
                  <span className="text-sm text-ink-muted">
                    {r.kind === 'lost' ? 'Lost' : 'Found'} · {categoryLabel[r.category]} ·{' '}
                    {r.area ?? 'area not provided'}
                  </span>
                  <span className="text-xs text-ink-muted">
                    Recorded {formatDateShort(r.createdAt.slice(0, 10) as DateOnly)} · demo sample
                  </span>
                  <span>
                    <Pill tone={r.status === 'published' ? 'plain' : 'warn'}>
                      {reportStatusLabel[r.status]}
                    </Pill>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tab === 'mine' && claims.length > 0 ? (
        <SectionCard id="lf-claims-h" title="Your claims">
          <ul className="flex flex-col gap-2">
            {claims.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <Link
                  to={`/community/lost-found/claims/${c.id}`}
                  className="font-medium text-coffee underline"
                >
                  {community.reports.find((r) => r.id === c.reportId)?.title ?? 'Item'}
                </Link>
                <Pill>{claimStatusLabel[c.status]}</Pill>
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      {showDemoOps ? <CommunityOps section="lostfound" /> : null}
    </article>
  )
}

export function ReportNewPage() {
  const [params] = useSearchParams()
  const kind = params.get('type') === 'lost' ? 'lost' : 'found'
  const nav = useNavigate()
  const { community, status, profileId, repo, newId } = useCommunity()
  const { act } = useAction()
  const [key] = useState(() => newId('idem'))
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<Report['category']>('bag')
  const [description, setDescription] = useState('')
  const [colour, setColour] = useState('')
  const [date, setDate] = useState('')
  const [area, setArea] = useState('')
  const [priv, setPriv] = useState('')
  const [photo, setPhoto] = useState<PhotoMeta | undefined>()
  const [photoError, setPhotoError] = useState('')
  const [error, setError] = useState('')
  const [confirmDup, setConfirmDup] = useState(false)
  if (status === 'loading' || !community) return <Loading />
  const dup = title.trim()
    ? findDuplicate(community, profileId, { kind, title, category })
    : undefined
  const submit = async (publish: boolean) => {
    setError('')
    const r = await act(
      () =>
        repo.createReport(
          profileId,
          {
            kind,
            title,
            category,
            description,
            colour,
            privateDetails: priv,
            publish,
            ...(isDateOnly(date) ? { approxDate: date as DateOnly } : {}),
            ...(area ? { area: area as Report['area'] } : {}),
            ...(photo ? { photo } : {}),
          },
          key,
          confirmDup,
        ),
      publish ? 'Report published on this device.' : 'Draft saved on this device.',
    )
    if (r.ok) nav(`/community/lost-found/${r.value.report.id}`)
    else setError(r.error.message)
  }
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={kind === 'lost' ? 'Report something lost' : 'Report something found'}
        badge={<Pill tone="demo">Demo · nobody is notified</Pill>}
      />
      <Link to="/community/lost-found" className="text-sm font-medium text-coffee underline">
        Back to Lost & Found
      </Link>
      <p role="note" className="rounded-md border border-border-strong bg-mist p-3 text-sm">
        Do not type a real ID number, phone number or exact room. This prototype keeps what you
        enter as plain text in this browser only.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(true)
        }}
      >
        <Field label="Title (public)">
          {(a) => (
            <input
              {...a}
              className={inputClass}
              maxLength={80}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <Field label="Category (public)">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={category}
              onChange={(e) => setCategory(e.target.value as Report['category'])}
            >
              {ITEM_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel[c]}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Description (public, optional)">
          {(a) => (
            <textarea
              {...a}
              rows={2}
              maxLength={300}
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-3">
          <Field label="Colour (public, optional)">
            {(a) => (
              <input
                {...a}
                className={`${inputClass} w-40`}
                value={colour}
                onChange={(e) => setColour(e.target.value)}
              />
            )}
          </Field>
          <Field
            label="Approximate date (optional)"
            hint="Leave blank if you do not know. It is not filled in for you."
          >
            {(a) => (
              <input
                {...a}
                type="date"
                className={`${inputClass} w-44`}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            )}
          </Field>
          <Field label="General area (public, optional)">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} w-44`}
                value={area}
                onChange={(e) => setArea(e.target.value)}
              >
                <option value="">Not provided</option>
                {AREAS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>
        <Field
          label="Picture (optional)"
          hint="JPEG, PNG or WebP up to 2 MB. Only the file name and size are kept; the picture is not stored or scanned."
        >
          {(a) => (
            <input
              {...a}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (!f) {
                  setPhoto(undefined)
                  setPhotoError('')
                  return
                }
                const bad = validatePhoto(f)
                if (bad) {
                  setPhoto(undefined)
                  setPhotoError(bad)
                  return
                }
                setPhotoError('')
                setPhoto({ name: f.name, mime: f.type as PhotoMeta['mime'], sizeBytes: f.size })
              }}
            />
          )}
        </Field>
        {photoError ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {photoError} Your other answers are kept.
          </p>
        ) : null}
        {photo ? (
          <p className="text-sm">
            Recorded: {photo.name} ({Math.round(photo.sizeBytes / 1024)} KB). No picture is shown; a
            category icon is used.
          </p>
        ) : null}
        <Field
          label={
            kind === 'found'
              ? 'Private identifying details (only you see this)'
              : 'Private identifying details (only you see this, optional)'
          }
          hint="Something only the owner would know."
        >
          {(a) => (
            <textarea
              {...a}
              rows={2}
              maxLength={300}
              className={inputClass}
              value={priv}
              onChange={(e) => setPriv(e.target.value)}
            />
          )}
        </Field>
        <SectionCard id="rn-prev-h" title="Preview: what others will see">
          <p>
            <strong>{title || 'Untitled'}</strong> · {categoryLabel[category]} ·{' '}
            {area || 'area not provided'}
          </p>
          <p className="text-ink-muted">
            Private details stay hidden: {priv ? 'yes, you entered some' : 'none entered'}.
          </p>
        </SectionCard>
        {dup ? (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={confirmDup}
              onChange={(e) => setConfirmDup(e.target.checked)}
            />
            You already have a similar open report ("{dup.title}"). This is a different item.
          </label>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11">
            Publish locally
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => void submit(false)}
          >
            Save as draft
          </Button>
        </div>
      </form>
    </article>
  )
}

export function ReportDetailPage() {
  const { reportId = '' } = useParams()
  const { community, status, profileId, repo, showDemoOps } = useCommunity()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [answer, setAnswer] = useState('')
  const [claimError, setClaimError] = useState('')
  const [editing, setEditing] = useState(false)
  const [eTitle, setETitle] = useState('')
  const [eDesc, setEDesc] = useState('')
  if (status === 'loading' || !community) return <Loading />
  const raw = community.reports.find((r) => r.id === reportId)
  const visible = raw && (raw.ownerProfileId === profileId || raw.status !== 'draft')
  if (!raw || !visible)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Report not found" />
        <Empty>
          This report does not exist, or it is a draft that only its owner can see.{' '}
          <Link to="/community/lost-found" className="underline">
            Back to Lost & Found
          </Link>
        </Empty>
      </article>
    )
  const r = viewReport(raw, profileId)
  const own = raw.ownerProfileId === profileId
  const matches = own ? matchCandidates(community, raw) : []
  const myClaim = community.claims.find(
    (c) =>
      c.reportId === r.id && c.claimantProfileId === profileId && CLAIM_ACTIVE.includes(c.status),
  )
  const approvedClaim = community.claims.find(
    (c) => c.reportId === r.id && c.status === 'demoApproved' && c.claimantProfileId === profileId,
  )
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={r.title} badge={<Pill tone="demo">Demo · sample report</Pill>} />
      <Link to="/community/lost-found" className="text-sm font-medium text-coffee underline">
        Back to Lost & Found
      </Link>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard
        id="rd-info-h"
        title={r.kind === 'lost' ? 'Lost item' : 'Found item'}
        action={
          <Pill tone={r.status === 'published' ? 'plain' : 'warn'}>
            {reportStatusLabel[r.status]}
          </Pill>
        }
      >
        <div className="flex gap-3">
          <ItemIcon category={r.category} />
          <dl className="grid flex-1 gap-1 sm:grid-cols-2">
            <div>
              <dt className="font-medium">Category</dt>
              <dd>{categoryLabel[r.category]}</dd>
            </div>
            <div>
              <dt className="font-medium">General area</dt>
              <dd>{r.area ?? 'Not provided'}</dd>
            </div>
            <div>
              <dt className="font-medium">Approximate date</dt>
              <dd>{r.approxDate ? formatDateShort(r.approxDate) : 'Unknown'}</dd>
            </div>
            <div>
              <dt className="font-medium">Colour</dt>
              <dd>{r.colour ?? 'Not provided'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-medium">Description</dt>
              <dd>{r.description ?? 'Not provided'}</dd>
            </div>
            {r.photo ? (
              <div className="sm:col-span-2">
                <dt className="font-medium">Picture</dt>
                <dd>{r.photo.name} was recorded; no picture is shown on this device.</dd>
              </div>
            ) : null}
          </dl>
        </div>
        {r.status === 'returned' ? (
          <p className="mt-2 rounded-md bg-mist p-2">
            Returned on this device{raw.handoverAt ? ` on ${formatInstant(raw.handoverAt)}` : ''}.
            This is not a legal record.
          </p>
        ) : null}
        {own ? (
          <div className="mt-3 border-t border-border pt-3">
            <h3 className="font-medium">Private to you</h3>
            <p>{raw.privateDetails ?? 'No private details were entered.'}</p>
            <p className="mt-1 text-ink-muted">
              {waitingClaimCount(community, r.id)} claim(s) waiting. Claimants and their answers are
              never shown to you here.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {raw.status === 'draft' ? (
                <Button
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.publishReport(profileId, r.id),
                      'Report published on this device.',
                    )
                  }
                >
                  Publish locally
                </Button>
              ) : null}
              {raw.status === 'draft' || raw.status === 'published' ? (
                <>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={() => {
                      setEditing(!editing)
                      setETitle(raw.title)
                      setEDesc(raw.description ?? '')
                    }}
                  >
                    {editing ? 'Cancel edit' : 'Edit report'}
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11"
                    onClick={async () => {
                      const c = await confirm({
                        title: 'Close this report?',
                        description: (
                          <p>
                            It leaves the active lists. Any waiting claim ends. Your history is
                            kept.
                          </p>
                        ),
                        confirmLabel: 'Close report',
                      })
                      if (c === 'confirm')
                        await act(() => repo.closeReport(profileId, r.id), 'Report closed.')
                    }}
                  >
                    Close report
                  </Button>
                </>
              ) : null}
            </div>
            {editing ? (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  const ok = await act(
                    () =>
                      repo.updateReport(profileId, r.id, {
                        title: eTitle,
                        category: raw.category,
                        description: eDesc,
                        colour: raw.colour,
                        approxDate: raw.approxDate,
                        area: raw.area,
                        privateDetails: raw.privateDetails,
                      }),
                    'Report updated.',
                  )
                  if (ok.ok) setEditing(false)
                }}
              >
                <Field label="Title">
                  {(a) => (
                    <input
                      {...a}
                      className={inputClass}
                      value={eTitle}
                      onChange={(e) => setETitle(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="Description">
                  {(a) => (
                    <textarea
                      {...a}
                      rows={2}
                      className={inputClass}
                      value={eDesc}
                      onChange={(e) => setEDesc(e.target.value)}
                    />
                  )}
                </Field>
                <Button type="submit" className="min-h-11 self-start">
                  Save changes
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}
      </SectionCard>
      {own ? (
        <SectionCard id="rd-match-h" title="Possible matches">
          {matches.length === 0 ? (
            <Empty>
              No possible match right now. A suggestion needs a matching category and at least one
              more matching detail on both reports.
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {matches.map((m) => (
                <li key={m.report.id} className="rounded-md border border-border p-3">
                  <Pill>Possible match</Pill>{' '}
                  <Link
                    to={`/community/lost-found/${m.report.id}`}
                    className="font-medium text-coffee underline"
                  >
                    {m.report.title}
                  </Link>
                  <p className="text-sm text-ink-muted">
                    Why: {m.signals.join(', ')}. This is a suggestion only, not proof that it is
                    yours.
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
      {!own && r.kind === 'found' && r.status === 'published' ? (
        <SectionCard id="rd-claim-h" title="Is this yours?">
          {myClaim ? (
            <p>
              You have a claim for this item.{' '}
              <Link
                to={`/community/lost-found/claims/${myClaim.id}`}
                className="font-medium text-coffee underline"
              >
                Open your claim
              </Link>
            </p>
          ) : (
            <form
              className="flex flex-col gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                setClaimError('')
                const res = await act(
                  () => repo.submitClaim(profileId, r.id, answer),
                  'Claim recorded on this device.',
                )
                if (res.ok) setAnswer('')
                else setClaimError(res.error.message)
              }}
            >
              <Field
                label="Something only the owner would know (kept private)"
                hint="Other people never see your answer. A claim is a request, not proof."
              >
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={300}
                    className={inputClass}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                  />
                )}
              </Field>
              {claimError ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {claimError}
                </p>
              ) : null}
              <Button type="submit" className="min-h-11 self-start">
                Request to claim
              </Button>
            </form>
          )}
        </SectionCard>
      ) : null}
      {approvedClaim ? (
        <p className="text-sm">
          Your claim was approved on this device.{' '}
          <Link to={`/community/lost-found/claims/${approvedClaim.id}`} className="underline">
            Open it
          </Link>
        </p>
      ) : null}
      {own ? (
        <SectionCard id="rd-hist-h" title="History">
          <ol className="flex flex-col gap-1">
            {raw.history.map((h) => (
              <li key={h.id}>
                {formatInstant(h.at)} ·{' '}
                {h.actorType === 'student' ? 'You' : `Simulated (${h.actorType})`} · {h.eventType}
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}
      {showDemoOps ? <CommunityOps section="lostfound" /> : null}
    </article>
  )
}

export function ClaimPage() {
  const { claimId = '' } = useParams()
  const { community, status, profileId, repo } = useCommunity()
  const { act, message } = useAction()
  const confirm = useConfirm()
  if (status === 'loading' || !community) return <Loading />
  const c = community.claims.find((x) => x.id === claimId && x.claimantProfileId === profileId)
  if (!c)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Claim not found" />
        <Empty>
          This claim is not in your records. Claims are private to the person who made them.{' '}
          <Link to="/community/lost-found" className="underline">
            Back to Lost & Found
          </Link>
        </Empty>
      </article>
    )
  const report = community.reports.find((r) => r.id === c.reportId)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="Your claim"
        badge={<Pill tone="demo">Demo · not proof of ownership</Pill>}
      />
      <Link
        to="/community/lost-found?tab=mine"
        className="text-sm font-medium text-coffee underline"
      >
        Back to my reports
      </Link>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard
        id="cl-sum-h"
        title={report?.title ?? 'Item'}
        action={<Pill>{claimStatusLabel[c.status]}</Pill>}
      >
        <p>
          <strong>Your private answer:</strong> {c.privateAnswer}
        </p>
        {c.decisionReason ? (
          <p className="mt-1">
            <strong>Reason:</strong> {c.decisionReason}
          </p>
        ) : null}
        {c.status === 'demoApproved' && report?.status === 'returned' ? (
          <p className="mt-1">Handover recorded on this device.</p>
        ) : null}
        {c.status === 'demoApproved' && report?.status !== 'returned' ? (
          <p className="mt-1">Approved on this device. The handover step is still pending.</p>
        ) : null}
        {CLAIM_ACTIVE.includes(c.status) ? (
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={async () => {
              const ok = await confirm({
                title: 'Withdraw this claim?',
                description: <p>Your history is kept.</p>,
                confirmLabel: 'Withdraw claim',
              })
              if (ok === 'confirm')
                await act(() => repo.withdrawClaim(profileId, c.id), 'Claim withdrawn.')
            }}
          >
            Withdraw claim
          </Button>
        ) : null}
        {report ? (
          <p className="mt-2">
            <Link to={`/community/lost-found/${report.id}`} className="underline">
              Open the item
            </Link>
          </p>
        ) : null}
      </SectionCard>
      <SectionCard id="cl-hist-h" title="History">
        <ol className="flex flex-col gap-1">
          {c.history.map((h) => (
            <li key={h.id}>
              {formatInstant(h.at)} · {h.actorType === 'student' ? 'You' : `Simulated reviewer`} ·{' '}
              {h.eventType}
              {h.reason ? ` · ${h.reason}` : ''}
            </li>
          ))}
        </ol>
      </SectionCard>
      <p role="note" className="rounded-md border border-border-strong bg-mist p-3 text-sm">
        In-app only. Nobody was contacted, and this is not a real security or lost-property
        decision.
      </p>
    </article>
  )
}
