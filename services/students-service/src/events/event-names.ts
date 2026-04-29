// Centralized event name constants used across the platform.
// Publishers and consumers must use these names to avoid typos.

export const STUDENT_EVENTS = {
  CREATED: 'student.created',
  UPDATED: 'student.updated',
  STATUS_CHANGED: 'student.status_changed',
} as const;

export const ATTENDANCE_EVENTS = {
  MARKED: 'attendance.marked',
  LOW_DETECTED: 'attendance.low_detected',
} as const;

export const ACADEMIC_EVENTS = {
  HISTORY_UPDATED: 'academic_history.updated',
} as const;

// Inbound events (consumed from other services)
export const INBOUND_EVENTS = {
  AUTH_STUDENT_CREATED: 'auth.student_created',
  GRADES_SEMESTER_CLOSED: 'grades.semester_closed',
  ENROLLMENT_STATUS_CHANGED: 'enrollment.status_changed',
} as const;
