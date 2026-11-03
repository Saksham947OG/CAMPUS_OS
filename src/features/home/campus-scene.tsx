/* The illustration is an inline SVG with a text description in the figure caption. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { ArrowUpRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { useCampusWorld, type FacilityLoad } from '@/features/presence/use-campus-world'
import { useNow } from '@/hooks/use-now'
import { cn } from '@/lib/utils'

/** Light for the hour in the campus timezone: sky, ground, walls and whether windows glow. */
function light(hour: number) {
  if (hour >= 5 && hour < 7)
    return {
      name: 'Dawn',
      sky: ['#f4cfa5', '#f7e7c6'],
      ground: '#9fb48c',
      wall: '#e9d3b4',
      lit: false,
      sun: { x: 90, y: 96, c: '#f7b267' },
    }
  if (hour >= 7 && hour < 17)
    return {
      name: 'Daytime',
      sky: ['#bcdcec', '#eaf3ee'],
      ground: '#a9c597',
      wall: '#ecd9b8',
      lit: false,
      sun: { x: 520, y: 40, c: '#f7d679' },
    }
  if (hour >= 17 && hour < 19)
    return {
      name: 'Dusk',
      sky: ['#e59a73', '#f4d6a8'],
      ground: '#93a67f',
      wall: '#e3c5a2',
      lit: true,
      sun: { x: 560, y: 108, c: '#e8744f' },
    }
  return {
    name: 'Night',
    sky: ['#1d2e4a', '#3a4d6e'],
    ground: '#4d6b57',
    wall: '#a39c8d',
    lit: true,
    sun: { x: 540, y: 44, c: '#e9ecf4' },
  }
}

type Spot = {
  id: string
  label: string
  world: string | null
  x: number
  y: number
  w: number
  h: number
}
// Box positions are percentages of the 640×280 drawing; each is a real button over its building.
const SPOTS: Spot[] = [
  { id: 'library', label: 'Library', world: 'library', x: 4, y: 40, w: 20, h: 40 },
  { id: 'academic', label: 'Academic block', world: 'classrooms', x: 30, y: 28, w: 24, h: 52 },
  { id: 'mess', label: 'Mess', world: 'mess', x: 57, y: 50, w: 20, h: 30 },
  { id: 'hostel', label: 'Hostel and laundry', world: 'laundry', x: 80, y: 30, w: 17, h: 50 },
  { id: 'ground', label: 'Activity area and gym', world: 'gym', x: 36, y: 80, w: 28, h: 16 },
]

function stateText(load: FacilityLoad | undefined) {
  if (!load) return 'No live count here: a conceptual building, not a map.'
  const unit =
    load.unit === 'rooms'
      ? 'rooms booked'
      : load.unit === 'machines'
        ? 'machines in use'
        : 'people now'
  return `${load.count} of ${load.capacity} ${unit} · ${load.simulated ? 'an estimate, not a measured headcount' : 'from the recorded class and booking schedule'}`
}

/**
 * A small original campus illustration (design spec §7.2). It is conceptual: not a map, no routes, no travel
 * estimates. Light follows the hour in the campus timezone; selecting a building shows its service and state;
 * the same information is available by keyboard and touch. Counts are labelled as estimates.
 */
