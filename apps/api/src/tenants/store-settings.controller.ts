import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { StoreSettingsDto } from '@myapp/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { SaveStoreSettingsDto } from './store-settings.dto';
import { StoreSettingsService } from './store-settings.service';

@ApiTags('store-settings')
@ApiBearerAuth()
@Controller('store-settings')
export class StoreSettingsController {
  constructor(private readonly settings: StoreSettingsService) {}

  @Get()
  get(): Promise<StoreSettingsDto> {
    return this.settings.get();
  }

  @Roles('OWNER', 'ADMIN')
  @Put()
  save(@Body() dto: SaveStoreSettingsDto): Promise<StoreSettingsDto> {
    return this.settings.update(dto);
  }
}