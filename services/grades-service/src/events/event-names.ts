// Centralized event name constants used across the platform.
// Publishers and consumers must use these names to avoid typos.

export const ASSESSMENT_EVENTS = {
  CREATED: 'assessment.created',
  UPDATED: 'assessment.updated',
  STATUS_CHANGED: 'assessment.status_changed',
} as const;

export const GRADE_EVENTS = {
  SUBMITTED: 'grades.submitted',
  PUBLISHED: 'grades.published',
  AMENDED: 'grades.amended',
  OVERRIDDEN: 'grades.overridden',
} as const;

export const RESULT_EVENTS = {
  COURSE_PUBLISHED: 'results.course_published',
  TERM_PUBLISHED: 'results.term_published',
} as const;

export const GPA_EVENTS = {
  UPDATED: 'gpa.updated',
  STANDING_CHANGED: 'gpa.standing_changed',
} as const;

export const TRANSCRIPT_EVENTS = {
  REQUESTED: 'transcript.requested',
  COMPLETED: 'transcript.completed',
  REJECTED: 'transcript.rejected',
} as const;

export const REGRADE_EVENTS = {
  REQUESTED: 'regrade.requested',
  REVIEWED: 'regrade.reviewed',
} as const;

export const STUDENT_RISK_EVENTS = {
  AT_RISK_DETECTED: 'student.at_risk_detected',
} as const;

// Inbound events (consumed from other services)
export const INBOUND_EVENTS = {
  ENROLLMENT_CREATED: 'enrollment.created',
  ENROLLMENT_WITHDRAWN: 'enrollment.withdrawn',
  COURSE_UPDATED: 'course.updated',
  TERM_CLOSED: 'term.closed',
} as const;
