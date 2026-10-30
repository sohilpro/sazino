import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { PageDto, PageSummaryDto } from '@myapp/shared-types';
import { Roles } from '../auth/decorators/roles.decorator';
import { PageSlugPipe, SavePageDto } from './page.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@ApiBearerAuth()
@Controller('pages')
export class PagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  list(): Promise<PageSummaryDto[]> {
    return this.pages.list();
  }

  @Get(':slug')
  get(@Param('slug', PageSlugPipe) slug: string): Promise<PageDto> {
    return this.pages.get(slug);
  }

  @Put(':slug')
  save(@Param('slug', PageSlugPipe) slug: string, @Body() dto: SavePageDto): Promise<PageDto> {
    return this.pages.saveDraft(slug, dto);
  }

  @Post(':slug/publish')
  @HttpCode(200)
  publish(@Param('slug', PageSlugPipe) slug: string): Promise<PageDto> {
    return this.pages.publish(slug);
  }

  @Delete(':slug/draft')
  @HttpCode(200)
  discardDraft(@Param('slug', PageSlugPipe) slug: string): Promise<PageDto> {
    return this.pages.discardDraft(slug);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':slug')
  @HttpCode(204)
  async remove(@Param('slug', PageSlugPipe) slug: string): Promise<void> {
    await this.pages.remove(slug);
  }
}