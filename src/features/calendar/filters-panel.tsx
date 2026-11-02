import { useEffect, useRef } from 'react'
import { categoriesInLayer, categoryLabel, layerLabel, LAYERS } from '@/domain/categories'
import type { CalendarPrefs } from '@/data/prefs/prefs'
import type { Course, EventCategory } from '@/domain/records'
import {
  CALENDAR_PRESETS,
  layerState,
  matchPreset,
  presetById,
  toggleLayer,
} from '@/selectors/filters'
import { Button } from '@/components/ui/button'
import { formatTime, minutesToTime } from '@/lib/time'

interface Props {
  prefs: CalendarPrefs
  courses: readonly Course[]
  workloadText: string
  hasSearch: boolean
  onChange: (fn: (p: CalendarPrefs) => CalendarPrefs) => void
  onClearSearch: () => void
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-t border-border pt-3 first:border-0 first:pt-0">
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {title}
      </legend>
      <div className="flex flex-col">{children}</div>
    </fieldset>
  )
}

const row = 'flex min-h-11 items-center gap-2.5 rounded-md px-1 text-sm text-ink'
const box = 'size-5 accent-[var(--accent-teal)]'

function LayerCheckbox({
  layer,
  prefs,
  onChange,
}: {
  layer: (typeof LAYERS)[number]
  prefs: CalendarPrefs
  onChange: Props['onChange']
}) {
  const ref = useRef<HTMLInputElement>(null)
  const state = layerState(prefs.categories, layer)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = state === 'some'
  }, [state])
  return (
    <label className={row}>
      <input
        ref={ref}
        type="checkbox"
        className={box}
        checked={state === 'all'}
        onChange={() => onChange((p) => ({ ...p, categories: toggleLayer(p.categories, layer) }))}
      />
      {layerLabel[layer]}
      <span className="sr-only"> layer</span>
    </label>
  )
}

