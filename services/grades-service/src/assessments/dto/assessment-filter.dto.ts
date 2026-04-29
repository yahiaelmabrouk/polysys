import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AssessmentStatus, AssessmentType } from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class AssessmentFilterDto extends PaginationDto {
  @IsOptional()
  @IsUUID()
  courseId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  academicTerm?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @IsEnum(AssessmentType)
  type?: AssessmentType;

  @IsOptional()
  @IsEnum(AssessmentStatus)
  status?: AssessmentStatus;
}
