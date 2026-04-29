import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AssignmentStatus } from '@prisma/client';

export class AssignTeacherDto {
  // Optional in body when used under /courses/:id/assign-teacher
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsUUID()
  teacherUserId: string;

  @IsString()
  @MinLength(2)
  @MaxLength(50)
  academicTerm: string;

  @IsString()
  @Matches(/^[A-Z0-9-]{1,10}$/, {
    message: 'sectionCode must be UPPERCASE letters/digits/dash, max 10 chars',
  })
  sectionCode: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;
}

export class UpdateTeacherAssignmentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  academicTerm?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z0-9-]{1,10}$/, {
    message: 'sectionCode must be UPPERCASE letters/digits/dash, max 10 chars',
  })
  sectionCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxStudents?: number;

  @IsOptional()
  @IsEnum(AssignmentStatus)
  status?: AssignmentStatus;
}
