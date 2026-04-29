import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { UpdateProfileDto } from './dto/profile.dto';

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByStudentId(studentId: string) {
    const profile = await this.prisma.studentProfile.findUnique({ where: { studentId } });
    if (!profile) throw new NotFoundException('Profile not found');
    return profile;
  }

  async upsert(studentId: string, dto: UpdateProfileDto) {
    return this.prisma.studentProfile.upsert({
      where: { studentId },
      update: { ...dto },
      create: {
        studentId,
        addressLine1: dto.addressLine1 ?? '',
        city: dto.city ?? '',
        stateRegion: dto.stateRegion ?? '',
        postalCode: dto.postalCode ?? '',
        country: dto.country ?? '',
        emergencyContactName: dto.emergencyContactName ?? '',
        emergencyContactPhone: dto.emergencyContactPhone ?? '',
        emergencyContactRelation: dto.emergencyContactRelation ?? '',
        bio: dto.bio,
        profilePhotoUrl: dto.profilePhotoUrl,
        medicalNotes: dto.medicalNotes,
        addressLine2: dto.addressLine2,
      },
    });
  }
}
