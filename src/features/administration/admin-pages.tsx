import { ClipboardCheck, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  LEAVE_STATUSES,
  TICKET_STATUSES,
  leaveStatusLabel,
  ticketStatusLabel,
} from '@/domain/admin'
import { formatInstant } from '@/lib/time'
import { canonicalHref, filterRequests, myRequests, type RequestFilter } from '@/selectors/admin'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { DemoBanner, StatusPill } from './admin-common'
import { useAdmin } from './admin-hooks'
import { adminTabs } from './admin-nav'
import { AdminOps } from './admin-ops'

export function AdminHubPage() {
  const { admin, status, profileId, showDemoOps } = useAdmin()
  if (status === 'loading' || !admin) return <Loading />
  const rows = myRequests(admin, profileId)
  const open = rows.filter((r) => r.open)
  const card = (to: string, title: string, text: string, icon?: React.ReactNode) => (
    <li key={to}>
      <Link
        to={to}
        className="flex h-full flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
      >
        <span className="flex items-center gap-2 text-base font-semibold text-ink">
          {icon} {title}
        </span>
        <span className="text-sm text-ink-muted">{text}</span>
      </Link>
    </li>
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Administration"
        description="Leave and out-time, facility complaints and classroom equipment reports in one demonstration. Everything here is a record in this app only."
        badge={<Pill tone="demo">Demo · not an official system</Pill>}
      />
      <SubNav label="Administration sections" items={adminTabs} current="hub" />
      <DemoBanner>
        CampusOS is not connected to any office, warden, guard or maintenance team, and it is not
        for emergencies.
      </DemoBanner>
      <ul className="grid gap-3 sm:grid-cols-3">
        {card(
          '/administration/leave',
          'Leave and out-time',
          'Request time away and follow a simulated review.',
          <ClipboardCheck className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/administration/complaints',
          'Facility complaints',
          'Report plumbing, power, Wi-Fi, cleaning or washroom issues.',
          <Wrench className="size-5 text-coffee" aria-hidden="true" />,
        )}
        {card(
          '/administration/teaching-aids',
          'Teaching aids',
          'Report a faulty projector, microphone, AC or smartboard.',
        )}
      </ul>
      <SectionCard
        id="hub-mine-h"
        title={`Your open requests (${open.length})`}
        action={
          <Link to="/administration/requests" className="text-sm font-medium text-coffee underline">
            All my requests
          </Link>
        }
      >
        {open.length === 0 ? (
          <Empty>You have no open requests.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.slice(0, 4).map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  <strong>{r.title}</strong> · {r.kindLabel}
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill label={r.statusLabel} />
                  <Button asChild size="sm" variant="outline" className="min-h-11">
                    <Link to={r.href}>Open</Link>
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        A future appointments feature (the BMS Office) is not part of this module, so no link to it
        is offered.
      </p>
      {showDemoOps ? <AdminOps /> : null}
    </article>
  )
}

const STATUS_OPTIONS = [
  ...LEAVE_STATUSES.map((s) => ({ v: s, l: leaveStatusLabel[s] })),
  ...TICKET_STATUSES.filter((s) => !LEAVE_STATUSES.includes(s as never)).map((s) => ({
    v: s,
    l: ticketStatusLabel[s],
  })),
]

export function MyRequestsPage() {
  const { admin, status, profileId, showDemoOps } = useAdmin()
  const [f, setF] = useState<RequestFilter>({
    kind: '',
    status: '',
    state: '',
    query: '',
    from: '',
    to: '',
  })
  if (status === 'loading' || !admin) return <Loading />
  const all = myRequests(admin, profileId)
  const rows = filterRequests(all, f)
  const set = (patch: Partial<RequestFilter>) => setF({ ...f, ...patch })
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="My requests"
        description="Every request you have made on this device, in one place. Filters only change what is shown."
        badge={<Pill tone="demo">Demo · your records only</Pill>}
      />
      <SubNav label="Administration sections" items={adminTabs} current="requests" />
      <DemoBanner>
        Filters only change what is shown. Nothing here is an official record.
      </DemoBanner>
      <SectionCard id="mr-f-h" title="Filter">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Search">
            {(a) => (
              <input
                {...a}
                type="search"
                className={inputClass}
                value={f.query}
                onChange={(e) => set({ query: e.target.value })}
              />
            )}
          </Field>
          <Field label="Type">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={f.kind}
                onChange={(e) => set({ kind: e.target.value as RequestFilter['kind'] })}
              >
                <option value="">All types</option>
                <option value="leave">Leave and out-time</option>
                <option value="complaint">Facility complaints</option>
                <option value="teachingAid">Teaching-aid reports</option>
              </select>
            )}
          </Field>
          <Field label="Status">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={f.status}
                onChange={(e) => set({ status: e.target.value })}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.v} value={o.v}>
                    {o.l}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Open or finished">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={f.state}
                onChange={(e) => set({ state: e.target.value as RequestFilter['state'] })}
              >
                <option value="">Both</option>
                <option value="open">Open</option>
                <option value="closed">Finished</option>
              </select>
            )}
          </Field>
          <Field label="Updated from">
            {(a) => (
              <input
                {...a}
                type="date"
                className={inputClass}
                value={f.from}
                onChange={(e) => set({ from: e.target.value })}
              />
            )}
          </Field>
          <Field label="Updated to">
            {(a) => (
              <input
                {...a}
                type="date"
                className={inputClass}
                value={f.to}
                onChange={(e) => set({ to: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Button
          variant="ghost"
          className="mt-2 min-h-11"
          onClick={() => setF({ kind: '', status: '', state: '', query: '', from: '', to: '' })}
        >
          Clear filters
        </Button>
      </SectionCard>
      <SectionCard id="mr-l-h" title={`Showing ${rows.length} of ${all.length}`}>
        {rows.length === 0 ? (
          <Empty>
            {all.length === 0
              ? 'You have not made any requests yet.'
              : 'No request matches these filters. Nothing was deleted.'}
          </Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border bg-surface p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{r.title}</span>
                  <StatusPill label={r.statusLabel} />
                </div>
                <p className="text-sm text-ink-muted">
                  {r.kindLabel} · {r.category} · requested {formatInstant(r.createdAt)} · updated{' '}
                  {formatInstant(r.updatedAt)}
                </p>
                <p className="text-sm text-ink-muted">{r.summary}</p>
                <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
                  <Link to={r.href}>Open</Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {showDemoOps ? <AdminOps /> : null}
    </article>
  )
}

/** /administration/requests/:id is only a deep link. It forwards to the canonical record and never copies it. */
export function RequestLinkPage() {
  const { id } = useParams()
  const { admin, status, profileId } = useAdmin()
  if (status === 'loading' || !admin) return <Loading />
  const to = canonicalHref(admin, profileId, id ?? '')
  if (to) return <Navigate to={to} replace />
  return (
    <div className="max-w-xl">
      <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
        Request not found
      </h1>
      <p className="mt-2 text-ink-muted">
        We could not find that request for this persona. It may not exist, or it may belong to
        another profile. Nothing was changed.
      </p>
      <Button asChild className="mt-4 min-h-11">
        <Link to="/administration/requests">Back to My requests</Link>
      </Button>
    </div>
  )
}
