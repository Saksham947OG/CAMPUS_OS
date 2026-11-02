import { Link } from 'react-router'
import { meetingStatusLabel, type Meeting } from '@/domain/academics'
import { Pill } from '../essentials/ess-common'

export function DemoNotice({ children }: { children: React.ReactNode }) {
  return (
    <p role="note" className="rounded-md border border-border-strong bg-mist p-3 text-sm text-ink">
      {children}
    </p>
  )
}

export function MeetingStatusPill({ status }: { status: Meeting['status'] }) {
  const warn = status === 'rejectedDemo' || status === 'cancelledDemo' || status === 'withdrawn'
  return <Pill tone={warn ? 'warn' : 'plain'}>{meetingStatusLabel[status]}</Pill>
}

export function BackLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm font-medium text-coffee underline">
      {children}
    </Link>
  )
}
