import { ExternalLink } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { NOTICE_TYPES, noticeLabel } from '@/domain/academics'
import { isSafeUrl } from '@/domain/academics-logic'
import { useCampusData } from '@/hooks/use-campus-data'
import { addDays, formatDateShort } from '@/lib/time'
import {
  announcementsFor,
  courseById,
  courseDeadlines,
  coursesFor,
  facultyForCourse,
  isRead,
  linkedTasks,
  myGroups,
  myMeetings,
  noteFor,
  resourcesFor,
  unreadAnnouncements,
  isOpenMeeting,
  meetingWith,
} from '@/selectors/academics'
import { itemsInRange } from '@/selectors/occurrences'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { DemoNotice, MeetingStatusPill } from './academics-common'
import { academicsTabs } from './academics-nav'
import { useAcademics } from './academics-hooks'
import { AcademicsOps } from './academics-ops'
import { milestoneSummary } from '@/selectors/academics'

export function AcademicsHubPage() {
  const { academics, status, profileId, showDemoOps } = useAcademics()
  const { data } = useCampusData()
  if (status === 'loading' || !academics || !data) return <Loading />
  const courses = coursesFor(data)
  const ids = new Set(courses.map((c) => c.id))
  const unread = unreadAnnouncements(academics, profileId, ids)
  const open = myMeetings(academics, profileId).filter(isOpenMeeting)
  const groups = myGroups(academics, profileId)
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
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Academics"
        description="Your courses, assessments, faculty, project groups and BMS office information."
        badge={<Pill tone="demo">Campus data, not official records</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="hub" />
      <DemoNotice>
        Notices, faculty and the office are fictional samples. A meeting request here is recorded on
        this device only; nobody is told, and a request is not a confirmed appointment.
      </DemoNotice>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {card(
          '/academics/courses',
          `My courses (${courses.length})`,
          `${unread.length} unread notice${unread.length === 1 ? '' : 's'}.`,
        )}
        {card(
          '/academics/faculty',
          'Faculty Connect',
          'Faculty associations and meeting proposals.',
        )}
        {card(
          '/academics/mentorship',
          `Mentorship (${groups.length})`,
          'Project groups and mentor invitations.',
        )}
        {card('/academics/office', 'BMS Office', 'Office information and requests.')}
      </ul>
      <SectionCard
        id="ah-meetings-h"
        title={`Your open meeting requests (${open.length})`}
        action={
          <Link
            to="/academics/faculty/appointments"
            className="text-sm font-medium text-coffee underline"
          >
            All faculty meetings
          </Link>
        }
      >
        {open.length === 0 ? (
          <Empty>You have no open meeting requests.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {open.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <Link
                  to={`/academics/appointments/${m.id}`}
                  className="font-medium text-coffee underline"
                >
                  {meetingWith(academics, m)} · {formatDateShort(m.date)} {m.start}
                </Link>
                <MeetingStatusPill status={m.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}

export function CoursesPage() {
  const { academics, status, profileId } = useAcademics()
  const { data } = useCampusData()
  const [q, setQ] = useState('')
  if (status === 'loading' || !academics || !data) return <Loading />
  const all = coursesFor(data)
  const shown = all.filter((c) =>
    `${c.code} ${c.title}`.toLowerCase().includes(q.trim().toLowerCase()),
  )
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="My courses"
        description="Only courses that appear in this persona's own schedule or deadlines are listed. Nothing else is assumed."
        badge={<Pill tone="demo">Supplied curriculum</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="courses" />
      <Field label="Search courses">
        {(a) => (
          <input
            {...a}
            className={`${inputClass} max-w-sm`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </Field>
      {all.length === 0 ? (
        <Empty>This profile has no courses in its own records.</Empty>
      ) : shown.length === 0 ? (
        <Empty>No course matches that search.</Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {shown.map((c) => {
            const unread = unreadAnnouncements(academics, profileId, new Set([c.id])).length
            return (
              <li key={c.id}>
                <Link
                  to={`/academics/courses/${c.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-surface p-4 shadow-card hover:bg-mist"
                >
                  <span className="text-base font-semibold text-ink">
                    {c.code} · {c.title}
                  </span>
                  {unread > 0 ? (
                    <span className="text-sm text-ink-muted">
                      {unread} unread notice{unread === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </article>
  )
}

const COURSE_TABS = ['overview', 'announcements', 'materials', 'assignments', 'projects'] as const
type CourseTab = (typeof COURSE_TABS)[number]
const tabLabel: Record<CourseTab, string> = {
  overview: 'Overview',
  announcements: 'Notices',
  materials: 'Materials',
  assignments: 'Assignments',
  projects: 'Projects',
}

export function CoursePage() {
  const { courseId = '', tab = 'overview' } = useParams()
  const { academics, status, profileId, now, repo } = useAcademics()
  const { data } = useCampusData()
  const { act } = useAction()
  const [filter, setFilter] = useState('')
  const [draft, setDraft] = useState<string | null>(null)
  const stored = academics ? (noteFor(academics, profileId, courseId)?.text ?? '') : ''
  const note = draft ?? stored
  if (status === 'loading' || !academics || !data) return <Loading />
  const course = courseById(data, courseId)
  if (!course || !coursesFor(data).some((c) => c.id === courseId))
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Course not found" />
        <Empty>
          That course is not in this profile's records.{' '}
          <Link to="/academics/courses" className="underline">
            Back to My courses
          </Link>
        </Empty>
      </article>
    )
  if (!COURSE_TABS.includes(tab as CourseTab))
    return <Navigate to={`/academics/courses/${courseId}`} replace />
  const current = tab as CourseTab
  const notices = announcementsFor(academics, courseId)
  const deadlines = courseDeadlines(data, now, courseId)
  const nextClass = itemsInRange(data, now.today, addDays(now.today, 14)).find(
    (i) => i.courseId === courseId && i.recordKind !== 'deadline' && i.recordKind !== 'task',
  )
  const nextDeadline = deadlines.find((d) => d.standing !== 'completed' && d.standing !== 'overdue')
  const tabs = COURSE_TABS.map((t) => ({
    id: t,
    label: tabLabel[t],
    to: t === 'overview' ? `/academics/courses/${courseId}` : `/academics/courses/${courseId}/${t}`,
  }))
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title={`${course.code} · ${course.title}`}
        description="Course information and resources retain their source. Check the source register for dated documents, planning assumptions and missing material."
        badge={<Pill tone="demo">Supplied course information</Pill>}
      />
      <SubNav label="Course sections" items={tabs} current={current} />
      {current === 'overview' ? (
        <>
          <SectionCard id="co-next-h" title="Next known items">
            <dl className="grid gap-2 sm:grid-cols-2">
              <div>
                <dt className="font-medium">Next known class</dt>
                <dd>
                  {nextClass
                    ? `${nextClass.title}, ${formatDateShort(nextClass.date)}${nextClass.time.kind === 'timed' ? ` ${nextClass.time.start}` : ''}`
                    : 'No class in the next two weeks is on record.'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Next pending assignment</dt>
                <dd>
                  {nextDeadline
                    ? `${nextDeadline.title}, due ${formatDateShort(nextDeadline.dueDate)}${nextDeadline.dueTime ? ` ${nextDeadline.dueTime}` : ' (date only)'}`
                    : 'None on record.'}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Instructor</dt>
                <dd>
                  {facultyForCourse(academics, courseId).map((f) => (
                    <Link key={f.id} to={`/academics/faculty/${f.id}`} className="mr-3 underline">
                      {f.displayName}
                    </Link>
                  ))}
                  {facultyForCourse(academics, courseId).length === 0 ? 'Not provided.' : null}
                </dd>
              </div>
              <div>
                <dt className="font-medium">Credits, syllabus</dt>
                <dd>Not provided on this device.</dd>
              </div>
            </dl>
          </SectionCard>
          <SectionCard id="co-note-h" title="Your private note">
            <form
              className="flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                void act(
                  () => repo.saveNote(profileId, courseId, note),
                  'Note saved on this device.',
                )
              }}
            >
              <Field label="Note (only you see this, up to 1000 characters)">
                {(a) => (
                  <textarea
                    {...a}
                    rows={3}
                    maxLength={1000}
                    className={inputClass}
                    value={note}
                    onChange={(e) => setDraft(e.target.value)}
                  />
                )}
              </Field>
              <Button type="submit" className="min-h-11 self-start">
                Save note
              </Button>
            </form>
          </SectionCard>
        </>
      ) : null}
      {current === 'announcements' ? (
        <SectionCard id="co-feed-h" title="Course notices (samples)">
          <Field label="Show">
            {(a) => (
              <select
                {...a}
                className={`${inputClass} w-56`}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">All notice types</option>
                {NOTICE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {noticeLabel[t]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {notices.filter((n) => !filter || n.noticeType === filter).length === 0 ? (
            <div className="mt-2">
              <Empty>No notices match.</Empty>
            </div>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {notices
                .filter((n) => !filter || n.noticeType === filter)
                .map((n) => {
                  const read = isRead(academics, profileId, n.id)
                  return (
                    <li key={n.id} className="rounded-md border border-border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong>{n.title}</strong>
                        <Pill>{noticeLabel[n.noticeType]}</Pill>
                        {read ? null : <Pill tone="warn">Unread</Pill>}
                      </div>
                      <p className="mt-1">{n.body}</p>
                      <p className="mt-1 text-xs text-ink-muted">
                        {n.authorLabel} · {n.audienceLabel} ·{' '}
                        {n.publishedOn
                          ? `published ${formatDateShort(n.publishedOn)}`
                          : 'date not provided'}{' '}
                        · {n.sourceLabel}
                      </p>
                      {read ? null : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2 min-h-11"
                          onClick={() => void repo.markRead(profileId, n.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                    </li>
                  )
                })}
            </ul>
          )}
        </SectionCard>
      ) : null}
      {current === 'materials' ? (
        <SectionCard id="co-mat-h" title="Materials (samples)">
          {resourcesFor(academics, courseId).length === 0 ? (
            <Empty>Resource not provided. No materials are on record for this course.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {resourcesFor(academics, courseId).map((r) => (
                <li key={r.id} className="rounded-md border border-border p-3">
                  <strong>{r.title}</strong>
                  <p className="text-xs text-ink-muted">
                    {r.accessLabel ?? 'No access note'} · {r.sourceLabel}
                  </p>
                  {isSafeUrl(r.uri) ? (
                    <a
                      href={r.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center gap-1 font-medium text-coffee underline"
                    >
                      Open link <ExternalLink className="size-4" aria-hidden="true" />
                      <span className="sr-only">(opens a new tab)</span>
                    </a>
                  ) : (
                    <p className="mt-1 text-sm">Resource not provided. There is no usable link.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
      {current === 'assignments' ? (
        <SectionCard id="co-asg-h" title="Assignments (the same records Calendar and Home show)">
          {deadlines.length === 0 ? (
            <Empty>No assignment is on record for this course.</Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {deadlines.map((d) => (
                <li key={d.key} className="rounded-md border border-border p-3">
                  <strong>{d.title}</strong> ·{' '}
                  {d.dueDate ? `due ${formatDateShort(d.dueDate)}` : 'no due date'}
                  {d.dueTime ? ` ${d.dueTime}` : ' (date only)'}
                  <p className="text-xs text-ink-muted">
                    Verification: {d.verification}. Your personal tasks never mark this as
                    submitted.
                  </p>
                  <Link
                    to={`/calendar?view=agenda&date=${d.dueDate}&event=${encodeURIComponent(d.calendarKey)}&panel=details`}
                    className="mt-1 inline-flex min-h-11 items-center text-coffee underline"
                  >
                    Open in Calendar
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h3 className="mt-3 font-medium">Your tasks for this course</h3>
          {linkedTasks(data, courseId).length === 0 ? (
            <p className="text-ink-muted">None yet.</p>
          ) : (
            <ul className="list-disc pl-5">
              {linkedTasks(data, courseId).map((t) => (
                <li key={t.id}>{t.title}</li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
      {current === 'projects' ? (
        <SectionCard id="co-prj-h" title="Project groups for this course">
          {myGroups(academics, profileId).filter((g) => g.courseId === courseId).length === 0 ? (
            <Empty>
              No project group yet.{' '}
              <Link to="/academics/mentorship" className="underline">
                Create one in Mentorship
              </Link>
              .
            </Empty>
          ) : (
            <ul className="flex flex-col gap-2">
              {myGroups(academics, profileId)
                .filter((g) => g.courseId === courseId)
                .map((g) => (
                  <li key={g.id}>
                    <Link
                      to={`/academics/mentorship/groups/${g.id}`}
                      className="font-medium text-coffee underline"
                    >
                      {g.title}
                    </Link>{' '}
                    · {milestoneSummary(g)}
                  </li>
                ))}
            </ul>
          )}
        </SectionCard>
      ) : null}
    </article>
  )
}
