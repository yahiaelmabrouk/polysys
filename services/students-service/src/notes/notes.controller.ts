import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { NotesService } from './notes.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('students/:studentId/notes')
@Roles('Admin', 'Teacher')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  list(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.notesService.list(studentId, user);
  }
}
