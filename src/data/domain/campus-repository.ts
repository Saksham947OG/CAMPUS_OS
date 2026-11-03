import type { ZodType } from 'zod'
import { type DemoDataset, buildDemoDataset } from '@/data/seeds/demo/campus-data'
import { storageKey, type StorageAdapter } from '@/data/storage/storage-adapter'
import type { Profile } from '@/domain/profile'
import type { Provenance } from '@/domain/provenance'
import {
  announcementSchema,
  birthdaySchema,
  bookingRefSchema,
  type BookingRef,
  courseSchema,
  deadlineSchema,
  eventSchema,
  exceptionSchema,
  focusBlockSchema,
  messMealSchema,
  seriesSchema,
  taskSchema,
  taskMutableSchema,
  timeTaxScenarioSchema,
  type Audience,
  type BirthdayReminder,
  type CalendarEvent,
  type Deadline,
  type FocusBlock,
  type OccurrenceException,
  type PersonalTask,
  type ProfileData,
  type RecurrenceSeries,
  type TaskMutable,
} from '@/domain/records'
import { todayIn, type Clock } from '@/lib/time'
import type { RepositoryError, Result, Unsubscribe } from '../repositories/types'
import { emptyUserData, parseUserData, userDataEnvelopeSchema, type UserData } from './user-data'

export interface Saved<T> {
  value: T
  /** False when storage is unavailable: the change exists for this session only. */
  persisted: boolean
}

type Omitted = 'id' | 'provenance' | 'ownerProfileId' | 'updatedAt'
export type EventDraft = Omit<CalendarEvent, Omitted | 'status' | 'audience'> & { id?: string }
export type SeriesDraft = Omit<RecurrenceSeries, Omitted | 'status' | 'audience'> & { id?: string }
export type ExceptionDraft = Omit<OccurrenceException, 'id' | 'provenance' | 'updatedAt'> & {
  id?: string
}
export type TaskDraft = Omit<PersonalTask, Omitted | 'createdAt'> & { id?: string }
export type FocusDraft = Omit<FocusBlock, Omitted> & { id?: string }
export type BirthdayDraft = Omit<BirthdayReminder, Omitted | 'audience'> & { id?: string }

/**
 * The single facade over seed + user records. Components and selectors never see storage or
 * fixtures. A future backend adapter implements this same interface (DEC-029).
 */
export interface CampusDataRepository {
  load(profileId: string): Promise<ProfileData>
  subscribe(listener: (profileId: string) => void): Unsubscribe
  saveEvent(profileId: string, draft: EventDraft): Promise<Result<Saved<CalendarEvent>>>
  deleteEvent(profileId: string, id: string): Promise<Result<Saved<void>>>
  saveSeries(profileId: string, draft: SeriesDraft): Promise<Result<Saved<RecurrenceSeries>>>
  deleteSeries(profileId: string, id: string): Promise<Result<Saved<void>>>
  saveException(
    profileId: string,
    draft: ExceptionDraft,
  ): Promise<Result<Saved<OccurrenceException>>>
  removeException(profileId: string, id: string): Promise<Result<Saved<void>>>
  saveTask(profileId: string, draft: TaskDraft): Promise<Result<Saved<PersonalTask>>>
  deleteTask(profileId: string, id: string): Promise<Result<Saved<void>>>
  saveFocusBlock(profileId: string, draft: FocusDraft): Promise<Result<Saved<FocusBlock>>>
  deleteFocusBlock(profileId: string, id: string): Promise<Result<Saved<void>>>
  saveBirthday(profileId: string, draft: BirthdayDraft): Promise<Result<Saved<BirthdayReminder>>>
  deleteBirthday(profileId: string, id: string): Promise<Result<Saved<void>>>
  /** Deliberate, separate from layout/filter resets: removes everything this profile created or changed. */
  resetUserData(profileId: string): Promise<void>
}

export interface CampusRepositoryOptions {
  storage: StorageAdapter
  clock: Clock
  enrolledCourseIds?: (profileId: string) => string[]
  dataset?: (today: ReturnType<typeof todayIn>) => DemoDataset
  profiles: readonly Profile[]
  /** Id factory for new user records; injected so tests are deterministic. */
  newId: (prefix: string) => string
  /** Read-only bookings owned by another module (e.g. machine reservations), merged in so a record exists once. */
  extraBookings?: (profileId: string) => BookingRef[]
  /** Read-only deadlines owned by other modules (Workspace team tasks). */
  extraDeadlines?: (profileId: string) => Deadline[]
}

