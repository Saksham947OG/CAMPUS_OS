import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { demoProfiles } from '@/data/seeds/demo/profiles'
import { useCampusData } from '@/hooks/use-campus-data'
import {
  formatDateShort,
  formatInstant,
  isDateOnly,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import { examsFor, examTimeText, profileCourseIds, seatText, seatView } from '@/selectors/exams'
import { Empty, Loading, OpsCard, Pill, SectionCard } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { useShared } from './shared-hooks'
import { useConfirm } from '@/components/confirm-context'

const nameOf = (id: string) => demoProfiles.find((p) => p.id === id)?.displayName ?? id

function ExamOps() {
  const { shared, repo } = useShared()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [exam, setExam] = useState('exam-1')
  const [who, setWho] = useState(demoProfiles[0]!.id)
  const [hall, setHall] = useState('')
  const [row, setRow] = useState('')
  const [col, setCol] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  if (!shared) return null
  return (
    <OpsCard id="ops-exams-h" title="Demo Operations: exam seating" message={message}>
      <p className="text-xs">
        Fictional seats only. A simulated change keeps every earlier version and sends one critical
        message that does not print the seat.
      </p>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void act(
            () => repo.changeSeat(exam, who, { hall, row, column: col }),
            'Seating changed (simulated).',
          )
        }}
      >
        <Field label="Exam">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-64`}
              value={exam}
              onChange={(e) => setExam(e.target.value)}
            >
              {shared.exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Profile">
          {(a) => (
            <select
              {...a}
              className={`${inputClass} w-52`}
              value={who}
              onChange={(e) => setWho(e.target.value)}
            >
              {demoProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Hall">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-36`}
              value={hall}
              onChange={(e) => setHall(e.target.value)}
            />
          )}
        </Field>
        <Field label="Row">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-20`}
              value={row}
              onChange={(e) => setRow(e.target.value)}
            />
          )}
        </Field>
        <Field label="Column">
          {(a) => (
            <input
              {...a}
              className={`${inputClass} w-20`}
              value={col}
              onChange={(e) => setCol(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" className="min-h-11">
          Set or change seat
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() =>
            void act(
              () => repo.injectSeatConflict(exam, who),
              'A contradicting allocation was added (simulated).',
            )
          }
        >
          Add a contradicting allocation
        </Button>
      </form>
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!isDateOnly(date)) return
          void act(
            () =>
              repo.rescheduleExam(exam, {
                date: date as DateOnly,
                ...(time ? { startTime: time as LocalTime } : {}),
              }),
            'Exam rescheduled (simulated).',
          )
        }}
      >
        <Field label="New exam date">
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
        <Field label="New start time (optional)">
          {(a) => (
            <input
              {...a}
              type="time"
              className={`${inputClass} w-36`}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          )}
        </Field>
        <Button type="submit" variant="outline" className="min-h-11" disabled={!isDateOnly(date)}>
          Reschedule exam
        </Button>
      </form>
      <ul className="flex flex-col gap-1 text-sm">
        {shared.seats
          .filter((s) => s.needsVerification)
          .map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2">
              {nameOf(s.ownerProfileId)} · {shared.exams.find((e) => e.id === s.examId)?.name} ·{' '}
              {seatText(s)} <Pill tone="warn">needs verification</Pill>
              <Button
                size="sm"
                variant="outline"
                className="min-h-11"
                onClick={() =>
                  void act(
                    () => repo.resolveSeatConflict(s.id),
                    'That allocation now stands (simulated).',
                  )
                }
              >
                Keep this one
              </Button>
            </li>
          ))}
      </ul>
      <div className="border-t border-border-strong pt-3">
        <Button
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            const c = await confirm({
              title: 'Reset the Shared demo records?',
              description:
                'This removes your saved Time Tax what-ifs and restores the sample exams and seats for every profile. Everything else is untouched.',
              confirmLabel: 'Reset Shared records',
              danger: true,
            })
            if (c === 'confirm')
              await act(() => repo.resetScenarioAll(), 'Shared demo records were reset.')
          }}
        >
          Reset Shared demo records…
        </Button>
      </div>
    </OpsCard>
  )
}

export function ExamsPage() {
  const { shared, status, profileId, showDemoOps } = useShared()
  const { data } = useCampusData()
  if (status === 'loading' || !shared) return <Loading />
  const exams = examsFor(shared, profileCourseIds(data))
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Exams"
        description="Exams for the courses on your own schedule, and your private seating. All exams and seats here are fictional demo records, not an official allotment."
        badge={<Pill tone="demo">Demo · private to your profile</Pill>}
      />
      <SectionCard id="ex-h" title={`Your exams (${exams.length})`}>
        {exams.length === 0 ? (
          <Empty>No exams are recorded for the courses on your schedule.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {exams.map((e) => {
              const v = seatView(shared, profileId, e.id)
              return (
                <li key={e.id} className="rounded-lg border border-border bg-surface p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{e.name}</span>
                    <Pill tone={e.status === 'changed' ? 'warn' : 'plain'}>
                      {e.status === 'changed' ? 'Changed (demo)' : 'Scheduled (demo)'}
                    </Pill>
                  </div>
                  <p className="text-sm text-ink-muted">
                    {formatDateShort(e.date)} · {examTimeText(e)}
                  </p>
                  <p className="text-sm">
                    {v.kind === 'seat'
                      ? 'Your seating is available.'
                      : v.kind === 'conflict'
                        ? 'Your seating needs verification.'
                        : 'Seating not provided for this demo profile.'}
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2 min-h-11">
                    <Link to={`/academics/exams/${e.id}`}>
                      {v.kind === 'none' ? 'Exam details' : 'View my seating'}
                    </Link>
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        Seating is shown only to the profile it belongs to. There is no search by roll number and no
        shared seating chart.
      </p>
      {showDemoOps ? <ExamOps /> : null}
    </article>
  )
}

export function ExamDetailPage() {
  const { examId } = useParams()
  const { shared, status, profileId } = useShared()
  const { data } = useCampusData()
  if (status === 'loading' || !shared) return <Loading />
  const e = shared.exams.find((x) => x.id === examId)
  if (!e || !profileCourseIds(data).has(e.courseId))
    return (
      <div className="max-w-xl">
        <h1 id="page-title" className="font-display text-3xl font-semibold text-ink">
          Exam not found
        </h1>
        <p className="mt-2 text-ink-muted">
          That exam is not on your schedule. Nothing was changed.
        </p>
        <Button asChild className="mt-4 min-h-11">
          <Link to="/academics/exams">Back to Exams</Link>
        </Button>
      </div>
    )
  const v = seatView(shared, profileId, e.id)
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Link
        to="/academics/exams"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-coffee"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Exams
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <h1
            id="page-title"
            className="font-display text-3xl font-semibold tracking-tight text-ink"
          >
            {e.name}
          </h1>
          <Pill tone="demo">Demo record</Pill>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {formatDateShort(e.date)} · {examTimeText(e)} · version {e.version}
        </p>
      </div>
      <p
        role="note"
        className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm"
      >
        <strong>Not an official allotment.</strong> {e.sourceLabel}. Check your real exam notice for
        your real seat.
      </p>
      <SectionCard id="seat-h" title="My seating">
        {v.kind === 'none' ? (
          <p>Seating not provided for this demo profile.</p>
        ) : v.kind === 'conflict' ? (
          <p role="alert" className="font-medium">
            Needs verification: more than one allocation exists for you for this exam, so none is
            shown as fact.
          </p>
        ) : (
          <>
            <p className="text-lg font-semibold">{seatText(v.seat)}</p>
            <p className="text-xs text-ink-muted">
              {v.seat.sourceLabel} · version {v.seat.version} · updated{' '}
              {formatInstant(v.seat.updatedAt)}
            </p>
            {v.seat.sourceEmailId ? (
              <p className="mt-1 text-sm">
                <Link
                  to={`/notifications/mail/${v.seat.sourceEmailId}`}
                  className="font-medium text-coffee underline"
                >
                  View the original mail
                </Link>{' '}
                (simulated, revision {v.seat.sourceRevision})
              </p>
            ) : null}
            {v.seat.history.length > 1 ? (
              <details className="mt-2">
                <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-coffee">
                  Earlier versions ({v.seat.history.length - 1})
                </summary>
                <ol className="mt-1 flex flex-col gap-1 text-sm">
                  {v.seat.history.slice(0, -1).map((h) => (
                    <li key={h.version}>
                      Version {h.version}: {seatText(h)}{' '}
                      <span className="text-ink-muted">({formatInstant(h.at)})</span>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </>
        )}
      </SectionCard>
      <p className="text-xs text-ink-muted">
        A seating change never changes the exam’s date or time, and an exam change never rewrites
        your seat.
      </p>
    </article>
  )
}
