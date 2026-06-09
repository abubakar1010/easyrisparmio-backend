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
import { UpdateMeterStatusDto } from './dto/update-meter-status.dto';
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

  // ─── User Endpoint (named route first) ────────────────────

  @Get('my-meters')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my active meters/utilities',
    description:
      'Returns the authenticated user\'s active meters with supplier and address details. ' +
      'Only meters with `active` status are returned. No pagination — users typically have 2-5 utilities.',
  })
  @ApiOkResponse({
    description: 'List of user\'s active meters',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
              userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              utilityType: 'electricity',
              meterCode: 'IT001E556779',
              supplierId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              status: 'active',
              annualConsumption: '12500.00',
              consumptionUnit: 'kWh',
              contractedPowerKw: '3.00',
              activationDate: '2025-01-15',
              createdAt: '2026-06-01T10:00:00.000Z',
              supplier: {
                id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                name: 'Ener Energia',
              },
              address: {
                id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                streetAddress: 'Via Roma 42',
                city: 'Milano',
                postalCode: '20121',
              },
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
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  getMyMeters(@CurrentUser('id') userId: string) {
    return this.metersService.findUserActiveMeters(userId);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new meter (admin)',
    description:
      'Creates a meter/utility point for a user. The meter code + utility type combination must be unique. ' +
      'The `createdBy` field is automatically set to the admin user.',
  })
  @ApiBody({ type: CreateMeterDto })
  @ApiCreatedResponse({
    description: 'Meter created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
            userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            utilityType: 'electricity',
            meterCode: 'IT001E556779',
            supplierId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            status: 'active',
            annualConsumption: '12500.00',
            consumptionUnit: 'kWh',
            contractedPowerKw: '3.00',
            addressId: null,
            activationDate: '2025-01-15',
            notes: null,
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
          message: ['meterCode should not be empty', 'utilityType must be a valid enum value'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Duplicate meter code + utility type',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['A meter with this code and utility type already exists'],
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
    summary: 'List all meters (admin, paginated)',
    description:
      'Returns a paginated list of all meters with user, supplier, and address details. ' +
      'Supports filtering by utility type, status, user ID, supplier ID, and text search (meter code, user name/email).',
  })
  @ApiOkResponse({
    description: 'Paginated list of meters',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
                utilityType: 'electricity',
                meterCode: 'IT001E556779',
                status: 'active',
                annualConsumption: '12500.00',
                consumptionUnit: 'kWh',
                createdAt: '2026-06-01T10:00:00.000Z',
                user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' },
                supplier: { id: 'b2c3d4e5...', name: 'Ener Energia' },
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
    summary: 'Get meter detail (admin)',
    description: 'Returns a single meter with full user, supplier, and address details.',
  })
  @ApiOkResponse({
    description: 'Meter details',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
            userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            utilityType: 'electricity',
            meterCode: 'IT001E556779',
            status: 'active',
            annualConsumption: '12500.00',
            consumptionUnit: 'kWh',
            contractedPowerKw: '3.00',
            activationDate: '2025-01-15',
            notes: 'Verified via supplier portal',
            createdBy: 'admin-uuid',
            updatedBy: 'admin-uuid',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-09T12:00:00.000Z',
            user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' },
            supplier: { id: 'b2c3d4e5...', name: 'Ener Energia' },
            address: { id: 'c3d4e5f6...', streetAddress: 'Via Roma 42', city: 'Milano', postalCode: '20121' },
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
    summary: 'Update meter fields (admin)',
    description: 'Updates meter fields. All fields are optional. Use `PATCH :id/status` for status moderation.',
  })
  @ApiBody({ type: UpdateMeterDto })
  @ApiOkResponse({
    description: 'Meter updated successfully',
    content: { 'application/json': { example: { success: true, data: { id: 'm1a2b3c4...', meterCode: 'IT001E556779', annualConsumption: '15000.00', updatedBy: 'admin-uuid', updatedAt: '2026-06-09T14:00:00.000Z' } } } },
  })
  @ApiNotFoundResponse({
    description: 'Meter not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Meter not found'], timestamp: '2026-06-09T12:00:00.000Z' } } },
  })
  @ApiConflictResponse({
    description: 'Duplicate meter code + utility type after update',
    content: { 'application/json': { example: { success: false, statusCode: 409, message: ['A meter with this code and utility type already exists'], timestamp: '2026-06-09T12:00:00.000Z' } } },
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
    summary: 'Soft-delete a meter (admin)',
    description: 'Marks the meter as deleted (sets `deleted_at`). The meter is hidden from all queries but preserved in the database.',
  })
  @ApiOkResponse({
    description: 'Meter deleted successfully',
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

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Change meter status (admin moderation)',
    description:
      'Updates a meter\'s status. Controls whether the meter is visible to the user.\n\n' +
      'Valid transitions:\n' +
      '- PENDING → ACTIVE or TERMINATED\n' +
      '- ACTIVE → INACTIVE or TERMINATED\n' +
      '- INACTIVE → ACTIVE or TERMINATED\n' +
      '- TERMINATED is a terminal state (no further transitions)',
  })
  @ApiBody({ type: UpdateMeterStatusDto })
  @ApiOkResponse({
    description: 'Meter status updated',
    content: {
      'application/json': {
        examples: {
          activated: {
            summary: 'Meter activated (visible to user)',
            value: {
              success: true,
              data: {
                id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
                meterCode: 'IT001E556779',
                status: 'active',
                updatedBy: 'admin-uuid',
                updatedAt: '2026-06-09T14:00:00.000Z',
              },
            },
          },
          deactivated: {
            summary: 'Meter deactivated (hidden from user)',
            value: {
              success: true,
              data: {
                id: 'm1a2b3c4-d5e6-7890-abcd-ef1234567890',
                meterCode: 'IT001E556779',
                status: 'inactive',
                updatedBy: 'admin-uuid',
                updatedAt: '2026-06-09T14:00:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid status transition',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['Cannot transition from terminated to active'],
          timestamp: '2026-06-09T12:00:00.000Z',
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
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMeterStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.metersService.updateStatus(id, dto, adminId);
  }
}
