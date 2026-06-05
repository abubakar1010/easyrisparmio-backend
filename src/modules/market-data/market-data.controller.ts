import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MarketDataService } from './market-data.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Market Data')
@Controller('market-data')
export class MarketDataController {
  constructor(private readonly marketDataService: MarketDataService) {}

  @Get('indices')
  @ApiOperation({ summary: 'Get latest market index values' })
  getLatestIndices() {
    return this.marketDataService.getLatestIndices();
  }

  @Get('indices/:name/history')
  @ApiOperation({ summary: 'Get historical data for a market index' })
  getIndexHistory(
    @Param('name') name: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.marketDataService.getIndexHistory(name, from, to);
  }

  @Post('indices')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new market index entry (admin)' })
  createIndex(
    @Body()
    body: {
      indexName: string;
      value: number;
      unit: string;
      date: string;
    },
  ) {
    return this.marketDataService.createIndex(body);
  }
}
