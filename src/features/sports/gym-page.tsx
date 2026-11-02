import type { EvidenceMeta } from '@/domain/evidence'
import { EvidencePicker } from '../help/report-page'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { Field, inputClass } from '@/components/form-kit'
import { equipmentStatusLabel } from '@/domain/sports'
import { formatInstant } from '@/lib/time'
import { gymView } from '@/selectors/sports'
import { Empty, Loading, Pill, SectionCard, SubNav, TripScenario } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { bookingTabs } from './sports-nav'
import { useSports } from './sports-hooks'
import { SportsOps } from './sports-ops'
import { SlotBooker } from './slot-booker'
import { useState } from 'react'

export function GymPage() {
  const { sports, status, profileId, now, repo, showDemoOps } = useSports()
  const { act, message } = useAction()
  const [faultFor, setFaultFor] = useState('')
  const [fault, setFault] = useState('')
  const [faultEvidence, setFaultEvidence] = useState<EvidenceMeta[]>([])
  if (status === 'loading' || !sports) return <Loading />
  const v = gymView(sports, profileId, now.ms)
  const gym = v.gym
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Gym"
        description="Gym sessions from 6:00 AM to 10:00 PM in 30-minute intervals, self-check-in and equipment notices. Reservations and occupancy are saved on this device."
        badge={<Pill tone="demo">Campus facility</Pill>}
      />
      <SubNav label="Bookings sections" items={bookingTabs} current="gym" />

      {gym?.status === 'closed' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
        >
          <strong>Gym closed:</strong> {gym.closureNote}
        </p>
      ) : null}

      <SectionCard id="gym-over-h" title="Overview">
        <p>
          <strong>Published hours:</strong> {v.hours ? `${v.hours} (local)` : 'Not provided'}
        </p>
        <p className="mt-1">
          <strong>Occupancy:</strong> {v.snapshot}
        </p>
        <p className="mt-1">
          <strong>Self-reported count:</strong> {v.selfReportedNow}{' '}
          {v.selfReportedNow === 1 ? 'person has' : 'people have'} checked in on this device
          {v.staleForReview
            ? `, plus ${v.staleForReview} older ${v.staleForReview === 1 ? 'session' : 'sessions'} set aside for review`
            : ''}
          .
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          Self-reported and simulated figures cover only personas, so they are not a live or
          verified headcount. Current occupancy is not known.
        </p>
        <p className="mt-2 text-xs text-ink-muted">
          Hours and session duration were supplied by the project owner. Local reservations hold a
          slot in this app only; official capacity and booking rules require confirmation.
        </p>
      </SectionCard>

      {gym?.referenceCapacity ? (
        <p className="rounded-md bg-mist p-3 text-sm">
          Persona reference capacity: {gym.referenceCapacityApproximate ? 'approximately ' : ''}
          {gym.referenceCapacity} people. This is not a live headcount or a verified booking limit.
        </p>
      ) : null}
      <SlotBooker activity="gym" />

      <SectionCard id="gym-visit-h" title="My visit (self-reported)">
        <p className="text-ink-muted">
          Checking in records that <strong>you</strong> are here. It is not an access control or a
          verified headcount, and you are never checked out automatically.
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            className="min-h-11"
            onClick={() =>
              void act(() => repo.gymCheckIn(profileId), 'Self-reported check-in recorded.')
            }
          >
            {v.mySession ? 'You are checked in' : 'Check in (self-report)'}
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            onClick={() => void act(() => repo.gymCheckOut(profileId), 'Checked out.')}
          >
            Check out
          </Button>
          {v.mySession ? (
            <Button
              variant="ghost"
              className="min-h-11"
              onClick={() =>
                void act(() => repo.gymCorrect(profileId), 'Check-in removed as a correction.')
              }
            >
              Correct: I did not check in
            </Button>
          ) : null}
        </div>
        {v.mySession ? (
          <div className="mt-1 text-sm text-ink-muted">
            <p>
              Checked in at {formatInstant(v.mySession.startedAt)}
              {v.mySession.expiresAt
                ? `; this check-in counts until ${formatInstant(v.mySession.expiresAt)}`
                : ''}
              .
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-1 min-h-11"
              onClick={() => void act(() => repo.gymRenew(profileId), 'Check-in renewed.')}
            >
              Still here
            </Button>
          </div>
        ) : v.myExpired ? (
          <p className="mt-1 text-sm text-ink" data-testid="expired-note">
            Your check-in expired at {formatInstant(v.myExpired.endedAt!)}. Physical use is
            unconfirmed: it does not mean you left, and it does not mean the facility is empty.
          </p>
        ) : null}
        <output className="mt-2 block min-h-5 text-sm font-medium" aria-live="polite">
          {message}
        </output>
      </SectionCard>

      <SectionCard id="gym-eq-h" title="Equipment">
        {sports.equipment.length === 0 ? (
          <Empty>No equipment is configured.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {sports.equipment.map((e) => (
              <li key={e.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.label}</span>
                  <Pill tone={e.status === 'reportedAvailable' ? 'plain' : 'warn'}>
                    {equipmentStatusLabel[e.status]}
                  </Pill>
                </div>
                <p className="text-xs text-ink-muted">
                  {e.sourceLabel} · last update {formatInstant(e.asOf)}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11"
                  onClick={() => setFaultFor(faultFor === e.id ? '' : e.id)}
                >
                  Report a fault (local note)
                </Button>
                {faultFor === e.id ? (
                  <form
                    className="mt-1 flex flex-col gap-2"
                    onSubmit={async (ev) => {
                      ev.preventDefault()
                      const r = await act(
                        () => repo.reportFault(profileId, e.id, fault, faultEvidence),
                        'Your note was saved on this device. It is not a complaint ticket and no repair was requested.',
                      )
                      if (r.ok) {
                        setFault('')
                        setFaultEvidence([])
                        setFaultFor('')
                      }
                    }}
                  >
                    <Field label="What is wrong?">
                      {(a) => (
                        <input
                          {...a}
                          className={inputClass}
                          maxLength={300}
                          value={fault}
                          onChange={(ev) => setFault(ev.target.value)}
                        />
                      )}
                    </Field>
                    <EvidencePicker value={faultEvidence} onChange={setFaultEvidence} />
                    <Button type="submit" className="min-h-11 self-start">
                      Save note
                    </Button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-ink-muted">
          A fault on one item does not close the gym. A report is a note, not a confirmed fault or a
          completed repair, and the complaints module does not exist yet.
        </p>
      </SectionCard>

      <TripScenario id="gym-tt-h" noun="gym trips" />
      {showDemoOps ? <SportsOps /> : null}
    </article>
  )
}
