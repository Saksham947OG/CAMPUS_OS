import type { Ctx, Notice } from './service-core'
import type { AutomationLog, WorkspaceStore } from './workspace'

/**
 * Bounded automations (spec §5.4). Each rule is a fixed, visible trigger and action, on by default
 * and switchable per space. A rule never triggers another rule, and the same trigger (its key) is
 * never logged or notified twice. Notices are in-app only: nothing here sends an email or push.
 */
export const RULES = [
  {
    id: 'task-assigned',
    label: 'Task assigned',
    trigger: 'Someone assigns a task to a person',
    action: 'That person gets an in-app notification',
  },
  {
    id: 'meeting-agenda',
    label: 'Meeting scheduled',
    trigger: 'A team meeting is confirmed',
    action: 'An agenda page is created and the invited people are notified',
  },
  {
    id: 'decision-log',
    label: 'Decision recorded',
    trigger: 'A decision is finalized',
    action: 'It is added to the project’s Decision log page',
  },
  {
    id: 'due-soon',
    label: 'Due date approaching',
    trigger: 'A task assigned to you is due today or tomorrow (checked when you open Workspace)',
    action: 'You get one in-app reminder per task and day',
  },
] as const
export type RuleId = (typeof RULES)[number]['id']

const MAX_LOG = 120

export const ruleOn = (s: WorkspaceStore, spaceId: string, rule: RuleId) =>
  !s.spaces.find((x) => x.id === spaceId)?.automationsOff?.includes(rule)

/** Demo members are fictional, so they never receive a notification; the actor is not told about their own action. */
const real = (s: WorkspaceStore, id: string, actor: string) =>
  id !== actor && !s.people.some((p) => p.id === id)

export interface Fired {
  log: AutomationLog[]
  notices: Notice[]
}
export const NOTHING: Fired = { log: [], notices: [] }

export function fire(
  s: WorkspaceStore,
  c: Ctx,
  actor: string,
  i: {
    spaceId: string
    rule: RuleId
    key: string
    text: string
    to: string[]
    title: string
    body: string
    href: string
  },
): Fired {
  if (!ruleOn(s, i.spaceId, i.rule)) return NOTHING
  if (s.automationLog.some((l) => l.key === i.key)) return NOTHING
  const to = i.to.filter((r) => real(s, r, actor))
  return {
    log: [
      {
        id: c.newId('aut'),
        spaceId: i.spaceId,
        rule: i.rule,
        text: i.text,
        key: i.key,
        at: c.nowIso,
      },
    ],
    notices: to.map((r) => ({
      recipientProfileId: r,
      key: `workspace|${i.key}|${r}`,
      title: i.title,
      body: i.body,
      href: i.href,
      significance: 'standard' as const,
    })),
  }
}

/** A direct notice that is not an automation (an invitation, a mention, a review request). */
export const direct = (
  s: WorkspaceStore,
  actor: string,
  key: string,
  to: string[],
  title: string,
  body: string,
  href: string,
): Notice[] =>
  to
    .filter((r) => real(s, r, actor))
    .map((r) => ({
      recipientProfileId: r,
      key: `workspace|${key}|${r}`,
      title,
      body,
      href,
      significance: 'standard' as const,
    }))

export const addLog = (s: WorkspaceStore, f: Fired): AutomationLog[] =>
  f.log.length ? [...f.log, ...s.automationLog].slice(0, MAX_LOG) : s.automationLog
