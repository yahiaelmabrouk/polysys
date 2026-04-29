import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

interface ScaleBand {
  letterGrade: string;
  minPercentage: number;
  maxPercentage: number;
  gradePoints: number;
}

const DEFAULT_SCALE: ScaleBand[] = [
  { letterGrade: 'A',  minPercentage: 90, maxPercentage: 100, gradePoints: 4.0 },
  { letterGrade: 'A-', minPercentage: 87, maxPercentage: 89,  gradePoints: 3.7 },
  { letterGrade: 'B+', minPercentage: 83, maxPercentage: 86,  gradePoints: 3.3 },
  { letterGrade: 'B',  minPercentage: 80, maxPercentage: 82,  gradePoints: 3.0 },
  { letterGrade: 'B-', minPercentage: 77, maxPercentage: 79,  gradePoints: 2.7 },
  { letterGrade: 'C+', minPercentage: 73, maxPercentage: 76,  gradePoints: 2.3 },
  { letterGrade: 'C',  minPercentage: 70, maxPercentage: 72,  gradePoints: 2.0 },
  { letterGrade: 'C-', minPercentage: 67, maxPercentage: 69,  gradePoints: 1.7 },
  { letterGrade: 'D',  minPercentage: 60, maxPercentage: 66,  gradePoints: 1.0 },
  { letterGrade: 'F',  minPercentage: 0,  maxPercentage: 59,  gradePoints: 0.0 },
];

async function main() {
  console.log('[seed] Seeding default grading scale...');
  for (const band of DEFAULT_SCALE) {
    await prisma.gradingScale.upsert({
      where: {
        name_letterGrade: { name: 'default', letterGrade: band.letterGrade },
      },
      create: {
        name: 'default',
        letterGrade: band.letterGrade,
        minPercentage: new Prisma.Decimal(band.minPercentage),
        maxPercentage: new Prisma.Decimal(band.maxPercentage),
        gradePoints: new Prisma.Decimal(band.gradePoints),
        isActive: true,
      },
      update: {
        minPercentage: new Prisma.Decimal(band.minPercentage),
        maxPercentage: new Prisma.Decimal(band.maxPercentage),
        gradePoints: new Prisma.Decimal(band.gradePoints),
        isActive: true,
      },
    });
  }
  console.log(`[seed] Inserted/updated ${DEFAULT_SCALE.length} bands.`);
}

main()
  .catch((err) => {
    console.error('[seed] Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
