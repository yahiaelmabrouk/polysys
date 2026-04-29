import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional() @IsString() @MaxLength(500) profilePhotoUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) bio?: string;
  @IsOptional() @IsString() @MaxLength(120) addressLine1?: string;
  @IsOptional() @IsString() @MaxLength(120) addressLine2?: string;
  @IsOptional() @IsString() @MaxLength(80) city?: string;
  @IsOptional() @IsString() @MaxLength(80) stateRegion?: string;
  @IsOptional() @IsString() @MaxLength(20) postalCode?: string;
  @IsOptional() @IsString() @MaxLength(80) country?: string;
  @IsOptional() @IsString() @MaxLength(120) emergencyContactName?: string;
  @IsOptional() @IsString() @MaxLength(40) emergencyContactPhone?: string;
  @IsOptional() @IsString() @MaxLength(60) emergencyContactRelation?: string;
  @IsOptional() @IsString() @MaxLength(2000) medicalNotes?: string;
}
