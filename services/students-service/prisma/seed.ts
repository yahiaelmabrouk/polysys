import { PrismaClient, EnrollmentStatus, Gender, AttendanceStatus, AcademicStanding, ContactType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding students-service database...');

  const student = await prisma.student.upsert({
    where: { studentNumber: 'STU-2026-000001' },
    update: {},
    create: {
      authUserId: '11111111-1111-1111-1111-111111111111',
      studentNumber: 'STU-2026-000001',
      firstName: 'Alice',
      lastName: 'Johnson',
      dateOfBirth: new Date('2003-04-12'),
      gender: Gender.FEMALE,
      nationality: 'Tunisian',
      admissionDate: new Date('2024-09-01'),
      expectedGraduationDate: new Date('2028-06-30'),
      programName: 'Computer Science',
      currentLevel: 2,
      enrollmentStatus: EnrollmentStatus.ACTIVE,
      profile: {
        create: {
          addressLine1: '12 Avenue Habib Bourguiba',
          city: 'Tunis',
          stateRegion: 'Tunis',
          postalCode: '1000',
          country: 'Tunisia',
          emergencyContactName: 'Karim Johnson',
          emergencyContactPhone: '+21620000000',
          emergencyContactRelation: 'Father',
        },
      },
      contacts: {
        create: [
          { type: ContactType.EMAIL, label: 'Personal', value: 'alice@example.com', isPrimary: true },
          { type: ContactType.PHONE, label: 'Mobile', value: '+21655555555', isPrimary: true },
        ],
      },
    },
  });

  await prisma.academicHistory.upsert({
    where: { studentId_semesterName: { studentId: student.id, semesterName: 'Fall 2024' } },
    update: {},
    create: {
      studentId: student.id,
      semesterName: 'Fall 2024',
      creditsAttempted: 18,
      creditsCompleted: 18,
      gpa: 3.6,
      cgpa: 3.6,
      academicStanding: AcademicStanding.GOOD,
    },
  });

  await prisma.attendance.upsert({
    where: {
      studentId_courseId_sessionDate: {
        studentId: student.id,
        courseId: '00000000-0000-0000-0000-000000000001',
        sessionDate: new Date('2026-04-28'),
      },
    },
    update: {},
    create: {
      studentId: student.id,
      courseId: '00000000-0000-0000-0000-000000000001',
      sessionDate: new Date('2026-04-28'),
      status: AttendanceStatus.PRESENT,
      markedByUserId: '22222222-2222-2222-2222-222222222222',
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
