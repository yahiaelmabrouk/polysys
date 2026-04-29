import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { PrerequisiteType } from '@prisma/client';

export class AddPrerequisiteDto {
  @IsUUID()
  prerequisiteCourseId: string;

  @IsOptional()
  @IsEnum(PrerequisiteType)
  type?: PrerequisiteType;

  @IsOptional()
  @IsString()
  @MaxLength(5)
  @Matches(/^[A-F][+-]?$/, { message: 'minimumGrade must be one of A, A-, B+, B, B-, C+, C, C-, D, F (etc.)' })
  minimumGrade?: string;
}
