import { Injectable } from '@nestjs/common';
import { EnrollmentsRepository } from '../enrollments/enrollments.repository';
import { WaitlistsService } from '../waitlists/waitlists.service';

@Injectable()
export class RosterService {
  constructor(
    private readonly enrollments: EnrollmentsRepository,
    private readonly waitlists: WaitlistsService,
  ) {}

  /**
   * Roster of currently-enrolled students for a course/term/(section).
   * The student object is intentionally minimal; downstream consumers
   * (e.g. the Gateway) join with Students Service for richer profile data.
   */
  async getRoster(
    courseId: string,
    academicTerm: string,
    sectionCode?: string,
  ) {
    const items = await this.enrollments.rosterFor(
      courseId,
      academicTerm,
      sectionCode,
    );
    return {
      courseId,
      academicTerm,
      sectionCode: sectionCode ?? null,
      total: items.length,
      students: items.map((e) => ({
        enrollmentId: e.id,
        studentId: e.studentId,
        sectionCode: e.sectionCode,
        gradingOption: e.gradingOption,
        creditsSnapshot: Number(e.creditsSnapshot),
        enrolledAt: e.enrolledAt,
      })),
    };
  }

  getWaitlist(
    courseId: string,
    academicTerm: string,
    sectionCode?: string,
    page = 1,
    limit = 50,
  ) {
    return this.waitlists.listForCourse(
      courseId,
      academicTerm,
      sectionCode,
      page,
      limit,
    );
  }
}
