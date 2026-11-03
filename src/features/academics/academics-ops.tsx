import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { inviteStatusLabel, meetingStatusLabel } from '@/domain/academics'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { formatDateShort, isDateOnly, type DateOnly, type LocalTime } from '@/lib/time'
import { meetingWith } from '@/selectors/academics'
import { OpsCard, Pill } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useAcademics } from './academics-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

/** Settings-gated. Each button is one visible, recorded step; nothing happens by itself. */
export function AcademicsOps() {
  const { academics, repo } = useAcademics()
  const { act, message } = useAction()
  const [reason, setReason] = useState('')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  if (!academics) return null
  const live = academics.meetings.filter(
    (m) => !['rejectedDemo', 'withdrawn', 'cancelledDemo', 'completedDemo'].includes(m.status),
  )
  const invites = academics.invites.filter((i) => i.status === 'sent')
  const alt =
    isDateOnly(date) && start && end
      ? { date: date as DateOnly, start: start as LocalTime, end: end as LocalTime }
      : undefined
  return (
    <OpsCard
      id="ops-academics-h"
      title="Local Operations: meetings and mentorship"
      message={message}
    >
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Reason (needed to decline)">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-56`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          )}
        </Field>
        <Field label="Alternative date">
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
        <Field label="Alt. start">
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
        <Field label="Alt. end">
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
      </div>
      {live.length === 0 ? (
        <p className="text-sm">No open meeting request from any profile.</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {live.map((m) => {
          const v = m.statusVersion
          const go = (
            action: 'accept' | 'reject' | 'propose' | 'confirmAlternative' | 'cancel' | 'complete',
            done: string,
          ) =>
            void act(
              () =>
                repo.simulateMeeting(m.id, action, {
                  expectedVersion: v,
                  reason,
                  ...(alt ? { alternative: alt } : {}),
                }),
              done,
            )
          return (
            <li
              key={m.id}
              className="flex flex-col gap-1 rounded-md border border-border-strong bg-surface p-3 text-sm"
            >
              <span>
                {nameOf(m.ownerProfileId)} → {meetingWith(academics, m)} · {formatDateShort(m.date)}{' '}
                {m.start} <Pill>{meetingStatusLabel[m.status]}</Pill>
              </span>
              <span className="flex flex-wrap gap-2">
                {m.status === 'requested' ? (
                  <>
                    <Button
                      size="sm"
                      className="min-h-11"
                      onClick={() => go('accept', 'Accepted.')}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => go('reject', 'Declined.')}
                    >
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={!alt}
                      onClick={() => go('propose', 'Alternative proposed.')}
                    >
                      Propose alternative
                    </Button>
                  </>
                ) : null}
                {m.status === 'alternativeAccepted' ? (
                  <Button
                    size="sm"
                    className="min-h-11"
                    onClick={() => go('confirmAlternative', 'Alternative confirmed.')}
                  >
                    Confirm alternative
                  </Button>
                ) : null}
                {m.status === 'acceptedDemo' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => go('complete', 'Marked completed.')}
                    >
                      Mark completed
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => go('cancel', 'Cancelled.')}
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
                {m.status === 'cancellationRequested' ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => go('cancel', 'Cancelled.')}
                  >
                    Confirm cancellation
                  </Button>
                ) : null}
              </span>
            </li>
          )
        })}
      </ul>
      <ul className="flex flex-col gap-2">
        {invites.map((i) => (
          <li
            key={i.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface p-3 text-sm"
          >
            {nameOf(i.ownerProfileId)} invited{' '}
            {academics.faculty.find((f) => f.id === i.facultyId)?.displayName}{' '}
            <Pill>{inviteStatusLabel[i.status]}</Pill>
            <Button
              size="sm"
              className="min-h-11"
              onClick={() =>
                void act(
                  () => repo.simulateInvite(i.id, 'accepted', i.statusVersion),
                  'Accepted by a simulated mentor.',
                )
              }
            >
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void act(
                  () => repo.simulateInvite(i.id, 'declined', i.statusVersion),
                  'Declined by a simulated mentor.',
                )
              }
            >
              Decline
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void act(
                  () => repo.simulateInvite(i.id, 'feedbackRequested', i.statusVersion),
                  'Feedback requested.',
                )
              }
            >
              Request feedback
            </Button>
          </li>
        ))}
      </ul>
    </OpsCard>
  )
}