export const domainStorageKey = (profileId: string) =>
  storageKey({ area: 'domain', version: 1, profileId })

const userProvenance = (clock: Clock): Provenance => ({
  dataMode: 'userCreated',
  verification: 'notApplicable',
  authority: 'personal',
  updatedAt: clock.now().toString(),
})

const err = (
  code: RepositoryError['code'],
  message: string,
  extra: Partial<RepositoryError> = {},
) => ({ ok: false, error: { code, message, ...extra } }) as const

function validationError(issues: { path: PropertyKey[]; message: string }[]): Result<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || 'form'
    fieldErrors[key] ??= issue.message
  }
  return err('validation', 'Please fix the highlighted fields.', {
    fieldErrors,
    issues: issues.map((i) => i.message),
  })
}

const audienceMatches = (audience: Audience, profile: Profile): boolean => {
  switch (audience.kind) {
    case 'all':
      return true
    case 'cohort':
      return audience.cohortIds.includes(profile.cohortId)
    case 'profiles':
      return audience.profileIds.includes(profile.id)
  }
}

function keepValid<T>(
  list: readonly unknown[],
  schema: ZodType<T>,
  label: string,
  warnings: string[],
): T[] {
  const out: T[] = []
  let bad = 0
  for (const item of list) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
    else bad++
  }
  if (bad)
    warnings.push(
      `${bad} ${label} record${bad === 1 ? '' : 's'} failed validation and ${bad === 1 ? 'was' : 'were'} not shown.`,
    )
  return out
}

