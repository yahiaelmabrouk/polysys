import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Assessment, Grade } from '@prisma/client';
import { JwtPayload } from '../strategies/jwt-access.strategy';
import { AssessmentsService } from '../assessments/assessments.service';
import { GradesRepository } from '../grades/grades.repository';
import { CoursesClient } from '../clients/courses.client';
import { EnrollmentClient } from '../clients/enrollment.client';

export interface GradebookCell {
  assessmentId: string;
  gradeId: string | null;
  rawScore: number | null;
  percentageScore: number | null;
  letterGrade: string | null;
  status: Grade['status'] | null;
}

export interface GradebookRow {
  studentId: string;
  enrollmentId?: string | null;
  enrollmentStatus?: string;
  cells: GradebookCell[];
  weightedTotal: number; // out of 100; only counts published grades
  coverage: number;      // % of total weight already graded (published)
}

export interface GradebookView {
  courseId: string;
  academicTerm: string;
  sectionCode: string | null;
  assessments: Array<{
    id: string;
    title: string;
    type: Assessment['type'];
    maxScore: number;
    weightPercentage: number;
    status: Assessment['status'];
  }>;
  rows: GradebookRow[];
  weightTotal: number; // sum of weight of non-archived assessments
}

@Injectable()
export class GradebookService {
  private readonly logger = new Logger(GradebookService.name);

  constructor(
    private readonly assessments: AssessmentsService,
    private readonly grades: GradesRepository,
    private readonly coursesClient: CoursesClient,
    private readonly enrollmentClient: EnrollmentClient,
  ) {}

  async getGradebook(
    courseId: string,
    academicTerm: string,
    sectionCode: string | undefined,
    actor: JwtPayload,
  ): Promise<GradebookView> {
    const course = await this.coursesClient.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');

    if (actor.role === 'Teacher') {
      const ok = await this.coursesClient.isTeacherAssignedToCourse(
        actor.sub,
        courseId,
        academicTerm,
        sectionCode,
      );
      if (!ok) {
        throw new ForbiddenException('Teacher is not assigned to this course');
      }
    } else if (actor.role !== 'Admin') {
      throw new ForbiddenException('Only Teachers and Admins can view gradebooks');
    }

    const assessments = await this.assessments.findForCourseTerm(
      courseId,
      academicTerm,
      sectionCode,
    );
    const activeAssessments = assessments.filter((a) => a.status !== 'ARCHIVED');
    const weightTotal = activeAssessments.reduce(
      (s, a) => s + Number(a.weightPercentage),
      0,
    );

    const roster = await this.enrollmentClient.getRoster(
      courseId,
      academicTerm,
      sectionCode,
    );

    // Pull all grades for these assessments in one shot
    const gradesByKey = new Map<string, Grade>();
    for (const a of activeAssessments) {
      const list = await this.grades.findManyByAssessment(a.id);
      for (const g of list) {
        gradesByKey.set(`${a.id}::${g.studentId}`, g);
      }
    }

    const rows: GradebookRow[] = roster.map((r) => {
      let weighted = 0;
      let coverage = 0;
      const cells: GradebookCell[] = activeAssessments.map((a) => {
        const g = gradesByKey.get(`${a.id}::${r.studentId}`) ?? null;
        if (g && g.status === 'PUBLISHED') {
          weighted +=
            (Number(g.percentageScore) * Number(a.weightPercentage)) / 100;
          coverage += Number(a.weightPercentage);
        }
        return {
          assessmentId: a.id,
          gradeId: g?.id ?? null,
          rawScore: g ? Number(g.rawScore) : null,
          percentageScore: g ? Number(g.percentageScore) : null,
          letterGrade: g?.letterGrade ?? null,
          status: g?.status ?? null,
        };
      });
      return {
        studentId: r.studentId,
        enrollmentId: r.id,
        enrollmentStatus: r.status,
        cells,
        weightedTotal: Math.round(weighted * 100) / 100,
        coverage: Math.round(coverage * 100) / 100,
      };
    });

    return {
      courseId,
      academicTerm,
      sectionCode: sectionCode ?? null,
      assessments: activeAssessments.map((a) => ({
        id: a.id,
        title: a.title,
        type: a.type,
        maxScore: Number(a.maxScore),
        weightPercentage: Number(a.weightPercentage),
        status: a.status,
      })),
      rows,
      weightTotal: Math.round(weightTotal * 100) / 100,
    };
  }
}
