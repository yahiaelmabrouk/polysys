import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { NoteVisibility } from '@prisma/client';

export class CreateNoteDto {
  @IsString() @MaxLength(2000)
  note: string;

  @IsOptional() @IsEnum(NoteVisibility)
  visibility?: NoteVisibility;
}
