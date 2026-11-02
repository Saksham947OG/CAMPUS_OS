import { Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { useServices } from '@/app/services'
import { Field, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import type { ProfileData } from '@/domain/records'
import { useCampusCommands } from '@/hooks/use-campus-data'
import {
  isDateOnly,
  isLocalTime,
  monthName,
  timeToMinutes,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import type { PlanningPrefs } from '@/selectors/free-pockets'
import type { CalendarItem } from '@/selectors/items'
import type { EditorRequest } from './editor-types'
import { ConflictWarning, GapList } from './slot-tools'
import { addMinutes, useSlotTools } from './slot-utils'

const actions = (children: React.ReactNode) => (
  <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">{children}</div>
)

/* ───────────────────────────── Task ───────────────────────────── */

type TaskReq = Extract<EditorRequest, { kind: 'task' }>

export function TaskEditor({
  request,
  data,
  onClose,
}: {
  request: TaskReq
  data: ProfileData
  onClose: () => void
}) {
  const { task, prefill } = request
  const { newId } = useServices()
  const commands = useCampusCommands()
  const toast = useToast()
  const [id] = useState(() => task?.id ?? prefill?.id ?? newId('task'))
  const [f, setF] = useState(() => ({
    title: task?.title ?? prefill?.title ?? '',
    description: task?.description ?? prefill?.description ?? '',
    courseId: task?.courseId ?? prefill?.courseId ?? '',
    dueDate: (task?.dueDate ?? prefill?.dueDate ?? '') as string,
    dueTime: (task?.dueTime ?? prefill?.dueTime ?? '') as string,
    priority: task?.priority ?? prefill?.priority ?? 'normal',
    related: task?.relatedDeadlineId ?? prefill?.relatedDeadlineId ?? '',
    subtasks: task?.subtasks ?? prefill?.subtasks ?? [],
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  const submit = async () => {
    const next: Record<string, string> = {}
    if (!f.title.trim()) next.title = 'Title is required'
    if (f.dueDate && !isDateOnly(f.dueDate)) next.dueDate = 'Enter a valid date'
    if (f.dueTime && !f.dueDate) next.dueTime = 'A due time needs a due date'
    if (f.dueTime && !isLocalTime(f.dueTime)) next.dueTime = 'Enter a valid time'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    const result = await commands.saveTask({
      id,
      title: f.title,
      description: f.description.trim() || undefined,
      courseId: f.courseId || undefined,
      dueDate: f.dueDate ? (f.dueDate as DateOnly) : undefined,
      dueTime: f.dueTime ? (f.dueTime as LocalTime) : undefined,
      relatedDeadlineId: f.related || undefined,
      state: task?.state ?? prefill?.state ?? 'notStarted',
      priority: f.priority as 'low' | 'normal' | 'high',
      subtasks: f.subtasks
        .filter((s) => s.title.trim())
        .map((s) => ({ ...s, title: s.title.trim() })),
    })
    setSaving(false)
    if (!result.ok) {
      const map = result.error.fieldErrors ?? {}
      return setErrors({
        title: map.title ?? '',
        dueDate: map.dueDate ?? '',
        dueTime: map.dueTime ?? '',
        form: Object.keys(map).length ? '' : result.error.message,
      })
    }
    toast.saved(result.value.persisted, 'Task')
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) void submit()
      }}
    >
      {errors.form ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-2 text-sm"
        >
          {errors.form}
        </p>
      ) : null}
      <Field label="Title" error={errors.title}>
        {(a) => (
          <input
            {...a}
            className={inputClass}
            maxLength={120}
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Notes (optional)">
        {(a) => (
          <textarea
            {...a}
            className={`${inputClass} min-h-20 py-2`}
            maxLength={1000}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Due date (optional)" error={errors.dueDate}>
          {(a) => (
            <input
              {...a}
              type="date"
              className={inputClass}
              value={f.dueDate}
              onChange={(e) =>
                set({ dueDate: e.target.value, dueTime: e.target.value ? f.dueTime : '' })
              }
            />
          )}
        </Field>
        <Field label="Due time (optional)" error={errors.dueTime}>
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              disabled={!f.dueDate}
              value={f.dueTime}
              onChange={(e) => set({ dueTime: e.target.value })}
            />
          )}
        </Field>
      </div>
      <p className="-mt-2 text-xs text-ink-muted">
        Leave the time empty for a date-only task; it is never given a clock time for you.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Course (optional)">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={f.courseId}
              onChange={(e) => set({ courseId: e.target.value })}
            >
              <option value="">No course</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Priority">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={f.priority}
              onChange={(e) => set({ priority: e.target.value as 'low' | 'normal' | 'high' })}
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          )}
        </Field>
      </div>
      <Field
        label="Linked deadline (optional)"
        hint="Linking never changes the supplied deadline, and deleting this task never deletes it."
      >
        {(a) => (
          <select
            {...a}
            className={inputClass}
            value={f.related}
            onChange={(e) => set({ related: e.target.value })}
          >
            <option value="">Not linked</option>
            {data.deadlines.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-ink">My preparation checklist</legend>
        {f.subtasks.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <input
              type="checkbox"
              className="size-5 accent-[var(--accent-teal)]"
              aria-label={`Done: ${s.title || `item ${i + 1}`}`}
              checked={s.done}
              onChange={(e) =>
                set({
                  subtasks: f.subtasks.map((x) =>
                    x.id === s.id ? { ...x, done: e.target.checked } : x,
                  ),
                })
              }
            />
            <input
              aria-label={`Checklist item ${i + 1}`}
              className={inputClass}
              value={s.title}
              maxLength={120}
              onChange={(e) =>
                set({
                  subtasks: f.subtasks.map((x) =>
                    x.id === s.id ? { ...x, title: e.target.value } : x,
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              aria-label={`Remove checklist item ${i + 1}`}
              onClick={() => set({ subtasks: f.subtasks.filter((x) => x.id !== s.id) })}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start gap-2"
          onClick={() =>
            set({ subtasks: [...f.subtasks, { id: newId('st'), title: '', done: false }] })
          }
        >
          <Plus aria-hidden="true" /> Add checklist item
        </Button>
        <p className="text-xs text-ink-muted">
          Finishing every item can suggest marking the task done, but it never submits anything
          officially.
        </p>
      </fieldset>

      {actions(
        <>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-11" disabled={saving}>
            {saving ? 'Saving…' : 'Save task'}
          </Button>
        </>,
      )}
    </form>
  )
}

/* ─────────────────────────── Focus block ─────────────────────────── */

type FocusReq = Extract<EditorRequest, { kind: 'focus' }>
const PRESETS = [30, 60, 120]

export function FocusEditor({
  request,
  data,
  planning,
  getItemsOn,
  onClose,
}: {
  request: FocusReq
  data: ProfileData
  planning: PlanningPrefs
  getItemsOn: (d: DateOnly) => CalendarItem[]
  onClose: () => void
}) {
  const { focus, prefill } = request
  const { newId } = useServices()
  const commands = useCampusCommands()
  const toast = useToast()
  const formRef = useRef<HTMLFormElement>(null)
  const [id] = useState(() => focus?.id ?? newId('focus'))
  const [f, setF] = useState(() => ({
    taskId: focus?.taskId ?? prefill?.taskId ?? '',
    title: focus?.title ?? prefill?.title ?? '',
    date: (focus?.date ?? prefill?.date ?? '') as string,
    start: (focus?.start ?? prefill?.start ?? '') as string,
    end: (focus?.end ?? prefill?.end ?? '') as string,
    description: focus?.description ?? '',
    duration: focus ? String(timeToMinutes(focus.end) - timeToMinutes(focus.start)) : '60',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  const tools = useSlotTools({
    date: f.date,
    start: f.start,
    end: f.end,
    getItemsOn,
    planning,
    ignoreRecordId: id,
    busy: true,
  })
  const durationNum = Number(f.duration)
  const durationOk = Number.isInteger(durationNum) && durationNum >= 5 && durationNum <= 600

  const applyDuration = (minutes: number, start = f.start) => {
    const end = isLocalTime(start) ? addMinutes(start, minutes) : undefined
    set({ duration: String(minutes), ...(end ? { end } : {}) })
  }

  const submit = async (force: boolean) => {
    const next: Record<string, string> = {}
    if (!f.title.trim()) next.title = 'Give the session a title or link a task'
    if (!isDateOnly(f.date)) next.date = 'Choose a date'
    if (!isLocalTime(f.start)) next.start = 'Choose a start time'
    if (!isLocalTime(f.end)) next.end = 'Choose an end time'
    else if (isLocalTime(f.start) && timeToMinutes(f.end) <= timeToMinutes(f.start))
      next.end = 'End time must be after the start time'
    setErrors(next)
    if (Object.keys(next).length) return
    if (tools.conflicts.length > 0 && !force && !tools.acknowledged)
      return setErrors({ form: 'overlap' })
    setSaving(true)
    const result = await commands.saveFocusBlock({
      id,
      title: f.title,
      taskId: f.taskId || undefined,
      date: f.date as DateOnly,
      start: f.start as LocalTime,
      end: f.end as LocalTime,
      description: f.description.trim() || undefined,
    })
    setSaving(false)
    if (!result.ok)
      return setErrors({ form: result.error.message, ...(result.error.fieldErrors ?? {}) })
    toast.saved(result.value.persisted, 'Focus block')
    onClose()
  }

  return (
    <form
      ref={formRef}
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) void submit(false)
      }}
    >
      <p className="rounded-md bg-mist p-2 text-sm text-ink">
        A focus block is a planned work session. It is a draft until you save, and it never
        completes or deletes the task.
      </p>
      {errors.form && errors.form !== 'overlap' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-2 text-sm"
        >
          {errors.form}
        </p>
      ) : null}
      <Field label="Linked task (optional)">
        {(a) => (
          <select
            {...a}
            className={inputClass}
            value={f.taskId}
            onChange={(e) => {
              const t = data.tasks.find((x) => x.id === e.target.value)
              set({
                taskId: e.target.value,
                title: f.title || (t ? `Work on: ${t.title}` : f.title),
              })
            }}
          >
            <option value="">No linked task</option>
            {data.tasks
              .filter((t) => t.state !== 'personallyCompleted' || t.id === f.taskId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
        )}
      </Field>
      <Field label="Title" error={errors.title}>
        {(a) => (
          <input
            {...a}
            className={inputClass}
            maxLength={120}
            value={f.title}
            onChange={(e) => set({ title: e.target.value })}
          />
        )}
      </Field>
      <Field label="Date" error={errors.date}>
        {(a) => (
          <input
            {...a}
            type="date"
            className={inputClass}
            value={f.date}
            onChange={(e) => {
              set({ date: e.target.value })
              tools.setAcknowledged(false)
            }}
          />
        )}
      </Field>

      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">How long?</legend>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((m) => (
            <Button
              key={m}
              type="button"
              variant="outline"
              aria-pressed={durationNum === m}
              className={`min-h-11 ${durationNum === m ? 'bg-teal-tint ring-2 ring-teal' : ''}`}
              onClick={() => applyDuration(m)}
            >
              {m} min
            </Button>
          ))}
          <label className="flex items-center gap-1.5 text-sm">
            Custom
            <input
              type="number"
              min={5}
              max={600}
              className={`${inputClass} w-24`}
              value={f.duration}
              onChange={(e) => {
                set({ duration: e.target.value })
                const n = Number(e.target.value)
                if (Number.isInteger(n) && n >= 5 && n <= 600) applyDuration(n)
              }}
              aria-label="Custom duration in minutes"
            />
            min
          </label>
        </div>
        {!durationOk ? (
          <p className="mt-1 text-xs font-medium text-danger">
            Enter a duration from 5 to 600 minutes.
          </p>
        ) : null}
      </fieldset>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Start time" error={errors.start}>
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              value={f.start}
              onChange={(e) => {
                set({ start: e.target.value })
                tools.setAcknowledged(false)
                if (durationOk) applyDuration(durationNum, e.target.value)
              }}
            />
          )}
        </Field>
        <Field label="End time" error={errors.end}>
          {(a) => (
            <input
              {...a}
              type="time"
              className={inputClass}
              value={f.end}
              onChange={(e) => {
                set({ end: e.target.value })
                tools.setAcknowledged(false)
              }}
            />
          )}
        </Field>
      </div>

      <div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          aria-expanded={tools.showGaps}
          disabled={!isDateOnly(f.date)}
          onClick={() => tools.setShowGaps(!tools.showGaps)}
        >
          Find open windows
        </Button>
        {tools.showGaps ? (
          <GapList
            gaps={tools.gaps}
            duration={durationOk ? durationNum : 60}
            onApplyGap={(start, end) => {
              set({ start, end })
              tools.setAcknowledged(false)
            }}
          />
        ) : null}
        <p className="mt-1 text-xs text-ink-muted">
          Windows come from your recorded timed commitments only. They are not a promise you are
          free.
        </p>
      </div>

      <Field label="Notes (optional)">
        {(a) => (
          <textarea
            {...a}
            className={`${inputClass} min-h-20 py-2`}
            maxLength={1000}
            value={f.description}
            onChange={(e) => set({ description: e.target.value })}
          />
        )}
      </Field>

      {tools.conflicts.length > 0 ? (
        <ConflictWarning
          tools={tools}
          onEditTime={() =>
            formRef.current?.querySelector<HTMLElement>('input[type="time"]')?.focus()
          }
          onApplyGap={(start, end) => {
            set({ start, end })
            tools.setAcknowledged(false)
          }}
        />
      ) : null}

      {actions(
        <>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          {tools.conflicts.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => {
                tools.setAcknowledged(true)
                void submit(true)
              }}
            >
              Save anyway
            </Button>
          ) : null}
          <Button type="submit" className="min-h-11" disabled={saving}>
            {saving ? 'Saving…' : 'Save focus block'}
          </Button>
        </>,
      )}
    </form>
  )
}

/* ───────────────────────────── Birthday ───────────────────────────── */

type BirthdayReq = Extract<EditorRequest, { kind: 'birthday' }>

export function BirthdayEditor({
  request,
  onClose,
}: {
  request: BirthdayReq
  onClose: () => void
}) {
  const { birthday } = request
  const { newId } = useServices()
  const commands = useCampusCommands()
  const toast = useToast()
  const [id] = useState(() => birthday?.id ?? newId('bd'))
  const [f, setF] = useState({
    name: birthday?.displayName ?? '',
    month: String(birthday?.month ?? 1),
    day: String(birthday?.day ?? ''),
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const day = Number(f.day)
    const next: Record<string, string> = {}
    if (!f.name.trim()) next.name = 'Name is required'
    if (!Number.isInteger(day) || day < 1 || day > 31) next.day = 'Enter a day from 1 to 31'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    const result = await commands.saveBirthday({
      id,
      displayName: f.name,
      month: Number(f.month),
      day,
      visibility: 'private',
    })
    setSaving(false)
    if (!result.ok)
      return setErrors({
        name: result.error.fieldErrors?.displayName ?? '',
        day: result.error.fieldErrors?.day ?? '',
        form: result.error.fieldErrors ? '' : result.error.message,
      })
    toast.saved(result.value.persisted, 'Birthday reminder')
    onClose()
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) void submit()
      }}
    >
      <p className="rounded-md bg-mist p-2 text-sm text-ink">
        This reminder is private to you. No birth year is stored, and it is never shared with
        anyone.
      </p>
      {errors.form ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-2 text-sm"
        >
          {errors.form}
        </p>
      ) : null}
      <Field label="Name" error={errors.name}>
        {(a) => (
          <input
            {...a}
            className={inputClass}
            maxLength={60}
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Month">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={f.month}
              onChange={(e) => setF({ ...f, month: e.target.value })}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Day" error={errors.day}>
          {(a) => (
            <input
              {...a}
              type="number"
              min={1}
              max={31}
              className={inputClass}
              value={f.day}
              onChange={(e) => setF({ ...f, day: e.target.value })}
            />
          )}
        </Field>
      </div>
      {actions(
        <>
          <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" className="min-h-11" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>,
      )}
    </form>
  )
}