export function createCampusRepository(options: CampusRepositoryOptions): CampusDataRepository {
  const { storage, clock, profiles, newId, extraBookings } = options
  const dataset = options.dataset ?? buildDemoDataset
  const listeners = new Set<(profileId: string) => void>()
  const notify = (profileId: string) => listeners.forEach((l) => l(profileId))

  const profileOf = (profileId: string) => profiles.find((p) => p.id === profileId)

  const readUser = (profileId: string): { data: UserData; warnings: string[] } => {
    const result = storage.read(domainStorageKey(profileId), userDataEnvelopeSchema)
    if (result.status === 'ok') return parseUserData(result.value)
    if (result.status === 'invalid') {
      return {
        data: emptyUserData(),
        warnings: [
          'Saved personal data could not be read, so it is not shown. It was not deleted.',
        ],
      }
    }
    return { data: emptyUserData(), warnings: [] }
  }

  /** Read-modify-write one profile's user data. */
  const mutate = <T>(profileId: string, fn: (data: UserData) => Result<T>): Result<Saved<T>> => {
    if (!profileOf(profileId)) return err('notFound', 'Unknown profile.')
    const { data } = readUser(profileId)
    const result = fn(data)
    if (!result.ok) return result
    const written = storage.write(domainStorageKey(profileId), data)
    notify(profileId)
    return { ok: true, value: { value: result.value, persisted: written.ok } }
  }

  const upsert = <T extends { id: string }>(list: T[], item: T) => {
    const i = list.findIndex((x) => x.id === item.id)
    if (i >= 0) list[i] = item
    else list.push(item)
  }

  const personalAudience = (profileId: string): Audience => ({
    kind: 'profiles',
    profileIds: [profileId],
  })

  async function load(profileId: string): Promise<ProfileData> {
    const profile = profileOf(profileId)
    if (!profile) throw new Error(`Unknown profile: ${profileId}`)
    const warnings: string[] = []
    const seed = dataset(todayIn(clock))
    const { data: user, warnings: userWarnings } = readUser(profileId)
    warnings.push(...userWarnings)

    const deleted = new Set(user.deletedSeedIds)
    const visible = <T extends { audience: Audience }>(list: readonly T[]) =>
      list.filter((r) => audienceMatches(r.audience, profile))

    const seedSeries = visible(keepValid(seed.series, seriesSchema, 'recurring event', warnings))
    const seriesIds = new Set([...seedSeries, ...user.series].map((s) => s.id))

    const seedTasks = keepValid(seed.tasks, taskSchema, 'task', warnings)
      .filter((t) => t.ownerProfileId === profileId && !deleted.has(t.id))
      .map((t) => {
        const override = user.taskOverrides[t.id]
        return override ? { ...t, ...override } : t
      })

    const birthdaysSeed = keepValid(seed.birthdays, birthdaySchema, 'birthday', warnings).filter(
      (b) => {
        if (deleted.has(b.id)) return false
        if (b.visibility === 'private') return b.ownerProfileId === profileId
        return audienceMatches(b.audience, profile)
      },
    )

    return {
      profileId,
      ...(options.enrolledCourseIds
        ? { enrolledCourseIds: options.enrolledCourseIds(profileId) }
        : {}),
      courses: keepValid(seed.courses, courseSchema, 'course', warnings),
      events: [...visible(keepValid(seed.events, eventSchema, 'event', warnings)), ...user.events],
      series: [...seedSeries, ...user.series],
      exceptions: [
        ...keepValid(seed.exceptions, exceptionSchema, 'occurrence change', warnings).filter((e) =>
          seriesIds.has(e.seriesId),
        ),
        ...user.exceptions,
      ],
      deadlines: [
        ...visible(keepValid(seed.deadlines, deadlineSchema, 'deadline', warnings)),
        ...(options.extraDeadlines?.(profileId) ?? []),
      ],
      tasks: [...seedTasks, ...user.tasks],
      focusBlocks: user.focusBlocks,
      birthdays: [...birthdaysSeed, ...user.birthdays],
      mess: keepValid(seed.mess, messMealSchema, 'mess', warnings),
      bookings: [
        ...keepValid(seed.bookings, bookingRefSchema, 'booking', warnings).filter(
          (b) => b.ownerProfileId === profileId,
        ),
        ...(extraBookings?.(profileId) ?? []),
      ],
      announcements: visible(
        keepValid(seed.announcements, announcementSchema, 'announcement', warnings),
      ),
      timeTax: keepValid(seed.timeTax, timeTaxScenarioSchema, 'Time Tax scenario', warnings),
      importWarnings: warnings,
    }
  }

  return {
    load,

    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },

    async saveEvent(profileId, draft) {
      return mutate(profileId, (data) => {
        const id = draft.id ?? newId('ev')
        const record = {
          ...draft,
          id,
          status: 'scheduled' as const,
          audience: personalAudience(profileId),
          ownerProfileId: profileId,
          provenance: userProvenance(clock),
          updatedAt: clock.now().toString(),
        }
        const parsed = eventSchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.events, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async deleteEvent(profileId, id) {
      return mutate(profileId, (data) => {
        if (!data.events.some((e) => e.id === id))
          return err('forbidden', 'Only events you created can be deleted.')
        data.events = data.events.filter((e) => e.id !== id)
        return { ok: true, value: undefined }
      })
    },

    async saveSeries(profileId, draft) {
      return mutate(profileId, (data) => {
        const id = draft.id ?? newId('series')
        const record = {
          ...draft,
          id,
          status: 'scheduled' as const,
          audience: personalAudience(profileId),
          ownerProfileId: profileId,
          provenance: userProvenance(clock),
          updatedAt: clock.now().toString(),
        }
        const parsed = seriesSchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.series, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async deleteSeries(profileId, id) {
      return mutate(profileId, (data) => {
        if (!data.series.some((s) => s.id === id))
          return err('forbidden', 'Only recurring events you created can be deleted.')
        data.series = data.series.filter((s) => s.id !== id)
        data.exceptions = data.exceptions.filter((e) => e.seriesId !== id)
        return { ok: true, value: undefined }
      })
    },

    async saveException(profileId, draft) {
      return mutate(profileId, (data) => {
        if (!data.series.some((s) => s.id === draft.seriesId)) {
          return err('forbidden', 'Occurrences of supplied or sample schedules cannot be changed.')
        }
        // One exception per (series, original date): replace rather than stack (never duplicate).
        const existing = data.exceptions.find(
          (e) => e.seriesId === draft.seriesId && e.originalDate === draft.originalDate,
        )
        const record = {
          ...draft,
          id: existing?.id ?? draft.id ?? newId('ex'),
          provenance: userProvenance(clock),
          updatedAt: clock.now().toString(),
        }
        const parsed = exceptionSchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.exceptions, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async removeException(profileId, id) {
      return mutate(profileId, (data) => {
        data.exceptions = data.exceptions.filter((e) => e.id !== id)
        return { ok: true, value: undefined }
      })
    },

    async saveTask(profileId, draft) {
      return mutate(profileId, (data) => {
        const loaded = readSeedTask(draft.id)
        if (draft.id && loaded && loaded.ownerProfileId === profileId) {
          // Seeded demo task: store only the mutable fields as an override; the seed stays immutable.
          const { id: _id, ...mutable } = draft
          const parsed = taskMutableSchema.safeParse(mutable)
          if (!parsed.success) return validationError(parsed.error.issues)
          data.taskOverrides[draft.id] = parsed.data as TaskMutable
          return { ok: true, value: { ...loaded, ...parsed.data } }
        }
        const existing = draft.id ? data.tasks.find((t) => t.id === draft.id) : undefined
        const record = {
          ...draft,
          id: draft.id ?? newId('task'),
          ownerProfileId: profileId,
          createdAt: existing?.createdAt ?? clock.now().toString(),
          provenance: existing?.provenance ?? userProvenance(clock),
        }
        const parsed = taskSchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.tasks, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async deleteTask(profileId, id) {
      return mutate(profileId, (data) => {
        if (data.tasks.some((t) => t.id === id)) {
          data.tasks = data.tasks.filter((t) => t.id !== id)
          // Focus blocks keep existing: deleting a task never deletes scheduled sessions silently.
          data.focusBlocks = data.focusBlocks.map((f) =>
            f.taskId === id ? { ...f, taskId: undefined } : f,
          )
        } else if (readSeedTask(id)?.ownerProfileId === profileId) {
          if (!data.deletedSeedIds.includes(id)) data.deletedSeedIds.push(id)
          delete data.taskOverrides[id]
        } else {
          return err('forbidden', 'Only your own tasks can be deleted.')
        }
        return { ok: true, value: undefined }
      })
    },

    async saveFocusBlock(profileId, draft) {
      return mutate(profileId, (data) => {
        const record = {
          ...draft,
          id: draft.id ?? newId('focus'),
          ownerProfileId: profileId,
          provenance: userProvenance(clock),
        }
        const parsed = focusBlockSchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.focusBlocks, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async deleteFocusBlock(profileId, id) {
      return mutate(profileId, (data) => {
        // Deleting a session never deletes or completes the linked task (C-A16).
        data.focusBlocks = data.focusBlocks.filter((f) => f.id !== id)
        return { ok: true, value: undefined }
      })
    },

    async saveBirthday(profileId, draft) {
      return mutate(profileId, (data) => {
        const record = {
          ...draft,
          id: draft.id ?? newId('bd'),
          ownerProfileId: profileId,
          audience: personalAudience(profileId),
          // Personal birthday reminders are private: sharing needs documented permission.
          visibility: 'private' as const,
          provenance: userProvenance(clock),
        }
        const parsed = birthdaySchema.safeParse(record)
        if (!parsed.success) return validationError(parsed.error.issues)
        upsert(data.birthdays, parsed.data)
        return { ok: true, value: parsed.data }
      })
    },

    async resetUserData(profileId) {
      storage.remove(domainStorageKey(profileId))
      notify(profileId)
    },

    async deleteBirthday(profileId, id) {
      return mutate(profileId, (data) => {
        if (data.birthdays.some((b) => b.id === id))
          data.birthdays = data.birthdays.filter((b) => b.id !== id)
        else if (readSeedBirthday(id)?.ownerProfileId === profileId) data.deletedSeedIds.push(id)
        else return err('forbidden', 'Only birthday reminders you created can be deleted.')
        return { ok: true, value: undefined }
      })
    },
  }

  function readSeedTask(id: string | undefined): PersonalTask | undefined {
    if (!id) return undefined
    return dataset(todayIn(clock)).tasks.find((t) => t.id === id)
  }

  function readSeedBirthday(id: string): BirthdayReminder | undefined {
    return dataset(todayIn(clock)).birthdays.find((b) => b.id === id)
  }
}
