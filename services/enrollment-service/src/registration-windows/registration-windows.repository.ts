import { Injectable } from '@nestjs/common';
import { Prisma, RegistrationRoleScope } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class RegistrationWindowsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.registrationWindow.findUnique({ where: { id } });
  }

  findActiveForTerm(academicTerm: string, roleScope: RegistrationRoleScope) {
    return this.prisma.registrationWindow.findFirst({
      where: {
        academicTerm,
        roleScope: { in: [roleScope, RegistrationRoleScope.ALL] },
        isActive: true,
      },
      orderBy: { roleScope: 'asc' },
    });
  }

  list(filters: { academicTerm?: string; isActive?: boolean }) {
    return this.prisma.registrationWindow.findMany({
      where: {
        academicTerm: filters.academicTerm,
        isActive: filters.isActive,
      },
      orderBy: [{ academicTerm: 'desc' }, { roleScope: 'asc' }],
    });
  }

  create(data: Prisma.RegistrationWindowUncheckedCreateInput) {
    return this.prisma.registrationWindow.create({ data });
  }

  update(id: string, data: Prisma.RegistrationWindowUncheckedUpdateInput) {
    return this.prisma.registrationWindow.update({ where: { id }, data });
  }
}
