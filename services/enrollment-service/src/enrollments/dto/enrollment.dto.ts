import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { EnrollmentStatus, GradingOption } from '@prisma/client';

export class CreateEnrollmentDto {
  @IsUUID()
  courseId: string;

  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @IsEnum(GradingOption)
  gradingOption?: GradingOption;

  @IsOptional()
  @IsBoolean()
  joinWaitlistIfFull?: boolean;
}

export class BulkCreateEnrollmentDto {
  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => BulkEnrollmentItemDto)
  items: BulkEnrollmentItemDto[];
}

export class BulkEnrollmentItemDto {
  @IsUUID()
  courseId: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @IsEnum(GradingOption)
  gradingOption?: GradingOption;

  @IsOptional()
  @IsBoolean()
  joinWaitlistIfFull?: boolean;
}

export class DropEnrollmentDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class UpdateEnrollmentStatusDto {
  @IsEnum(EnrollmentStatus)
  status: EnrollmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ForceEnrollDto {
  @IsUUID()
  studentId: string;

  @IsUUID()
  courseId: string;

  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @IsEnum(GradingOption)
  gradingOption?: GradingOption;

  @IsString()
  @MaxLength(500)
  reason: string;

  @IsOptional()
  @IsBoolean()
  ignoreCapacity?: boolean;
}

export class ForceDropDto {
  @IsUUID()
  enrollmentId: string;

  @IsString()
  @MaxLength(500)
  reason: string;
}
