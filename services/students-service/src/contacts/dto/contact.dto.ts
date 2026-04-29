import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContactType } from '@prisma/client';

export class CreateContactDto {
  @IsEnum(ContactType)
  type: ContactType;

  @IsString() @MaxLength(60)
  label: string;

  @IsString() @MaxLength(200)
  value: string;

  @IsOptional() @IsBoolean()
  isPrimary?: boolean;
}

export class UpdateContactDto {
  @IsOptional() @IsEnum(ContactType) type?: ContactType;
  @IsOptional() @IsString() @MaxLength(60) label?: string;
  @IsOptional() @IsString() @MaxLength(200) value?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
}
