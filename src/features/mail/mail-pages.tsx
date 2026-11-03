import { Paperclip } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { PageHeader } from '@/components/page-header'
import { categoryTab } from '@/domain/mail'
import { formatInstant } from '@/lib/time'
import { MAIL_TABS, actionableUnread, filterMail, inboxFor, mailboxAlias } from '@/selectors/mail'
import { Empty, Loading, Pill, SectionCard } from '../essentials/ess-common'
import { useMail } from './mail-hooks'
import { MailLab } from './mail-lab'

const preview = (body: string) => body.replace(/\s+/g, ' ').trim().slice(0, 110)

export function MailPage() {
  const { mail, status, profileId, showDemoOps } = useMail()
  const [tab, setTab] = useState<(typeof MAIL_TABS)[number]['id']>('all')
  const [q, setQ] = useState('')
  if (status === 'loading' || !mail) return <Loading />
  const all = inboxFor(mail, profileId)
  const rows = filterMail(all, tab, q)
  const alias = mailboxAlias(mail, profileId)
  return (
    <article className="flex max-w-4xl flex-col gap-4">
      <PageHeader
        title="Campus Mail"
        description="A campus mailbox kept on this device. No real account is connected and nothing is fetched; messages arrive only from the lab."
        badge={<Pill tone="demo">Saved on this device</Pill>}
      />
      <p className="text-sm text-ink" data-testid="mail-status">
        Mailbox: <strong>{alias ?? 'none'}</strong> · Saved on this device · last sync: not
        applicable (nothing is synced) · {actionableUnread(all)} unread that need a look
      </p>
      <p>
        <Link to="/notifications" className="text-sm font-medium text-coffee underline">
          Back to Notifications
        </Link>
      </p>
      <div
        role="tablist"
        aria-label="Mail categories"
        className="flex flex-wrap gap-1 border-b border-border"
      >
        {MAIL_TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`min-h-11 border-b-4 px-3 py-2 text-sm font-medium ${tab === t.id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist'}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <Field label="Search subject, sender or text">
        {(a) => (
          <input
            {...a}
            className={`${inputClass} max-w-sm`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        )}
      </Field>
      {rows.length === 0 ? (
        <Empty>{all.length === 0 ? 'Your mailbox is empty.' : 'No message matches.'}</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((e) => (
            <li key={e.id}>
              <Link
                to={`/notifications/mail/${e.id}`}
                className={`flex flex-col gap-1 rounded-lg border border-border p-3 hover:bg-mist ${e.readAt ? 'bg-surface' : 'bg-coffee-tint'}`}
              >
                <span className="flex flex-wrap items-center gap-2 text-sm">
                  <strong>{e.subject}</strong>
                  {e.readAt ? null : <Pill>Unread</Pill>}
                  <Pill tone="demo">Local</Pill>
                  {e.syncState === 'NEEDS_REVIEW' ? <Pill tone="warn">Needs review</Pill> : null}
                  {e.attachments.length ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <Paperclip className="size-3" aria-hidden="true" />
                      {e.attachments.length} attachment
                    </span>
                  ) : null}
                </span>
                <span className="text-xs text-ink-muted">
                  {e.from} · {formatInstant(e.receivedAt)} · {categoryTab[e.category]}
                </span>
                <span className="text-sm text-ink-muted">{preview(e.body)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {showDemoOps ? <MailLab /> : null}
    </article>
  )
}

const statusText = {
  done: 'Done',
  skipped: 'Skipped',
  review: 'Needs review',
  duplicate: 'Duplicate',
  blocked: 'Stopped',
} as const

export function MailDetailPage() {
  const { emailId = '' } = useParams()
  const { mail, status, profileId, repo, showDemoOps } = useMail()
  const known = !!mail?.emails.find((e) => e.id === emailId)
  useEffect(() => {
    if (known) void repo.markRead(emailId)
  }, [known, emailId, repo])
  if (status === 'loading' || !mail) return <Loading />
  const e = inboxFor(mail, profileId).find((x) => x.id === emailId)
  if (!e)
    return (
      <article className="flex max-w-3xl flex-col gap-4">
        <PageHeader title="Message not found" />
        <Empty>
          This message is not in your mailbox.{' '}
          <Link to="/notifications/mail" className="underline">
            Back to Campus Mail
          </Link>
        </Empty>
      </article>
    )
  const notice = mail.notices.find((n) => n.sourceEmailId === e.id)
  const seatApplied = e.stages.some((s) => s.stage === 'seat' && s.status === 'done')
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <PageHeader title={e.subject} badge={<Pill tone="demo">Local · message</Pill>} />
      <Link to="/notifications/mail" className="text-sm font-medium text-coffee underline">
        Back to Campus Mail
      </Link>
      <SectionCard id="md-head-h" title="Message">
        <dl className="grid gap-1 sm:grid-cols-2 text-sm">
          <div>
            <dt className="font-medium">From</dt>
            <dd>{e.from}</dd>
          </div>
          <div>
            <dt className="font-medium">Received</dt>
            <dd>{formatInstant(e.receivedAt)}</dd>
          </div>
          <div>
            <dt className="font-medium">Category (rule-based)</dt>
            <dd>{categoryTab[e.category]}</dd>
          </div>
          <div>
            <dt className="font-medium">Source</dt>
            <dd>
              {e.provenance === 'DEMO_SIMULATED' ? 'Simulated (local)' : e.provenance} ·{' '}
              {e.syncState.toLowerCase().replace('_', ' ')}
            </dd>
          </div>
        </dl>
        <pre
          className="mt-3 whitespace-pre-wrap rounded-md border border-border bg-canvas p-3 font-sans text-sm text-ink"
          data-testid="mail-body"
        >
          {e.body}
        </pre>
        {e.attachments.length ? (
          <ul className="mt-2 text-sm">
            {e.attachments.map((a) => (
              <li key={a.name}>
                {a.name}:{' '}
                {a.readable ? 'readable' : 'could not be read on this device; inspect the source'}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-ink-muted">
          Shown as plain text. Links are never followed or opened for you, and embedded instructions
          are never carried out.
        </p>
        {seatApplied && notice?.examId ? (
          <p className="mt-2">
            <Link
              to={`/academics/exams/${notice.examId}`}
              className="font-medium text-coffee underline"
            >
              View my seat
            </Link>
          </p>
        ) : null}
      </SectionCard>
      <SectionCard id="md-pipe-h" title="What happened to this message">
        <ol className="flex flex-col gap-1.5" data-testid="pipeline">
          {e.stages.map((s, i) => (
            <li key={`${s.stage}-${i}`} className="text-sm">
              <strong className="capitalize">{s.stage}</strong> · {statusText[s.status]} ·{' '}
              <span className="text-ink-muted">{s.note}</span>
            </li>
          ))}
        </ol>
      </SectionCard>
      {notice ? (
        <SectionCard id="md-ev-h" title="Extraction evidence">
          <details>
            <summary className="min-h-11 cursor-pointer py-2.5 text-sm font-medium text-coffee">
              Show extraction evidence
            </summary>
            <p className="mt-1 text-sm">
              Status: {notice.status.toLowerCase().replace('_', ' ')}
              {notice.reviewReason ? ` (${notice.reviewReason})` : ''}
            </p>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {notice.evidence.map((x, i) => (
                <li key={i}>
                  {x.field}: “{x.raw}” ({x.locator})
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-ink-muted">
              Candidate values read from the text. They are not proof, and no value is guessed.
            </p>
          </details>
        </SectionCard>
      ) : null}
      {showDemoOps ? <MailLab /> : null}
    </article>
  )
}
