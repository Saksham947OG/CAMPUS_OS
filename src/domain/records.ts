import { z } from 'zod'
import { isDateOnly, isLocalTime, type DateOnly, type LocalTime } from '@/lib/time/dates'
import { timeToMinutes } from '@/lib/time/calendar'
import { lifecycleStatusSchema, provenanceSchema, verificationSchema } from './provenance'

/**
 * Canonical record kinds (DEC-017). Calendar and Home are projections over these; nothing here is
 * a copy of another module's state. Every record carries provenance (DEC-016).
 */

export const dateOnlySchema = z.custom<DateOnly>(
  (v) => typeof v === 'string' && isDateOnly(v),
  'Enter a valid date (YYYY-MM-DD)',
)
export const localTimeSchema = z.custom<LocalTime>(
  (v) => typeof v === 'string' && isLocalTime(v),
  'Enter a valid time (HH:mm)',
)

const id = z.string().min(1).max(120)
const title = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(120, 'Keep the title under 120 characters')
const longText = z.string().trim().max(1000)
const isoInstant = z.iso.datetime({ offset: true })

/** Item categories that can appear on the calendar. `mess` is deliberately absent (DEC-017). */
export const EVENT_CATEGORIES = [
  'class',
  'exam',
  'assignment',
  'project',
  'meeting',
  'personal',
  'task',
  'focus',
  'booking',
  'administration',
  'holiday',
  'birthday',
  'club',
  'campusEvent',
  'sports',
] as const
export const eventCategorySchema = z.enum(EVENT_CATEGORIES)
export type EventCategory = z.infer<typeof eventCategorySchema>

export const audienceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('all') }),
  z.object({ kind: z.literal('cohort'), cohortIds: z.array(z.string().min(1)).min(1) }),
  z.object({ kind: z.literal('profiles'), profileIds: z.array(z.string().min(1)).min(1) }),
])
export type Audience = z.infer<typeof audienceSchema>

export const courseSchema = z.object({
  id,
  code: z.string().trim().min(1).max(20),
  title,
  provenance: provenanceSchema,
})
export type Course = z.infer<typeof courseSchema>

/** How an event occupies time. Unknown time never occupies the grid or conflicts (COS-CAL-001 §4.2). */
export const timingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('allDay') }),
  z.object({ kind: z.literal('unknownTime') }),
  z.object({ kind: z.literal('timed'), start: localTimeSchema, end: localTimeSchema }),
])
export type Timing = z.infer<typeof timingSchema>

const checkTiming = (t: Timing, ctx: z.RefinementCtx) => {
  if (t.kind === 'timed' && timeToMinutes(t.end) <= timeToMinutes(t.start)) {
    ctx.addIssue({
      code: 'custom',
      path: ['timing', 'end'],
      message: 'End time must be after the start time (events cannot cross midnight in this build)',
    })
  }
}

const eventBase = z.object({
  id,
  title,
  category: eventCategorySchema,
  timing: timingSchema,
  location: z.string().trim().max(120).optional(),
  instructor: z.string().trim().max(120).optional(),
  courseId: id.optional(),
  description: longText.optional(),
  /** Counts as busy time for Free Pockets / conflicts when timed and confirmed. */
  blocksTime: z.boolean(),
  audience: audienceSchema,
  status: lifecycleStatusSchema,
  provenance: provenanceSchema,
  /** Set for student-owned records; used to enforce profile isolation. */
  ownerProfileId: id.optional(),
  updatedAt: isoInstant.optional(),
})

export const eventSchema = eventBase
  .extend({ date: dateOnlySchema })
  .superRefine((e, ctx) => checkTiming(e.timing, ctx))
export type CalendarEvent = z.infer<typeof eventSchema>

export const recurrenceRuleSchema = z
  .object({
    freq: z.enum(['daily', 'weekly', 'monthly', 'yearly']),
    interval: z.number().int().min(1).max(52),
    /** ISO weekdays 1–7, weekly only. Defaults to the weekday of `startDate`. */
    weekdays: z.array(z.number().int().min(1).max(7)).min(1).optional(),
    startDate: dateOnlySchema,
    /** Required: unbounded series are never generated (COS-CAL-001 §10). */
    endDate: dateOnlySchema,
  })
  .superRefine((r, ctx) => {
    if (r.endDate < r.startDate) {
      ctx.addIssue({
        code: 'custom',
        path: ['endDate'],
        message: 'End date must not be before the start date',
      })
    }
  })
