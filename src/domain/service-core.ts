import type { AuditEvent } from './ess'

/**
 * Plumbing shared by every service module's pure rules (Essentials, Sports): a failure shape, the
 * in-app notice a change earned, a context carrying "now" and an id factory, and the append-only
 * audit event. Nothing here knows about a particular store, clock or React.
 */
export type Failure = { ok: false; reason: string }

export interface Notice {
  recipientProfileId: string
  /** `<module>|entityId|eventId|recipient` — one message per canonical transition. */
  key: string
  title: string
  body: string
  href: string
  significance: 'critical' | 'important' | 'standard' | 'optional'
}

export type Change<S, T> = { ok: true; store: S; value: T; notices: Notice[] } | Failure

export interface Ctx {
  nowIso: string
  newId: (prefix: string) => string
}

export const fail = (reason: string): Failure => ({ ok: false, reason })

export const ok = <S, T>(store: S, value: T, notices: Notice[] = []): Change<S, T> => ({
  ok: true,
  store,
  value,
  notices,
})

export const makeAudit = (
  entityId: string,
  actorKind: AuditEvent['actorKind'],
  action: string,
  c: Ctx,
  note?: string,
): AuditEvent => ({
  id: c.newId('ev'),
  entityId,
  actorKind,
  action,
  at: c.nowIso,
  dataMode: actorKind === 'student' ? 'userCreated' : 'simulated',
  ...(note ? { note } : {}),
})

export const makeNotice = (
  module: string,
  recipientProfileId: string,
  entityId: string,
  event: { id: string },
  title: string,
  body: string,
  href: string,
  significance: Notice['significance'] = 'standard',
): Notice => ({
  recipientProfileId,
  key: `${module}|${entityId}|${event.id}|${recipientProfileId}`,
  title,
  body,
  href,
  significance,
})
