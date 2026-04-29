import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../../strategies/jwt-access.strategy';

/**
 * Resolves the canonical student id from a JWT payload.
 * - Prefers payload.studentId (mapped student domain id)
 * - Falls back to payload.sub (auth user id) when not provided
 *
 * Throws if the actor is not a Student.
 */
export function requireStudentId(user: JwtPayload): string {
  if (user.role !== 'Student') {
    throw new ForbiddenException('Only students can access this resource');
  }
  const id = user.studentId || user.sub;
  if (!id) {
    throw new ForbiddenException('Token missing student identifier');
  }
  return id;
}

/**
 * Returns the studentId for the actor when role is Student,
 * otherwise null. Use for routes shared between admin and self-service.
 */
export function studentIdOrNull(user: JwtPayload): string | null {
  if (user.role !== 'Student') return null;
  return user.studentId || user.sub || null;
}
