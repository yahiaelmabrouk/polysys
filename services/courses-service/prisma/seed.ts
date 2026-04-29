import {
  PrismaClient,
  CourseLevel,
  SemesterType,
  DeliveryMode,
  CourseStatus,
  PrerequisiteType,
  AssignmentStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_USER_ID = '00000000-0000-0000-0000-000000000001';

async function main() {
  console.log('Seeding courses-service database...');

  // ─── Departments ──────────────────────────────────────────────────────────
  const cs = await prisma.department.upsert({
    where: { code: 'CS' },
    update: {},
    create: {
      code: 'CS',
      name: 'Computer Science',
      description: 'Department of Computer Science and Software Engineering',
      facultyName: 'Faculty of Engineering & Science',
    },
  });

  const math = await prisma.department.upsert({
    where: { code: 'MATH' },
    update: {},
    create: {
      code: 'MATH',
      name: 'Mathematics',
      description: 'Department of Mathematics',
      facultyName: 'Faculty of Engineering & Science',
    },
  });

  // ─── Subjects ─────────────────────────────────────────────────────────────
  const programming = await prisma.subject.upsert({
    where: { code: 'PROG' },
    update: {},
    create: {
      code: 'PROG',
      name: 'Programming',
      description: 'Programming languages and paradigms',
      departmentId: cs.id,
    },
  });

  const algebra = await prisma.subject.upsert({
    where: { code: 'ALG' },
    update: {},
    create: {
      code: 'ALG',
      name: 'Algebra',
      description: 'Linear and abstract algebra',
      departmentId: math.id,
    },
  });

  // ─── Courses ──────────────────────────────────────────────────────────────
  const cs101 = await prisma.course.upsert({
    where: { courseCode: 'CS101' },
    update: {},
    create: {
      courseCode: 'CS101',
      title: 'Introduction to Programming',
      slug: 'cs101-intro-programming',
      subjectId: programming.id,
      departmentId: cs.id,
      description: 'Foundational course covering variables, control flow, functions and data structures.',
      credits: 3,
      level: CourseLevel.L100,
      semesterType: SemesterType.ALL,
      capacityDefault: 60,
      durationWeeks: 15,
      language: 'English',
      deliveryMode: DeliveryMode.ONSITE,
      status: CourseStatus.ACTIVE,
      createdByUserId: ADMIN_USER_ID,
      tags: {
        create: [{ tagName: 'beginner' }, { tagName: 'mandatory' }],
      },
    },
  });

  const cs201 = await prisma.course.upsert({
    where: { courseCode: 'CS201' },
    update: {},
    create: {
      courseCode: 'CS201',
      title: 'Data Structures',
      slug: 'cs201-data-structures',
      subjectId: programming.id,
      departmentId: cs.id,
      description: 'Linear and non-linear data structures, complexity analysis.',
      credits: 4,
      level: CourseLevel.L200,
      semesterType: SemesterType.FALL,
      capacityDefault: 50,
      durationWeeks: 15,
      language: 'English',
      deliveryMode: DeliveryMode.HYBRID,
      status: CourseStatus.ACTIVE,
      createdByUserId: ADMIN_USER_ID,
      tags: {
        create: [{ tagName: 'core' }, { tagName: 'lab' }],
      },
    },
  });

  await prisma.course.upsert({
    where: { courseCode: 'MATH201' },
    update: {},
    create: {
      courseCode: 'MATH201',
      title: 'Linear Algebra',
      slug: 'math201-linear-algebra',
      subjectId: algebra.id,
      departmentId: math.id,
      description: 'Vector spaces, matrices, eigenvalues.',
      credits: 3,
      level: CourseLevel.L200,
      semesterType: SemesterType.SPRING,
      capacityDefault: 80,
      durationWeeks: 15,
      language: 'English',
      deliveryMode: DeliveryMode.ONSITE,
      status: CourseStatus.ACTIVE,
      createdByUserId: ADMIN_USER_ID,
    },
  });

  // ─── Prerequisites: CS201 requires CS101 with min C ───────────────────────
  await prisma.coursePrerequisite.upsert({
    where: {
      courseId_prerequisiteCourseId_type: {
        courseId: cs201.id,
        prerequisiteCourseId: cs101.id,
        type: PrerequisiteType.REQUIRED,
      },
    },
    update: {},
    create: {
      courseId: cs201.id,
      prerequisiteCourseId: cs101.id,
      type: PrerequisiteType.REQUIRED,
      minimumGrade: 'C',
    },
  });

  // ─── Teacher assignment example ───────────────────────────────────────────
  await prisma.teacherAssignment.upsert({
    where: {
      courseId_academicTerm_sectionCode: {
        courseId: cs101.id,
        academicTerm: 'Fall 2026',
        sectionCode: 'A',
      },
    },
    update: {},
    create: {
      courseId: cs101.id,
      teacherUserId: '99999999-9999-9999-9999-999999999999',
      academicTerm: 'Fall 2026',
      sectionCode: 'A',
      maxStudents: 60,
      assignedByUserId: ADMIN_USER_ID,
      status: AssignmentStatus.ACTIVE,
    },
  });

  // ─── Catalog version ──────────────────────────────────────────────────────
  await prisma.catalogVersion.upsert({
    where: { versionName: '2026-2027' },
    update: {},
    create: {
      versionName: '2026-2027',
      effectiveFrom: new Date('2026-09-01'),
      isCurrent: true,
      notes: 'Initial seeded catalog version',
    },
  });

  console.log('Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
