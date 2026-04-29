// Centralized event name constants used across the platform.
// Publishers and consumers must use these names to avoid typos.

export const DEPARTMENT_EVENTS = {
  CREATED: 'department.created',
  UPDATED: 'department.updated',
} as const;

export const SUBJECT_EVENTS = {
  CREATED: 'subject.created',
  UPDATED: 'subject.updated',
} as const;

export const COURSE_EVENTS = {
  CREATED: 'course.created',
  UPDATED: 'course.updated',
  STATUS_CHANGED: 'course.status_changed',
  ARCHIVED: 'course.archived',
  DELETED: 'course.deleted',
  PREREQUISITE_CHANGED: 'course.prerequisite_changed',
} as const;

export const TEACHER_EVENTS = {
  ASSIGNED_TO_COURSE: 'teacher.assigned_to_course',
  ASSIGNMENT_UPDATED: 'teacher.assignment_updated',
  ASSIGNMENT_REMOVED: 'teacher.assignment_removed',
} as const;

// Inbound events (consumed from other services)
export const INBOUND_EVENTS = {
  AUTH_TEACHER_UPDATED: 'auth.teacher_updated',
  ACADEMIC_TERM_CREATED: 'academic_term.created',
} as const;