export type RecurrenceRule = z.infer<typeof recurrenceRuleSchema>

export const seriesSchema = eventBase
  .extend({ rule: recurrenceRuleSchema })
  .superRefine((s, ctx) => checkTiming(s.timing, ctx))
export type RecurrenceSeries = z.infer<typeof seriesSchema>

/** Keyed by (seriesId, originalDate): never edits the series itself (C-D13). */
export const exceptionSchema = z.object({
  id,
  seriesId: id,
  originalDate: dateOnlySchema,
  action: z.enum(['cancelled', 'rescheduled', 'modified']),
  replacement: z
    .object({
      date: dateOnlySchema.optional(),
      start: localTimeSchema.optional(),
      end: localTimeSchema.optional(),
      location: z.string().trim().max(120).optional(),
      title: title.optional(),
    })
    .optional(),
  reason: z.string().trim().max(200).optional(),
  provenance: provenanceSchema,
  updatedAt: isoInstant.optional(),
})
export type OccurrenceException = z.infer<typeof exceptionSchema>

export const deadlineSchema = z.object({
  id,
  title,
  kind: z.enum(['assignment', 'homework', 'project']),
  dueDate: dateOnlySchema,
  /** Absent means date-only. Never defaulted to 23:59. */
  dueTime: localTimeSchema.optional(),
  courseId: id.optional(),
  details: longText.optional(),
  audience: audienceSchema,
  status: lifecycleStatusSchema,
  provenance: provenanceSchema,
  updatedAt: isoInstant.optional(),
})
export type Deadline = z.infer<typeof deadlineSchema>

export const subtaskSchema = z.object({ id, title, done: z.boolean() })

export const taskStateSchema = z.enum(['notStarted', 'inProgress', 'personallyCompleted'])
export type TaskState = z.infer<typeof taskStateSchema>

export const taskObjectSchema = z.object({
  id,
  ownerProfileId: id,
  title,
  description: longText.optional(),
  courseId: id.optional(),
  dueDate: dateOnlySchema.optional(),
  dueTime: localTimeSchema.optional(),
  relatedDeadlineId: id.optional(),
  state: taskStateSchema,
  priority: z.enum(['low', 'normal', 'high']).optional(),
  subtasks: z.array(subtaskSchema).max(30),
  createdAt: isoInstant.optional(),
  provenance: provenanceSchema,
})

const checkTask = (t: { dueDate?: unknown; dueTime?: unknown }, ctx: z.RefinementCtx) => {
  if (t.dueTime && !t.dueDate) {
    ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'A due time needs a due date' })
  }
}

export const taskSchema = taskObjectSchema.superRefine(checkTask)
/** Fields a student may change on any task they own, including seeded demo tasks (stored as an override). */
export const taskMutableSchema = taskObjectSchema
  .pick({
    title: true,
    description: true,
    courseId: true,
    dueDate: true,
    dueTime: true,
    relatedDeadlineId: true,
    state: true,
    priority: true,
    subtasks: true,
  })
  .superRefine(checkTask)
export type TaskMutable = z.infer<typeof taskMutableSchema>
export type PersonalTask = z.infer<typeof taskSchema>

export const focusBlockSchema = z
  .object({
    id,
    ownerProfileId: id,
    taskId: id.optional(),
    title,
    date: dateOnlySchema,
    start: localTimeSchema,
    end: localTimeSchema,
    description: longText.optional(),
    provenance: provenanceSchema,
  })
  .superRefine((f, ctx) => {
    if (timeToMinutes(f.end) <= timeToMinutes(f.start)) {
      ctx.addIssue({
        code: 'custom',
        path: ['end'],
        message: 'End time must be after the start time',
      })
    }
  })
export type FocusBlock = z.infer<typeof focusBlockSchema>

