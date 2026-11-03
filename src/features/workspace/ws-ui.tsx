import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'
import {
  LIFECYCLE_LABEL,
  ROLE_LABEL,
  TASK_STATUS_LABEL,
  type Page,
  type Role,
  type TaskStatus,
} from '@/domain/workspace'

export function WsCard({
  title,
  action,
  children,
  className,
  id,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
  id?: string
}) {
  return (
    <section
      aria-labelledby={id}
      className={cn('rounded-lg border border-border bg-surface p-4 shadow-card', className)}
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-md bg-mist p-3 text-sm text-ink-muted">{children}</p>
)

export function Pill({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'teal' | 'warn' | 'danger'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-mist text-ink',
        tone === 'teal' && 'bg-teal-tint text-ink',
        tone === 'warn' && 'bg-warning/15 text-ink',
        tone === 'danger' && 'bg-danger/15 text-ink',
      )}
    >
      {children}
    </span>
  )
}

export const RolePill = ({ role }: { role: Role }) => (
  <Pill tone={role === 'owner' ? 'teal' : 'neutral'}>{ROLE_LABEL[role]}</Pill>
)

export const AudiencePill = ({ audience }: { audience: Page['audience'] }) =>
  audience === 'private' ? (
    <Pill tone="warn">Only you</Pill>
  ) : (
    <Pill tone="teal">Shared with the space</Pill>
  )

export const LifecyclePill = ({ lifecycle }: { lifecycle: Page['lifecycle'] }) => (
  <Pill tone={lifecycle === 'approved' ? 'teal' : 'neutral'}>{LIFECYCLE_LABEL[lifecycle]}</Pill>
)

export const StatusPill = ({ status }: { status: TaskStatus }) => (
  <Pill tone={status === 'done' ? 'teal' : status === 'canceled' ? 'danger' : 'neutral'}>
    {TASK_STATUS_LABEL[status]}
  </Pill>
)

export const PageLink = ({ id, children }: { id: string; children: ReactNode }) => (
  <Link to={`/workspace/pages/${id}`} className="font-medium text-ink underline">
    {children}
  </Link>
)

export const linkBtn = 'min-h-11 text-sm font-medium text-coffee underline'
export const fieldClass =
  'min-h-11 rounded-md border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted disabled:bg-canvas'
