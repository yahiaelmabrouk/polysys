import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AssessmentType, GradeStatus } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class GradeFilterDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  academicTerm?: string;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsUUID()
  assessmentId?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  assessmentType?: AssessmentType;

  @IsOptional()
  @IsEnum(GradeStatus)
  status?: GradeStatus;
}
