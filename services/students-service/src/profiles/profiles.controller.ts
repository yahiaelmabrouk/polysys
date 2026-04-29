import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ProfilesService } from './profiles.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('profiles')
@Roles('Admin')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get(':studentId')
  get(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.profilesService.findByStudentId(studentId);
  }

  @Patch(':studentId')
  update(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profilesService.upsert(studentId, dto);
  }
}
