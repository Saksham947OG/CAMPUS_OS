import { useRef, useState } from 'react'
import { CheckField, Field, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import { useServices } from '@/app/services'
import type { RecurrenceRule } from '@/domain/records'
import { useCampusCommands } from '@/hooks/use-campus-data'
import { usePrefs } from '@/hooks/use-prefs'
import {
  addDays,
  formatDateShort,
  formatWeekday,
  isDateOnly,
  isLocalTime,
  isoWeekday,
  timeToMinutes,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import type { PlanningPrefs } from '@/selectors/free-pockets'
import type { CalendarItem } from '@/selectors/items'
import type { EditorRequest } from './editor-types'
import { ConflictWarning } from './slot-tools'
import { useSlotTools } from './slot-utils'

type Req = Extract<EditorRequest, { kind: 'event' }>
type Freq = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'

interface Props {
  request: Req
  planning: PlanningPrefs
  getItemsOn: (date: DateOnly) => CalendarItem[]
  onClose: () => void
}

const MONDAY = '2024-01-01' as DateOnly
const REMINDER_CHOICES = [
  ['default', 'Default (15 minutes before)'],
  ['off', 'No reminder'],
  ['5', '5 minutes before'],
  ['15', '15 minutes before'],
  ['30', '30 minutes before'],
  ['60', '1 hour before'],
  ['1440', '1 day before'],
] as const

const fieldKey: Record<string, string> = {
  title: 'title',
  date: 'date',
  'timing.start': 'start',
  'timing.end': 'end',
  location: 'location',
  description: 'description',
  'rule.endDate': 'until',
  'rule.interval': 'interval',
  'rule.weekdays': 'weekdays',
}

/** Personal event / recurring series editor. Preserves the draft on any validation or save failure. */
export function EventEditor({ request, planning, getItemsOn, onClose }: Props) {
  const existing = request.event
  const series = request.series
  const editingSeries = !!series
  const timing = existing?.timing ?? series?.timing
  const { newId } = useServices()
  const commands = useCampusCommands()
  const toast = useToast()
  const reminders = usePrefs('reminders')

  const [eventId] = useState(() => existing?.id ?? newId('ev'))
  const [seriesId] = useState(() => series?.id ?? newId('series'))
  const [f, setF] = useState(() => ({
    title: existing?.title ?? series?.title ?? request.prefill?.title ?? '',
    date: (existing?.date ?? series?.rule.startDate ?? request.prefill?.date ?? '') as string,
    allDay: timing ? timing.kind === 'allDay' : false,
    start: timing?.kind === 'timed' ? timing.start : (request.prefill?.start ?? ''),
    // End is never guessed from a click: the student must choose it (COS-CAL-001 §3.3).
    end: timing?.kind === 'timed' ? timing.end : (request.prefill?.end ?? ''),
    location: existing?.location ?? series?.location ?? '',
    description: existing?.description ?? series?.description ?? '',
    busy: existing?.blocksTime ?? series?.blocksTime ?? true,
    freq: (series ? series.rule.freq : 'none') as Freq,
    interval: String(series?.rule.interval ?? 1),
    weekdays: series?.rule.weekdays ?? ([] as number[]),
    until: (series?.rule.endDate ?? '') as string,
    reminder: 'default',
  }))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const set = (patch: Partial<typeof f>) => setF((prev) => ({ ...prev, ...patch }))

  const blocksTime = !f.allDay && f.busy
  const tools = useSlotTools({
    date: f.date,
    start: f.start,
    end: f.end,
    getItemsOn,
    planning,
    ignoreRecordId: editingSeries ? seriesId : eventId,
    busy: blocksTime,
  })

  const submit = async (forceSave: boolean) => {
    const next: Record<string, string> = {}
    if (!f.title.trim()) next.title = 'Title is required'
    if (!isDateOnly(f.date)) next.date = 'Choose a date'
    if (!f.allDay) {
      if (!isLocalTime(f.start)) next.start = 'Choose a start time'
      if (!isLocalTime(f.end)) next.end = 'Choose an end time (it is not filled in for you)'
      else if (isLocalTime(f.start) && timeToMinutes(f.end) <= timeToMinutes(f.start))
        next.end = 'End time must be after the start time'
    }
    if (f.freq !== 'none') {
      if (!isDateOnly(f.until)) next.until = 'Recurring events need an end date'
      else if (isDateOnly(f.date) && f.until < f.date)
        next.until = 'The end date cannot be before the first date'
      const n = Number(f.interval)
      if (!Number.isInteger(n) || n < 1 || n > 52)
        next.interval = 'Enter a whole number from 1 to 52'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    if (tools.conflicts.length > 0 && !forceSave && !tools.acknowledged) {
      tools.setAcknowledged(false)
      return setErrors({ form: 'overlap' })
    }

    setSaving(true)
    const common = {
      title: f.title,
      category: 'personal' as const,
      timing: f.allDay
        ? ({ kind: 'allDay' } as const)
        : ({ kind: 'timed', start: f.start as LocalTime, end: f.end as LocalTime } as const),
      location: f.location.trim() || undefined,
      description: f.description.trim() || undefined,
      blocksTime,
    }
    let result
    if (f.freq === 'none' && !editingSeries) {
      result = await commands.saveEvent({ id: eventId, ...common, date: f.date as DateOnly })
    } else {
      const rule: RecurrenceRule = {
        freq: f.freq === 'none' ? 'weekly' : f.freq,
        interval: Number(f.interval),
        ...(f.freq === 'weekly' && f.weekdays.length ? { weekdays: f.weekdays } : {}),
        startDate: f.date as DateOnly,
        endDate: f.until as DateOnly,
      }
      result = await commands.saveSeries({ id: seriesId, ...common, rule })
    }
    setSaving(false)
    if (!result.ok) {
      const mapped: Record<string, string> = {}
      for (const [k, v] of Object.entries(result.error.fieldErrors ?? {}))
        mapped[fieldKey[k] ?? 'form'] = v
      if (!Object.keys(mapped).length) mapped.form = result.error.message
      return setErrors(mapped)
    }

    // Per-event reminder choice (recurring events follow the category rule).
    if (f.freq === 'none' && !editingSeries) {
      const key = `${eventId}@${f.date}`
      await reminders.update((p) => {
        const overrides = { ...p.overrides }
        if (f.reminder === 'default') delete overrides[key]
        else if (f.reminder === 'off') overrides[key] = { enabled: false }
        else overrides[key] = { enabled: true, offsetMinutes: Number(f.reminder) }
        return { ...p, overrides }
      })
    }
    toast.saved(
      result.value.persisted,
      editingSeries || f.freq !== 'none' ? 'Recurring event' : 'Event',
    )
    onClose()
  }

  const toggleWeekday = (n: number) =>
    set({
      weekdays: f.weekdays.includes(n)
        ? f.weekdays.filter((d) => d !== n)
        : [...f.weekdays, n].sort(),
    })

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
      {errors.form && errors.form !== 'overlap' ? (
        <p
          role="alert"
          className="rounded-md border border-border-strong bg-terracotta-tint p-2 text-sm text-ink"
        >
          {errors.form}
        </p>
      ) : null}

      <Field label="Title" error={errors.title}>
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={f.title}
            maxLength={120}
            onChange={(e) => set({ title: e.target.value })}
          />
        )}
      </Field>
      <Field
        label={f.freq === 'none' && !editingSeries ? 'Date' : 'First date'}
        error={errors.date}
      >
        {(a) => (
          <input
            {...a}
            type="date"
            className={inputClass}
            value={f.date}
            onChange={(e) => set({ date: e.target.value })}
          />
        )}
      </Field>
      <CheckField
        label="All day"
        checked={f.allDay}
        onChange={(v) => set({ allDay: v, busy: v ? false : true })}
        hint="All-day items never count as busy time."
      />
      {!f.allDay ? (
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
      ) : null}
      {!f.allDay ? (
        <CheckField
          label="Counts as busy time"
          checked={f.busy}
          onChange={(v) => set({ busy: v })}
          hint="Used for overlap warnings and Free Pockets."
        />
      ) : null}

      <Field label="Location (optional)" error={errors.location}>
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={f.location}
            maxLength={120}
            onChange={(e) => set({ location: e.target.value })}
          />
        )}
      </Field>
      <Field label="Notes (optional)" error={errors.description}>
        {(a) => (
          <textarea
            {...a}
            className={`${inputClass} min-h-24 py-2`}
            value={f.description}
            maxLength={1000}
            onChange={(e) => set({ description: e.target.value })}
          />
        )}
      </Field>

      {!existing ? (
        <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium text-ink">Repeat</legend>
          <Field label="Repeats">
            {(a) => (
              <select
                {...a}
                className={inputClass}
                value={f.freq}
                onChange={(e) => set({ freq: e.target.value as Freq })}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            )}
          </Field>
          {f.freq !== 'none' ? (
            <>
              <Field label="Every (number of periods)" error={errors.interval}>
                {(a) => (
                  <input
                    {...a}
                    type="number"
                    min={1}
                    max={52}
                    className={inputClass}
                    value={f.interval}
                    onChange={(e) => set({ interval: e.target.value })}
                  />
                )}
              </Field>
              {f.freq === 'weekly' ? (
                <fieldset>
                  <legend className="mb-1 text-sm font-medium text-ink">On these days</legend>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from({ length: 7 }, (_, i) => i + 1).map((n) => (
                      <label
                        key={n}
                        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-border-strong px-2 text-sm has-[:checked]:bg-teal has-[:checked]:text-surface"
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={f.weekdays.includes(n)}
                          onChange={() => toggleWeekday(n)}
                        />
                        {formatWeekday(addDays(MONDAY, n - 1))}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {f.weekdays.length
                      ? ''
                      : `With none chosen, it repeats on ${isDateOnly(f.date) ? formatWeekday(f.date, 'long') : 'the first date’s weekday'}.`}
                  </p>
                </fieldset>
              ) : null}
              <Field
                label="Repeat until"
                error={errors.until}
                hint="Required: repeats are never open-ended."
              >
                {(a) => (
                  <input
                    {...a}
                    type="date"
                    className={inputClass}
                    value={f.until}
                    onChange={(e) => set({ until: e.target.value })}
                  />
                )}
              </Field>
            </>
          ) : null}
        </fieldset>
      ) : editingSeries && series ? (
        <p className="rounded-md bg-mist p-2 text-sm text-ink">
          Editing the entire series from {formatDateShort(series.rule.startDate)} (weekday{' '}
          {isoWeekday(series.rule.startDate)}). Changes made to single occurrences earlier are kept.
        </p>
      ) : null}

      {f.freq === 'none' && !editingSeries ? (
        <Field label="Reminder">
          {(a) => (
            <select
              {...a}
              className={inputClass}
              value={f.reminder}
              onChange={(e) => set({ reminder: e.target.value })}
            >
              {REMINDER_CHOICES.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </Field>
      ) : null}

      {errors.form === 'overlap' || tools.conflicts.length > 0 ? (
        <ConflictWarning
          tools={tools}
          onEditTime={() =>
            formRef.current?.querySelector<HTMLElement>('input[type="time"]')?.focus()
          }
          onApplyGap={(start, end) => {
            set({ start, end })
            tools.setAcknowledged(false)
            setErrors({})
          }}
        />
      ) : null}

      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
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
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
