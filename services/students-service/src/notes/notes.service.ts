import { Injectable, ForbiddenException } from '@nestjs/common';
import { NoteVisibility } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { CreateNoteDto } from './dto/note.dto';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  create(studentId: string, createdByUserId: string, dto: CreateNoteDto) {
    return this.prisma.studentNote.create({
      data: {
        studentId,
        createdByUserId,
        note: dto.note,
        visibility: dto.visibility ?? NoteVisibility.INTERNAL,
      },
    });
  }

  list(studentId: string, actor: JwtPayload) {
    const allowed: NoteVisibility[] = this.allowedVisibilities(actor);
    if (allowed.length === 0) throw new ForbiddenException('Cannot view notes');
    return this.prisma.studentNote.findMany({
      where: { studentId, visibility: { in: allowed } },
      orderBy: { createdAt: 'desc' },
    });
  }

  private allowedVisibilities(actor: JwtPayload): NoteVisibility[] {
    if (actor.role === 'Admin') {
      return [NoteVisibility.ADMIN, NoteVisibility.ADVISOR, NoteVisibility.INTERNAL];
    }
    if (actor.role === 'Teacher') {
      return [NoteVisibility.ADVISOR, NoteVisibility.INTERNAL];
    }
    return [];
  }
}
