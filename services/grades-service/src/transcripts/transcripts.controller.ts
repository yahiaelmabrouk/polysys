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
import { TranscriptsService } from './transcripts.service';
import {
  ApproveTranscriptDto,
  RejectTranscriptDto,
  RequestTranscriptDto,
  TranscriptListDto,
} from './dto/transcript.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('transcripts')
export class TranscriptsController {
  constructor(private readonly service: TranscriptsService) {}

  @Get('me')
  @Roles('Student')
  myTranscripts(@CurrentUser() user: JwtPayload) {
    return this.service.myTranscripts(user);
  }

  @Post('request')
  @Roles('Student')
  request(
    @Body() dto: RequestTranscriptDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.request(dto, user, ip);
  }

  @Get()
  @Roles('Admin')
  list(@Query() filters: TranscriptListDto) {
    return this.service.list(filters);
  }

  @Patch(':id/approve')
  @Roles('Admin')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTranscriptDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.approve(id, dto, user, ip);
  }

  @Patch(':id/reject')
  @Roles('Admin')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTranscriptDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.service.reject(id, dto, user, ip);
  }
}
