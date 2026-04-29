import { IsEnum, IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AcademicStanding } from '@prisma/client';

export class RecordAcademicHistoryDto {
  @IsString()
  @MaxLength(80)
  semesterName: string;

  @Type(() => Number) @IsInt() @Min(0) @Max(60) creditsAttempted: number;
  @Type(() => Number) @IsInt() @Min(0) @Max(60) creditsCompleted: number;

  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(4) gpa: number;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(4) cgpa: number;

  @IsEnum(AcademicStanding)
  academicStanding: AcademicStanding;

  @IsOptional() @IsString() @MaxLength(500) remarks?: string;
}
