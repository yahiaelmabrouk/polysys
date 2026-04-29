import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertCapacityDto {
  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  capacityTotal: number;
}
