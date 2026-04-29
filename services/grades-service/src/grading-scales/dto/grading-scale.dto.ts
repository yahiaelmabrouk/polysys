import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateGradingScaleDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minPercentage: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxPercentage: number;

  @IsString()
  @MinLength(1)
  @MaxLength(5)
  @Matches(/^[A-Z][A-Z+\-0-9]{0,4}$/, {
    message: 'letterGrade must start with an uppercase letter (e.g. A, B+, C-)',
  })
  letterGrade: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(4)
  gradePoints: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateGradingScaleDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  minPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  maxPercentage?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(4)
  gradePoints?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
