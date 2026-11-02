import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const inputClass =
  'min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-ink placeholder:text-ink-muted disabled:bg-canvas disabled:text-ink-muted'

/** Labelled form field with an inline, programmatically associated error. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  className?: string
  /** Receives the ids to wire onto the control. */
  children: (props: {
    id: string
    'aria-describedby'?: string
    'aria-invalid'?: boolean
  }) => ReactNode
}) {
  const id = useId()
  const describedBy =
    [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-ink-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function CheckField({
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  hint?: string
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col">
      <label htmlFor={id} className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
        <input
          id={id}
          type="checkbox"
          className="size-5 accent-[var(--accent-teal)]"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        {label}
      </label>
      {hint ? <p className="pl-8 text-xs text-ink-muted">{hint}</p> : null}
    </div>
  )
}
