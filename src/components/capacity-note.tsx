import { Users } from 'lucide-react'
import { CAPACITY_SOURCE, FACILITY_CAPACITY, capacityOf } from '@/domain/capacity'

/** One owner-supplied capacity line for a facility. It is a reference figure, never a live headcount. */
export function CapacityNote({ facility }: { facility: string }) {
  const c = capacityOf(facility)
  if (!c) return null
  return (
    <p
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-mist px-3 py-1 text-sm"
      title={`${CAPACITY_SOURCE}. Not a live headcount.`}
    >
      <Users className="size-4 text-coffee" aria-hidden="true" />
      <span className="text-ink-muted">Capacity</span>
      <strong>{c.text}</strong>
    </p>
  )
}

/** The full table, for the one place a person looks for "how many fit". */
export function CapacityTable() {
  return (
    <section
      aria-labelledby="capacity-h"
      className="max-w-3xl rounded-lg border border-border bg-surface p-4"
    >
      <h2 id="capacity-h" className="text-base font-semibold text-ink">
        How many people fit
      </h2>
      <p className="mb-2 text-sm text-ink-muted">
        {CAPACITY_SOURCE}. These are reference figures, not live occupancy.
      </p>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">Capacity by facility</caption>
        <thead>
          <tr className="border-b border-border text-ink-muted">
            <th scope="col" className="py-1 pr-3 font-medium">
              Facility
            </th>
            <th scope="col" className="py-1 font-medium">
              Capacity
            </th>
          </tr>
        </thead>
        <tbody>
          {FACILITY_CAPACITY.map((c) => (
            <tr key={c.key} className="border-b border-border last:border-0">
              <th scope="row" className="py-1.5 pr-3 font-medium">
                {c.label}
              </th>
              <td className="py-1.5">{c.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
