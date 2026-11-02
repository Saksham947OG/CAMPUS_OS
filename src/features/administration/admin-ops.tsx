import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { useConfirm } from '@/components/confirm-context'
import { Button } from '@/components/ui/button'
import { demoProfiles } from '@/data/seeds/demo/profiles'
import {
  assetLabel,
  categoryLabel,
  leaveStatusLabel,
  leaveTypeLabel,
  ticketStatusLabel,
  type ActorType,
} from '@/domain/admin'
import { OpsCard, Pill } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useAdmin } from './admin-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id
const ROLES: { id: ActorType; label: string }[] = [
  { id: 'demoApprover', label: 'Demo Approver' },
  { id: 'demoMaintenance', label: 'Demo Maintenance' },
  { id: 'demoGate', label: 'Demo Gate' },
]

/**
 * LOCAL DEMO OPERATIONS for Administration (COS-ADMIN-001 §7.3). Three simulated roles in one
 * browser. This is not a staff dashboard, a login or an integration: every action names the role it
 * plays, is written to the request's audit trail, and changes nothing outside this device.
 */
export function AdminOps() {
  const { admin, repo } = useAdmin()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [role, setRole] = useState<ActorType>('demoApprover')
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [team, setTeam] = useState<Record<string, string>>({})
  const [priority, setPriority] = useState<Record<string, '' | 'normal' | 'high'>>({})
  const [target, setTarget] = useState<Record<string, string>>({})
  if (!admin) return null
  const why = (id: string) => reasons[id] ?? ''
  const reasonField = (id: string, label: string) => (
    <Field label={label}>
      {(a) => (
        <input
          {...a}
          className={`${inputClass} w-64`}
          maxLength={300}
          value={why(id)}
          onChange={(e) => setReasons({ ...reasons, [id]: e.target.value })}
        />
      )}
    </Field>
  )

  return (
    <OpsCard id="ops-admin-h" title="Demo Operations: Administration" message={message}>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">Simulated role</legend>
        {ROLES.map((r) => (
          <Button
            key={r.id}
            variant="outline"
            className="min-h-11"
            aria-pressed={role === r.id}
            onClick={() => setRole(r.id)}
          >
            {r.label}
          </Button>
        ))}
      </fieldset>
      <p className="text-xs text-ink-muted">
        Acting as <strong>{ROLES.find((r) => r.id === role)!.label} (simulated)</strong>. No real
        person, team or office is involved.
      </p>

      {role === 'demoApprover' ? (
        <ul className="flex flex-col gap-2">
          {admin.leaves.length === 0 ? (
            <li className="text-sm text-ink-muted">
              No leave requests yet. Submit one as a student first.
            </li>
          ) : null}
          {admin.leaves.map((l) => {
            const seen = { expectedRevision: l.revision, expectedVersion: l.statusVersion }
            return (
              <li key={l.id} className="rounded-md border border-border bg-surface p-3">
                <p className="font-medium">
                  {nameOf(l.ownerProfileId)} · {leaveTypeLabel[l.leaveType]} · {l.startDate}{' '}
                  <Pill>{leaveStatusLabel[l.status]}</Pill>{' '}
                  <span className="text-xs text-ink-muted">rev {l.revision}</span>
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  {l.status === 'submitted' || l.status === 'resubmitted' ? (
                    <Button
                      size="sm"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () => repo.leaveAct(l.id, 'startReview', 'demoApprover', seen),
                          'Review started (simulated).',
                        )
                      }
                    >
                      Start review
                    </Button>
                  ) : null}
                  {l.status === 'underReview' ? (
                    <>
                      {reasonField(l.id, 'Reason (needed to reject or request changes)')}
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () =>
                              repo.leaveAct(l.id, 'approve', 'demoApprover', {
                                ...seen,
                                reason: why(l.id),
                              }),
                            'Approved in demo (simulated). Not a valid gate pass.',
                          )
                        }
                      >
                        Approve in demo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () =>
                              repo.leaveAct(l.id, 'requestChanges', 'demoApprover', {
                                ...seen,
                                reason: why(l.id),
                              }),
                            'Changes requested (simulated).',
                          )
                        }
                      >
                        Request changes
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() =>
                          void act(
                            () =>
                              repo.leaveAct(l.id, 'reject', 'demoApprover', {
                                ...seen,
                                reason: why(l.id),
                              }),
                            'Rejected in demo (simulated).',
                          )
                        }
                      >
                        Reject
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {role === 'demoGate' ? (
        <div>
          <label className="mb-2 flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={admin.config.gateEnabled}
              onChange={(e) =>
                void act(
                  () => repo.setPolicy({ gateEnabled: e.target.checked }),
                  e.target.checked
                    ? 'Demo gate actions switched on.'
                    : 'Demo gate actions switched off.',
                )
              }
            />
            Demo gate verification is on (a demo policy, not a campus rule)
          </label>
          <ul className="flex flex-col gap-2">
            {admin.leaves.filter((l) =>
              ['approvedInDemo', 'gateDepartureLogged', 'gateReturnLogged'].includes(l.status),
            ).length === 0 ? (
              <li className="text-sm text-ink-muted">No request is approved in the demo yet.</li>
            ) : null}
            {admin.leaves
              .filter((l) =>
                ['approvedInDemo', 'gateDepartureLogged', 'gateReturnLogged'].includes(l.status),
              )
              .map((l) => (
                <li key={l.id} className="rounded-md border border-border bg-surface p-3">
                  <p className="font-medium">
                    {nameOf(l.ownerProfileId)} · {l.startDate}{' '}
                    <Pill>{leaveStatusLabel[l.status]}</Pill>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () =>
                            repo.leaveAct(l.id, 'logDeparture', 'demoGate', {
                              expectedRevision: l.revision,
                              expectedVersion: l.statusVersion,
                            }),
                          'Departure logged (simulated).',
                        )
                      }
                    >
                      Log departure
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() =>
                        void act(
                          () =>
                            repo.leaveAct(l.id, 'logReturn', 'demoGate', {
                              expectedRevision: l.revision,
                              expectedVersion: l.statusVersion,
                            }),
                          'Return logged (simulated).',
                        )
                      }
                    >
                      Log return
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {role === 'demoMaintenance' ? (
        <ul className="flex flex-col gap-2">
          {admin.tickets.length === 0 ? (
            <li className="text-sm text-ink-muted">
              No tickets yet. Report one as a student first.
            </li>
          ) : null}
          {admin.tickets.map((t) => {
            const seen = { expectedVersion: t.statusVersion }
            const step = (
              action: Parameters<typeof repo.ticketAct>[1],
              done: string,
              extra: object = {},
            ) =>
              void act(
                () => repo.ticketAct(t.id, action, 'demoMaintenance', { ...seen, ...extra }),
                done,
              )
            return (
              <li key={t.id} className="rounded-md border border-border bg-surface p-3">
                <p className="font-medium">
                  {nameOf(t.ownerProfileId)} ·{' '}
                  {t.kind === 'teachingAid' && t.teaching
                    ? `${assetLabel[t.teaching.assetType]}, ${t.teaching.classroomReference}`
                    : categoryLabel[t.category]}{' '}
                  <Pill>{ticketStatusLabel[t.status]}</Pill>
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  {t.status === 'submitted' || t.status === 'reopened' ? (
                    <>
                      <Field label="Demo team">
                        {(a) => (
                          <select
                            {...a}
                            className={`${inputClass} w-64`}
                            value={team[t.id] ?? ''}
                            onChange={(e) => setTeam({ ...team, [t.id]: e.target.value })}
                          >
                            <option value="">Team not assigned</option>
                            {admin.config.teams.map((x) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ))}
                          </select>
                        )}
                      </Field>
                      <Field label="Demo priority">
                        {(a) => (
                          <select
                            {...a}
                            className={`${inputClass} w-36`}
                            value={priority[t.id] ?? ''}
                            onChange={(e) =>
                              setPriority({
                                ...priority,
                                [t.id]: e.target.value as '' | 'normal' | 'high',
                              })
                            }
                          >
                            <option value="">none</option>
                            <option value="normal">normal</option>
                            <option value="high">high</option>
                          </select>
                        )}
                      </Field>
                      <Field label="Demo target, hours (not an SLA)">
                        {(a) => (
                          <input
                            {...a}
                            type="number"
                            min={1}
                            className={`${inputClass} w-32`}
                            value={target[t.id] ?? ''}
                            onChange={(e) => setTarget({ ...target, [t.id]: e.target.value })}
                          />
                        )}
                      </Field>
                      <Button
                        size="sm"
                        className="min-h-11"
                        onClick={() =>
                          step('assign', 'Assignment simulated.', {
                            team: team[t.id],
                            ...(priority[t.id] ? { demoPriority: priority[t.id] } : {}),
                            ...(target[t.id] ? { demoTargetHours: Number(target[t.id]) } : {}),
                          })
                        }
                      >
                        Assign
                      </Button>
                    </>
                  ) : null}
                  {t.status === 'assigned' || t.status === 'reopened' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => step('start', 'Work started (simulated).')}
                    >
                      Start work
                    </Button>
                  ) : null}
                  {t.status === 'assigned' || t.status === 'inProgress' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => step('awaitParts', 'Awaiting parts (simulated).')}
                    >
                      Await parts
                    </Button>
                  ) : null}
                  {t.status === 'awaitingParts' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => step('resume', 'Work resumed (simulated).')}
                    >
                      Resume
                    </Button>
                  ) : null}
                  {t.status === 'inProgress' ? (
                    <Button
                      size="sm"
                      className="min-h-11"
                      onClick={() => step('resolve', 'Marked resolved (simulated).')}
                    >
                      Mark resolved
                    </Button>
                  ) : null}
                  {t.status === 'resolvedInDemo' ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => step('close', 'Closed (simulated).')}
                    >
                      Close ticket
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      <div className="border-t border-border-strong pt-3">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            const c = await confirm({
              title: 'Reset the Administration demo records?',
              description:
                'This removes every demo leave request, ticket and teaching-aid report for every demo profile. Home, Calendar and the other services are not touched.',
              confirmLabel: 'Reset Administration records',
              danger: true,
            })
            if (c === 'confirm')
              await act(() => repo.resetScenario(), 'Administration demo records were reset.')
          }}
        >
          Reset Administration demo records…
        </Button>
        <p className="mt-1 text-xs text-ink-muted">
          Scoped: only requests and tickets. Filters and views never delete anything; this does.
        </p>
      </div>
    </OpsCard>
  )
}