export function CampusScene({ className }: { className?: string }) {
  const now = useNow()
  const world = useCampusWorld()
  const L = light(now.hour)
  const [picked, setPicked] = useState<string | null>(null)
  const spot = SPOTS.find((s) => s.id === picked)
  const load = spot?.world ? world?.loads.find((l) => l.id === spot.world) : undefined
  const glow = L.lit ? '#f3e6b8' : '#cfe3ea'
  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <div className="relative overflow-hidden rounded-[var(--radius-lg)] border border-border bg-surface shadow-card">
        <svg
          viewBox="0 0 640 280"
          className="block h-auto w-full"
          role="img"
          aria-label={`Conceptual campus illustration at ${L.name.toLowerCase()}: library, academic block, mess, hostel and activity area.`}
        >
          <defs>
            <linearGradient id="scene-sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={L.sky[0]} />
              <stop offset="1" stopColor={L.sky[1]} />
            </linearGradient>
          </defs>
          <rect width="640" height="280" fill="url(#scene-sky)" />
          <circle cx={L.sun.x} cy={L.sun.y} r="20" fill={L.sun.c} opacity="0.95" />
          <g className="drift-a" opacity="0.9">
            <g className="float-a">
              <ellipse cx="150" cy="52" rx="34" ry="10" fill="#fff" opacity="0.8" />
              <ellipse cx="176" cy="46" rx="22" ry="9" fill="#fff" opacity="0.8" />
            </g>
          </g>
          <g className="float-b">
            <ellipse cx="410" cy="36" rx="28" ry="8" fill="#fff" opacity="0.7" />
            <ellipse cx="430" cy="31" rx="18" ry="7" fill="#fff" opacity="0.7" />
          </g>
          <path d="M0 214 Q150 188 320 206 T640 200 V280 H0 Z" fill={L.ground} />
          <path
            d="M60 280 Q220 232 340 232 T600 280"
            fill="none"
            stroke="#e8dcc3"
            strokeWidth="14"
            opacity="0.7"
          />
          {/* library: dome and columns */}
          <g>
            <rect x="26" y="124" width="116" height="86" rx="4" fill={L.wall} />
            <path d="M44 124 Q84 78 124 124 Z" fill="#a95138" />
            <rect x="80" y="70" width="8" height="12" fill="#a95138" />
            {[44, 66, 88, 110].map((x) => (
              <rect key={x} x={x} y="140" width="8" height="70" fill="#fffefb" opacity="0.85" />
            ))}
            <rect x="70" y="176" width="28" height="34" rx="14" fill="#246e65" />
          </g>
          {/* academic block */}
          <g>
            <rect x="192" y="100" width="156" height="112" rx="4" fill={L.wall} />
            <rect x="184" y="92" width="172" height="14" rx="3" fill="#246e65" />
            {[0, 1, 2].flatMap((r) =>
              [0, 1, 2, 3, 4].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={206 + c * 28}
                  y={118 + r * 26}
                  width="16"
                  height="16"
                  rx="2"
                  fill={glow}
                  opacity={L.lit ? 1 : 0.85}
                />
              )),
            )}
            <rect x="256" y="188" width="36" height="24" fill="#456c8a" />
          </g>
          {/* mess */}
          <g>
            <rect x="366" y="152" width="124" height="60" rx="4" fill={L.wall} />
            <path d="M360 152 L428 124 L496 152 Z" fill="#a95138" />
            <rect x="460" y="118" width="12" height="28" fill="#8a4b30" />
            <g className="float-a" opacity="0.7">
              <circle cx="466" cy="108" r="5" fill="#fff" />
              <circle cx="472" cy="98" r="4" fill="#fff" />
            </g>
            {[384, 416, 448].map((x) => (
              <rect key={x} x={x} y="170" width="20" height="16" rx="2" fill={glow} />
            ))}
            <rect x="408" y="188" width="24" height="24" rx="2" fill="#246e65" />
          </g>
          {/* hostel */}
          <g>
            <rect x="512" y="96" width="96" height="116" rx="4" fill={L.wall} />
            <rect x="506" y="88" width="108" height="10" rx="3" fill="#456c8a" />
            {[0, 1, 2, 3].flatMap((r) =>
              [0, 1, 2].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={526 + c * 28}
                  y={108 + r * 24}
                  width="14"
                  height="14"
                  rx="2"
                  fill={glow}
                  opacity={L.lit ? 1 : 0.85}
                />
              )),
            )}
            <rect x="550" y="190" width="20" height="22" fill="#246e65" />
          </g>
          {/* activity area */}
          <g>
            <ellipse cx="320" cy="252" rx="86" ry="18" fill="#8fb27a" />
            <ellipse
              cx="320"
              cy="252"
              rx="86"
              ry="18"
              fill="none"
              stroke="#fffefb"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <line
              x1="320"
              y1="234"
              x2="320"
              y2="270"
              stroke="#fffefb"
              strokeWidth="1.5"
              opacity="0.8"
            />
            <rect x="244" y="240" width="3" height="20" fill="#fffefb" />
            <rect x="393" y="240" width="3" height="20" fill="#fffefb" />
          </g>
          <g className="float-b" opacity="0.95">
            <path d="M560 62 L596 52 L574 70 Z" fill="#fffefb" stroke="#456c8a" strokeWidth="1.2" />
          </g>
        </svg>
        {SPOTS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setPicked(s.id)}
            onMouseEnter={() => setPicked(s.id)}
            aria-pressed={picked === s.id}
            aria-label={`${s.label}. ${stateText(s.world ? world?.loads.find((l) => l.id === s.world) : undefined)}`}
            style={{ left: `${s.x}%`, top: `${s.y}%`, width: `${s.w}%`, height: `${s.h}%` }}
            className={cn(
              'absolute rounded-xl border-2 border-transparent transition-colors hover:border-teal focus-visible:border-teal',
              picked === s.id && 'border-teal bg-teal/10',
            )}
          />
        ))}
      </div>
      <figcaption className="text-xs text-ink-muted">
        <span className="font-medium text-ink">{L.name} on campus.</span> A conceptual illustration,
        not a map.{' '}
        {spot ? (
          <span className="mt-1 flex flex-wrap items-center gap-x-2 rounded-xl bg-teal-tint p-2 text-ink">
            <strong>{spot.label}:</strong> {stateText(load)}
            {load ? (
              <Link
                to={load.path}
                className="inline-flex min-h-9 items-center gap-1 font-medium text-coffee underline"
              >
                Open <ArrowUpRight className="size-3.5" aria-hidden="true" />
              </Link>
            ) : null}
          </span>
        ) : (
          'Select a building to see its service.'
        )}
      </figcaption>
    </figure>
  )
}
