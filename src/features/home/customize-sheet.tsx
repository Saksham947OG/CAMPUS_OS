import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ArrowDown, ArrowUp, GripVertical, Lock } from 'lucide-react'
import { useState } from 'react'
import { Field, inputClass } from '@/components/form-kit'
import { Tabs } from '@/components/tabs'
import { useConfirm } from '@/components/confirm-context'
import { useToast } from '@/components/toast-context'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { quickActionRoutes, statusLabel } from '@/app/routes'
import {
  defaultHomePrefs,
  HOME_PRESETS,
  type HomePresetId,
  type HomePrefs,
  type HomeWidgetId,
  type WidgetLayout,
} from '@/data/prefs/home-prefs'
import { useMediaQuery } from '@/hooks/use-media-query'
import { isLocalTime } from '@/lib/time'
import { planningPrefsSchema } from '@/selectors/free-pockets'
import type { HomeCtx } from './home-context'
import {
  applyPreset,
  canEnterZone,
  inZone,
  matchHomePreset,
  moveQuickAction,
  moveToZone,
  moveWithinZone,
  reorderZone,
  setQuickAction,
  setSize,
  setVisible,
  widgetName,
  withDerivedPreset,
  zoneName,
  type Move,
} from './layout-ops'

const ZONES = [1, 2, 3] as const

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  ctx: HomeCtx
}

