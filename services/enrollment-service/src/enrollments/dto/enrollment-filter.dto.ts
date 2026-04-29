import {
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EnrollmentSource, EnrollmentStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class EnrollmentFilterDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  academicTerm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @IsEnum(EnrollmentStatus)
  status?: EnrollmentStatus;

  @IsOptional()
  @IsEnum(EnrollmentSource)
  source?: EnrollmentSource;

  @IsOptional()
  @IsBooleanString()
  includeAuditLogs?: string;
}
