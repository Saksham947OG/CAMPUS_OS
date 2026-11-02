export const facilities = [
  {
    id: 'library',
    label: 'Library',
    capacity: 130,
    icon: '📚',
    action: 'studying',
    path: '/bookings/library',
  },
  {
    id: 'mess',
    label: 'Mess',
    capacity: 100,
    icon: '🍽️',
    action: 'having a meal',
    path: '/services/mess',
  },
  {
    id: 'gym',
    label: 'Gym',
    capacity: 20,
    icon: '🏋️',
    action: 'working out',
    path: '/bookings/gym',
  },
  {
    id: 'classrooms',
    label: 'Classrooms',
    capacity: 70,
    icon: '🧑‍🏫',
    action: 'in a project meeting',
    path: '/bookings/classrooms',
  },
  {
    id: 'laundry',
    label: 'Laundry',
    capacity: 2,
    icon: '🧺',
    action: 'using a washing machine',
    path: '/services/laundry/machines',
  },
  {
    id: 'cafe',
    label: 'Chill Spot',
    capacity: 40,
    icon: '☕',
    action: 'collecting a snack',
    path: '/services/chill-spot',
  },
  {
    id: 'campus',
    label: 'Around campus',
    capacity: 300,
    icon: '🌳',
    action: 'walking between activities',
    path: '/calendar',
  },
] as const
export interface NPC {
  id: number
  place: number
}
export function initialWorld(): NPC[] {
  const distribution = [78, 64, 12, 48, 2, 16, 80]
  let id = 0
  return distribution.flatMap((count, place) =>
    Array.from({ length: count }, () => ({ id: id++, place })),
  )
}
export function advanceWorld(world: readonly NPC[], tick: number): NPC[] {
  const next = world.map((p) => ({ ...p }))
  const counts = facilities.map((_, i) => next.filter((p) => p.place === i).length)
  for (let n = 0; n < 5; n++) {
    const person = next[(tick * 17 + n * 43) % next.length]!
    const destination = (person.place + 1 + n) % facilities.length
    if (destination !== person.place && counts[destination]! < facilities[destination]!.capacity) {
      counts[person.place]!--
      counts[destination]!++
      person.place = destination
    }
  }
  return [...next.slice(1), next[0]!]
}
export function distanceMetres(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const rad = (x: number) => (x * Math.PI) / 180
  const dlat = rad(b.latitude - a.latitude),
    dlon = rad(b.longitude - a.longitude)
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dlon / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}
export function boundaryState(
  distance: number,
  accuracy: number,
  radius: number,
): 'inside' | 'outside' | 'uncertain' {
  if (
    !Number.isFinite(distance) ||
    !Number.isFinite(accuracy) ||
    accuracy < 0 ||
    accuracy > Math.min(50, radius / 2)
  )
    return 'uncertain'
  if (distance + accuracy < radius) return 'inside'
  if (distance - accuracy > radius + 20) return 'outside'
  return 'uncertain'
}
