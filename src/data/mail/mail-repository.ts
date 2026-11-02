import { initialMailStore } from '@/data/seeds/demo/mail-data'
import { createStoreRunner } from '@/data/service-runner'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { NotificationsState } from '@/data/prefs/reminder-prefs'
import type { PreferencesRepository } from '@/data/repositories/preferences-repository'
import type { SharedRepository } from '@/data/shared/shared-repository'
import type { Result, Unsubscribe } from '@/data/repositories/types'
import { mailStoreSchema, type MailStore } from '@/domain/mail'
import { confirmSeat, failSeat, ingest, markRead, type Incoming } from '@/domain/mail-logic'
import type { Clock, DateOnly, LocalTime } from '@/lib/time'
import { instantMs } from '@/selectors/now'

/**
 * The owner of the SIMULATED Campus Mail inbox. One GLOBAL store (a mailbox per persona plus a
 * broadcast feed); a student reads only their own mailbox and the broadcast feed through the
 * selectors. A seat that a mail yields is written to the Shared store, the only owner of seats, and
 * the alert is sent only after that write really succeeded.
 */
export const MAIL_STORE_KEY = storageKey({ area: 'mail', version: 1 })
type Out<T> = Promise<Result<T>>

export interface ReceiveResult {
  emailId: string
  duplicate: boolean
  alerted: boolean
}

export interface MailRepository {
  load(): Promise<MailStore>
  /** Delivers one simulated message to a profile's mailbox, or to the broadcast feed when profileId is null. */
  receive(profileId: string | null, incoming: Incoming): Out<ReceiveResult>
  markRead(emailId: string): Out<void>
  resetAll(): Promise<void>
  subscribe(listener: () => void): Unsubscribe
}

export interface MailRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  newId: (prefix: string) => string
  notifications: PreferencesRepository<NotificationsState>
  shared: SharedRepository
}

export function createMailRepository(o: MailRepositoryOptions): MailRepository {
  const listeners = new Set<() => void>()
  const nowMs = () => o.clock.now().epochMilliseconds
  const runner = createStoreRunner<MailStore>({
    storage: o.storage,
    key: MAIL_STORE_KEY,
    schema: mailStoreSchema,
    starting: () => initialMailStore(nowMs()),
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
    async receive(profileId, incoming) {
      const shared = await o.shared.load()
      const seatOf = (p: string, examId: string) =>
        shared.seats.find((x) => x.ownerProfileId === p && x.examId === examId)
      const connectionId = profileId ? `conn-${profileId}` : 'conn-broadcast'
      const first = await run((s, c) =>
        ingest(s, connectionId, incoming, c, {
          profileId,
          nowMs: nowMs(),
          exam: (id) => shared.exams.find((e) => e.id === id),
          currentSeat: (p, examId) => {
            const x = seatOf(p, examId)
            return x
              ? {
                  revision: x.sourceRevision,
                  room: x.room,
                  row: x.row,
                  column: x.column,
                  seat: x.seat,
                }
              : undefined
          },
        }),
      )
      if (!first.ok) return first
      const out = first.value
      if (out.kind === 'duplicate')
        return { ok: true, value: { emailId: out.emailId, duplicate: true, alerted: false } }
      if (!out.effect)
        return { ok: true, value: { emailId: out.emailId, duplicate: false, alerted: false } }
      const e = out.effect
      const prev = seatOf(e.profileId, e.examId)
      const applied = await o.shared.applyMailSeat(e.examId, e.profileId, e.fields, {
        sourceNoticeId: e.noticeId,
        sourceEmailId: e.emailId,
        revision: e.revision,
      })
      if (!applied.ok) {
        await run((s, c) =>
          failSeat(s, e.emailId, `The seat could not be applied: ${applied.error.message}`, c),
        )
        return { ok: true, value: { emailId: e.emailId, duplicate: false, alerted: false } }
      }
      const exam = shared.exams.find((x) => x.id === e.examId)!
      const startMs = exam.startTime
        ? instantMs(exam.date as DateOnly, exam.startTime as LocalTime)
        : null
      const done = await run((s, c) =>
        confirmSeat(
          s,
          e,
          prev ? { room: prev.room, row: prev.row, column: prev.column } : undefined,
          { name: exam.name, startMs },
          c,
          nowMs(),
        ),
      )
      return done.ok
        ? { ok: true, value: { emailId: e.emailId, duplicate: false, alerted: done.value.alerted } }
        : done
    },
    markRead: (emailId) => run((s, c) => markRead(s, emailId, c)),
    async resetAll() {
      runner.reset()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
