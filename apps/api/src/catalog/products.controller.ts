import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import {
  CreateProductDto,
  CreateVariantDto,
  ProductListQueryDto,
  UpdateInventoryDto,
  UpdateProductDto,
  UpdateVariantDto,
} from './product.dto';
import { ProductsService } from './products.service';
import { SetProductImagesDto } from '../media/media.dto';
import { PlanLimit } from '../plans/plan-limit.guard';

@ApiTags('products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  list(@Query() query: ProductListQueryDto) {
    return this.products.list(query);
  }

  @PlanLimit('products')
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.getById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.products.remove(id);
  }

  @Put(':id/images')
  setImages(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetProductImagesDto) {
    return this.products.setImages(id, dto.mediaIds);
  }

  @Post(':id/variants')
  addVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateVariantDto) {
    return this.products.addVariant(id, dto);
  }

  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateVariantDto,
  ) {
    return this.products.updateVariant(id, variantId, dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Delete(':id/variants/:variantId')
  removeVariant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
  ) {
    return this.products.removeVariant(id, variantId);
  }

  @Patch(':id/variants/:variantId/inventory')
  updateInventory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateInventoryDto,
  ) {
    return this.products.updateInventory(id, variantId, dto);
  }
}