/** Layers, presets and filters. Everything here changes visibility only — never a record. */
export function FiltersPanel({
  prefs,
  courses,
  workloadText,
  hasSearch,
  onChange,
  onClearSearch,
}: Props) {
  const preset = matchPreset(prefs.categories)

  const clear = () => {
    // Restores the active preset's visibility (or Balanced when custom); never removes records.
    const base = presetById(preset === 'custom' ? 'balanced' : preset)!
    onChange((p) => ({
      ...p,
      categories: [...base.categories],
      courseIds: [],
      verification: 'all',
      origin: 'all',
      showCompletedTasks: true,
    }))
    onClearSearch()
  }

  const toggleCategory = (c: EventCategory) =>
    onChange((p) => ({
      ...p,
      categories: p.categories.includes(c)
        ? p.categories.filter((x) => x !== c)
        : [...p.categories, c],
    }))

  return (
    <div className="flex flex-col gap-4 text-ink">
      <p className="rounded-md bg-mist p-2.5 text-xs text-ink" aria-label="Workload">
        {workloadText}
      </p>

      <Section title="Preset">
        {CALENDAR_PRESETS.map((p) => (
          <label key={p.id} className={row} title={p.description}>
            <input
              type="radio"
              name="calendar-preset"
              className={box}
              checked={preset === p.id}
              onChange={() =>
                onChange((prev) => ({
                  ...prev,
                  categories: [...p.categories],
                  diningOverlay: false,
                }))
              }
            />
            {p.label}
          </label>
        ))}
        <p className="px-1 py-1 text-xs text-ink-muted" aria-live="polite">
          {preset === 'custom'
            ? 'Custom: your own combination of layers.'
            : presetById(preset)?.description}
        </p>
      </Section>

      <Section title="Layers">
        {LAYERS.map((l) => (
          <LayerCheckbox key={l} layer={l} prefs={prefs} onChange={onChange} />
        ))}
        <details className="mt-1">
          <summary className="min-h-11 cursor-pointer px-1 py-2.5 text-sm font-medium text-teal-strong">
            Individual categories
          </summary>
          <div className="flex flex-col pl-2">
            {LAYERS.flatMap((l) => categoriesInLayer(l)).map((c) => (
              <label key={c} className={row}>
                <input
                  type="checkbox"
                  className={box}
                  checked={prefs.categories.includes(c)}
                  onChange={() => toggleCategory(c)}
                />
                {categoryLabel[c]}
              </label>
            ))}
          </div>
        </details>
      </Section>

      <Section title="Campus services">
        <label className={row}>
          <input
            type="checkbox"
            className={box}
            checked={prefs.diningOverlay}
            onChange={(e) => onChange((p) => ({ ...p, diningOverlay: e.target.checked }))}
          />
          Dining times overlay
        </label>
        <p className="px-1 text-xs text-ink-muted">
          Shaded bands for meals with a known serving window. They are information only and never
          count as busy time.
        </p>
      </Section>

      {courses.length > 0 ? (
        <Section title="Course">
          {courses.map((c) => (
            <label key={c.id} className={row}>
              <input
                type="checkbox"
                className={box}
                checked={prefs.courseIds.includes(c.id)}
                onChange={() =>
                  onChange((p) => ({
                    ...p,
                    courseIds: p.courseIds.includes(c.id)
                      ? p.courseIds.filter((x) => x !== c.id)
                      : [...p.courseIds, c.id],
                  }))
                }
              />
              {c.code} · {c.title}
            </label>
          ))}
          <p className="px-1 text-xs text-ink-muted">With none selected, every course is shown.</p>
        </Section>
      ) : null}

      <Section title="Status and origin">
        <label className="flex flex-col gap-1 py-1 text-sm">
          Confirmation
          <select
            className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
            value={prefs.verification}
            onChange={(e) =>
              onChange((p) => ({
                ...p,
                verification: e.target.value as CalendarPrefs['verification'],
              }))
            }
          >
            <option value="all">All (including unknown)</option>
            <option value="confirmed">Confirmed only</option>
            <option value="tentative">Tentative only</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 py-1 text-sm">
          Record origin
          <select
            className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
            value={prefs.origin}
            onChange={(e) =>
              onChange((p) => ({ ...p, origin: e.target.value as CalendarPrefs['origin'] }))
            }
          >
            <option value="all">All</option>
            <option value="provided">Supplied</option>
            <option value="demo">Sample data</option>
            <option value="personal">Personal</option>
          </select>
        </label>
        <label className={row}>
          <input
            type="checkbox"
            className={box}
            checked={prefs.showCompletedTasks}
            onChange={(e) => onChange((p) => ({ ...p, showCompletedTasks: e.target.checked }))}
          />
          Show completed tasks
        </label>
      </Section>

      <Section title="Visible hours">
        <div className="flex items-center gap-2 py-1 text-sm">
          <label className="flex flex-1 flex-col gap-1">
            From
            <select
              className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
              value={prefs.hourStart}
              onChange={(e) => {
                const v = Number(e.target.value)
                onChange((p) => ({ ...p, hourStart: v, hourEnd: Math.max(p.hourEnd, v + 2) }))
              }}
            >
              {Array.from({ length: 23 }, (_, h) => (
                <option key={h} value={h}>
                  {formatTime(minutesToTime(h * 60))}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-1 flex-col gap-1">
            To
            <select
              className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
              value={prefs.hourEnd}
              onChange={(e) => onChange((p) => ({ ...p, hourEnd: Number(e.target.value) }))}
            >
              {Array.from({ length: 23 }, (_, i) => i + 2)
                .filter((h) => h > prefs.hourStart)
                .map((h) => (
                  <option key={h} value={h}>
                    {h === 24 ? 'Midnight' : formatTime(minutesToTime(h * 60))}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-ink-muted">
          Only changes the grid window; the default is not campus opening hours.
        </p>
      </Section>

      <Button
        variant="outline"
        className="min-h-11"
        onClick={clear}
        disabled={
          preset !== 'custom' &&
          !hasSearch &&
          prefs.courseIds.length === 0 &&
          prefs.verification === 'all' &&
          prefs.origin === 'all' &&
          prefs.showCompletedTasks
        }
      >
        Clear filters
      </Button>
    </div>
  )
}
