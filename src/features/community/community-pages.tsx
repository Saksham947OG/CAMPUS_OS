import { Link } from 'react-router'
import { PageHeader } from '@/components/page-header'
import { claimStatusLabel, teamStatusLabel } from '@/domain/community'
import { formatDateShort } from '@/lib/time'
import { myClaims, myRequests, requestsForCaptain } from '@/selectors/community'
import { myMeetings } from '@/selectors/academics'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAcademics } from '../academics/academics-hooks'
import {} from './community-common'
import { communityTabs } from './community-nav'
import { useCommunity } from './community-hooks'
import { CommunityOps } from './community-ops'

export function CommunityHubPage() {
  const { community, status, profileId, now, showDemoOps } = useCommunity()
  const { academics } = useAcademics()
  if (status === 'loading' || !community) return <Loading />
  const follows = new Set(community.follows[profileId] ?? [])
  const events = community.clubEvents.filter(
    (e) => follows.has(e.clubId) && e.status !== 'cancelled' && e.date >= now.today,
  )
  const teams = new Set(
    community.teams.filter((t) => t.members.includes(profileId)).map((t) => t.id),
  )
  const fixtures = community.fixtures.filter(
    (f) =>
      f.status !== 'cancelled' &&
      f.teamIds.some((t) => teams.has(t)) &&
      (!f.date || f.date >= now.today),
  )
  const claims = myClaims(community, profileId)
  const reports = community.reports.filter((r) => r.ownerProfileId === profileId)
  const reqs = myRequests(community, profileId)
  const cap = requestsForCaptain(community, profileId)
  const clubReqs = academics ? myMeetings(academics, profileId, 'club') : []
  const card = (to: string, title: string, text: string) => (
    <li key={to}>
      <Link
        to={to}
        className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
      >
        <span className="text-base font-semibold text-ink">{title}</span>
        <span className="text-sm text-ink-muted">{text}</span>
      </Link>
    </li>
  )
  const activity = reports.length + claims.length + reqs.length + clubReqs.length
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Community"
        description="Supplied club information and proposed events, with local Lost & Found reports and sports team planning; nobody is messaged."
        badge={<Pill tone="demo">Campus community</Pill>}
      />
      <SubNav label="Community sections" items={communityTabs} current="hub" />
      <ul className="grid gap-3 sm:grid-cols-3">
        {card(
          '/community/lost-found',
          'Lost & Found',
          'Report and search for items. Claims stay private.',
        )}
        {card(
          '/community/clubs',
          'Clubs & Committees',
          'Browse fictional clubs and request a conversation.',
        )}
        {card('/community/sports-events', 'Sports & Teams', 'Fixtures, teams and open places.')}
      </ul>
      <SectionCard id="ch-next-h" title="Coming up for you">
        {events.length + fixtures.length === 0 ? (
          <Empty>
            Nothing yet. Follow a club or join a team and its events and fixtures show here.
          </Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {events.map((e) => (
              <li key={e.id}>
                {e.title} · {formatDateShort(e.date)} · {e.start ?? 'time not provided'}
              </li>
            ))}
            {fixtures.map((f) => (
              <li key={f.id}>
                <Link to={`/community/sports-events/fixtures/${f.id}`} className="underline">
                  {f.title}
                </Link>{' '}
                · {f.date ? formatDateShort(f.date) : 'date not provided'}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="ch-act-h" title={`Your activity (${activity})`}>
        {activity === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {reports.map((r) => (
              <li key={r.id}>
                <Link to={`/community/lost-found/${r.id}`} className="underline">
                  {r.title}
                </Link>{' '}
                · your {r.kind} report
              </li>
            ))}
            {claims.map((c) => (
              <li key={c.id}>
                <Link to={`/community/lost-found/claims/${c.id}`} className="underline">
                  Claim
                </Link>{' '}
                · {claimStatusLabel[c.status]}
              </li>
            ))}
            {reqs.map((r) => (
              <li key={r.id}>
                <Link to={`/community/sports-events/teams/${r.teamId}`} className="underline">
                  {community.teams.find((t) => t.id === r.teamId)?.name}
                </Link>{' '}
                · join request {r.status}
              </li>
            ))}
            {clubReqs.map((m) => (
              <li key={m.id}>
                <Link to={`/academics/appointments/${m.id}`} className="underline">
                  {m.actorLabel ?? 'Club'}
                </Link>{' '}
                · conversation request
              </li>
            ))}
          </ul>
        )}
        {cap.length > 0 ? (
          <p className="mt-2">{cap.length} join request(s) wait for your decision.</p>
        ) : null}
        <p className="mt-2 text-xs text-ink-muted">
          Team status words follow: {Object.values(teamStatusLabel).slice(0, 2).join(', ')}…
        </p>
      </SectionCard>
      {showDemoOps ? <CommunityOps section="lostfound" /> : null}
    </article>
  )
}
