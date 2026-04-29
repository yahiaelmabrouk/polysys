import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { GradeStatus } from '@prisma/client';

export class CreateGradeDto {
  @IsUUID()
  assessmentId: string;

  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  rawScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsEnum(GradeStatus)
  status?: GradeStatus;
}

export class UpdateGradeDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  rawScore?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsEnum(GradeStatus)
  status?: GradeStatus;
}

export class OverrideGradeDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  rawScore: number;

  @IsString()
  @MaxLength(1000)
  reason: string;
}

class BulkGradeEntryDto {
  @IsUUID()
  studentId: string;

  @IsOptional()
  @IsUUID()
  enrollmentId?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  rawScore: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;
}

export class BulkCreateGradesDto {
  @IsUUID()
  assessmentId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkGradeEntryDto)
  entries: BulkGradeEntryDto[];

  @IsOptional()
  @IsEnum(GradeStatus)
  status?: GradeStatus;
}
