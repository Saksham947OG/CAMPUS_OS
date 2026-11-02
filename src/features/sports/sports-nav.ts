export const bookingTabs = [
  { id: 'hub', label: 'Overview', to: '/bookings' },
  { id: 'gym', label: 'Gym', to: '/bookings/gym' },
  { id: 'badminton', label: 'Badminton', to: '/bookings/badminton' },
  { id: 'sports', label: 'Other sports', to: '/bookings/sports' },
  { id: 'library', label: 'Library', to: '/bookings/library' },
  { id: 'music', label: 'Music Room', to: '/bookings/music-room' },
  { id: 'chill', label: 'Chill Zone', to: '/bookings/chill-zone' },
  { id: 'classrooms', label: 'Classrooms', to: '/bookings/classrooms' },
  { id: 'my', label: 'My bookings', to: '/bookings/my' },
  { id: 'waitlist', label: 'Waitlists', to: '/bookings/waitlist' },
]

/** Where a booking of each kind is made, so a finished or cancelled booking can offer "Book again". */
export const bookPathFor: Record<string, string> = {
  gym: '/bookings/gym',
  badminton: '/bookings/badminton',
  library: '/bookings/library',
  musicRoom: '/bookings/music-room',
  chillZone: '/bookings/chill-zone',
  tableTennis: '/bookings/sports?activity=tableTennis',
  pool: '/bookings/sports?activity=pool',
  snooker: '/bookings/sports?activity=snooker',
  basketball: '/bookings/sports?activity=basketball',
}
