import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto } from './dto/contact.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('students/:studentId/contacts')
@Roles('Admin')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  list(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.contactsService.list(studentId);
  }

  @Post()
  create(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateContactDto,
  ) {
    return this.contactsService.create(studentId, dto);
  }

  @Patch(':contactId')
  update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.contactsService.update(studentId, contactId, dto);
  }

  @Delete(':contactId')
  delete(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    return this.contactsService.delete(studentId, contactId);
  }
}
