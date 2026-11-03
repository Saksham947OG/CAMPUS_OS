import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { EVENT_CATEGORIES } from '@/domain/records'
import { homeFilterGroups } from '@/domain/categories'
import type { HomePrefs } from '@/data/prefs/home-prefs'
import type { Course } from '@/domain/records'

const row = 'flex min-h-11 items-center gap-2.5 rounded-md px-1 text-sm text-ink'
const box = 'size-5 accent-[var(--accent-teal)]'

interface Props {
  open: boolean
  onOpenChange: (o: boolean) => void
  prefs: HomePrefs
  courses: readonly Course[]
  resultCount: number
  onChange: (fn: (p: HomePrefs) => HomePrefs) => void
}

/** Home schedule filters (COS-HOME-001 §7.1). They hide items from this card only; nothing is deleted. */
export function ScheduleFilterSheet({
  open,
  onOpenChange,
  prefs,
  courses,
  resultCount,
  onChange,
}: Props) {
  const f = prefs.filters
  const set = (patch: Partial<HomePrefs['filters']>) =>
    onChange((p) => ({ ...p, filters: { ...p.filters, ...patch } }))

  const groupOn = (cats: readonly string[]) => cats.every((c) => f.categories.includes(c as never))
  const toggleGroup = (cats: readonly string[]) =>
    set({
      categories: groupOn(cats)
        ? f.categories.filter((c) => !cats.includes(c))
        : [...new Set([...f.categories, ...(cats as never[])])],
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[min(24rem,100vw)] overflow-y-auto p-4">
        <SheetHeader className="p-0 pb-3">
          <SheetTitle>Filter schedule</SheetTitle>
          <SheetDescription>
            Applies to the schedule card only. Records are never changed.
          </SheetDescription>
        </SheetHeader>

        <output className="mb-3 block rounded-md bg-mist p-2 text-sm text-ink" aria-live="polite">
          {resultCount} {resultCount === 1 ? 'item matches' : 'items match'} for the selected period
        </output>

        <fieldset className="mb-3">
          <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            Categories
          </legend>
          {homeFilterGroups.map((g) => (
            <label key={g.id} className={row}>
              <input
                type="checkbox"
                className={box}
                checked={groupOn(g.categories)}
                onChange={() => toggleGroup(g.categories)}
              />
              {g.label}
            </label>
          ))}
        </fieldset>

        {courses.length > 0 ? (
          <fieldset className="mb-3">
            <legend className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Course
            </legend>
            {courses.map((c) => (
              <label key={c.id} className={row}>
                <input
                  type="checkbox"
                  className={box}
                  checked={f.courseIds.includes(c.id)}
                  onChange={() =>
                    set({
                      courseIds: f.courseIds.includes(c.id)
                        ? f.courseIds.filter((x) => x !== c.id)
                        : [...f.courseIds, c.id],
                    })
                  }
                />
                {c.code} · {c.title}
              </label>
            ))}
            <p className="px-1 text-xs text-ink-muted">
              With none selected, every course is shown.
            </p>
          </fieldset>
        ) : null}

        <div className="mb-3 grid gap-3 text-sm">
          <label className="flex flex-col gap-1">
            Event status
            <select
              className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
              value={f.verification}
              onChange={(e) =>
                set({ verification: e.target.value as HomePrefs['filters']['verification'] })
              }
            >
              <option value="all">All (unknown stays visible)</option>
              <option value="confirmed">Confirmed</option>
              <option value="tentative">Tentative</option>
            </select>
          </label>
          <label className="flex flex-col gap-1">
            Record origin
            <select
              className="min-h-11 rounded-md border border-border-strong bg-surface px-2"
              value={f.origin}
              onChange={(e) => set({ origin: e.target.value as HomePrefs['filters']['origin'] })}
            >
              <option value="all">All</option>
              <option value="provided">Supplied</option>
              <option value="demo">Planning data</option>
              <option value="personal">Personal</option>
            </select>
          </label>
          <label className={row}>
            <input
              type="checkbox"
              className={box}
              checked={f.showCompleted}
              onChange={(e) => set({ showCompleted: e.target.checked })}
            />
            Show completed tasks
          </label>
        </div>

        <Button
          variant="outline"
          className="min-h-11 w-full"
          onClick={() =>
            set({
              categories: [...EVENT_CATEGORIES],
              courseIds: [],
              verification: 'all',
              origin: 'all',
              showCompleted: true,
            })
          }
        >
          Clear filters
        </Button>
      </SheetContent>
    </Sheet>
  )
}
