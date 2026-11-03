import {
  defaultHomePrefs,
  homePrefsSchema,
  layoutForPreset,
  type HomePrefs,
} from '@/data/prefs/home-prefs'
import {
  applyPreset,
  canEnterZone,
  inZone,
  matchHomePreset,
  moveQuickAction,
  moveToZone,
  moveWithinZone,
  normalize,
  reorderZone,
  setQuickAction,
  setSize,
  setVisible,
  withDerivedPreset,
} from './layout-ops'

const base = () => layoutForPreset('balanced')
const ids = (w: ReturnType<typeof base>, zone: 1 | 2 | 3) => inZone(w, zone).map((x) => x.id)

describe('H-T10 / H-T11 widget layout operations', () => {
  it('default Balanced layout shows all ten optional widgets in the spec zones', () => {
    const w = base()
    expect(w.filter((x) => x.visible && x.id !== 'schedule')).toHaveLength(10)
    expect(ids(w, 1)).toEqual(['upNext', 'deadlines'])
    expect(ids(w, 2)).toEqual([
      'quickActions',
      'activity',
      'messPreview',
      'myTasks',
      'freePockets',
      'workspace',
    ])
    expect(ids(w, 3)).toEqual(['campusPulse', 'timeTax'])
  })

  it('hiding and restoring a widget changes only visibility, keeping its place (data is never involved)', () => {
    const hidden = setVisible(base(), 'activity', false)
    expect(hidden.ok && hidden.widgets.find((x) => x.id === 'activity')).toMatchObject({
      visible: false,
      zone: 2,
    })
    const back = hidden.ok ? setVisible(hidden.widgets, 'activity', true) : hidden
    expect(back.ok && ids(back.widgets, 2)).toEqual(ids(base(), 2))
  })

  it('the schedule is pinned: it cannot be hidden, moved or resized', () => {
    expect(setVisible(base(), 'schedule', false)).toMatchObject({ ok: false })
    expect(moveWithinZone(base(), 'schedule', 1)).toMatchObject({ ok: false })
    expect(moveToZone(base(), 'schedule', 2)).toMatchObject({ ok: false })
    expect(setSize(base(), 'schedule', 'wide')).toMatchObject({ ok: false })
  })

  it('move up/down (the keyboard alternative) and index reorder (drag) produce the same order', () => {
    const viaButtons = moveWithinZone(base(), 'myTasks', -1)
    const viaDrag = reorderZone(base(), 2, 3, 2)
    expect(viaButtons.ok && viaDrag.ok && ids(viaButtons.widgets, 2)).toEqual(
      viaDrag.ok ? ids(viaDrag.widgets, 2) : [],
    )
    expect(viaButtons.ok && ids(viaButtons.widgets, 2)).toEqual([
      'quickActions',
      'activity',
      'myTasks',
      'messPreview',
      'freePockets',
      'workspace',
    ])
  })

  it('reordering never crosses zones, loses a widget or duplicates one', () => {
    const r = reorderZone(base(), 2, 0, 4)
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.widgets).toHaveLength(base().length)
      expect(new Set(r.widgets.map((w) => w.id)).size).toBe(base().length)
      expect(ids(r.widgets, 1)).toEqual(['upNext', 'deadlines'])
      expect(ids(r.widgets, 3)).toEqual(['campusPulse', 'timeTax'])
      expect(r.widgets.map((w) => w.order)).toEqual(r.widgets.map((_, i) => i)) // canonical, gap-free
    }
  })

  it('reports the edges instead of silently doing nothing', () => {
    expect(moveWithinZone(base(), 'upNext', -1)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/already first/),
    })
    expect(moveWithinZone(base(), 'workspace', 1)).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/already last/),
    })
  })

  it('moving to another zone is explicit and appends; unsuitable zones are rejected with an explanation and no change', () => {
    const moved = moveToZone(base(), 'timeTax', 2)
    expect(moved.ok && ids(moved.widgets, 2).at(-1)).toBe('timeTax')
    expect(moved.ok && ids(moved.widgets, 3)).toEqual(['campusPulse'])
    expect(canEnterZone('timeTax', 1)).toBe(false)
    const rejected = moveToZone(base(), 'timeTax', 1)
    expect(rejected).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/cannot be placed in Immediate priorities/),
    })
    expect(canEnterZone('myTasks', 1)).toBe(true)
  })

  it('sizes are stored per widget and survive reordering', () => {
    const sized = setSize(base(), 'activity', 'wide')
    const moved = sized.ok ? moveWithinZone(sized.widgets, 'activity', 1) : sized
    expect(moved.ok && moved.widgets.find((w) => w.id === 'activity')?.size).toBe('wide')
  })
})

