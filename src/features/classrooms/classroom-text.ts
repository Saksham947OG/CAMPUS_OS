import type { SlotStatus } from '@/domain/classrooms'

/** Text first, colour second: every status is spelled out. */
export function statusText(s: SlotStatus): { label: string; detail: string } {
  switch (s.kind) {
    case 'available':
      return {
        label: 'Available for this slot',
        detail: 'No conflict on this device schedule. This does not show the room is empty.',
      }
    case 'booked':
      return {
        label: s.mine ? 'Booked by you' : 'Booked',
        detail: `Booked until ${s.until} (recorded busy interval only).`,
      }
    case 'pending':
      return { label: 'Your request is pending', detail: 'Requested, not reserved.' }
    case 'blocked':
      return { label: 'Blocked', detail: `${s.label}, until ${s.until}.` }
    case 'unknown':
      return {
        label: 'Unknown / not synced',
        detail: 'The demo schedule does not cover this time, so it is not shown as free.',
      }
  }
}
