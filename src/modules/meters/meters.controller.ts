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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiBody,
} from '@nestjs/swagger';
import { MetersService } from './meters.service';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { QueryMetersDto } from './dto/query-meters.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Meters')
@Controller('meters')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MetersController {
  constructor(private readonly metersService: MetersService) {}

  // ─── User Endpoints (named routes first) ──────────────────

  @Get('my-services')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my activated services',
    description:
      'Returns the authenticated user\'s activated services — offers where the switch case is completed ' +
      'and the contract is active. Each item includes offer details, supplier info, and contract data.',
  })
  @ApiOkResponse({
    description: 'List of user\'s activated services',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              id: 'contract-uuid',
              caseId: 'case-uuid',
              offerId: 'offer-uuid',
              energyType: 'electricity',
              offerName: 'Luce Fissa 2026',
              supplierName: 'Ener Energia',
              contractNumber: 'CNT-20260630-00001',
              podPdrNumber: 'IT001E556779',
              activationDate: '2026-06-15',
              expiryDate: '2027-06-15',
              monthlyEstimate: '85.00',
              pricePerKwh: '0.085000',
              pricePerSmc: null,
              fixedMonthlyFee: '10.00',
              contractDurationMonths: 12,
              isGreenEnergy: true,
            },
          ],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' },
      },
    },
  })
  getMyServices(@CurrentUser('id') userId: string) {
    return this.metersService.findUserActivatedServices(userId);
  }

  @Get('my-meters')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my active meters (deprecated)',
    description:
      'Deprecated — use `GET /meters/my-services` instead. ' +
      'This endpoint is kept for backward compatibility and returns an empty array.',
    deprecated: true,
  })
  @ApiOkResponse({ description: 'Empty array (deprecated endpoint)' })
  getMyMeters() {
    return [];
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new service type (admin)',
    description:
      'Creates a service type entry in the catalog. Each utility type (electricity, gas, water, internet) ' +
      'can only exist once.',
  })
  @ApiBody({ type: CreateMeterDto })
  @ApiCreatedResponse({
    description: 'Service type created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
            utilityType: 'electricity',
            name: 'Electricity',
            description: 'Residential and business electricity supply',
            isActive: true,
            createdBy: 'admin-uuid',
            updatedBy: 'admin-uuid',
            createdAt: '2026-06-09T12:00:00.000Z',
            updatedAt: '2026-06-09T12:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['name should not be empty', 'utilityType must be a valid enum value'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Duplicate utility type',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['A service type with this utility type already exists'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateMeterDto,
  ) {
    return this.metersService.create(dto, adminId);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all service types (admin, paginated)',
    description:
      'Returns a paginated list of all service type catalog entries. ' +
      'Supports filtering by utility type, active status, and text search.',
  })
  @ApiOkResponse({
    description: 'Paginated list of service types',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
                utilityType: 'electricity',
                name: 'Electricity',
                description: 'Residential and business electricity supply',
                isActive: true,
                createdAt: '2026-06-01T10:00:00.000Z',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  findAll(@Query() query: QueryMetersDto) {
    return this.metersService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get service type detail (admin)',
    description: 'Returns a single service type catalog entry.',
  })
  @ApiOkResponse({
    description: 'Service type details',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
            utilityType: 'electricity',
            name: 'Electricity',
            description: 'Residential and business electricity supply',
            isActive: true,
            createdBy: 'admin-uuid',
            updatedBy: 'admin-uuid',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-09T12:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Meter not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Meter not found'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.metersService.findById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update service type (admin)',
    description: 'Updates service type fields. All fields are optional.',
  })
  @ApiBody({ type: UpdateMeterDto })
  @ApiOkResponse({
    description: 'Service type updated successfully',
    content: { 'application/json': { example: { success: true, data: { id: 'm1a2b3c4...', name: 'Electricity', isActive: true, updatedBy: 'admin-uuid', updatedAt: '2026-06-09T14:00:00.000Z' } } } },
  })
  @ApiNotFoundResponse({
    description: 'Meter not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Meter not found'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiConflictResponse({
    description: 'Duplicate utility type after update',
    content: { 'application/json': { example: { success: false, statusCode: 409, message: ['A service type with this utility type already exists'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeterDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.metersService.update(id, dto, adminId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft-delete a service type (admin)',
    description: 'Marks the service type as deleted. It is hidden from all queries but preserved in the database.',
  })
  @ApiOkResponse({
    description: 'Service type deleted successfully',
    content: { 'application/json': { example: { success: true, data: { message: 'Meter deleted successfully' } } } },
  })
  @ApiNotFoundResponse({
    description: 'Meter not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Meter not found'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.metersService.softDelete(id);
    return { message: 'Meter deleted successfully' };
  }
}
