import { FlaskConical } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Field, inputClass } from '@/components/form-kit'
import { cn } from '@/lib/utils'

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return <output className="block text-ink-muted">{children}</output>
}

export function Pill({
  children,
  tone = 'plain',
}: {
  children: ReactNode
  tone?: 'plain' | 'warn' | 'demo'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-border-strong px-2.5 py-1 text-xs font-semibold text-ink',
        tone === 'plain' && 'bg-mist',
        tone === 'warn' && 'bg-terracotta-tint',
        tone === 'demo' && 'bg-surface',
      )}
    >
      {children}
    </span>
  )
}

export function SectionCard({
  id,
  title,
  children,
  action,
}: {
  id: string
  title: string
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-base font-semibold text-ink">
          {title}
        </h2>
        {action}
      </div>
      <div className="mt-2 text-sm text-ink">{children}</div>
    </section>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-dashed border-border-strong bg-surface p-4 text-sm text-ink-muted">
      {children}
    </p>
  )
}

export function SubNav({
  label,
  items,
  current,
}: {
  label: string
  items: { id: string; label: string; to: string }[]
  current: string
}) {
  return (
    <nav aria-label={label} className="flex flex-wrap gap-1 border-b border-border">
      {items.map((i) => (
        <Link
          key={i.id}
          to={i.to}
          aria-current={current === i.id ? 'page' : undefined}
          className={cn(
            'min-h-11 border-b-4 px-4 py-2.5 text-sm font-medium text-ink',
            current === i.id ? 'border-coffee font-semibold' : 'border-transparent hover:bg-mist',
          )}
        >
          {i.label}
        </Link>
      ))}
    </nav>
  )
}

/** Wrapper that makes the simulator unmistakable: dashed, labelled, never part of the student surface. */
export function OpsCard({
  id,
  title,
  children,
  message,
}: {
  id: string
  title: string
  children: ReactNode
  message?: string
}) {
  return (
    <section
      aria-labelledby={id}
      data-testid="demo-ops"
      className="rounded-lg border-2 border-dashed border-border-strong bg-mist p-4"
    >
      <h2 id={id} className="flex items-center gap-2 text-base font-semibold text-ink">
        <FlaskConical className="size-4" aria-hidden="true" /> {title} · local simulator
      </h2>
      <p className="mt-1 text-sm text-ink">
        For presentations only. This is <strong>not</strong> a provider, staff account, sensor or
        live system, and it does not sync with other devices. Nothing changes unless you press a
        button, and everything here is recorded as <strong>simulated</strong>.
      </p>
      <output className="mt-2 block min-h-5 text-sm font-medium text-ink" aria-live="polite">
        {message}
      </output>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </section>
  )
}

/**
 * A what-if on assumptions you can change (COS-ESSENTIALS-001 §8). It is not a measurement of the real
 * service; the starting numbers are examples.
 */
export function TripScenario({ id, noun }: { id: string; noun: string }) {
  const [now, setNow] = useState('4')
  const [after, setAfter] = useState('1')
  const [mins, setMins] = useState('12')
  const valid = [now, after, mins].every(
    (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 100,
  )
  const avoided = valid ? Number(now) - Number(after) : 0
  const net = valid ? avoided * Number(mins) : 0
  const num = (label: string, v: string, set: (s: string) => void) => (
    <Field label={label}>
      {(a) => (
        <input
          {...a}
          type="number"
          min={0}
          max={100}
          className={inputClass}
          value={v}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </Field>
  )
  return (
    <SectionCard id={id} title="Time Tax scenario">
      <p className="mb-2">
        <Pill tone="warn">Illustrative scenario, not an observation</Pill>
      </p>
      <p className="text-ink-muted">
        A what-if on assumptions you can change. It is <strong>not</strong> a measurement of real{' '}
        {noun}, and registering things in CampusOS does not by itself prove any time was saved.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {num('Trips per month today', now, setNow)}
        {num('Trips per month with in-app updates', after, setAfter)}
        {num('Minutes per trip', mins, setMins)}
      </div>
      <p className="mt-3 rounded-md bg-coffee-tint p-3 font-semibold" aria-live="polite">
        {valid
          ? `Illustrative net change: ${net > 0 ? '−' : net < 0 ? '+' : ''}${Math.abs(net)} minutes per month ${net > 0 ? '(less travelling)' : net < 0 ? '(MORE travelling)' : '(no change)'}`
          : 'Enter whole numbers from 0 to 100 in every box.'}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        Hypothetical trips avoided: {valid ? Math.max(0, avoided) : '—'} per month. Observed
        results: none recorded; a real comparison needs field observation with a sample size, dates
        and method.
      </p>
    </SectionCard>
  )
}

/**
 * COS-SPACES-001 §9: potential person-minutes avoided = eligible visits × max(0, baseline minutes −
 * hypothetical intervention minutes), shown as student-hours. A what-if on assumptions you can
 * change; a confirmed reservation does not prove any time was saved.
 */
export function PersonMinutesScenario({ id, noun }: { id: string; noun: string }) {
  const [visits, setVisits] = useState('20')
  const [baseline, setBaseline] = useState('10')
  const [after, setAfter] = useState('2')
  const nums = [visits, baseline, after]
  const valid = nums.every(
    (v) => v !== '' && Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) <= 1000,
  )
  const minutes = valid ? Number(visits) * Math.max(0, Number(baseline) - Number(after)) : 0
  const field = (label: string, v: string, set: (s: string) => void, hint?: string) => (
    <Field label={label} hint={hint}>
      {(a) => (
        <input
          {...a}
          type="number"
          min={0}
          max={1000}
          className={inputClass}
          value={v}
          onChange={(e) => set(e.target.value)}
        />
      )}
    </Field>
  )
  return (
    <SectionCard id={id} title="Time Tax scenario">
      <p className="mb-2">
        <Pill tone="warn">Illustrative scenario, not an observation</Pill>
      </p>
      <p className="text-ink-muted">
        A what-if on assumptions you can change. It is <strong>not</strong> a measurement of real{' '}
        {noun}, and a confirmed reservation does not prove any time was saved.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {field('Eligible visits per month', visits, setVisits)}
        {field('Baseline wait or coordination (minutes)', baseline, setBaseline, 'Assumed today.')}
        {field('Hypothetical with a booking (minutes)', after, setAfter, 'Assumed, not measured.')}
      </div>
      <p className="mt-3 rounded-md bg-coffee-tint p-3 font-semibold" aria-live="polite">
        {valid
          ? `Hypothetical person-minutes avoided: ${minutes} per month (${(minutes / 60).toFixed(2)} student-hours)`
          : 'Enter whole numbers from 0 to 1000 in every box.'}
      </p>
      <p className="mt-1 text-xs text-ink-muted">
        = visits × max(0, baseline − hypothetical). Never below zero, and never a measured result.
        Observed results: none recorded; a real comparison needs failed-visit counts, waiting times,
        a sample size and dates.
      </p>
    </SectionCard>
  )
}
