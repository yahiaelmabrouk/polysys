import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RegistrationRoleScope } from '@prisma/client';

export class CreateRegistrationWindowDto {
  @IsString()
  @MaxLength(20)
  academicTerm: string;

  @IsOptional()
  @IsEnum(RegistrationRoleScope)
  roleScope?: RegistrationRoleScope;

  @IsDateString()
  opensAt: string;

  @IsDateString()
  closesAt: string;

  @IsOptional()
  @IsDateString()
  lateAddDeadline?: string;

  @IsDateString()
  dropDeadline: string;

  @IsDateString()
  withdrawDeadline: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRegistrationWindowDto {
  @IsOptional()
  @IsDateString()
  opensAt?: string;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsOptional()
  @IsDateString()
  lateAddDeadline?: string;

  @IsOptional()
  @IsDateString()
  dropDeadline?: string;

  @IsOptional()
  @IsDateString()
  withdrawDeadline?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
