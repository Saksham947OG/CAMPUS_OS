import { Temporal } from 'temporal-polyfill'
import { defaultReminderPrefs, type ReminderPrefs } from '@/data/prefs/reminder-prefs'
import { parseDateOnly, parseLocalTime } from '@/lib/time'
import { makeRepo } from '@/test/campus-fixtures'
import { itemsOnDate } from './occurrences'
import { dueReminders, reminderCandidates, reminderPlan } from './reminders'

const ms = (iso: string) => Temporal.Instant.from(iso).epochMilliseconds
const t = parseLocalTime

describe('in-app reminders (COS-CAL-001 §9)', () => {
  it('C-T19: a personal timed event reminds once, 15 minutes before, and never twice', async () => {
    const env = makeRepo()
    await env.repo.saveEvent('demo-student-a', {
      id: 'ev-mine',
      title: 'My review',
      category: 'personal',
      date: env.d(0),
      timing: { kind: 'timed', start: t('15:00'), end: t('16:00') },
      blocksTime: true,
    })
    const data = await env.load()
    const candidates = reminderCandidates(data, defaultReminderPrefs(), env.d(-1), env.d(7)).filter(
      (c) => c.item.recordId === 'ev-mine',
    )
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.triggerMs).toBe(ms('2026-11-02T09:15:00Z')) // 14:45 IST
    expect(candidates[0]!.key).toBe(
      `demo-student-a|ev-mine|ev-mine@${env.d(0)}|personal|2026-11-02T09:15:00Z`,
    )

    const window = [ms('2026-11-02T09:00:00Z'), ms('2026-11-02T09:30:00Z')] as const
    const first = dueReminders(candidates, new Set(), ...window)
    expect(first).toHaveLength(1)
    // A refresh / session resume re-derives the same key: nothing fires again.
    expect(dueReminders(candidates, new Set(first.map((c) => c.key)), ...window)).toHaveLength(0)
  })

  it('date-only deadlines are reminded at the reminder clock on the previous day, never at an invented due time', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const dl = itemsOnDate(data, d(2)).find((i) => i.recordId === 'dl-assign-1')!
    const plan = reminderPlan(dl, defaultReminderPrefs())!
    expect(plan.ruleId).toBe('deadlineDateOnly')
    expect(plan.triggerMs).toBe(ms('2026-11-03T03:30:00Z')) // 3 Nov 09:00 IST
    expect(plan.offsetMinutes).toBeUndefined()
  })

  it('a deadline with a supplied due time reminds 24 hours before that instant', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const dl = itemsOnDate(data, d(4)).find((i) => i.recordId === 'dl-homework-1')!
    expect(reminderPlan(dl, defaultReminderPrefs())!.triggerMs).toBe(ms('2026-11-05T11:30:00Z')) // 5 Nov 17:00 IST
  })

  it('classes are off by default and an explicit per-occurrence choice turns one on', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const klass = itemsOnDate(data, d(0)).find((i) => i.category === 'class')!
    expect(reminderPlan(klass, defaultReminderPrefs())!.enabled).toBe(false)
    const on: ReminderPrefs = {
      ...defaultReminderPrefs(),
      overrides: { [klass.key]: { enabled: true, offsetMinutes: 30 } },
    }
    const plan = reminderPlan(klass, on)!
    expect(plan).toMatchObject({ enabled: true, source: 'override', offsetMinutes: 30 })
    expect(plan.triggerMs).toBe(ms('2026-11-02T03:00:00Z')) // 09:00 IST class − 30 min = 08:30 IST
    const off: ReminderPrefs = { ...on, overrides: { [klass.key]: { enabled: false } } }
    expect(reminderCandidates(data, off, d(0), d(0)).some((c) => c.item.key === klass.key)).toBe(
      false,
    )
  })

  it('C-T21: a rescheduled occurrence has exactly one pending reminder (the new one); a cancelled one has none', async () => {
    const env = makeRepo()
    await env.repo.saveSeries('demo-student-a', {
      id: 'series-mine',
      title: 'Weekly review',
      category: 'personal',
      timing: { kind: 'timed', start: t('18:00'), end: t('19:00') },
      blocksTime: true,
      rule: { freq: 'weekly', interval: 1, startDate: env.d(0), endDate: env.d(28) },
    })
    const prefs = defaultReminderPrefs()
    const pending = async () =>
      reminderCandidates(await env.load(), prefs, env.d(0), env.d(14)).filter(
        (c) => c.item.seriesId === 'series-mine',
      )

    const before = await pending()
    expect(before).toHaveLength(3) // d0, d7, d14
    const original = before.find((c) => c.item.date === env.d(7))!

    await env.repo.saveException('demo-student-a', {
      seriesId: 'series-mine',
      originalDate: env.d(7),
      action: 'rescheduled',
      replacement: { date: env.d(8), start: t('20:00'), end: t('21:00') },
    })
    const after = await pending()
    expect(after).toHaveLength(3)
    const moved = after.find((c) => c.item.key === original.item.key)!
    expect(moved.key).not.toBe(original.key) // trigger time is part of the key: old pending reminder is gone
    expect(moved.triggerMs).toBe(ms('2026-11-10T14:15:00Z')) // 10 Nov 19:45 IST (20:00 − 15 min)
    expect(after.filter((c) => c.key === original.key)).toHaveLength(0)

    await env.repo.saveException('demo-student-a', {
      seriesId: 'series-mine',
      originalDate: env.d(7),
      action: 'cancelled',
    })
    expect((await pending()).some((c) => c.item.key === original.item.key)).toBe(false)
  })

  it('C-T20: a reminder that came due while the app was closed is never replayed or back-dated', async () => {
    const env = makeRepo()
    await env.repo.saveEvent('demo-student-a', {
      id: 'ev-early',
      title: 'Early event',
      category: 'personal',
      date: env.d(0),
      timing: { kind: 'timed', start: t('11:00'), end: t('12:00') },
      blocksTime: true,
    })
    const candidates = reminderCandidates(
      await env.load(),
      defaultReminderPrefs(),
      env.d(-1),
      env.d(3),
    ).filter((c) => c.item.recordId === 'ev-early')
    const triggerMs = candidates[0]!.triggerMs // 10:45 IST
    // The app opens at 10:50 IST and only looks at the span since it started running.
    const opened = triggerMs + 5 * 60_000
    expect(dueReminders(candidates, new Set(), opened, opened + 30_000)).toEqual([])
  })

  it('the master switch disables every reminder', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    expect(
      reminderCandidates(data, { ...defaultReminderPrefs(), enabled: false }, d(0), d(10)),
    ).toEqual([])
  })

  it('cancelled bookings and completed tasks never produce reminders', async () => {
    const { load, d } = makeRepo()
    const data = await load()
    const items = [...itemsOnDate(data, d(4)), ...itemsOnDate(data, d(-2))]
    const cancelledBooking = items.find(
      (i) => i.recordKind === 'booking' && i.status === 'cancelled',
    )!
    expect(reminderPlan(cancelledBooking, defaultReminderPrefs())).toBeNull()
    const done = items.find(
      (i) => i.recordKind === 'task' && i.taskState === 'personallyCompleted',
    )!
    expect(
      reminderPlan(done, {
        ...defaultReminderPrefs(),
        rules: { ...defaultReminderPrefs().rules, task: { enabled: true, daysBefore: 1 } },
      }),
    ).toBeNull()
  })

  it('date helper sanity', () => {
    expect(parseDateOnly('2026-11-03')).toBe('2026-11-03')
  })
})
