import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { isSafeUrl } from '@/domain/academics-logic'
import { formatDateShort, isDateOnly, type DateOnly, type LocalTime } from '@/lib/time'
import { conflictsForSlot } from '@/selectors/conflicts'
import { itemsOnDate } from '@/selectors/occurrences'
import { useCampusData } from '@/hooks/use-campus-data'
import { clubRecruitment, eventsOf, isFollowing, listClubs } from '@/selectors/community'
import { myMeetings } from '@/selectors/academics'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useAcademics } from '../academics/academics-hooks'
import { AcademicsOps } from '../academics/academics-ops'
import {} from './community-common'
import { clubStatusLabel } from './community-nav'
import { communityTabs } from './community-nav'
import { useCommunity } from './community-hooks'
import { CommunityOps } from './community-ops'

const RECRUIT_TEXT = {
  notAnnounced: 'Recruitment not announced',
  open: 'Recruitment open',
  closingSoon: 'Recruitment closing soon',
  closed: 'Recruitment closed',
  archived: 'Recruitment archived',
} as const

export function ClubsPage() {
  const { community, status, now, showDemoOps } = useCommunity()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('')
  if (status === 'loading' || !community) return <Loading />
  const rows = listClubs(community, q, cat)
  return (
    <article className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Clubs & Committees"
        description="Clubs and committees listed in supplied research; BMS activity and contacts need confirmation. No phone number, handle or private contact is shown anywhere."
        badge={<Pill tone="demo">Source-labelled club directory</Pill>}
      />
      <SubNav label="Community sections" items={communityTabs} current="clubs" />
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Search clubs">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-56`}
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
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            >
              <option value="">All</option>
              {['Academic', 'Cultural', 'Sports', 'Social', 'Technical', 'committee'].map((c) => (
                <option key={c} value={c}>
                  {c === 'committee' ? 'Committees' : c}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Link
          to="/community/clubs/requests"
          className="min-h-11 py-2 font-medium text-coffee underline"
        >
          My club requests
        </Link>
      </div>
      {rows.length === 0 ? (
        <Empty>No club matches. Only the sample clubs listed on this device can be found.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link
                to={`/community/clubs/${c.id}`}
                className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
              >
                <span className="text-base font-semibold text-ink">{c.name}</span>
                <span className="text-sm text-ink-muted">
                  {c.type === 'committee' ? 'Committee' : 'Club'} · {c.category}
                </span>
                <span className="text-sm">{c.purpose}</span>
                <span>
                  <Pill>{RECRUIT_TEXT[clubRecruitment(community, c, now)]}</Pill>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {showDemoOps ? <CommunityOps section="clubs" /> : null}
    </article>
  )
}

const CLUB_TABS = ['overview', 'events', 'recruitment', 'roles', 'connect'] as const
const clubTabLabel: Record<(typeof CLUB_TABS)[number], string> = {
  overview: 'Overview',
  events: 'Events',
  recruitment: 'Recruitment',
  roles: 'Members & roles',
  connect: 'Connect',
}

export function ClubPage() {
  const { clubId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const nav = useNavigate()
  const { community, status, profileId, now, repo, academics, newId, showDemoOps } = useCommunity()
  const { data } = useCampusData()
  const { act } = useAction()
  const [key] = useState(() => newId('idem'))
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [purpose, setPurpose] = useState('Learn about a club')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  if (status === 'loading' || !community) return <Loading />
  const club = community.clubs.find((c) => c.id === clubId)
  if (!club)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Club not found" />
        <Empty>
          <Link to="/community/clubs" className="underline">
            Back to Clubs & Committees
          </Link>
        </Empty>
      </article>
    )
  const tab = (CLUB_TABS.find((t) => t === params.get('tab')) ??
    'overview') as (typeof CLUB_TABS)[number]
  const rec = clubRecruitment(community, club, now)
  const following = isFollowing(community, profileId, club.id)
  const events = eventsOf(community, club.id)
  const clashes =
    data && isDateOnly(date) && start && end
      ? conflictsForSlot(itemsOnDate(data, date as DateOnly), { date, start, end })
      : []
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title={club.name}
        description={club.purpose}
        badge={<Pill tone="demo">Source-labelled {club.type}</Pill>}
      />
      <Link to="/community/clubs" className="text-sm font-medium text-coffee underline">
        Back to Clubs & Committees
      </Link>
      <div
        role="tablist"
        aria-label="Club sections"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {CLUB_TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={`min-h-11 border-b-4 px-4 py-2 text-sm font-medium ${tab === t ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist'}`}
            onClick={() => setParams({ tab: t })}
          >
            {clubTabLabel[t]}
          </button>
        ))}
      </div>
      {tab === 'overview' ? (
        <SectionCard id="cb-ov-h" title="About">
          <p>{club.purpose}</p>
          <p className="mt-1 text-ink-muted">
            {club.category} · {club.sourceLabel}
          </p>
          <p className="mt-2">
            <Pill>{RECRUIT_TEXT[rec]}</Pill>{' '}
            {following ? <Pill>Following (not a membership)</Pill> : null}
          </p>
        </SectionCard>
      ) : null}
      {tab === 'events' ? (
        <SectionCard id="cb-ev-h" title="Events (samples)">
          {events.length === 0 ? (
            <Empty>No event is on record.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-md border border-border p-3">
                  <strong>{e.title}</strong>{' '}
                  {e.status !== 'scheduled' ? (
                    <Pill tone="warn">
                      {e.status === 'cancelled' ? 'Cancelled' : 'Rescheduled'}
                    </Pill>
                  ) : null}
                  <p>
                    {formatDateShort(e.date)} ·{' '}
                    {e.start && e.end ? `${e.start}–${e.end}` : 'time not provided'} ·{' '}
                    {e.venue ?? 'venue not provided'}
                  </p>
                  <p className="text-xs text-ink-muted">
                    {e.sourceLabel}
                    {following ? '' : ' · Follow this club to see its events on your Calendar.'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
      {tab === 'recruitment' ? (
        <SectionCard id="cb-rec-h" title="Recruitment">
          <p>
            <Pill>{RECRUIT_TEXT[rec]}</Pill>
          </p>
          <p className="mt-1">
            Opens:{' '}
            {club.recruitment.openDate
              ? formatDateShort(club.recruitment.openDate)
              : 'not provided'}{' '}
            · Closes:{' '}
            {club.recruitment.closeDate
              ? formatDateShort(club.recruitment.closeDate)
              : 'not provided'}{' '}
            (date only; no closing time is given)
          </p>
          {(rec === 'open' || rec === 'closingSoon') && isSafeUrl(club.recruitment.url) ? (
            <a
              href={club.recruitment.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex min-h-11 items-center font-medium text-coffee underline"
            >
              Open the application link<span className="sr-only"> (opens a new tab)</span>
            </a>
          ) : (
            <p className="mt-2">
              {rec === 'closed' || rec === 'archived'
                ? 'Recruitment is closed.'
                : 'Application link not provided. There is nothing to apply to from here.'}
            </p>
          )}
        </SectionCard>
      ) : null}
      {tab === 'roles' ? (
        <SectionCard id="cb-roles-h" title="Published roles">
          {club.roles.length === 0 ? (
            <Empty>No role is published for this {club.type}.</Empty>
          ) : (
            <ul className="list-disc pl-5">
              {club.roles.map((r) => (
                <li key={r.title}>
                  {r.title}: {r.holderLabel}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-ink-muted">
            Contact details are not shown. Use a conversation request instead.
          </p>
        </SectionCard>
      ) : null}
      {tab === 'connect' ? (
        <>
          <SectionCard id="cb-follow-h" title="Follow this club">
            <p>
              Following only puts its timed events on your Calendar and sends you in-app updates. It
              does not make you a member.
            </p>
            <p className="text-sm text-ink-muted">
              They are drawn as Club items. The default “Balanced Campus” Calendar preset hides Club
              and Sports items, so choose the “Campus Life” preset to see them.
            </p>
            <Button
              className="mt-2 min-h-11"
              variant={following ? 'outline' : 'default'}
              aria-pressed={following}
              onClick={() =>
                void act(
                  () => repo.setFollow(profileId, club.id, !following),
                  following ? 'You no longer follow this club.' : 'You follow this club.',
                )
              }
            >
              {following ? 'Unfollow' : 'Follow'}
            </Button>
          </SectionCard>
          <SectionCard id="cb-req-h" title="Request a conversation">
            <p role="note" className="mb-2 rounded-md bg-mist p-2">
              This is a local local request. It has not been sent to any club officer.
            </p>
            <form
              className="flex flex-col gap-3"
              onSubmit={async (e) => {
                e.preventDefault()
                setError('')
                if (!isDateOnly(date) || !start || !end)
                  return setError('Propose a date and start and end time.')
                const r = await act(
                  () =>
                    academics.submitMeeting(
                      profileId,
                      {
                        actorKind: 'club',
                        actorId: club.id,
                        actorLabel: club.name,
                        date: date as DateOnly,
                        start: start as LocalTime,
                        end: end as LocalTime,
                        topic: 'Learn about a club',
                        note: `${purpose}${note ? `: ${note}` : ''}`.slice(0, 300),
                      },
                      key,
                    ),
                  'Request recorded on this device.',
                )
                if (r.ok) nav('/community/clubs/requests')
                else setError(r.error.message)
              }}
            >
              <Field label="Purpose">
                {(a) => (
                  <select
                    {...a}
                    className={inputClass}
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                  >
                    {['Learn about a club', 'Recruitment', 'An event', 'Other'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                )}
              </Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Preferred date">
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
                <Field label="Start">
                  {(a) => (
                    <input
                      {...a}
                      type="time"
                      className={inputClass}
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  )}
                </Field>
                <Field label="End">
                  {(a) => (
                    <input
                      {...a}
                      type="time"
                      className={inputClass}
                      value={end}
                      onChange={(e) => setEnd(e.target.value)}
                    />
                  )}
                </Field>
              </div>
              <p className="text-sm text-ink-muted">
                No availability is published for this club, so you propose a time.
              </p>
              {clashes.length > 0 ? (
                <p
                  role="alert"
                  className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
                >
                  This overlaps {clashes.map((c) => c.title).join(', ')}. Nothing on your Calendar
                  is moved.
                </p>
              ) : null}
              <Field label="Note (optional)">
                {(a) => (
                  <textarea
                    {...a}
                    rows={2}
                    maxLength={200}
                    className={inputClass}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                )}
              </Field>
              {error ? (
                <p role="alert" className="text-sm font-medium text-danger">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="min-h-11 self-start">
                Record request locally
              </Button>
            </form>
          </SectionCard>
        </>
      ) : null}
      {showDemoOps ? <CommunityOps section="clubs" /> : null}
    </article>
  )
}

export function ClubRequestsPage() {
  const { academics, status, profileId, showDemoOps } = useAcademics()
  if (status === 'loading' || !academics) return <Loading />
  const rows = myMeetings(academics, profileId, 'club')
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="My club requests"
        badge={<Pill tone="demo">Local · recorded on this device only</Pill>}
      />
      <Link to="/community/clubs" className="text-sm font-medium text-coffee underline">
        Back to Clubs & Committees
      </Link>
      {rows.length === 0 ? (
        <Empty>You have no club requests yet.</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((m) => (
            <li
              key={m.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3"
            >
              <Link
                to={`/academics/appointments/${m.id}`}
                className="font-medium text-coffee underline"
              >
                {m.actorLabel ?? 'Club'} · {formatDateShort(m.date)} {m.start}–{m.end}
              </Link>
              <Pill
                tone={
                  ['rejectedDemo', 'withdrawn', 'cancelledDemo'].includes(m.status)
                    ? 'warn'
                    : 'plain'
                }
              >
                {clubStatusLabel[m.status]}
              </Pill>
            </li>
          ))}
        </ul>
      )}
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}
