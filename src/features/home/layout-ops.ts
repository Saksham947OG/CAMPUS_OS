import {
  HOME_PRESETS,
  layoutForPreset,
  type HomePresetId,
  type HomePrefs,
  type HomeWidgetId,
  type WidgetLayout,
} from '@/data/prefs/home-prefs'

/**
 * Pure layout operations. They change only visibility / order / zone / size metadata — never a record
 * (COS-HOME-001 §6.3). Every operation returns a normalized list so the saved order is one canonical
 * array that responsive rendering reads, never a pixel position.
 */

type Zone = WidgetLayout['zone']

/** Widgets allowed in Immediate Priorities. Others are rejected with an explanation (audit A13). */
export const ZONE1_ALLOWED: readonly HomeWidgetId[] = [
  'schedule',
  'upNext',
  'deadlines',
  'myTasks',
  'freePockets',
]

export const widgetName: Record<HomeWidgetId, string> = {
  schedule: 'Your schedule',
  upNext: 'Up next',
  deadlines: 'Deadline focus',
  quickActions: 'Quick actions',
  activity: 'My activity',
  messPreview: 'Mess preview',
  myTasks: 'My tasks',
  freePockets: 'Free Pockets',
  campusPulse: 'Campus Pulse',
  timeTax: 'Time Tax snapshot',
  workspace: 'Workspace',
}

export const zoneName: Record<Zone, string> = {
  1: 'Immediate priorities',
  2: 'Things to do',
  3: 'Discover & reflect',
}

export type Move = { ok: true; widgets: WidgetLayout[] } | { ok: false; reason: string }

export const canEnterZone = (id: HomeWidgetId, zone: Zone) =>
  zone !== 1 || ZONE1_ALLOWED.includes(id)

/** Re-number `order` 0..n: schedule first, then zone 1, 2, 3 each by its current order. */
export function normalize(widgets: readonly WidgetLayout[]): WidgetLayout[] {
  const sorted = [...widgets].sort((a, b) => {
    if (a.id === 'schedule') return -1
    if (b.id === 'schedule') return 1
    return a.zone - b.zone || a.order - b.order
  })
  return sorted.map((w, order) => ({ ...w, order }))
}

export const inZone = (widgets: readonly WidgetLayout[], zone: Zone) =>
  normalize(widgets).filter((w) => w.zone === zone && w.id !== 'schedule')

/** Move a widget up/down within its zone (the keyboard / touch alternative to dragging). */
export function moveWithinZone(
  widgets: readonly WidgetLayout[],
  id: HomeWidgetId,
  delta: -1 | 1,
): Move {
  if (id === 'schedule') return { ok: false, reason: 'The schedule is pinned and cannot be moved.' }
  const w = widgets.find((x) => x.id === id)
  if (!w) return { ok: false, reason: 'Unknown widget.' }
  const zoneList = inZone(widgets, w.zone)
  const from = zoneList.findIndex((x) => x.id === id)
  const to = from + delta
  if (to < 0 || to >= zoneList.length) {
    return {
      ok: false,
      reason: `${widgetName[id]} is already ${delta < 0 ? 'first' : 'last'} in ${zoneName[w.zone]}.`,
    }
  }
  return reorderZone(widgets, w.zone, from, to)
}

/** Reorder inside one zone by index (used by drag-and-drop). Never changes zones. */
export function reorderZone(
  widgets: readonly WidgetLayout[],
  zone: Zone,
  from: number,
  to: number,
): Move {
  const list = inZone(widgets, zone)
  if (from < 0 || to < 0 || from >= list.length || to >= list.length)
    return { ok: false, reason: 'That position does not exist.' }
  const next = [...list]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  const others = normalize(widgets).filter((w) => w.zone !== zone || w.id === 'schedule')
  return {
    ok: true,
    widgets: normalize([...others, ...next.map((w, i) => ({ ...w, order: 1000 * zone + i }))]),
  }
}

export function moveToZone(widgets: readonly WidgetLayout[], id: HomeWidgetId, zone: Zone): Move {
  if (id === 'schedule')
    return { ok: false, reason: 'The schedule is pinned in Immediate priorities.' }
  if (!canEnterZone(id, zone)) {
    return {
      ok: false,
      reason: `${widgetName[id]} cannot be placed in ${zoneName[zone]}. Nothing was changed.`,
    }
  }
  const w = widgets.find((x) => x.id === id)
  if (!w) return { ok: false, reason: 'Unknown widget.' }
  if (w.zone === zone) return { ok: true, widgets: normalize(widgets) }
  return {
    ok: true,
    widgets: normalize(
      widgets.map((x) => (x.id === id ? { ...x, zone, order: 1000 * zone + 999 } : x)),
    ),
  }
}

export function setVisible(
  widgets: readonly WidgetLayout[],
  id: HomeWidgetId,
  visible: boolean,
): Move {
  if (id === 'schedule') return { ok: false, reason: 'The schedule is always visible.' }
  return { ok: true, widgets: normalize(widgets.map((w) => (w.id === id ? { ...w, visible } : w))) }
}

export function setSize(
  widgets: readonly WidgetLayout[],
  id: HomeWidgetId,
  size: WidgetLayout['size'],
): Move {
  if (id === 'schedule') return { ok: false, reason: 'The schedule has a fixed size.' }
  return { ok: true, widgets: normalize(widgets.map((w) => (w.id === id ? { ...w, size } : w))) }
}

/** Which preset the current layout equals (visibility + order + zones), else "custom" (H-D09). */
export function matchHomePreset(widgets: readonly WidgetLayout[]): HomePresetId | 'custom' {
  const key = (list: readonly WidgetLayout[]) =>
    normalize(list)
      .map((w) => `${w.id}:${w.visible ? 1 : 0}:${w.zone}`)
      .join('|')
  const current = key(widgets)
  const hit = (Object.keys(HOME_PRESETS) as HomePresetId[]).find(
    (p) => key(layoutForPreset(p)) === current,
  )
  return hit ?? 'custom'
}

/** Applying a preset replaces visibility and order only; sizes reset to standard; data is untouched. */
export function applyPreset(prefs: HomePrefs, preset: HomePresetId): HomePrefs {
  return { ...prefs, preset, widgets: layoutForPreset(preset) }
}

/** Keeps `preset` in step with the layout: any manual change becomes "custom" automatically. */
export function withDerivedPreset(prefs: HomePrefs): HomePrefs {
  return { ...prefs, preset: matchHomePreset(prefs.widgets) }
}

/** Quick actions: replace slot `index` with `routeId`, rejecting duplicates (H-A13). */
export function setQuickAction(
  actions: readonly string[],
  index: number,
  routeId: string,
): { ok: true; actions: string[] } | { ok: false; reason: string } {
  if (index < 0 || index >= actions.length)
    return { ok: false, reason: 'That slot does not exist.' }
  if (actions.some((a, i) => a === routeId && i !== index))
    return { ok: false, reason: 'That destination is already one of your four shortcuts.' }
  const next = [...actions]
  next[index] = routeId
  return { ok: true, actions: next }
}

export function moveQuickAction(
  actions: readonly string[],
  index: number,
  delta: -1 | 1,
): string[] {
  const to = index + delta
  if (to < 0 || to >= actions.length) return [...actions]
  const next = [...actions]
  const [moved] = next.splice(index, 1)
  next.splice(to, 0, moved!)
  return next
}
