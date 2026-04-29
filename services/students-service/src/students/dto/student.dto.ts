import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnrollmentStatus, Gender } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CreateStudentDto {
  @IsUUID()
  authUserId: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  studentNumber?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nationality?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  nationalId?: string;

  @IsDateString()
  admissionDate: string;

  @IsOptional()
  @IsDateString()
  expectedGraduationDate?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  programName: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  currentLevel?: number;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  enrollmentStatus?: EnrollmentStatus;

  @IsOptional()
  @IsUUID()
  advisorId?: string;
}

export class UpdateStudentDto {
  @IsOptional() @IsString() @MaxLength(80) firstName?: string;
  @IsOptional() @IsString() @MaxLength(80) lastName?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsEnum(Gender) gender?: Gender;
  @IsOptional() @IsString() @MaxLength(80) nationality?: string;
  @IsOptional() @IsString() @MaxLength(40) nationalId?: string;
  @IsOptional() @IsDateString() expectedGraduationDate?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(120) programName?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) currentLevel?: number;
  @IsOptional() @IsUUID() advisorId?: string;
}

export class UpdateStudentStatusDto {
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateOwnContactDto {
  @IsOptional() @IsString() @MaxLength(120) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(120) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) stateRegion?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  @IsOptional() @IsString() @MaxLength(40) emergencyContactPhone?: string;
  @IsOptional() @IsString() @MaxLength(60) emergencyContactRelation?: string;
  @IsOptional() @IsString() @MaxLength(500) profilePhotoUrl?: string;
}

export class StudentSearchDto extends PaginationDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(32) studentNumber?: string;
  @IsOptional() @IsUUID() departmentId?: string;
  @IsOptional() @IsString() @MaxLength(120) program?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) level?: number;
  @IsOptional() @IsEnum(EnrollmentStatus) status?: EnrollmentStatus;
  @IsOptional() @IsUUID() advisorId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1900) admissionYear?: number;
}
