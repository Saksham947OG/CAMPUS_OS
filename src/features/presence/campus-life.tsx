import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { facilities, type NPC } from './world'
import { useCampusWorld, type FacilityLoad } from './use-campus-world'
import { RealPresence } from './real-presence'
export function CampusLife() {
  const value = useCampusWorld()
  return value ? <CampusWorld {...value} /> : null
}
function CampusWorld({
  world,
  loads,
  paused,
  setPaused,
}: {
  world: readonly NPC[]
  loads: readonly FacilityLoad[]
  paused: boolean
  setPaused: (p: boolean | ((p: boolean) => boolean)) => void
}) {
  const [real, setReal] = useState(false),
    [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  const relevant = loads.find((f) => f.id !== 'campus' && pathname.startsWith(f.path))
  const recent = world.filter((p) => p.id % 31 === world[0]!.place % 31).slice(0, 4)
  const lead = relevant ? [relevant] : loads.slice(0, 3)
  return (
    <section
      className="mb-4 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
      aria-label="Campus activity"
    >
      <style>{`@keyframes campus-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-5px) rotate(3deg)}}.campus-avatar{animation:campus-bob 2.8s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.campus-avatar{animation:none}}`}</style>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-teal-tint px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-strong">
          Campus in motion · simulation
        </p>
        <ul className="flex flex-wrap gap-x-3 text-sm" aria-label="Simulated headcount">
          {lead.map((f) => (
            <li key={f.id}>
              {f.label}{' '}
              <strong className="tabular-nums">
                {f.count}/{f.capacity}
              </strong>
            </li>
          ))}
        </ul>
        <div className="ml-auto flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="min-h-9"
            aria-expanded={open}
            aria-controls="campus-life-detail"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide details' : 'Show all places'}
          </Button>
        </div>
      </div>
      {open ? (
        <div id="campus-life-detail">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 text-sm">
            <p>
              300 virtual students · {paused ? 'paused' : 'updates every 8 seconds'} · Student{' '}
              {String(recent[0]?.id ?? 0).padStart(3, '0')} is{' '}
              {facilities[recent[0]?.place ?? 0]!.action}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPaused((p) => !p)}>
                {paused ? 'Resume activity' : 'Pause activity'}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setReal((r) => !r)}>
                {real ? 'Hide location setup' : 'Real check-in setup'}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-7">
            {loads.map((f, i) => (
              <Link
                key={f.id}
                to={f.path}
                className="min-w-0 rounded-lg border border-border p-2 hover:bg-mist"
              >
                <span
                  aria-hidden="true"
                  className="campus-avatar inline-block text-xl"
                  style={{
                    animationDelay: `${i * -0.4}s`,
                    animationPlayState: paused ? 'paused' : 'running',
                  }}
                >
                  {f.icon}
                </span>
                <p className="mt-1 truncate text-xs font-medium">{f.label}</p>
                <p className="text-lg font-semibold tabular-nums">
                  {f.count}
                  <span className="text-xs font-normal text-ink-muted"> / {f.capacity}</span>
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded bg-mist">
                  <div
                    className="h-full bg-teal"
                    style={{ width: `${(f.count / f.capacity) * 100}%` }}
                  />
                </div>
              </Link>
            ))}
          </div>
          <details className="border-t border-border px-4 py-2">
            <summary className="cursor-pointer py-1 text-sm font-medium">
              Student activity stream · virtual characters
            </summary>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {recent.map((p) => (
                <li key={p.id} className="flex gap-2 rounded-md bg-mist p-2 text-sm">
                  <span aria-hidden="true" className="campus-avatar">
                    {['🧑‍🎓', '👩‍💻', '🧑‍🔬', '👨‍🎨'][p.id % 4]}
                  </span>
                  <span>
                    Student {String(p.id + 1).padStart(3, '0')} is {facilities[p.place]!.action} ·{' '}
                    {facilities[p.place]!.label}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-ink-muted">
              NPC activity is a visual simulation, separate from your bookings, equipment status and
              real check-ins. Library 130, mess 100, gym about 20, Chill Spot 30–40 and the
              laundry's 2 machines are owner-supplied capacities; the campus-wide limit is
              illustrative. Classrooms booked counts rooms with a timetabled class or a held booking
              right now, from the recorded schedule. Empty simulated places are not available
              reservation slots.
            </p>
          </details>
        </div>
      ) : null}
      {open && real ? (
        <div className="px-3 pb-3">
          <RealPresence />
        </div>
      ) : null}
    </section>
  )
}
