import {
  IsBooleanString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  CourseLevel,
  CourseStatus,
  DeliveryMode,
  SemesterType,
} from '@prisma/client';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class CourseFilterDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  keyword?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsUUID()
  subjectId?: string;

  @IsOptional()
  @Type(() => Number)
  credits?: number;

  @IsOptional()
  @IsEnum(CourseLevel)
  level?: CourseLevel;

  @IsOptional()
  @IsEnum(SemesterType)
  semesterType?: SemesterType;

  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @IsOptional()
  @IsEnum(CourseStatus)
  status?: CourseStatus;

  @IsOptional()
  @IsUUID()
  teacherId?: string;

  @IsOptional()
  @IsBooleanString()
  includePrerequisites?: string;
}