export const birthdaySchema = z
  .object({
    id,
    displayName: z.string().trim().min(1, 'Name is required').max(60),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    /** Private unless permission and audience are documented (CLAUDE.md). No birth year is ever stored. */
    visibility: z.enum(['private', 'selectedAudience', 'campusPublic']),
    audience: audienceSchema,
    ownerProfileId: id.optional(),
    provenance: provenanceSchema,
  })
  .superRefine((b, ctx) => {
    const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][b.month - 1] ?? 31
    if (b.day > max)
      ctx.addIssue({
        code: 'custom',
        path: ['day'],
        message: 'That day does not exist in this month',
      })
  })
export type BirthdayReminder = z.infer<typeof birthdaySchema>

export const MEALS = ['breakfast', 'lunch', 'snacks', 'dinner'] as const
export const mealSchema = z.enum(MEALS)
export type Meal = z.infer<typeof mealSchema>

/** A food list is not evidence of a serving time: `start`/`end` are optional and stay unknown. */
export const messMealSchema = z.object({
  id,
  date: dateOnlySchema,
  meal: mealSchema,
  start: localTimeSchema.optional(),
  end: localTimeSchema.optional(),
  items: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  note: z.string().trim().max(200).optional(),
  provenance: provenanceSchema,
})
export type MessMeal = z.infer<typeof messMealSchema>

/** Read-only reference to a booking owned by the future Bookings module. */
export const bookingRefSchema = z.object({
  id,
  ownerProfileId: id,
  resource: z.string().trim().min(1).max(80),
  date: dateOnlySchema,
  start: localTimeSchema,
  end: localTimeSchema,
  /** Set only when the booking ends on a later date than it starts (it crossed midnight). */
  endDate: dateOnlySchema.optional(),
  status: z.enum(['active', 'cancelled']),
  location: z.string().trim().max(120).optional(),
  /** What Calendar draws it as. Absent means a booking; a meeting, club event or fixture says so. */
  category: z.enum(['booking', 'meeting', 'club', 'sports']).optional(),
  /** Where "Manage" goes. Defaults to the future Bookings module. */
  manageRoute: z.string().startsWith('/').optional(),
  updatedAt: isoInstant.optional(),
  provenance: provenanceSchema,
})
export type BookingRef = z.infer<typeof bookingRefSchema>

export const announcementSchema = z.object({
  id,
  title,
  summary: z.string().trim().max(300).optional(),
  publishedOn: dateOnlySchema,
  importance: z.enum(['important', 'normal']),
  audience: audienceSchema,
  provenance: provenanceSchema,
})
export type Announcement = z.infer<typeof announcementSchema>

export const timeTaxScenarioSchema = z.object({
  id,
  label: title,
  service: z.string().trim().min(1).max(60),
  /** Always an assumption set in this build. Observed baselines need imported fieldwork. */
  basis: z.literal('illustrative'),
  students: z.number().int().min(1).max(100000),
  visitsPerStudentPerWeek: z.number().min(0).max(50),
  baselineWaitMinutes: z.number().min(0).max(240),
  scenarioWaitMinutes: z.number().min(0).max(240),
  provenance: provenanceSchema,
})
export type TimeTaxScenario = z.infer<typeof timeTaxScenarioSchema>

export { verificationSchema }

/** Everything one profile can see, already audience-filtered. Selectors only read this. */
export interface ProfileData {
  profileId: string
  /** Explicit enrolment from a supplied persona/curriculum, independent of scheduled events. */
  enrolledCourseIds?: readonly string[]
  courses: readonly Course[]
  events: readonly CalendarEvent[]
  series: readonly RecurrenceSeries[]
  exceptions: readonly OccurrenceException[]
  deadlines: readonly Deadline[]
  tasks: readonly PersonalTask[]
  focusBlocks: readonly FocusBlock[]
  birthdays: readonly BirthdayReminder[]
  mess: readonly MessMeal[]
  bookings: readonly BookingRef[]
  announcements: readonly Announcement[]
  timeTax: readonly TimeTaxScenario[]
  /** Source records that failed validation. Shown honestly, never rendered with guessed fields. */
  importWarnings: readonly string[]
}

export const emptyProfileData = (profileId: string): ProfileData => ({
  profileId,
  courses: [],
  events: [],
  series: [],
  exceptions: [],
  deadlines: [],
  tasks: [],
  focusBlocks: [],
  birthdays: [],
  mess: [],
  bookings: [],
  announcements: [],
  timeTax: [],
  importWarnings: [],
})
