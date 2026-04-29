/**
 * Enrollment Service seed.
 *
 * Seeds a single sample registration window so the service can run end-to-end
 * in dev environments. Capacities are owned by capacity snapshots and are
 * created on demand by the enrollment flow; we don't fabricate course IDs here
 * because the source of truth lives in Courses Service.
 */
import { PrismaClient, RegistrationRoleScope } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const term = process.env.SEED_ACADEMIC_TERM || '2026-fall';

  const opensAt = new Date();
  const closesAt = new Date(opensAt.getTime() + 60 * 24 * 60 * 60 * 1000); // +60d
  const dropDeadline = new Date(opensAt.getTime() + 30 * 24 * 60 * 60 * 1000); // +30d
  const withdrawDeadline = new Date(opensAt.getTime() + 90 * 24 * 60 * 60 * 1000); // +90d

  await prisma.registrationWindow.upsert({
    where: {
      academicTerm_roleScope: {
        academicTerm: term,
        roleScope: RegistrationRoleScope.STUDENT,
      },
    },
    update: {},
    create: {
      academicTerm: term,
      roleScope: RegistrationRoleScope.STUDENT,
      opensAt,
      closesAt,
      dropDeadline,
      withdrawDeadline,
      isActive: true,
    },
  });

  await prisma.registrationWindow.upsert({
    where: {
      academicTerm_roleScope: {
        academicTerm: term,
        roleScope: RegistrationRoleScope.ADMIN,
      },
    },
    update: {},
    create: {
      academicTerm: term,
      roleScope: RegistrationRoleScope.ADMIN,
      opensAt: new Date(opensAt.getTime() - 30 * 24 * 60 * 60 * 1000),
      closesAt: new Date(closesAt.getTime() + 30 * 24 * 60 * 60 * 1000),
      dropDeadline,
      withdrawDeadline,
      isActive: true,
    },
  });

  console.log(`Seeded registration windows for term=${term}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
