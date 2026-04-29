// Centralized event name constants used by the platform.
//
// Outbound events are emitted by this service when domain state changes.
// Inbound events are consumed from other services (in production via a
// message broker; here via @nestjs/event-emitter for local parity).

export const ENROLLMENT_EVENTS = {
  CREATED: 'enrollment.created',
  DROPPED: 'enrollment.dropped',
  WITHDRAWN: 'enrollment.withdrawn',
  STATUS_CHANGED: 'enrollment.status_changed',
  OVERRIDE: 'enrollment.override',
} as const;

export const WAITLIST_EVENTS = {
  JOINED: 'waitlist.joined',
  PROMOTED: 'waitlist.promoted',
  LEFT: 'waitlist.left',
  EXPIRED: 'waitlist.expired',
} as const;

export const COURSE_CAPACITY_EVENTS = {
  FULL: 'course.capacity_full',
  CHANGED: 'course.capacity_changed',
} as const;

export const STUDENT_LOAD_EVENTS = {
  OVERLOADED: 'student.overloaded',
} as const;

export const REGISTRATION_WINDOW_EVENTS = {
  OPENED: 'registration.term_opened',
  CLOSED: 'registration.term_closed',
  UPDATED: 'registration.window_updated',
} as const;

// Inbound (consumed) events — hand-off points for broker adapter.
export const INBOUND_EVENTS = {
  COURSE_UPDATED: 'course.updated',
  COURSE_ARCHIVED: 'course.archived',
  STUDENT_STATUS_CHANGED: 'student.status_changed',
  REGISTRATION_TERM_OPENED: 'registration.term_opened',
  FINANCE_HOLD_PLACED: 'finance.hold_placed',
  FINANCE_HOLD_CLEARED: 'finance.hold_cleared',
} as const;
