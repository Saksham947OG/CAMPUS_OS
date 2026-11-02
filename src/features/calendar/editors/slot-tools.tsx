import { TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatTime, type LocalTime } from '@/lib/time'
import { addMinutes, type useSlotTools } from './slot-utils'

/** Visible warning with the three choices from COS-CAL-001 §11: Edit time, Find candidate gap, Save anyway. */
export function ConflictWarning({
  tools,
  onApplyGap,
  onEditTime,
}: {
  tools: ReturnType<typeof useSlotTools>
  onApplyGap: (start: LocalTime, end: LocalTime) => void
  onEditTime: () => void
}) {
  const { conflicts, gaps, duration, showGaps, setShowGaps, acknowledged } = tools
  if (conflicts.length === 0) return null
  return (
    <div
      role="alert"
      className="rounded-md border border-border-strong bg-terracotta-tint p-3 text-sm text-ink"
    >
      <p className="flex items-center gap-2 font-semibold">
        <TriangleAlert className="size-4" aria-hidden="true" /> This overlaps another commitment
      </p>
      <ul className="mt-1 list-disc pl-5">
        {conflicts.map((c) => (
          <li key={c.key}>
            {c.title} (
            {c.time.kind === 'timed' ? `${formatTime(c.time.start)}–${formatTime(c.time.end)}` : ''}
            ){c.verification === 'tentative' ? ', tentative' : ''}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-ink-muted">
        Nothing will be moved or removed. You decide what to do.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" onClick={onEditTime}>
          Edit time
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setShowGaps(!showGaps)}
          aria-expanded={showGaps}
        >
          Find candidate gap
        </Button>
        {!acknowledged ? (
          <p className="self-center text-xs text-ink-muted">Or choose “Save anyway” below.</p>
        ) : (
          <p className="self-center text-xs font-medium">Saving with the overlap.</p>
        )}
      </div>
      {showGaps ? <GapList gaps={gaps} duration={duration} onApplyGap={onApplyGap} /> : null}
    </div>
  )
}

export function GapList({
  gaps,
  duration,
  onApplyGap,
}: {
  gaps: { start: LocalTime; end: LocalTime; minutes: number }[]
  duration: number
  onApplyGap: (start: LocalTime, end: LocalTime) => void
}) {
  if (gaps.length === 0) {
    return (
      <p className="mt-2 text-ink-muted">
        No gaps of {duration} minutes found in your recorded schedule for that day.
      </p>
    )
  }
  return (
    <ul className="mt-2 flex flex-col gap-1.5" aria-label="Open windows in your recorded schedule">
      {gaps.map((g) => {
        const end = addMinutes(g.start, duration)
        return (
          <li key={g.start}>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full justify-start"
              disabled={!end}
              onClick={() => end && onApplyGap(g.start, end)}
            >
              Open on your CampusOS calendar: {formatTime(g.start)}–{formatTime(g.end)}
              <span className="ml-1 text-ink-muted">
                (use {formatTime(g.start)}–{end ? formatTime(end) : ''})
              </span>
            </Button>
          </li>
        )
      })}
    </ul>
  )
}
