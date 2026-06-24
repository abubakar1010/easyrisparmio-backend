import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
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
  @ApiOperation({
    summary: 'Get latest market index values',
    description:
      'Returns the most recent value for each energy market index (PUN, GME, PSV, etc.). ' +
      'Public endpoint, no authentication required.',
  })
  @ApiOkResponse({
    description: 'Latest market index values',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              indexName: 'PUN',
              value: '0.1245',
              unit: 'EUR/kWh',
              date: '2026-06-24',
              createdAt: '2026-06-24T08:00:00.000Z',
              updatedAt: '2026-06-24T08:00:00.000Z',
            },
            {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              indexName: 'PSV',
              value: '0.3520',
              unit: 'EUR/Smc',
              date: '2026-06-24',
              createdAt: '2026-06-24T08:00:00.000Z',
              updatedAt: '2026-06-24T08:00:00.000Z',
            },
            {
              id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
              indexName: 'GME',
              value: '0.1180',
              unit: 'EUR/kWh',
              date: '2026-06-24',
              createdAt: '2026-06-24T08:00:00.000Z',
              updatedAt: '2026-06-24T08:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  getLatestIndices() {
    return this.marketDataService.getLatestIndices();
  }

  @Get('indices/:name/history')
  @ApiOperation({
    summary: 'Get historical data for a market index',
    description:
      'Returns historical price data for a specific market index (e.g. PUN, PSV, GME). ' +
      'Optionally filter by date range using `from` and `to` query parameters (YYYY-MM-DD format). ' +
      'Public endpoint, no authentication required.',
  })
  @ApiParam({ name: 'name', type: String, description: 'Market index name', example: 'PUN' })
  @ApiQuery({ name: 'from', required: false, type: String, description: 'Start date (YYYY-MM-DD)', example: '2026-01-01' })
  @ApiQuery({ name: 'to', required: false, type: String, description: 'End date (YYYY-MM-DD)', example: '2026-06-24' })
  @ApiOkResponse({
    description: 'Historical data for the market index',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              indexName: 'PUN',
              value: '0.1180',
              unit: 'EUR/kWh',
              date: '2026-01-01',
              createdAt: '2026-01-01T08:00:00.000Z',
              updatedAt: '2026-01-01T08:00:00.000Z',
            },
            {
              id: 'd4e5f6a7-b8c9-0123-defg-234567890123',
              indexName: 'PUN',
              value: '0.1210',
              unit: 'EUR/kWh',
              date: '2026-02-01',
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T08:00:00.000Z',
            },
            {
              id: 'e5f6a7b8-c9d0-1234-efgh-345678901234',
              indexName: 'PUN',
              value: '0.1245',
              unit: 'EUR/kWh',
              date: '2026-03-01',
              createdAt: '2026-03-01T08:00:00.000Z',
              updatedAt: '2026-03-01T08:00:00.000Z',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Market index not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Market index not found'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
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
  @ApiOperation({
    summary: 'Create a new market index entry (admin)',
    description:
      'Creates a new data point for a market index (PUN, PSV, GME, etc.). ' +
      'Used to record daily energy market prices. Admin only.',
  })
  @ApiCreatedResponse({
    description: 'Market index entry created',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'f6a7b8c9-d0e1-2345-fghi-456789012345',
            indexName: 'PUN',
            value: '0.1260',
            unit: 'EUR/kWh',
            date: '2026-06-24',
            createdAt: '2026-06-24T10:00:00.000Z',
            updatedAt: '2026-06-24T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or duplicate entry for this index and date',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['indexName should not be empty', 'value must be a number'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 403,
          message: ['Forbidden resource'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
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
