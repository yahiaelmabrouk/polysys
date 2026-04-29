import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  list(studentId: string) {
    return this.prisma.studentContact.findMany({
      where: { studentId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(studentId: string, dto: CreateContactDto) {
    if (dto.isPrimary) {
      await this.prisma.studentContact.updateMany({
        where: { studentId, type: dto.type },
        data: { isPrimary: false },
      });
    }
    return this.prisma.studentContact.create({
      data: { studentId, ...dto },
    });
  }

  async update(studentId: string, contactId: string, dto: UpdateContactDto) {
    const existing = await this.prisma.studentContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.studentId !== studentId) {
      throw new NotFoundException('Contact not found for this student');
    }
    if (dto.isPrimary && existing.type) {
      await this.prisma.studentContact.updateMany({
        where: { studentId, type: dto.type ?? existing.type, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }
    return this.prisma.studentContact.update({ where: { id: contactId }, data: dto });
  }

  async delete(studentId: string, contactId: string) {
    const existing = await this.prisma.studentContact.findUnique({ where: { id: contactId } });
    if (!existing || existing.studentId !== studentId) {
      throw new NotFoundException('Contact not found for this student');
    }
    await this.prisma.studentContact.delete({ where: { id: contactId } });
    return { deleted: true };
  }
}
