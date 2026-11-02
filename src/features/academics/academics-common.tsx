import { useServices } from '@/app/services'
import { Link } from 'react-router'
import { meetingStatusLabel, type Meeting } from '@/domain/academics'
import { Pill } from '../essentials/ess-common'

export function DemoNotice({ children }: { children: React.ReactNode }) {
  const { sourceData } = useServices()
  return (
    <p role="note" className="rounded-md border border-border-strong bg-mist p-3 text-sm text-ink">
      {sourceData ? (
        <>
          Names and course associations come from supplied campus documents. Dates, source versions
          and missing details are listed in{' '}
          <Link to="/sources" className="text-coffee underline">
            Data & Sources
          </Link>
          . Requests and status changes are saved on this device; no message is sent to faculty or
          staff.
        </>
      ) : (
        children
      )}
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
