import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import type { ProfileData } from '@/domain/records'
import { useCampusCommands } from '@/hooks/use-campus-data'
import {
  formatDateLong,
  isDateOnly,
  isLocalTime,
  timeToMinutes,
  type DateOnly,
  type LocalTime,
} from '@/lib/time'
import type { EditorRequest } from './editor-types'

type Req = Extract<EditorRequest, { kind: 'occurrence' }>

/**
 * Change ONE occurrence of a personal recurring event. This writes an exception keyed by
 * (series, original date); the series itself is never copied or rewritten (C-D13, C-T06).
 */
export function OccurrenceEditor({
  request,
  data,
  onClose,
}: {
  request: Req
  data: ProfileData
  onClose: () => void
}) {
  const { series, originalDate } = request
  const commands = useCampusCommands()
  const toast = useToast()
  const existing = data.exceptions.find(
    (e) => e.seriesId === series.id && e.originalDate === originalDate,
  )
  const baseTiming = series.timing
  const [f, setF] = useState({
    title: existing?.replacement?.title ?? series.title,
    date: (existing?.replacement?.date ?? originalDate) as string,
    start: existing?.replacement?.start ?? (baseTiming.kind === 'timed' ? baseTiming.start : ''),
    end: existing?.replacement?.end ?? (baseTiming.kind === 'timed' ? baseTiming.end : ''),
    location: existing?.replacement?.location ?? series.location ?? '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const timed = baseTiming.kind === 'timed'

  const run = async (
    fn: () => Promise<{ ok: boolean; persisted?: boolean; message?: string }>,
    label: string,
  ) => {
    setSaving(true)
    const r = await fn()
    setSaving(false)
    if (!r.ok) return setErrors({ form: r.message ?? 'Could not save.' })
    toast.saved(r.persisted ?? true, label)
    onClose()
  }

  const save = () => {
    const next: Record<string, string> = {}
    if (!f.title.trim()) next.title = 'Title is required'
    if (!isDateOnly(f.date)) next.date = 'Choose a date'
    if (timed) {
      if (!isLocalTime(f.start)) next.start = 'Choose a start time'
      if (!isLocalTime(f.end)) next.end = 'Choose an end time'
      else if (isLocalTime(f.start) && timeToMinutes(f.end) <= timeToMinutes(f.start))
        next.end = 'End time must be after the start time'
    }
    setErrors(next)
    if (Object.keys(next).length) return
    const moved =
      f.date !== originalDate ||
      (timed && (f.start !== baseTiming.start || f.end !== baseTiming.end))
    const changed = moved || f.title !== series.title || f.location !== (series.location ?? '')
    if (!changed) return setErrors({ form: 'Nothing has changed for this occurrence.' })
    void run(async () => {
      const r = await commands.saveException({
        seriesId: series.id,
        originalDate,
        action: moved ? 'rescheduled' : 'modified',
        replacement: {
          ...(f.date !== originalDate ? { date: f.date as DateOnly } : {}),
          ...(timed ? { start: f.start as LocalTime, end: f.end as LocalTime } : {}),
          title: f.title,
          location: f.location.trim() || undefined,
        },
      })
      return r.ok
        ? { ok: true, persisted: r.value.persisted }
        : {
            ok: false,
            message: r.error.fieldErrors ? Object.values(r.error.fieldErrors)[0] : r.error.message,
          }
    }, 'This occurrence')
  }

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!saving) save()
      }}
    >
      <p className="rounded-md bg-mist p-2 text-sm text-ink">
        Only the occurrence on {formatDateLong(originalDate)} changes. The rest of “{series.title}”
        stays as it is.
      </p>
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
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
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
            onChange={(e) => setF({ ...f, date: e.target.value })}
          />
        )}
      </Field>
      {timed ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start time" error={errors.start}>
            {(a) => (
              <input
                {...a}
                type="time"
                className={inputClass}
                value={f.start}
                onChange={(e) => setF({ ...f, start: e.target.value })}
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
                onChange={(e) => setF({ ...f, end: e.target.value })}
              />
            )}
          </Field>
        </div>
      ) : null}
      <Field label="Location (optional)">
        {(a) => (
          <input
            {...a}
            className={inputClass}
            value={f.location}
            onChange={(e) => setF({ ...f, location: e.target.value })}
          />
        )}
      </Field>
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" className="min-h-11" onClick={onClose}>
          Close
        </Button>
        {existing ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={saving}
            onClick={() =>
              void run(async () => {
                const r = await commands.removeException(existing.id)
                return r.ok
                  ? { ok: true, persisted: r.value.persisted }
                  : { ok: false, message: r.error.message }
              }, 'Original restored;')
            }
          >
            Restore original
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={saving}
          onClick={() =>
            void run(async () => {
              const r = await commands.saveException({
                seriesId: series.id,
                originalDate,
                action: 'cancelled',
              })
              return r.ok
                ? { ok: true, persisted: r.value.persisted }
                : { ok: false, message: r.error.message }
            }, 'Occurrence cancelled;')
          }
        >
          Cancel this occurrence
        </Button>
        <Button type="submit" className="min-h-11" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
