import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  TranscriptRequestType,
  TranscriptStatus,
} from '@prisma/client';

export class RequestTranscriptDto {
  @IsEnum(TranscriptRequestType)
  requestType!: TranscriptRequestType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class TranscriptListDto {
  @IsOptional()
  @IsEnum(TranscriptStatus)
  status?: TranscriptStatus;

  @IsOptional()
  @IsEnum(TranscriptRequestType)
  requestType?: TranscriptRequestType;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class ApproveTranscriptDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class RejectTranscriptDto {
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
