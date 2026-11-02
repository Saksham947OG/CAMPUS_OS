import type { ProfileData } from '@/domain/records'
import type { DateOnly } from '@/lib/time'
import { itemsInRange } from './occurrences'

export interface Workload {
  deadlines: number
  incompleteTasks: number
  focusBlocks: number
}

/**
 * Verifiable counts only (COS-CAL-001 §6.5). No difficulty, hours, risk or stress score is inferred
 * from them.
 */
export function workloadFor(data: ProfileData, from: DateOnly, to: DateOnly): Workload {
  const items = itemsInRange(data, from, to).filter((i) => i.status !== 'cancelled')
  return {
    deadlines: items.filter((i) => i.recordKind === 'deadline').length,
    incompleteTasks: data.tasks.filter((t) => t.state !== 'personallyCompleted').length,
    focusBlocks: items.filter((i) => i.recordKind === 'focus').length,
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

export function workloadText(w: Workload, scope: string): string {
  return [
    `${plural(w.deadlines, 'deadline', 'deadlines')} ${scope}`,
    `${plural(w.incompleteTasks, 'incomplete task', 'incomplete tasks')}`,
    `${plural(w.focusBlocks, 'planned focus block', 'planned focus blocks')}`,
  ].join(' · ')
}
