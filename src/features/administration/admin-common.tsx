import { useState, type ReactNode } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { actorLabel, type Attachment, type RequestEvent } from '@/domain/admin'
import { checkAttachment, describeAttachment } from '@/domain/admin-logic'
import { formatInstant } from '@/lib/time'
import { Pill } from '../essentials/ess-common'

/** Every Administration page opens with this: nothing here is an institutional action. */
export function DemoBanner({ children }: { children?: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm text-ink"
    >
      <strong>Saved on this device.</strong> Nothing here is sent to the campus, and no decision,
      permission, gate pass or repair is real. {children}
    </p>
  )
}

export const EMERGENCY_NOTE =
  'This demo cannot contact emergency help or any campus office. If anyone is in danger, use the established campus or emergency channels.'

export function StatusPill({ label, tone = 'plain' }: { label: string; tone?: 'plain' | 'warn' }) {
  return <Pill tone={tone}>{label}</Pill>
}

/** Append-only history, written for a student: who did what, when, and why. */
export function Timeline({ events }: { events: readonly RequestEvent[] }) {
  return (
    <ol className="flex flex-col gap-1.5">
      {events.map((h) => (
        <li key={h.id} className="flex flex-wrap gap-x-2 border-b border-border pb-1.5 text-sm">
          <time dateTime={h.at} className="text-ink-muted">
            {formatInstant(h.at)}
          </time>
          <span className="font-medium">{h.eventType}</span>
          {h.revision ? <span className="text-ink-muted">revision {h.revision}</span> : null}
          <Pill tone={h.actorType === 'student' ? 'plain' : 'demo'}>{actorLabel[h.actorType]}</Pill>
          {h.reason ? <span className="text-ink-muted">“{h.reason}”</span> : null}
        </li>
      ))}
    </ol>
  )
}

/**
 * Describes a file without reading it: only its name, type and size are kept, so nothing sensitive is
 * ever stored. A file that is not acceptable is refused with an alert and the rest of the form stays.
 */
export function AttachmentField({
  label,
  kind,
  value,
  onChange,
  newId,
  warning,
}: {
  label: string
  kind: 'image' | 'any'
  value: readonly Attachment[]
  onChange: (next: Attachment[]) => void
  newId: (prefix: string) => string
  warning: string
}) {
  const [error, setError] = useState<string>()
  return (
    <div className="flex flex-col gap-1">
      <Field label={label} hint={warning}>
        {(a) => (
          <input
            {...a}
            type="file"
            accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : undefined}
            className={`${inputClass} py-2`}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              const bad = checkAttachment(
                { name: file.name, type: file.type, size: file.size },
                kind,
              )
              if (bad) {
                setError(bad)
                e.target.value = ''
                return
              }
              setError(undefined)
              onChange([
                ...value,
                describeAttachment(
                  { name: file.name, type: file.type, size: file.size },
                  { nowIso: '', newId },
                ),
              ])
              e.target.value = ''
            }}
          />
        )}
      </Field>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
      {value.length > 0 ? (
        <ul className="text-sm text-ink-muted">
          {value.map((v) => (
            <li key={v.id} className="flex flex-wrap items-center gap-2">
              {v.displayName} · {Math.max(1, Math.round(v.sizeBytes / 1024))} KB · demo descriptor
              only
              <button
                type="button"
                className="min-h-11 text-coffee underline"
                onClick={() => onChange(value.filter((x) => x.id !== v.id))}
              >
                Remove {v.displayName}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
