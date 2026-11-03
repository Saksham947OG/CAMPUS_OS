/* The bars are styled with the design tokens, which the native meter and img elements cannot take. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role */
import { Clock, Users } from 'lucide-react'
import { Link } from 'react-router'
import { useAppStore } from '@/app/app-store'
import { useServices } from '@/app/services'
import { CapacityTable } from '@/components/capacity-note'
import { compositeRange, personaEvidence, potentialRange } from '@/data/campus/evidence'
import { CAPACITY_SOURCE, FACILITY_CAPACITY, type FacilityCapacity } from '@/domain/capacity'
import { useCampusWorld, type FacilityLoad } from '@/features/presence/use-campus-world'
import { cn } from '@/lib/utils'

/** Which Time Tax process each place's wait belongs to. */
const PROCESS: Record<string, string> = {
  mess: 'lunch',
  library: 'library',
  cabin: 'library',
  gym: 'gym',
  laundry: 'machines',
  chillSpot: 'chill-spot',
  classroom: 'classrooms',
  basketball: 'sports',
  badminton: 'sports',
  tableTennis: 'sports',
  pool: 'sports',
  snooker: 'sports',
}
const PATH: Record<string, string> = {
  mess: '/services/mess',
  library: '/bookings/library',
  cabin: '/bookings/library',
  gym: '/bookings/gym',
  laundry: '/services/laundry/machines',
  chillSpot: '/services/chill-spot',
  classroom: '/bookings/classrooms',
  musicRoom: '/bookings/music-room',
  basketball: '/bookings/sports?activity=basketball',
  badminton: '/bookings/badminton',
  tableTennis: '/bookings/sports?activity=tableTennis',
  pool: '/bookings/sports?activity=pool',
  snooker: '/bookings/sports?activity=snooker',
}

const range = (r: [number, number]) => (r[0] === r[1] ? `${r[0]} min` : `${r[0]}–${r[1]} min`)

function tone(fill: number) {
  if (fill >= 0.9) return { label: 'Likely queue', bar: 'bg-danger', text: 'text-danger' }
  if (fill >= 0.7) return { label: 'Getting busy', bar: 'bg-warning', text: 'text-warning' }
  return { label: 'Easy', bar: 'bg-teal', text: 'text-teal-strong' }
}

/** Fixed-capacity places: one dot per person for small groups, a scaled bar for large ones. */
function CapacityVisual({ c }: { c: FacilityCapacity }) {
  const n = c.people
  if (!n) return null
  if (n <= 10)
    return (
      <p className="flex flex-wrap gap-1" role="img" aria-label={`${n} people`}>
        {Array.from({ length: n }, (_, i) => (
          <Users key={i} className="size-4 text-teal-strong" aria-hidden="true" />
        ))}
      </p>
    )
  return (
    <div className="h-2 overflow-hidden rounded bg-mist" role="img" aria-label={`${n} people`}>
      <div className="h-full rounded bg-teal-strong" style={{ width: `${(n / 130) * 100}%` }} />
    </div>
  )
}

function LiveMeter({ load }: { load: FacilityLoad }) {
  const fill = load.capacity ? load.count / load.capacity : 0
  const t = tone(fill)
  return (
    <div>
      <div
        role="meter"
        aria-label={`${load.label}: ${load.count} of ${load.capacity}`}
        aria-valuemin={0}
        aria-valuemax={load.capacity}
        aria-valuenow={load.count}
        className="h-3 overflow-hidden rounded bg-mist"
      >
        <div className={cn('h-full rounded', t.bar)} style={{ width: `${fill * 100}%` }} />
      </div>
      <p className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
        <span>
          <strong className="text-lg tabular-nums">{load.count}</strong>
          <span className="text-ink-muted">
            {' '}
            / {load.capacity}{' '}
            {load.unit === 'rooms'
              ? 'rooms booked'
              : load.unit === 'machines'
                ? 'machines in use'
                : 'people now'}
          </span>
        </span>
        <span className={cn('font-semibold', t.text)}>{t.label}</span>
      </p>
      <p className="text-xs text-ink-muted">
        {load.simulated ? 'Simulated headcount' : 'From the recorded class and booking schedule'}
      </p>
    </div>
  )
}

