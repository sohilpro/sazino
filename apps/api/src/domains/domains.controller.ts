import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DomainDto, DomainsDto, DomainVerifyDto } from '@myapp/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { AddDomainDto } from './domain.dto';
import { DomainsService } from './domains.service';

@ApiTags('domains')
@ApiBearerAuth()
@Controller('domains')
export class DomainsController {
  constructor(private readonly domains: DomainsService) {}

  @Get()
  list(): Promise<DomainsDto> {
    return this.domains.list();
  }

  @Roles('OWNER', 'ADMIN')
  @Post()
  add(@Body() dto: AddDomainDto): Promise<DomainDto> {
    return this.domains.add(dto.hostname);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/verify')
  @HttpCode(200)
  verify(@Param('id', ParseUUIDPipe) id: string): Promise<DomainVerifyDto> {
    return this.domains.verify(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Post(':id/primary')
  @HttpCode(200)
  setPrimary(@Param('id', ParseUUIDPipe) id: string): Promise<DomainDto> {
    return this.domains.setPrimary(id);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.domains.remove(id);
  }
}