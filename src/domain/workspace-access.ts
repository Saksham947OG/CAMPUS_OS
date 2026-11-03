import { Temporal } from 'temporal-polyfill'
import { CAMPUS_TIMEZONE, fromPlainDate, type DateOnly } from '@/lib/time'
import type { Page, Role, WorkspaceStore } from './workspace'

/**
 * Who may do what (spec §2.2 and §18). Local enforcement for the single-browser prototype: it keeps
 * the roles honest in the interface and in the rules, but it is NOT server-side security. Separate
 * devices and real sign-in arrive with the connected phase.
 */
export type Action = 'read' | 'comment' | 'edit' | 'manage'

const RANK: Record<Role, number> = { viewer: 1, commenter: 2, editor: 3, owner: 4 }
const NEED: Record<Action, number> = { read: 1, comment: 2, edit: 3, manage: 4 }

export const can = (role: Role | null, action: Action) =>
  role !== null && RANK[role] >= NEED[action]

export function roleOf(s: WorkspaceStore, spaceId: string, userId: string): Role | null {
  const space = s.spaces.find((x) => x.id === spaceId)
  if (!space) return null
  if (space.type === 'personal') return space.ownerId === userId ? 'owner' : null
  const m = s.members.find((x) => x.spaceId === spaceId && x.userId === userId)
  // An invitation that has not been accepted gives no access at all.
  return m && !m.invitation ? m.role : null
}

/** A private page is the author's alone, whatever the reader's role in the space. */
export function canReadPage(s: WorkspaceStore, page: Page, userId: string): boolean {
  if (!can(roleOf(s, page.spaceId, userId), 'read')) return false
  return page.audience === 'space' || page.authorId === userId
}

export function canEditPage(s: WorkspaceStore, page: Page, userId: string): boolean {
  return canReadPage(s, page, userId) && can(roleOf(s, page.spaceId, userId), 'edit')
}

/** Calendar date in the campus timezone for an ISO instant. */
export const istDate = (iso: string): DateOnly =>
  fromPlainDate(Temporal.Instant.from(iso).toZonedDateTimeISO(CAMPUS_TIMEZONE).toPlainDate())
