// Booking status model shared by My Bookings and the staff Dashboard.
export var STATUS_LABELS = {
  pending: 'Pending',
  progress: 'In Progress',
  ready: 'Ready for Pickup',
  done: 'Completed',
  cancelled: 'Cancelled'
};

// Allowed forward moves. Completed and Cancelled are terminal, so e.g.
// Completed -> Pending is rejected. A real backend must enforce the same rules.
var TRANSITIONS = {
  pending: ['progress', 'cancelled'],
  progress: ['ready', 'cancelled'],
  ready: ['done', 'cancelled'],
  done: [],
  cancelled: []
};

export function allowedNextStatuses(status) {
  return TRANSITIONS[status] ? TRANSITIONS[status].slice() : [];
}

export function canTransition(from, to) {
  return allowedNextStatuses(from).indexOf(to) !== -1;
}

// Customers may only cancel a booking the shop hasn't started on.
export function customerCanCancel(status) {
  return status === 'pending';
}