/**
 * The Services capacity section: how many each place holds, how full it is right now (simulation, or the
 * recorded schedule for classrooms), and what a wait there costs the active persona in Time Tax terms.
 */
export function CapacityBoard() {
  const world = useCampusWorld()
  const { sourceData } = useServices()
  const profileId = useAppStore((s) => s.activeProfileId)
  const evidence = sourceData ? personaEvidence(profileId) : []
  const composite = compositeRange(evidence)
  const counted = evidence.filter((e) => e.includeInComposite).length
  const live = (key: string) => world?.loads.find((l) => l.capacityKey === key)
  const busiest = [...(world?.loads ?? [])]
    .filter((l) => l.capacityKey && l.capacity > 0)
    .sort((a, b) => b.count / b.capacity - a.count / a.capacity)[0]

  const rows = [...FACILITY_CAPACITY].sort(
    (a, b) => Number(Boolean(live(b.key))) - Number(Boolean(live(a.key))),
  )
  return (
    <section aria-labelledby="capacity-board-h" className="max-w-5xl">
      <h2 id="capacity-board-h" className="font-display text-xl font-semibold text-ink">
        How full is campus, and what does a wait cost?
      </h2>
      <p className="mt-1 text-sm text-ink-muted">
        {CAPACITY_SOURCE}. Capacity is a reference figure. The live bars are a visible simulation
        (classrooms use the recorded schedule), not a measured headcount.
      </p>
      {composite ? (
        <p className="mt-3 rounded-md bg-teal-tint p-3 text-sm text-ink">
          <strong>Time Tax at stake: {range(composite)}</strong> of potential reduction across your{' '}
          {counted} selected processes.{' '}
          {busiest && busiest.count / busiest.capacity >= 0.7 ? (
            <>
              Busiest right now: <strong>{busiest.label}</strong> ({busiest.count}/
              {busiest.capacity}) — a good moment to book ahead or go later.{' '}
            </>
          ) : null}
          <Link to="/time-tax" className="font-medium underline">
            Open Time Tax
          </Link>
        </p>
      ) : null}
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((c) => {
          const load = live(c.key)
          const proc = evidence.find((e) => e.id === PROCESS[c.key])
          const potential = proc ? potentialRange(proc) : null
          return (
            <li
              key={c.key}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-card"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 id={`cap-${c.key}`} className="font-semibold text-ink">
                  <span aria-hidden="true">{load?.icon ?? ''}</span> {c.label}
                </h3>
                <Link
                  to={PATH[c.key] ?? '/services'}
                  aria-describedby={`cap-${c.key}`}
                  className="text-sm font-medium text-coffee underline"
                >
                  Details
                </Link>
              </div>
              <p className="text-sm">
                <span className="text-ink-muted">Holds </span>
                <strong>{c.text}</strong>
              </p>
              {load ? <LiveMeter load={load} /> : <CapacityVisual c={c} />}
              {sourceData && proc ? (
                <p className="mt-auto flex items-start gap-1.5 rounded-md bg-mist p-2 text-xs">
                  <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {proc.baseline && proc.target && potential ? (
                    <span>
                      <strong>Time Tax · {proc.label}:</strong> {range(proc.baseline)} wait → target{' '}
                      {range(proc.target)}, up to <strong>{range(potential)}</strong> back (
                      {proc.basis === 'reported' ? 'reported' : 'planning figure'}).
                    </span>
                  ) : (
                    <span>
                      <strong>Time Tax · {proc.label}:</strong> no wait has been measured yet.
                    </span>
                  )}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-ink">Show as a table</summary>
        <div className="mt-2">
          <CapacityTable />
        </div>
      </details>
    </section>
  )
}