describe('H-T12 presets and the Custom label', () => {
  it('applying a preset replaces visibility and order only', () => {
    const prefs = defaultHomePrefs()
    const academic = applyPreset(prefs, 'academic')
    expect(
      academic.widgets
        .filter((w) => w.visible && w.id !== 'schedule')
        .map((w) => w.id)
        .sort(),
    ).toEqual([
      'activity',
      'deadlines',
      'freePockets',
      'myTasks',
      'quickActions',
      'upNext',
      'workspace',
    ])
    expect(academic.quickActions).toEqual(prefs.quickActions) // unrelated preferences untouched
    expect(matchHomePreset(academic.widgets)).toBe('academic')
    expect(homePrefsSchema.safeParse(academic).success).toBe(true)
  })

  it('every preset keeps the schedule visible (H-D07)', () => {
    for (const p of ['balanced', 'academic', 'campusLife'] as const) {
      expect(layoutForPreset(p).find((w) => w.id === 'schedule')).toMatchObject({
        visible: true,
        zone: 1,
      })
    }
  })

  it('a manual change flips the label to custom automatically; the original preset stays selectable', () => {
    const prefs = defaultHomePrefs()
    const hidden = setVisible(prefs.widgets, 'timeTax', false)
    const next = withDerivedPreset({
      ...prefs,
      widgets: hidden.ok ? hidden.widgets : prefs.widgets,
    })
    expect(next.preset).toBe('custom')
    expect(applyPreset(next, 'balanced').widgets).toEqual(layoutForPreset('balanced'))
  })
})

describe('H-T09 quick action preferences', () => {
  const four = ['chill-spot', 'laundry', 'bookings', 'mess']
  it('refuses duplicates and keeps exactly four', () => {
    expect(setQuickAction(four, 0, 'laundry')).toMatchObject({ ok: false })
    const ok = setQuickAction(four, 0, 'calendar')
    expect(ok.ok && ok.actions).toEqual(['calendar', 'laundry', 'bookings', 'mess'])
    expect(ok.ok && new Set(ok.actions).size).toBe(4)
  })
  it('reorders without changing membership', () => {
    expect(moveQuickAction(four, 0, 1)).toEqual(['laundry', 'chill-spot', 'bookings', 'mess'])
    expect(moveQuickAction(four, 0, -1)).toEqual(four)
  })
  it('the stored schema rejects anything other than four unique shortcuts and an unpinned schedule', () => {
    const p = defaultHomePrefs()
    expect(homePrefsSchema.safeParse({ ...p, quickActions: ['a', 'b', 'c'] }).success).toBe(false)
    expect(homePrefsSchema.safeParse({ ...p, quickActions: ['a', 'a', 'b', 'c'] }).success).toBe(
      false,
    )
    const hiddenSchedule: HomePrefs = {
      ...p,
      widgets: p.widgets.map((w) => (w.id === 'schedule' ? { ...w, visible: false } : w)),
    }
    expect(homePrefsSchema.safeParse(hiddenSchedule).success).toBe(false)
  })
})

describe('normalize', () => {
  it('is idempotent and keeps the schedule first', () => {
    const once = normalize(base())
    expect(normalize(once)).toEqual(once)
    expect(once[0]?.id).toBe('schedule')
  })
})
