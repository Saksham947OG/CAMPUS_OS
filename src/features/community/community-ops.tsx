import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import {
  CLAIM_ACTIVE,
  claimStatusLabel,
  fixtureStatusLabel,
  teamStatusLabel,
} from '@/domain/community'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { formatDateShort, isDateOnly, type DateOnly, type LocalTime } from '@/lib/time'
import { OpsCard, Pill } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useCommunity } from './community-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

/** Settings-gated. Each button is one visible, recorded step; nothing happens by itself. */
export function CommunityOps({ section }: { section: 'lostfound' | 'clubs' | 'sports' }) {
  const { community, repo } = useCommunity()
  const { act, message } = useAction()
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [venue, setVenue] = useState('')
  const [result, setResult] = useState('')
  if (!community) return null
  const when = isDateOnly(date)
    ? {
        date: date as DateOnly,
        ...(start ? { start: start as LocalTime } : {}),
        ...(end ? { end: end as LocalTime } : {}),
        ...(venue ? { venue } : {}),
        ...(reason ? { reason } : {}),
      }
    : undefined
  const fields = (
    <div className="flex flex-wrap items-end gap-2">
      <Field label="Reason (needed to decline)">
        {(a) => (
          <input
            {...a}
            className={`${inputClass} w-52`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      {section !== 'lostfound' ? (
        <>
          <Field label="New date">
            {(a) => (
              <input
                {...a}
                type="date"
                className={`${inputClass} w-40`}
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
                className={`${inputClass} w-32`}
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
                className={`${inputClass} w-32`}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            )}
          </Field>
          <Field label="Venue (optional)">
            {(a) => (
              <input
                {...a}
                className={`${inputClass} w-40`}
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
              />
            )}
          </Field>
        </>
      ) : null}
    </div>
  )
  return (
    <OpsCard
      id={`ops-community-${section}-h`}
      title={
        section === 'lostfound'
          ? 'Local Operations: Lost & Found review'
          : section === 'clubs'
            ? 'Local Operations: club events'
            : 'Local Operations: teams and fixtures'
      }
      message={message}
    >
      {fields}
      {section === 'lostfound' ? (
        <>
          <p className="text-xs">
            Reviewer view. Students never see another person’s answer or private details; this panel
            is not a student account.
          </p>
          {community.claims.filter((c) => CLAIM_ACTIVE.includes(c.status)).length === 0 ? (
            <p className="text-sm">No claim is waiting for review.</p>
          ) : null}
          <ul className="flex flex-col gap-2">
            {community.claims
              .filter((c) => CLAIM_ACTIVE.includes(c.status))
              .map((c) => {
                const r = community.reports.find((x) => x.id === c.reportId)
                return (
                  <li
                    key={c.id}
                    className="flex flex-col gap-1 rounded-md border border-border-strong bg-surface p-3 text-sm"
                  >
                    <span>
                      {nameOf(c.claimantProfileId)} → {r?.title}{' '}
                      <Pill>{claimStatusLabel[c.status]}</Pill>
                    </span>
                    <span>
                      Their answer: “{c.privateAnswer}” · Reporter’s private details: “
                      {r?.privateDetails ?? 'none'}”
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {c.status === 'requested' ? (
                        <Button
                          size="sm"
                          className="min-h-11"
                          onClick={() =>
                            void act(
                              () =>
                                repo.reviewClaim(c.id, 'startReview', {
                                  expectedVersion: c.statusVersion,
                                }),
                              'Moved into review.',
                            )
                          }
                        >
                          Start review
                        </Button>
                      ) : null}
                      {c.status === 'reviewPending' ? (
                        <Button
                          size="sm"
                          className="min-h-11"
                          onClick={() =>
                            void act(
                              () =>
                                repo.reviewClaim(c.id, 'approve', {
                                  expectedVersion: c.statusVersion,
                                }),
                              'Claim approved.',
                            )
                          }
                        >
                          Approve claim
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () =>
                              repo.reviewClaim(c.id, 'reject', {
                                expectedVersion: c.statusVersion,
                                reason,
                              }),
                            'Claim not approved.',
                          )
                        }
                      >
                        Do not approve
                      </Button>
                    </span>
                  </li>
                )
              })}
          </ul>
          <ul className="flex flex-col gap-2">
            {community.reports
              .filter(
                (r) =>
                  r.status === 'published' &&
                  community.claims.some((c) => c.reportId === r.id && c.status === 'demoApproved'),
              )
              .map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                  {r.title}: a claim is approved.{' '}
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => void act(() => repo.markReturned(r.id), 'Marked returned.')}
                  >
                    Record handover
                  </Button>
                </li>
              ))}
          </ul>
        </>
      ) : null}
      {section === 'clubs' ? (
        <ul className="flex flex-col gap-2">
          {community.clubEvents.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface p-3 text-sm"
            >
              {e.title} · {formatDateShort(e.date)} <Pill>{e.status}</Pill>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={!when || e.status === 'cancelled'}
                onClick={() =>
                  when &&
                  void act(
                    () =>
                      repo.changeClubEvent(e.id, {
                        date: when.date,
                        start: when.start,
                        end: when.end,
                        venue: when.venue,
                        reason,
                      }),
                    'Event rescheduled.',
                  )
                }
              >
                Reschedule
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                disabled={e.status === 'cancelled'}
                onClick={() =>
                  void act(
                    () => repo.changeClubEvent(e.id, { cancel: true, reason }),
                    'Event cancelled.',
                  )
                }
              >
                Cancel
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {section === 'sports' ? (
        <>
          <Field label="Result text (optional, for Mark completed)">
            {(a) => (
              <input
                {...a}
                className={`${inputClass} w-64`}
                value={result}
                onChange={(e) => setResult(e.target.value)}
              />
            )}
          </Field>
          <ul className="flex flex-col gap-2">
            {community.fixtures.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface p-3 text-sm"
              >
                {f.title} <Pill>{fixtureStatusLabel[f.status]}</Pill> v{f.version}
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  disabled={!when}
                  onClick={() =>
                    when &&
                    void act(
                      () => repo.changeFixture(f.id, { kind: 'reschedule', ...when }, f.version),
                      'Fixture rescheduled.',
                    )
                  }
                >
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.changeFixture(f.id, { kind: 'cancel', reason }, f.version),
                      'Fixture cancelled.',
                    )
                  }
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="min-h-11"
                  onClick={() =>
                    void act(
                      () => repo.changeFixture(f.id, { kind: 'complete', result }, f.version),
                      'Marked completed.',
                    )
                  }
                >
                  Mark completed
                </Button>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-2">
            {community.teams.map((t) => (
              <li
                key={t.id}
                className="flex flex-col gap-1 rounded-md border border-border-strong bg-surface p-3 text-sm"
              >
                <span>
                  {t.name} ({t.sport}) · {t.captainLabel} · {t.members.length}/{t.maxRoster}{' '}
                  <Pill>{teamStatusLabel[t.status]}</Pill>
                </span>
                <span className="flex flex-wrap gap-2">
                  {t.status === 'submitted' ? (
                    <>
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () => repo.decideTeamApproval(t.id, 'approvedDemo'),
                            'Team approved.',
                          )
                        }
                      >
                        Approve team
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () => repo.decideTeamApproval(t.id, 'declinedDemo'),
                            'Team declined.',
                          )
                        }
                      >
                        Decline team
                      </Button>
                    </>
                  ) : null}
                  {!t.captainProfileId
                    ? community.joinRequests
                        .filter((r) => r.teamId === t.id && r.status === 'requested')
                        .map((r) => (
                          <span key={r.id} className="flex flex-wrap items-center gap-2">
                            {nameOf(r.profileId)} asked to join:
                            <Button
                              size="sm"
                              className="min-h-11"
                              onClick={() =>
                                void act(
                                  () =>
                                    repo.decideJoin({ kind: 'demoCaptain' }, t.id, r.id, 'accept'),
                                  'Accepted by the simulated captain.',
                                )
                              }
                            >
                              Accept as captain
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11"
                              onClick={() =>
                                void act(
                                  () =>
                                    repo.decideJoin({ kind: 'demoCaptain' }, t.id, r.id, 'reject'),
                                  'Declined by the simulated captain.',
                                )
                              }
                            >
                              Decline as captain
                            </Button>
                          </span>
                        ))
                    : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </OpsCard>
  )
}
