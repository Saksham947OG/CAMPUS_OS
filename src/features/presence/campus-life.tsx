import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useServices } from '@/app/services'
import { Button } from '@/components/ui/button'
import { facilities, initialWorld, advanceWorld } from './world'
import { RealPresence } from './real-presence'
export function CampusLife() {
  const { sourceData } = useServices()
  return sourceData ? <CampusWorld /> : null
}
function CampusWorld() {
  const [world, setWorld] = useState(initialWorld),
    [paused, setPaused] = useState(false),
    [real, setReal] = useState(false)
  const tick = useRef(0)
  const { pathname } = useLocation()
  useEffect(() => {
    if (paused) return
    const interval = setInterval(() => {
      if (!document.hidden) setWorld((w) => advanceWorld(w, ++tick.current))
    }, 8000)
    return () => clearInterval(interval)
  }, [paused])
  const counts = facilities.map((_, i) => world.filter((p) => p.place === i).length)
  const relevant = facilities.find((f) => pathname.startsWith(f.path))
  const recent = world.filter((p) => p.id % 31 === world[0]!.place % 31).slice(0, 4)
  return (
    <section
      className="mb-6 overflow-hidden rounded-xl border border-border bg-surface shadow-card"
      aria-label="Campus activity"
    >
      <style>{`@keyframes campus-bob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-5px) rotate(3deg)}}.campus-avatar{animation:campus-bob 2.8s ease-in-out infinite}@media(prefers-reduced-motion:reduce){.campus-avatar{animation:none}}`}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 bg-teal-tint px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-strong">
            Campus in motion · simulation
          </p>
          <p className="mt-1 text-sm">
            300 virtual students · {paused ? 'paused' : 'updates every 8 seconds'}
            {relevant
              ? ` · ${relevant.label}: ${counts[facilities.indexOf(relevant)]}/${relevant.capacity}`
              : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span aria-hidden="true" className="campus-avatar text-2xl">
            🧑‍🎓
          </span>
          <span>
            Student {String(recent[0]?.id ?? 0).padStart(3, '0')} ·{' '}
            {facilities[recent[0]?.place ?? 0]!.action}
          </span>
        </div>
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
        {facilities.map((f, i) => (
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
              {counts[i]}
              <span className="text-xs font-normal text-ink-muted"> / {f.capacity}</span>
            </p>
            <div className="mt-1 h-1 overflow-hidden rounded bg-mist">
              <div
                className="h-full bg-teal"
                style={{ width: `${(counts[i]! / f.capacity) * 100}%` }}
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
          real check-ins. Library 140 and mess 100 are owner-supplied reference capacities; other
          limits are illustrative. Empty simulated places are not available reservation slots.
        </p>
      </details>
      {real ? (
        <div className="px-3 pb-3">
          <RealPresence />
        </div>
      ) : null}
    </section>
  )
}
