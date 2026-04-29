import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class JoinWaitlistDto {
  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  sectionCode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000)
  priorityScore?: number;
}

export class AdminJoinWaitlistDto extends JoinWaitlistDto {
  @IsUUID()
  studentId: string;
}
