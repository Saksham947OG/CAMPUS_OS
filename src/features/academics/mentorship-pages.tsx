import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { useConfirm } from '@/components/confirm-context'
import { INVITE_ACTIVE, inviteStatusLabel } from '@/domain/academics'
import { useCampusData } from '@/hooks/use-campus-data'
import { formatDateShort, isDateOnly, type DateOnly } from '@/lib/time'
import { coursesFor, milestoneSummary, myGroups, myInvites } from '@/selectors/academics'
import { Empty, Loading, Pill, SectionCard, SubNav } from '../essentials/ess-common'
import { useAction } from '../essentials/ess-hooks'
import { BackLink, DemoNotice } from './academics-common'
import { academicsTabs } from './academics-nav'
import { useAcademics } from './academics-hooks'
import { AcademicsOps } from './academics-ops'

export function MentorshipPage() {
  const { academics, status, profileId, repo, showDemoOps } = useAcademics()
  const { data } = useCampusData()
  const { act } = useAction()
  const [title, setTitle] = useState('')
  const [courseId, setCourseId] = useState('')
  const [members, setMembers] = useState('')
  const [error, setError] = useState('')
  if (status === 'loading' || !academics || !data) return <Loading />
  const groups = myGroups(academics, profileId)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Mentorship"
        description="Create a project group and invite a simulated mentor. An invitation is never an agreement to mentor."
        badge={<Pill tone="demo">Demo · nothing delivered to any professor</Pill>}
      />
      <SubNav label="Academics sections" items={academicsTabs} current="mentorship" />
      <SectionCard id="mp-groups-h" title={`Your project groups (${groups.length})`}>
        {groups.length === 0 ? (
          <Empty>You have no project group yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id} className="rounded-md border border-border p-3">
                <Link
                  to={`/academics/mentorship/groups/${g.id}`}
                  className="font-medium text-coffee underline"
                >
                  {g.title}
                </Link>
                <p className="text-sm text-ink-muted">
                  {milestoneSummary(g)} ·{' '}
                  {
                    myInvites(academics, profileId, g.id).filter((i) =>
                      INVITE_ACTIVE.includes(i.status),
                    ).length
                  }{' '}
                  active invitation(s)
                </p>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
      <SectionCard id="mp-new-h" title="Create a project group">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (e) => {
            e.preventDefault()
            setError('')
            const r = await act(
              () =>
                repo.createGroup(profileId, {
                  title,
                  ...(courseId ? { courseId } : {}),
                  memberAliases: members
                    .split(',')
                    .map((m) => m.trim())
                    .filter(Boolean),
                }),
              'Project group created on this device.',
            )
            if (r.ok) {
              setTitle('')
              setMembers('')
            } else setError(r.error.message)
          }}
        >
          <Field label="Group title">
            {(a) => (
              <input
                {...a}
                className={inputClass}
                maxLength={80}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Course (optional)">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="">None</option>
                {coursesFor(data).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} · {c.title}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field
            label="Other members (made-up names, comma separated)"
            hint="Nobody is invited or verified. These are labels only."
          >
            {(a) => (
              <input
                {...a}
                className={inputClass}
                value={members}
                onChange={(e) => setMembers(e.target.value)}
              />
            )}
          </Field>
          {error ? (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" className="min-h-11 self-start">
            Create group
          </Button>
        </form>
      </SectionCard>
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}

export function GroupPage() {
  const { groupId = '' } = useParams()
  const { academics, status, profileId, repo, showDemoOps } = useAcademics()
  const { act, message } = useAction()
  const confirm = useConfirm()
  const [ms, setMs] = useState('')
  const [due, setDue] = useState('')
  const [facultyId, setFacultyId] = useState('')
  const [note, setNote] = useState('')
  if (status === 'loading' || !academics) return <Loading />
  const g = academics.groups.find((x) => x.id === groupId && x.ownerProfileId === profileId)
  if (!g)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Group not found" />
        <Empty>
          This group is not in your records.{' '}
          <Link to="/academics/mentorship" className="underline">
            Back to Mentorship
          </Link>
        </Empty>
      </article>
    )
  const invites = myInvites(academics, profileId, g.id)
  const nameOf = (id: string) =>
    academics.faculty.find((f) => f.id === id)?.displayName ?? 'Faculty'
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader title={g.title} badge={<Pill tone="demo">Demo · private to this profile</Pill>} />
      <BackLink to="/academics/mentorship">Back to Mentorship</BackLink>
      <output aria-live="polite" className="block min-h-5 text-sm font-medium">
        {message}
      </output>
      <SectionCard id="gp-sum-h" title="Group">
        <p>
          Members (labels only): {g.memberAliases.length ? g.memberAliases.join(', ') : 'just you'}
        </p>
        <p>{milestoneSummary(g)}</p>
        <Button
          variant="outline"
          className="mt-2 min-h-11 border-danger text-danger"
          onClick={async () => {
            const c = await confirm({
              title: 'Delete this group?',
              description: <p>Its milestones and invitations are removed from this device.</p>,
              confirmLabel: 'Delete group',
              danger: true,
            })
            if (c === 'confirm')
              await act(() => repo.deleteGroup(profileId, g.id), 'Group deleted.')
          }}
        >
          Delete group
        </Button>
      </SectionCard>
      <SectionCard id="gp-ms-h" title="Milestones (your own plan)">
        <DemoNotice>
          Milestones are personal planning. Marking one done never changes an official course
          deadline.
        </DemoNotice>
        {g.milestones.length === 0 ? (
          <div className="mt-2">
            <Empty>No milestone yet.</Empty>
          </div>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {g.milestones.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <span>
                  {m.title}
                  {m.dueDate ? ` · ${formatDateShort(m.dueDate)}` : ''}
                </span>
                <select
                  aria-label={`Status of ${m.title}`}
                  className={`${inputClass} w-40`}
                  value={m.status}
                  onChange={(e) =>
                    void repo.setMilestoneStatus(
                      profileId,
                      g.id,
                      m.id,
                      e.target.value as 'notStarted' | 'inProgress' | 'done',
                    )
                  }
                >
                  <option value="notStarted">Not started</option>
                  <option value="inProgress">In progress</option>
                  <option value="done">Done</option>
                </select>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-wrap items-end gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await act(
              () =>
                repo.addMilestone(profileId, g.id, {
                  title: ms,
                  ...(isDateOnly(due) ? { dueDate: due as DateOnly } : {}),
                }),
              'Milestone added.',
            )
            if (r.ok) {
              setMs('')
              setDue('')
            }
          }}
        >
          <Field label="New milestone">
            {(a) => (
              <input
                {...a}
                className={`${inputClass} w-64`}
                value={ms}
                onChange={(e) => setMs(e.target.value)}
              />
            )}
          </Field>
          <Field label="Due (optional)">
            {(a) => (
              <input
                {...a}
                type="date"
                className={inputClass}
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" className="min-h-11">
            Add milestone
          </Button>
        </form>
      </SectionCard>
      <SectionCard id="gp-inv-h" title="Mentor invitations">
        {invites.length === 0 ? (
          <Empty>No invitation yet.</Empty>
        ) : (
          <ul className="flex flex-col gap-2">
            {invites.map((i) => (
              <li key={i.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong>{nameOf(i.facultyId)}</strong>
                  <Pill
                    tone={i.status === 'declined' || i.status === 'withdrawn' ? 'warn' : 'plain'}
                  >
                    {inviteStatusLabel[i.status]}
                  </Pill>
                </div>
                <p className="text-sm">Your note: {i.note}</p>
                {i.feedback ? (
                  <p className="text-sm">Sample feedback (simulated): {i.feedback}</p>
                ) : null}
                {i.status === 'accepted' ? (
                  <Link
                    to={`/academics/faculty/appointments/new?actor=${i.facultyId}&group=${g.id}`}
                    className="inline-flex min-h-11 items-center font-medium text-coffee underline"
                  >
                    Request a meeting with this mentor
                  </Link>
                ) : null}
                {INVITE_ACTIVE.includes(i.status) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1 min-h-11"
                    onClick={() =>
                      void act(() => repo.withdrawInvite(profileId, i.id), 'Invitation withdrawn.')
                    }
                  >
                    Withdraw invitation
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={async (e) => {
            e.preventDefault()
            const r = await act(
              () => repo.sendInvite(profileId, { groupId: g.id, facultyId, note }),
              'Invitation recorded on this device.',
            )
            if (r.ok) setNote('')
          }}
        >
          <Field label="Invite a (fictional) mentor">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
              >
                <option value="">Choose…</option>
                {academics.faculty.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="What would you like help with?">
            {(a) => (
              <textarea
                {...a}
                rows={2}
                maxLength={300}
                className={inputClass}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            )}
          </Field>
          <Button type="submit" className="min-h-11 self-start" disabled={!facultyId}>
            Record invitation locally
          </Button>
        </form>
      </SectionCard>
      {showDemoOps ? <AcademicsOps /> : null}
    </article>
  )
}
