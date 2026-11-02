import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/confirm-context'
import { SPORTS, fixtureStatusLabel, teamStatusLabel, type Team } from '@/domain/community'
import { activeRequest, needOpen, spotsLeft } from '@/domain/community-logic'
import { formatDateShort, formatInstant, isDateOnly, type DateOnly } from '@/lib/time'
import {
  closedNeeds,
  fixtureTeams,
  listFixtures,
  myRequests,
  myTeams,
  openNeeds,
  requestsForCaptain,
} from '@/selectors/community'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import {} from './community-common'
import { communityTabs } from './community-nav'
import { useCommunity } from './community-hooks'
import { CommunityOps } from './community-ops'

const TABS = [
  { id: 'fixtures', label: 'Fixtures' },
  { id: 'teams', label: 'Find a team' },
  { id: 'looking', label: 'Looking for players' },
  { id: 'create', label: 'Create a team' },
] as const

const timeText = (f: { date?: string; start?: string; end?: string }) =>
  `${f.date ? formatDateShort(f.date as DateOnly) : 'date not provided'} · ${f.start && f.end ? `${f.start}–${f.end}` : 'time not provided'}`

export function SportsPage() {
  const { community, status, profileId, now, repo, showDemoOps } = useCommunity()
  const [params, setParams] = useSearchParams()
  const tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'fixtures'
  const nav = useNavigate()
  const { act } = useAction()
  const [sport, setSport] = useState('')
  const [when, setWhen] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [teamId, setTeamId] = useState('')
  const [cSport, setCSport] = useState<string>(SPORTS[0])
  const [cName, setCName] = useState('')
  const [cMax, setCMax] = useState('')
  const [cDesc, setCDesc] = useState('')
  const [error, setError] = useState('')
  if (status === 'loading' || !community) return <Loading />
  const fixtures = listFixtures(community, { sport, when, teamId }, now.today)
  const recruiting = community.teams.filter(
    (t) => t.status === 'recruiting' && (sport ? t.sport === sport : true),
  )
  const needs = openNeeds(community, now.today)
  const closed = closedNeeds(community, now.today)
  return (
    <article className="flex max-w-5xl flex-col gap-4">
      <PageHeader
        title="Sports & Teams"
        description="Fixtures, teams and player sign-ups. Registering a team does not book a court, and no real committee sees anything here."
        badge={<Pill tone="demo">Local · simulated committee</Pill>}
      />
      <SubNav label="Community sections" items={communityTabs} current="sports" />
      <p>
        <Link
          to="/community/sports-events/my-participation"
          className="font-medium text-coffee underline"
        >
          My participation
        </Link>
      </p>
      <div
        role="tablist"
        aria-label="Sports sections"
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
      {tab !== 'create' ? (
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Sport">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} w-40`}
                value={sport}
                onChange={(e) => setSport(e.target.value)}
              >
                <option value="">All</option>
                {SPORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            )}
          </Field>
          {tab === 'fixtures' ? (
            <>
              <Field label="When">
                {(a) => (
                  <select
                    {...a}
                    className={`${inputClass} w-40`}
                    value={when}
                    onChange={(e) => setWhen(e.target.value as typeof when)}
                  >
                    <option value="upcoming">Upcoming or undated</option>
                    <option value="past">Past</option>
                    <option value="all">All</option>
                  </select>
                )}
              </Field>
              <Field label="Team">
                {(a) => (
                  <select
                    {...a}
                    className={`${inputClass} w-52`}
                    value={teamId}
                    onChange={(e) => setTeamId(e.target.value)}
                  >
                    <option value="">Any team</option>
                    {community.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.sport})
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </>
          ) : null}
        </div>
      ) : null}
      {tab === 'fixtures' ? (
        fixtures.length === 0 ? (
          <Empty>No fixture matches these filters.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {fixtures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-surface p-3"
              >
                <span>
                  <Link
                    to={`/community/sports-events/fixtures/${f.id}`}
                    className="font-medium text-coffee underline"
                  >
                    {f.title}
                  </Link>
                  <span className="block text-sm text-ink-muted">
                    {f.sport} · {timeText(f)} · {f.venue ?? 'venue not provided'}
                  </span>
                </span>
                <Pill
                  tone={f.status === 'cancelled' || f.status === 'rescheduled' ? 'warn' : 'plain'}
                >
                  {fixtureStatusLabel[f.status]}
                </Pill>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === 'teams' ? (
        recruiting.length === 0 ? (
          <Empty>No team is recruiting for this sport.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {recruiting.map((t) => (
              <li key={t.id} className="rounded-lg border border-border bg-surface p-4">
                <Link
                  to={`/community/sports-events/teams/${t.id}`}
                  className="text-base font-semibold text-coffee underline"
                >
                  {t.name}
                </Link>
                <p className="text-sm text-ink-muted">
                  {t.sport} · Captain: {t.captainLabel}
                </p>
                <p className="text-sm">
                  {t.members.length} of {t.maxRoster} places filled · {spotsLeft(t)} left
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === 'looking' ? (
        <>
          {needs.length === 0 ? (
            <Empty>No team is looking for players right now.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {needs
                .filter(
                  (n) => !sport || community.teams.find((t) => t.id === n.teamId)?.sport === sport,
                )
                .map((n) => {
                  const t = community.teams.find((x) => x.id === n.teamId)!
                  return (
                    <li key={n.id} className="rounded-md border border-border bg-surface p-3">
                      <strong>{t.name}</strong> ({t.sport}): {n.description}
                      {n.positions ? ` · ${n.positions}` : ''}
                      <p className="text-sm text-ink-muted">
                        Open until {formatDateShort(n.expiresOn)} ·{' '}
                        <Link to={`/community/sports-events/teams/${t.id}`} className="underline">
                          See the team
                        </Link>
                      </p>
                    </li>
                  )
                })}
            </ul>
          )}
          {closed.length > 0 ? (
            <p className="text-sm text-ink-muted">
              {closed.length} earlier post(s) have closed and no longer show a sign-up.
            </p>
          ) : null}
        </>
      ) : null}
      {tab === 'create' ? (
        <SectionCard id="sp-create-h" title="Create a team">
          <p role="note" className="mb-2 rounded-md bg-mist p-2">
            A team here is a sample roster only. It is not entered into any real event.
          </p>
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              setError('')
              const max = cMax.trim() === '' ? undefined : Number(cMax)
              const r = await act(
                () =>
                  repo.createTeam(profileId, {
                    sport: cSport as Team['sport'],
                    name: cName,
                    ...(max !== undefined ? { maxRoster: max } : {}),
                    description: cDesc,
                  }),
                'Team created on this device.',
              )
              if (r.ok) nav(`/community/sports-events/teams/${r.value.id}`)
              else setError(r.error.message)
            }}
          >
            <Field label="Sport">
              {(a) => (
                <select
                  {...a}
                  className={inputClass}
                  value={cSport}
                  onChange={(e) => setCSport(e.target.value)}
                >
                  {SPORTS.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              )}
            </Field>
            <Field label="Team name">
              {(a) => (
                <input
                  {...a}
                  className={inputClass}
                  maxLength={40}
                  value={cName}
                  onChange={(e) => setCName(e.target.value)}
                />
              )}
            </Field>
            <Field
              label="Maximum roster"
              hint={`Left blank, the demo setting of ${community.config.defaultMaxRoster} is used. The real limit is unknown.`}
            >
              {(a) => (
                <input
                  {...a}
                  inputMode="numeric"
                  className={`${inputClass} w-32`}
                  value={cMax}
                  onChange={(e) => setCMax(e.target.value)}
                />
              )}
            </Field>
            <Field label="Description (optional)">
              {(a) => (
                <textarea
                  {...a}
                  rows={2}
                  maxLength={200}
                  className={inputClass}
                  value={cDesc}
                  onChange={(e) => setCDesc(e.target.value)}
                />
              )}
            </Field>
            {error ? (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" className="min-h-11 self-start">
              Create team
            </Button>
          </form>
        </SectionCard>
      ) : null}
      {showDemoOps ? <CommunityOps section="sports" /> : null}
    </article>
  )
}

export function TeamPage() {
  const { teamId = '' } = useParams()
  const { community, status, profileId, now, repo, showDemoOps } = useCommunity()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [need, setNeed] = useState('')
  const [positions, setPositions] = useState('')
  const [expires, setExpires] = useState('')
  if (status === 'loading' || !community) return <Loading />
  const t = community.teams.find((x) => x.id === teamId)
  if (!t)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Team not found" />
        <Empty>
          <Link to="/community/sports-events" className="underline">
            Back to Sports & Teams
          </Link>
        </Empty>
      </article>
    )
  const me = { kind: 'student' as const, profileId }
  const captain = t.captainProfileId === profileId
  const member = t.members.includes(profileId)
  const mine = activeRequest(community, t.id, profileId)
  const waiting = community.joinRequests.filter(
    (r) => r.teamId === t.id && r.status === 'requested',
  )
  const needs = community.needs.filter((n) => n.teamId === t.id)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title={t.name}
        description={`${t.sport} · ${t.description ?? 'No description'}`}
        badge={<Pill tone="demo">Illustrative team</Pill>}
      />
      <Link to="/community/sports-events" className="text-sm font-medium text-coffee underline">
        Back to Sports & Teams
      </Link>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard id="tm-sum-h" title="Roster" action={<Pill>{teamStatusLabel[t.status]}</Pill>}>
        <p>Captain: {t.captainLabel}</p>
        <p>
          {t.members.length} of {t.maxRoster} places filled by accepted members ({spotsLeft(t)}{' '}
          left). Waiting requests are not counted.
        </p>
        <p className="text-ink-muted">
          Being on this roster is not committee approval for any event, and it does not reserve a
          court or pitch.
        </p>
        {member && !captain ? (
          <Button
            variant="outline"
            className="mt-2 min-h-11"
            onClick={async () => {
              const ok = await confirm({
                title: 'Leave this team?',
                description: <p>Your place becomes free for someone else.</p>,
                confirmLabel: 'Leave team',
              })
              if (ok === 'confirm')
                await act(() => repo.leaveTeam(profileId, t.id), 'You left the team.')
            }}
          >
            Leave team
          </Button>
        ) : null}
        {!member && !mine ? (
          <Button
            className="mt-2 min-h-11"
            disabled={t.status !== 'recruiting' || spotsLeft(t) <= 0}
            onClick={() =>
              void act(
                () => repo.requestJoin(profileId, t.id),
                'Join request recorded on this device.',
              )
            }
          >
            Request to join
          </Button>
        ) : null}
        {!member && (t.status !== 'recruiting' || spotsLeft(t) <= 0) && !mine ? (
          <p className="mt-1 text-sm">
            {t.status !== 'recruiting' ? 'This team is not recruiting.' : 'This team is full.'}
          </p>
        ) : null}
        {mine ? (
          <p className="mt-2">
            Your request is waiting for the captain.{' '}
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void act(() => repo.withdrawJoin(profileId, mine.id), 'Request withdrawn.')
              }
            >
              Withdraw request
            </Button>
          </p>
        ) : null}
      </SectionCard>
      {captain ? (
        <SectionCard id="tm-cap-h" title="Captain controls">
          {waiting.length === 0 ? (
            <p>No request is waiting.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {waiting.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3"
                >
                  <span>
                    {r.profileId === 'demo-student-a'
                      ? 'Reference Student A'
                      : r.profileId === 'demo-student-b'
                        ? 'Reference Student B'
                        : r.profileId}
                  </span>
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() =>
                      void act(() => repo.decideJoin(me, t.id, r.id, 'accept'), 'Request accepted.')
                    }
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() =>
                      void act(() => repo.decideJoin(me, t.id, r.id, 'reject'), 'Request declined.')
                    }
                  >
                    Decline
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {t.status === 'recruiting' ? (
              <Button
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void act(() => repo.setRecruiting(me, t.id, false), 'Roster closed.')
                }
              >
                Close roster
              </Button>
            ) : null}
            {t.status === 'rosterClosed' ? (
              <>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void act(() => repo.setRecruiting(me, t.id, true), 'Recruiting again.')
                  }
                >
                  Reopen roster
                </Button>
                <Button
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.submitTeam(me, t.id),
                      'Submitted for demo approval. No real committee received it.',
                    )
                  }
                >
                  Submit for demo approval
                </Button>
              </>
            ) : null}
            {t.status !== 'withdrawn' ? (
              <Button
                variant="outline"
                className="min-h-11 border-danger text-danger"
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Cancel this team?',
                    description: <p>Members are told in the app. The history is kept.</p>,
                    confirmLabel: 'Cancel team',
                    danger: true,
                  })
                  if (ok === 'confirm')
                    await act(() => repo.cancelTeam(me, t.id), 'Team cancelled.')
                }}
              >
                Cancel team
              </Button>
            ) : null}
          </div>
          {t.status === 'recruiting' ? (
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const r = await act(
                  () =>
                    repo.postNeed(me, t.id, {
                      description: need,
                      positions,
                      expiresOn: expires as DateOnly,
                    }),
                  'Post added.',
                )
                if (r.ok) {
                  setNeed('')
                  setPositions('')
                }
              }}
            >
              <Field label="Looking for players">
                {(a) => (
                  <input
                    {...a}
                    className={`${inputClass} w-64`}
                    value={need}
                    onChange={(e) => setNeed(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Positions (optional)">
                {(a) => (
                  <input
                    {...a}
                    className={`${inputClass} w-36`}
                    value={positions}
                    onChange={(e) => setPositions(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Open until">
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    className={inputClass}
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" className="min-h-11" disabled={!isDateOnly(expires)}>
                Post
              </Button>
            </form>
          ) : null}
        </SectionCard>
      ) : null}
      {needs.length > 0 ? (
        <SectionCard id="tm-needs-h" title="Looking for players">
          <ul className="flex flex-col gap-1">
            {needs.map((n) => (
              <li key={n.id}>
                {n.description} ·{' '}
                {needOpen(n, now.today) ? `open until ${formatDateShort(n.expiresOn)}` : 'closed'}
                {captain && needOpen(n, now.today) ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-2 min-h-11"
                    onClick={() => void act(() => repo.closeNeed(me, n.id), 'Post closed.')}
                  >
                    Close post
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}
      <SectionCard id="tm-hist-h" title="History">
        {t.history.length === 0 ? (
          <p>No event yet.</p>
        ) : (
          <ol>
            {t.history.map((h) => (
              <li key={h.id}>
                {formatInstant(h.at)} ·{' '}
                {h.actorType === 'student' ? 'A student' : `Simulated (${h.actorType})`} ·{' '}
                {h.eventType}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
      {showDemoOps ? <CommunityOps section="sports" /> : null}
    </article>
  )
}

export function FixturePage() {
  const { fixtureId = '' } = useParams()
  const { community, status, showDemoOps } = useCommunity()
  if (status === 'loading' || !community) return <Loading />
  const f = community.fixtures.find((x) => x.id === fixtureId)
  if (!f)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Fixture not found" />
        <Empty>
          <Link to="/community/sports-events" className="underline">
            Back to Sports & Teams
          </Link>
        </Empty>
      </article>
    )
  const known = !!(f.date && f.start && f.end)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={f.title} badge={<Pill tone="demo">Illustrative fixture</Pill>} />
      <Link to="/community/sports-events" className="text-sm font-medium text-coffee underline">
        Back to Sports & Teams
      </Link>
      <SectionCard
        id="fx-sum-h"
        title="Match details"
        action={
          <Pill tone={f.status === 'cancelled' || f.status === 'rescheduled' ? 'warn' : 'plain'}>
            {fixtureStatusLabel[f.status]}
          </Pill>
        }
      >
        <dl className="grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="font-medium">Date</dt>
            <dd>{f.date ? formatDateShort(f.date) : 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Time</dt>
            <dd>{f.start && f.end ? `${f.start}–${f.end}` : 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Venue</dt>
            <dd>{f.venue ?? 'Not provided'}</dd>
          </div>
          <div>
            <dt className="font-medium">Result</dt>
            <dd>{f.result ?? 'No result recorded'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="font-medium">Teams</dt>
            <dd>
              {fixtureTeams(community, f).map((t) => (
                <Link
                  key={t.id}
                  to={`/community/sports-events/teams/${t.id}`}
                  className="mr-3 underline"
                >
                  {t.name}
                </Link>
              ))}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-ink-muted">
          {f.sourceLabel}. A court or pitch is not booked by this fixture.
        </p>
        {known && f.date ? (
          <p className="mt-2">
            <Link
              to={`/calendar?view=agenda&date=${f.date}`}
              className="font-medium text-coffee underline"
            >
              See it on the Calendar
            </Link>{' '}
            (shown only if you are on a participating team, and only with a preset that includes
            Sports items, such as “Campus Life”)
          </p>
        ) : (
          <p className="mt-2">It has no confirmed time yet, so it is not on any Calendar.</p>
        )}
      </SectionCard>
      <SectionCard id="fx-hist-h" title="Change history">
        {f.revisions.length === 0 ? (
          <p>This fixture has not changed.</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {f.revisions.map((r) => (
              <li key={r.version}>
                Version {r.version} (until {formatInstant(r.at)}): {timeText(r)} ·{' '}
                {r.venue ?? 'venue not provided'}
                {r.reason ? ` · ${r.reason}` : ''}
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
      {showDemoOps ? <CommunityOps section="sports" /> : null}
    </article>
  )
}

export function ParticipationPage() {
  const { community, status, profileId } = useCommunity()
  if (status === 'loading' || !community) return <Loading />
  const teams = myTeams(community, profileId)
  const reqs = myRequests(community, profileId)
  const cap = requestsForCaptain(community, profileId)
  const fx = community.fixtures.filter((f) =>
    f.teamIds.some((id) => teams.some((t) => t.id === id && t.members.includes(profileId))),
  )
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader
        title="My participation"
        badge={<Pill tone="demo">Local · your own teams and requests</Pill>}
      />
      <Link to="/community/sports-events" className="text-sm font-medium text-coffee underline">
        Back to Sports & Teams
      </Link>
      <SectionCard id="mp-teams-h" title={`Your teams (${teams.length})`}>
        {teams.length === 0 ? (
          <Empty>You are not on a team.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {teams.map((t) => (
              <li key={t.id}>
                <Link
                  to={`/community/sports-events/teams/${t.id}`}
                  className="font-medium text-coffee underline"
                >
                  {t.name}
                </Link>{' '}
                · {t.sport} · {teamStatusLabel[t.status]}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="mp-req-h" title={`Your join requests (${reqs.length})`}>
        {reqs.length === 0 ? (
          <Empty>You have not asked to join a team.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {reqs.map((r) => (
              <li key={r.id}>
                <Link to={`/community/sports-events/teams/${r.teamId}`} className="underline">
                  {community.teams.find((t) => t.id === r.teamId)?.name ?? 'Team'}
                </Link>{' '}
                ·{' '}
                {r.status === 'requested'
                  ? 'waiting for the captain'
                  : r.status === 'accepted'
                    ? 'accepted (not committee approval)'
                    : r.status === 'rejected'
                      ? 'not accepted'
                      : 'withdrawn'}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {cap.length > 0 ? (
        <p className="rounded-md bg-mist p-3">
          {cap.length} request(s) are waiting for your decision on a team you captain.
        </p>
      ) : null}
      <SectionCard id="mp-fx-h" title="Your fixtures">
        {fx.length === 0 ? (
          <Empty>No fixture is linked to your teams.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {fx.map((f) => (
              <li key={f.id}>
                <Link to={`/community/sports-events/fixtures/${f.id}`} className="underline">
                  {f.title}
                </Link>{' '}
                · {timeText(f)} · {fixtureStatusLabel[f.status]}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </article>
  )
}
