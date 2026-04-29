import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CatalogService } from './catalog.service';
import {
  CreateCatalogVersionDto,
  UpdateCatalogVersionDto,
} from './dto/catalog.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ClientIp } from '../common/decorators/client-ip.decorator';
import { JwtPayload } from '../strategies/jwt-access.strategy';

@Controller('catalog/versions')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get()
  list() {
    return this.catalogService.list();
  }

  @Get('current')
  current() {
    return this.catalogService.getCurrent();
  }

  @Post()
  @Roles('Admin')
  create(
    @Body() dto: CreateCatalogVersionDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.catalogService.create(dto, user, ip);
  }

  @Patch(':id')
  @Roles('Admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCatalogVersionDto,
    @CurrentUser() user: JwtPayload,
    @ClientIp() ip: string,
  ) {
    return this.catalogService.update(id, dto, user, ip);
  }
}
