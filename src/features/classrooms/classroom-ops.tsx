import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Button } from '@/components/ui/button'
import { campusProfiles as demoProfiles } from '@/data/campus/catalogue'
import { formatDateShort, isDateOnly, type DateOnly, type LocalTime } from '@/lib/time'
import { OpsCard, Pill } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useClassrooms } from './classroom-hooks'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

/** Settings-gated. A reviewer, a closure and another student's booking, each one visible, recorded step. */
export function ClassroomOps() {
  const { classrooms, repo } = useClassrooms()
  const { act, message } = useAction()
  const [reason, setReason] = useState('')
  const [room, setRoom] = useState('CR1')
  const [date, setDate] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  if (!classrooms) return null
  const pending = classrooms.reservations.filter((r) => r.state === 'pendingApproval')
  const span =
    isDateOnly(date) && start && end
      ? { date: date as DateOnly, start: start as LocalTime, end: end as LocalTime }
      : null
  return (
    <OpsCard
      id="ops-classrooms-h"
      title="Local Operations: classroom reviews and schedule"
      message={message}
    >
      <h3 className="text-sm font-semibold text-ink">Waiting requests ({pending.length})</h3>
      <Field label="Reason (needed to decline)">
        {(a) => (
          <input
            {...a}
            className={`${inputClass} w-64`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </Field>
      {pending.length === 0 ? <p className="text-sm">No request is waiting.</p> : null}
      <ul className="flex flex-col gap-2">
        {pending.map((r) => (
          <li
            key={r.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-border-strong bg-surface p-3 text-sm"
          >
            {nameOf(r.ownerProfileId)} ·{' '}
            {classrooms.rooms.find((x) => x.id === r.roomId)?.displayName} ·{' '}
            {formatDateShort(r.date)} {r.start}–{r.end}
            {r.needsVerification ? <Pill tone="warn">verification request</Pill> : null}
            <Button
              size="sm"
              className="min-h-11"
              onClick={() => void act(() => repo.decide(r.id, 'approve'), 'Approved (simulated).')}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="min-h-11"
              onClick={() =>
                void act(() => repo.decide(r.id, 'reject', reason), 'Declined (simulated).')
              }
            >
              Decline
            </Button>
          </li>
        ))}
      </ul>
      <h3 className="text-sm font-semibold text-ink">Change the reference schedule</h3>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Room">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-48`}
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              {classrooms.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.displayName}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Date">
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
        <Field label="From">
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
        <Field label="To">
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
        <Button
          variant="outline"
          className="min-h-11"
          disabled={!span}
          onClick={() =>
            span &&
            void act(
              () => repo.injectOtherBooking(room, span),
              'Another student’s booking recorded (simulated).',
            )
          }
        >
          Add another student’s booking
        </Button>
        <Button
          variant="outline"
          className="min-h-11"
          disabled={!span}
          onClick={() =>
            span &&
            void act(
              () => repo.closeRoom(room, span, 'Closed (demo maintenance)'),
              'Room closed for maintenance (simulated).',
            )
          }
        >
          Close for maintenance
        </Button>
      </div>
      <p className="text-xs">
        Adding a booking between a student choosing a slot and confirming it shows how a conflict is
        caught at confirmation time.
      </p>
    </OpsCard>
  )
}
