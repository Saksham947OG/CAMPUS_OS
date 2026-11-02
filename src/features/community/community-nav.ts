// Section tabs and club-specific wording for the Community pages.
export const communityTabs = [
  { id: 'hub', label: 'Overview', to: '/community' },
  { id: 'lost-found', label: 'Lost & Found', to: '/community/lost-found' },
  { id: 'clubs', label: 'Clubs', to: '/community/clubs' },
  { id: 'sports', label: 'Sports & Teams', to: '/community/sports-events' },
]

export const clubStatusLabel = {
  requested: 'Request recorded (not sent to anyone)',
  alternativeProposed: 'Alternative time proposed (simulated club representative)',
  alternativeAccepted: 'You accepted the alternative; awaiting demo confirmation',
  acceptedDemo: 'Accepted in demo (simulated club representative)',
  rejectedDemo: 'Declined in demo',
  withdrawn: 'Withdrawn',
  cancellationRequested: 'Cancellation requested',
  cancelledDemo: 'Cancelled in demo',
  completedDemo: 'Marked completed in demo',
} as const
