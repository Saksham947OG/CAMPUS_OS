import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import {
  REPORT_CATEGORIES,
  reportStoreSchema,
  type Issue,
  type ReportStore,
} from '@/domain/reports'
import { fail, makeNotice, ok, type Change } from '@/domain/service-core'
import type { Clock } from '@/lib/time'

export const REPORT_STORE_KEY = storageKey({ area: 'reports', version: 1 })
type Out<T> = Promise<Result<T>>

export interface NewIssue {
  category: Issue['category']
  description: string
  steps?: string
  contact?: string
  route: string
  entityRef?: string
  attachments: Issue['attachments']
  opId: string
}

export interface ReportRepository {
  load(): Promise<ReportStore>
  submit(profileId: string, input: NewIssue): Out<{ issue: Issue; created: boolean }>
  /** Local simulator only: a reviewer moves a report along. */
  review(id: string, status: Issue['status'], note?: string): Out<Issue>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export function createReportRepository(o: {
  storage: StorageAdapter
  clock: Clock
  newId: (p: string) => string
  notifications: PreferencesRepository<NotificationsState>
}): ReportRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<ReportStore>({
    storage: o.storage,
    key: REPORT_STORE_KEY,
    schema: reportStoreSchema,
    starting: () => ({ schemaVersion: 1, issues: [] }),
    notifications: o.notifications,
    nowMs,
    newId: o.newId,
    onChange: () => listeners.forEach((l) => l()),
  })
  const { read, run } = runner
  return {
    async load() {
      return read()
    },
    submit: (profileId, input) =>
      run((s, c): Change<ReportStore, { issue: Issue; created: boolean }> => {
        const dup = s.issues.find((i) => i.ownerProfileId === profileId && i.opId === input.opId)
        if (dup) return ok(s, { issue: dup, created: false })
        if (!REPORT_CATEGORIES.includes(input.category)) return fail('Choose a category.')
        if (!input.description.trim()) return fail('Describe what went wrong.')
        const id = c.newId('rpt')
        const issue: Issue = {
          id,
          ownerProfileId: profileId,
          category: input.category,
          description: input.description.trim(),
          ...(input.steps?.trim() ? { steps: input.steps.trim() } : {}),
          ...(input.contact?.trim() ? { contact: input.contact.trim() } : {}),
          route: input.route,
          ...(input.entityRef ? { entityRef: input.entityRef } : {}),
          attachments: input.attachments.slice(0, 3),
          status: 'RECEIVED',
          opId: input.opId,
          createdAt: c.nowIso,
          updatedAt: c.nowIso,
          history: [{ at: c.nowIso, actor: 'student', status: 'RECEIVED' }],
        }
        return ok({ ...s, issues: [issue, ...s.issues] }, { issue, created: true }, [
          makeNotice(
            'reports',
            profileId,
            id,
            { id: 'received' },
            'Report recorded (demo)',
            `${id}: saved on this device. It has not been sent to anyone.`,
            '/help/report',
          ),
        ])
      }),
    review: (id, status, note) =>
      run((s, c) => {
        const i = s.issues.find((x) => x.id === id)
        if (!i) return fail('That report was not found.')
        const next: Issue = {
          ...i,
          status,
          updatedAt: c.nowIso,
          history: [
            ...i.history,
            { at: c.nowIso, actor: 'demoReviewer', status, ...(note ? { note } : {}) },
          ],
        }
        return ok({ ...s, issues: s.issues.map((x) => (x.id === id ? next : x)) }, next, [
          makeNotice(
            'reports',
            i.ownerProfileId,
            id,
            { id: status },
            'Report status changed (demo)',
            `${id}: ${status.toLowerCase().replace('_', ' ')} (simulated reviewer).`,
            '/help/report',
          ),
        ])
      }),
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
