import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { AssessmentsService } from './assessments.service';
import {
  CreateAssessmentDto,
  UpdateAssessmentDto,
} from './dto/assessment.dto';
import { AssessmentFilterDto } from './dto/assessment-filter.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly service: AssessmentsService) {}

  @Get()
  @Roles('Teacher', 'Admin')
  list(@Query() filters: AssessmentFilterDto) {
    return this.service.list(filters);
  }

  @Get(':id')
  @Roles('Teacher', 'Admin')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findById(id);
  }

  @Post()
  @Roles('Teacher', 'Admin')
  create(
    @Body() dto: CreateAssessmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Teacher', 'Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.update(id, dto, user, ip);
  }
}
