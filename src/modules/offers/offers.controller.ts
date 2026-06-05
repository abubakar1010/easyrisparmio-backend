import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  @ApiOperation({ summary: 'List offers with filters (public)' })
  async findAll(@Query() query: QueryOffersDto) {
    return this.offersService.findAll(query);
  }

  @Get('compare')
  @ApiOperation({ summary: 'Compare multiple offers side by side' })
  @ApiQuery({
    name: 'ids',
    type: String,
    description: 'Comma-separated offer IDs',
    example: 'uuid1,uuid2,uuid3',
  })
  async compareOffers(@Query('ids') ids: string) {
    const idArray = ids.split(',').map((id) => id.trim());
    return this.offersService.compareOffers(idArray);
  }

  @Get('recommended/:billId')
  @ApiOperation({ summary: 'Get recommended offers based on a bill' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async getRecommendedOffers(
    @CurrentUser('id') userId: string,
    @Param('billId', ParseUUIDPipe) billId: string,
  ) {
    return this.offersService.getRecommendedOffers(billId, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get offer by ID' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new offer (admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async create(@Body() dto: CreateOfferDto) {
    return this.offersService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an offer (admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferDto,
  ) {
    return this.offersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete an offer (admin only)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.offersService.softDelete(id);
  }
}