/** Right drawer on desktop, full-height sheet on mobile. Every committed change auto-saves locally. */
export function CustomizeSheet({ open, onOpenChange, ctx }: Props) {
  const isMd = useMediaQuery('(min-width: 768px)')
  const toast = useToast()
  const confirm = useConfirm()
  const [tab, setTab] = useState<'layouts' | 'widgets' | 'quick' | 'display'>('layouts')
  const [message, setMessage] = useState('')
  const prefs = ctx.prefs
  const current = matchHomePreset(prefs.widgets)

  /** Commit a prefs change; the preset label follows the layout automatically ("Custom"). */
  const commit = async (fn: (p: HomePrefs) => HomePrefs, announce?: string) => {
    const result = await ctx.updatePrefs((p) => withDerivedPreset(fn(p)))
    toast.savedResult(result, 'Layout')
    if (announce) setMessage(announce)
  }

  const apply = (move: Move, success: string) => {
    if (!move.ok) return setMessage(move.reason)
    void commit((p) => ({ ...p, widgets: move.widgets }), success)
  }

  const choosePreset = async (id: HomePresetId) => {
    if (id === current) return
    const c = await confirm({
      title: `Switch to ${HOME_PRESETS[id].label}?`,
      description:
        'This replaces which widgets are shown and their order, and resets widget sizes. Your tasks, events, bookings and other records are not touched.',
      confirmLabel: 'Apply layout',
    })
    if (c === 'confirm')
      void commit((p) => applyPreset(p, id), `${HOME_PRESETS[id].label} layout applied.`)
  }

  const resetLayout = async () => {
    const c = await confirm({
      title: 'Reset layout?',
      description:
        'Resets widget visibility and order, the Agenda/Week choice, density, your quick actions and Home schedule filters to the defaults for this profile. It does not delete any events, tasks or bookings.',
      confirmLabel: 'Reset layout',
      danger: true,
    })
    if (c === 'confirm') void commit(() => defaultHomePrefs(), 'Layout reset to defaults.')
  }

  const tabs = [
    {
      id: 'layouts' as const,
      label: 'Layouts',
      content: (
        <div className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium text-ink">Preset</legend>
            {(Object.keys(HOME_PRESETS) as HomePresetId[]).map((id) => (
              <label
                key={id}
                className="flex min-h-11 items-start gap-2.5 rounded-md px-1 py-1.5 text-sm text-ink"
              >
                <input
                  type="radio"
                  name="home-preset"
                  aria-label={HOME_PRESETS[id].label}
                  className="mt-0.5 size-5 accent-[var(--accent-teal)]"
                  checked={current === id}
                  onChange={() => void choosePreset(id)}
                />
                <span>
                  <span className="block font-medium">{HOME_PRESETS[id].label}</span>
                  <span className="block text-xs text-ink-muted">
                    {HOME_PRESETS[id].description}
                  </span>
                </span>
              </label>
            ))}
            <p className="px-1 text-sm text-ink" aria-live="polite">
              Current layout:{' '}
              <strong>{current === 'custom' ? 'Custom' : HOME_PRESETS[current].label}</strong>
              {current === 'custom' ? (
                <span className="text-ink-muted">
                  {' '}
                  — you changed a preset; the original stays selectable above.
                </span>
              ) : null}
            </p>
          </fieldset>
          <p className="text-xs text-ink-muted">
            The header and schedule are always shown in every layout.
          </p>
          <Button
            variant="outline"
            className="min-h-11 self-start"
            onClick={() => void resetLayout()}
          >
            Reset layout
          </Button>
        </div>
      ),
    },
    {
      id: 'widgets' as const,
      label: 'Widgets',
      content: <WidgetsEditor prefs={prefs} apply={apply} message={message} />,
    },
    {
      id: 'quick' as const,
      label: 'Quick actions',
      content: (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">Choose exactly four different destinations.</p>
          <ol className="flex flex-col gap-2">
            {prefs.quickActions.map((id, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-5 text-sm text-ink-muted">{i + 1}</span>
                <select
                  aria-label={`Shortcut ${i + 1}`}
                  className={inputClass}
                  value={id}
                  onChange={(e) => {
                    const r = setQuickAction(prefs.quickActions, i, e.target.value)
                    if (!r.ok) return setMessage(r.reason)
                    void commit(
                      (p) => ({ ...p, quickActions: r.actions }),
                      `Shortcut ${i + 1} changed.`,
                    )
                  }}
                >
                  {quickActionRoutes.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      disabled={prefs.quickActions.some((a, j) => a === r.id && j !== i)}
                    >
                      {r.label}
                      {r.status !== 'live' ? ` (${statusLabel[r.status].toLowerCase()})` : ''}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Move shortcut ${i + 1} up`}
                  disabled={i === 0}
                  onClick={() =>
                    void commit(
                      (p) => ({ ...p, quickActions: moveQuickAction(p.quickActions, i, -1) }),
                      `Shortcut moved up.`,
                    )
                  }
                >
                  <ArrowUp aria-hidden="true" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 shrink-0"
                  aria-label={`Move shortcut ${i + 1} down`}
                  disabled={i === prefs.quickActions.length - 1}
                  onClick={() =>
                    void commit(
                      (p) => ({ ...p, quickActions: moveQuickAction(p.quickActions, i, 1) }),
                      `Shortcut moved down.`,
                    )
                  }
                >
                  <ArrowDown aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
          <p className="text-sm text-ink-muted" aria-live="polite">
            {message}
          </p>
        </div>
      ),
    },
    {
      id: 'display' as const,
      label: 'Display',
      content: <DisplaySettings ctx={ctx} commit={commit} />,
    },
  ]

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMd ? 'right' : 'bottom'}
        className={
          isMd
            ? 'w-[min(30rem,100vw)] overflow-y-auto p-4'
            : 'h-[92dvh] overflow-y-auto rounded-t-lg p-4'
        }
      >
        <SheetHeader className="p-0 pb-3">
          <SheetTitle>Customize Home</SheetTitle>
          <SheetDescription>
            Changes preview instantly and save on this device. They only change what Home shows,
            never your records.
          </SheetDescription>
        </SheetHeader>
        <Tabs
          idPrefix="customize"
          label="Customize Home"
          value={tab}
          onChange={setTab}
          tabs={tabs}
        />
        <div className="mt-4 flex justify-end border-t border-border pt-3">
          <Button className="min-h-11" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

/* ───────────────────────────── Widgets tab ───────────────────────────── */

function SortableWidgetRow({
  w,
  index,
  count,
  onMove,
  onVisible,
  onSize,
  onZone,
}: {
  w: WidgetLayout
  index: number
  count: number
  onMove: (delta: -1 | 1) => void
  onVisible: (v: boolean) => void
  onSize: (s: WidgetLayout['size']) => void
  onZone: (z: 1 | 2 | 3) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: w.id,
  })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-md border border-border bg-surface p-2 ${isDragging ? 'z-10 shadow-overlay' : ''}`}
      data-widget-row={w.id}
    >
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="inline-flex size-11 shrink-0 cursor-grab items-center justify-center rounded-md hover:bg-mist"
          aria-label={`Drag to reorder ${widgetName[w.id]}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-0 flex-1 text-sm font-medium text-ink">{widgetName[w.id]}</span>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Move ${widgetName[w.id]} up`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Move ${widgetName[w.id]} down`}
          disabled={index === count - 1}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-1 grid grid-cols-[auto_1fr_1fr] items-center gap-2 pl-1.5 text-xs text-ink-muted">
        <label className="flex min-h-11 items-center gap-1.5 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 accent-[var(--accent-teal)]"
            checked={w.visible}
            onChange={(e) => onVisible(e.target.checked)}
            aria-label={`Show ${widgetName[w.id]}`}
          />{' '}
          Show
        </label>
        <label className="flex flex-col gap-0.5">
          Width
          <select
            className={inputClass}
            aria-label={`Width of ${widgetName[w.id]}`}
            value={w.size}
            disabled={w.zone === 1}
            onChange={(e) => onSize(e.target.value as WidgetLayout['size'])}
          >
            <option value="compact">Compact</option>
            <option value="standard">Standard</option>
            <option value="wide">Wide</option>
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          Move to zone
          <select
            className={inputClass}
            aria-label={`Zone of ${widgetName[w.id]}`}
            value={w.zone}
            onChange={(e) => onZone(Number(e.target.value) as 1 | 2 | 3)}
          >
            {ZONES.map((z) => (
              <option key={z} value={z} disabled={!canEnterZone(w.id, z)}>
                {zoneName[z]}
                {canEnterZone(w.id, z) ? '' : ' (not available)'}
              </option>
            ))}
          </select>
        </label>
      </div>
      {w.zone === 1 ? (
        <p className="pl-1.5 text-[11px] text-ink-muted">
          Width applies to the lower sections; this one sits beside the schedule.
        </p>
      ) : null}
    </li>
  )
}

function WidgetsEditor({
  prefs,
  apply,
  message,
}: {
  prefs: HomePrefs
  apply: (m: Move, success: string) => void
  message: string
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const widgets = prefs.widgets

  const onDragEnd = (zone: 1 | 2 | 3) => (e: DragEndEvent) => {
    const list = inZone(widgets, zone)
    const from = list.findIndex((w) => w.id === e.active.id)
    const to = e.over ? list.findIndex((w) => w.id === e.over!.id) : -1
    if (from < 0 || to < 0 || from === to) return
    // Reordering only ever happens inside one zone, so a drag can never hide or overwrite a widget.
    const ids = arrayMove(
      list.map((w) => w.id),
      from,
      to,
    )
    apply(
      reorderZone(widgets, zone, from, to),
      `${widgetName[ids[to]!]} moved to position ${to + 1} in ${zoneName[zone]}.`,
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Drag the handle, or use the up and down buttons. Hiding a widget keeps its data; it just
        stops showing here.
      </p>
      <output className="block min-h-6 text-sm font-medium text-ink" aria-live="polite">
        {message}
      </output>
      {ZONES.map((zone) => {
        const list = inZone(widgets, zone)
        return (
          <section key={zone} aria-labelledby={`zone-${zone}-edit`}>
            <h3 id={`zone-${zone}-edit`} className="mb-1.5 text-sm font-semibold text-ink">
              {zoneName[zone]}
            </h3>
            {zone === 1 ? (
              <p className="mb-1.5 flex items-center gap-2 rounded-md bg-mist p-2 text-sm text-ink">
                <Lock className="size-4" aria-hidden="true" /> Your schedule is pinned here and
                always visible.
              </p>
            ) : null}
            {list.length === 0 ? (
              <p className="text-sm text-ink-muted">No widgets in this section.</p>
            ) : null}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd(zone)}
            >
              <SortableContext items={list.map((w) => w.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-2">
                  {list.map((w, i) => (
                    <SortableWidgetRow
                      key={w.id}
                      w={w}
                      index={i}
                      count={list.length}
                      onMove={(d) =>
                        apply(
                          moveWithinZone(widgets, w.id, d),
                          `${widgetName[w.id]} moved ${d < 0 ? 'up' : 'down'} to position ${i + d + 1} in ${zoneName[zone]}.`,
                        )
                      }
                      onVisible={(v) =>
                        apply(
                          setVisible(widgets, w.id as HomeWidgetId, v),
                          `${widgetName[w.id]} ${v ? 'shown' : 'hidden'}.`,
                        )
                      }
                      onSize={(s) =>
                        apply(setSize(widgets, w.id, s), `${widgetName[w.id]} width set to ${s}.`)
                      }
                      onZone={(z) =>
                        apply(
                          moveToZone(widgets, w.id, z),
                          `${widgetName[w.id]} moved to ${zoneName[z]}.`,
                        )
                      }
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </section>
        )
      })}
    </div>
  )
}

/* ───────────────────────────── Display tab ───────────────────────────── */

function DisplaySettings({
  ctx,
  commit,
}: {
  ctx: HomeCtx
  commit: (fn: (p: HomePrefs) => HomePrefs, announce?: string) => Promise<void>
}) {
  const toast = useToast()
  const { prefs, planning } = ctx
  const [win, setWin] = useState({
    start: planning.windowStart as string,
    end: planning.windowEnd as string,
    min: String(planning.minimumMinutes),
  })
  const [error, setError] = useState<string>()

  const trySave = async (next: typeof win) => {
    setWin(next)
    const candidate = {
      schemaVersion: 1 as const,
      windowStart: next.start,
      windowEnd: next.end,
      minimumMinutes: Number(next.min),
    }
    if (!isLocalTime(next.start) || !isLocalTime(next.end))
      return setError('Enter valid start and end times')
    const parsed = planningPrefsSchema.safeParse(candidate)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid settings'
      return setError(
        Number(next.min) < 15 || Number(next.min) > 180 || !Number.isInteger(Number(next.min))
          ? 'Minimum gap must be a whole number from 15 to 180 minutes'
          : message,
      )
    }
    setError(undefined)
    const result = await ctx.updatePlanning(() => parsed.data)
    toast.savedResult(result, 'Free Pockets settings')
  }

  return (
    <div className="flex flex-col gap-5">
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Density</legend>
        {(['comfortable', 'compact'] as const).map((d) => (
          <label key={d} className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name="density"
              className="size-5 accent-[var(--accent-teal)]"
              checked={prefs.density === d}
              onChange={() => void commit((p) => ({ ...p, density: d }), `Density set to ${d}.`)}
            />
            {d === 'comfortable' ? 'Comfortable' : 'Compact'}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend className="mb-1 text-sm font-medium text-ink">Schedule opens as</legend>
        {(['agenda', 'week'] as const).map((v) => (
          <label key={v} className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
            <input
              type="radio"
              name="schedule-view"
              className="size-5 accent-[var(--accent-teal)]"
              checked={prefs.scheduleView === v}
              onChange={() =>
                void commit((p) => ({ ...p, scheduleView: v }), `Schedule opens as ${v}.`)
              }
            />
            {v === 'agenda' ? 'Agenda' : 'Week'}
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-3 rounded-md border border-border p-3">
        <legend className="px-1 text-sm font-medium text-ink">Free Pockets</legend>
        <p className="text-xs text-ink-muted">
          A planning preference shared with the Calendar. It is not campus opening hours.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Working day starts">
            {(a) => (
              <input
                {...a}
                type="time"
                className={inputClass}
                value={win.start}
                onChange={(e) => void trySave({ ...win, start: e.target.value })}
              />
            )}
          </Field>
          <Field label="Working day ends">
            {(a) => (
              <input
                {...a}
                type="time"
                className={inputClass}
                value={win.end}
                onChange={(e) => void trySave({ ...win, end: e.target.value })}
              />
            )}
          </Field>
        </div>
        <Field label="Show gaps of at least (minutes)" error={error}>
          {(a) => (
            <input
              {...a}
              type="number"
              min={15}
              max={180}
              className={inputClass}
              value={win.min}
              onChange={(e) => void trySave({ ...win, min: e.target.value })}
            />
          )}
        </Field>
      </fieldset>
      <p className="text-xs text-ink-muted">
        Animations follow your system “reduce motion” setting.
      </p>
    </div>
  )
}
