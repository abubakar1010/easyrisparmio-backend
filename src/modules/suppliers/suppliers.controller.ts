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
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { ActivityLogService } from '../activity-log/activity-log.service';

@ApiTags('Suppliers')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly activityLogService: ActivityLogService,
  ) {}

  // ─── Public Endpoints ─────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List active suppliers (public)',
    description:
      'Returns a paginated list of active suppliers. No authentication required. ' +
      'Supports text search by supplier name and supplier code.',
  })
  @ApiOkResponse({
    description: 'Paginated list of active suppliers',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
                name: 'Enel Energia',
                logoUrl: 'https://cdn.easyresparmio.it/logos/enel-energia.png',
                description: 'Leading Italian energy supplier since 1962',
                rating: '4.50',
                isActive: true,
                contactEmail: 'info@enelenergia.it',
                contactPhone: '+39023456789',
                website: 'https://www.enelenergia.it',
                supplierCode: 'ENEL-001',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  findAllPublic(@Query() query: PaginationDto) {
    return this.suppliersService.findAllPublic(query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all suppliers (admin, paginated)',
    description:
      'Returns a paginated list of all suppliers including inactive ones. ' +
      'Supports filtering by active status and text search (name, email, supplier code).',
  })
  @ApiOkResponse({
    description: 'Paginated list of all suppliers',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
                name: 'Enel Energia',
                logoUrl: 'https://cdn.easyresparmio.it/logos/enel-energia.png',
                description: 'Leading Italian energy supplier since 1962',
                rating: '4.50',
                isActive: true,
                contactEmail: 'info@enelenergia.it',
                contactPhone: '+39023456789',
                website: 'https://www.enelenergia.it',
                supplierCode: 'ENEL-001',
                createdBy: 'admin-uuid',
                updatedBy: 'admin-uuid',
                createdAt: '2026-06-01T10:00:00.000Z',
                updatedAt: '2026-06-01T10:00:00.000Z',
              },
              {
                id: 's2b3c4d5-e6f7-8901-bcde-f23456789012',
                name: 'Edison Energia',
                logoUrl: null,
                description: null,
                rating: '3.80',
                isActive: false,
                contactEmail: 'info@edison.it',
                contactPhone: null,
                website: 'https://www.edison.it',
                supplierCode: 'EDIS-001',
                createdBy: 'admin-uuid',
                updatedBy: 'admin-uuid',
                createdAt: '2026-05-15T08:00:00.000Z',
                updatedAt: '2026-06-05T14:00:00.000Z',
              },
            ],
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  findAllAdmin(@Query() query: QuerySuppliersDto) {
    return this.suppliersService.findAllAdmin(query);
  }

  // ─── Admin: Deletion Management (before :id route) ───────

  @Get(':id/deletion-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get supplier deletion status (admin)',
    description: 'Returns the deletion status for a supplier, including scheduled deletion date and active contracts count.',
  })
  @ApiOkResponse({ description: 'Deletion status retrieved' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  getDeletionStatus(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.getDeletionStatus(id);
  }

  @Post(':id/cancel-deletion')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Cancel scheduled supplier deletion (admin)',
    description:
      'Cancels a previously scheduled supplier deletion. The supplier status is set back to inactive.',
  })
  @ApiOkResponse({
    description: 'Deletion cancelled',
    content: { 'application/json': { example: { success: true, data: { message: 'Supplier deletion cancelled. Status set to inactive.' } } } },
  })
  @ApiBadRequestResponse({ description: 'Supplier is not pending deletion' })
  @ApiNotFoundResponse({ description: 'Supplier not found' })
  async cancelDeletion(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    const result = await this.suppliersService.cancelScheduledDeletion(id, adminId);
    void this.activityLogService.log(adminId, 'Supplier Deletion Cancelled', 'supplier', id);
    return result;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get supplier by ID (public)',
    description: 'Returns a single supplier with its associated offers. No authentication required.',
  })
  @ApiOkResponse({
    description: 'Supplier details',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
            name: 'Enel Energia',
            logoUrl: 'https://cdn.easyresparmio.it/logos/enel-energia.png',
            description: 'Leading Italian energy supplier since 1962',
            rating: '4.50',
            isActive: true,
            contactEmail: 'info@enelenergia.it',
            contactPhone: '+39023456789',
            website: 'https://www.enelenergia.it',
            supplierCode: 'ENEL-001',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-01T10:00:00.000Z',
            offers: [
              {
                id: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890',
                name: 'Casa Luce Fix',
                energyType: 'electricity',
                status: 'active',
              },
            ],
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Supplier not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findById(id);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new supplier (admin)',
    description:
      'Creates a new energy supplier. The `supplierCode` must be unique if provided. ' +
      'The `createdBy` and `updatedBy` fields are automatically set from the admin JWT.',
  })
  @ApiBody({ type: CreateSupplierDto })
  @ApiCreatedResponse({
    description: 'Supplier created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
            name: 'Enel Energia',
            logoUrl: 'https://cdn.easyresparmio.it/logos/enel-energia.png',
            description: 'Leading Italian energy supplier since 1962',
            rating: '4.50',
            isActive: true,
            contactEmail: 'info@enelenergia.it',
            contactPhone: '+39023456789',
            website: 'https://www.enelenergia.it',
            supplierCode: 'ENEL-001',
            createdBy: 'admin-uuid',
            updatedBy: 'admin-uuid',
            createdAt: '2026-06-10T12:00:00.000Z',
            updatedAt: '2026-06-10T12:00:00.000Z',
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
          message: ['name should not be empty', 'name must be a string'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Duplicate supplier code',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['A supplier with this supplier code already exists'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateSupplierDto,
  ) {
    const result = await this.suppliersService.create(dto, adminId);
    void this.activityLogService.log(adminId, 'Supplier Created', 'supplier', result.id, { name: dto.name });
    return result;
  }

  @Patch(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Toggle supplier active status (admin)',
    description:
      'Activates or deactivates a supplier. Active suppliers are visible in the public listing; ' +
      'inactive suppliers are hidden from public but still visible to admins.',
  })
  @ApiBody({ type: UpdateSupplierStatusDto })
  @ApiOkResponse({
    description: 'Supplier status updated',
    content: {
      'application/json': {
        examples: {
          activated: {
            summary: 'Supplier activated (visible to public)',
            value: {
              success: true,
              data: {
                id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
                name: 'Enel Energia',
                isActive: true,
                updatedBy: 'admin-uuid',
                updatedAt: '2026-06-10T14:00:00.000Z',
              },
            },
          },
          deactivated: {
            summary: 'Supplier deactivated (hidden from public)',
            value: {
              success: true,
              data: {
                id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
                name: 'Enel Energia',
                isActive: false,
                updatedBy: 'admin-uuid',
                updatedAt: '2026-06-10T14:00:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Supplier not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    const result = await this.suppliersService.toggleStatus(id, dto, adminId);
    void this.activityLogService.log(adminId, 'Supplier Status Toggled', 'supplier', id, { isActive: dto.isActive });
    return result;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update supplier fields (admin)',
    description:
      'Updates supplier fields. All fields are optional. Use `PATCH :id/toggle-status` for active/inactive toggling.',
  })
  @ApiBody({ type: UpdateSupplierDto })
  @ApiOkResponse({
    description: 'Supplier updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
            name: 'Enel Energia S.p.A.',
            rating: '4.70',
            description: 'Updated description after rebrand',
            updatedBy: 'admin-uuid',
            updatedAt: '2026-06-10T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Supplier not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiConflictResponse({
    description: 'Duplicate supplier code after update',
    content: { 'application/json': { example: { success: false, statusCode: 409, message: ['A supplier with this supplier code already exists'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
    @CurrentUser('id') adminId: string,
  ) {
    const result = await this.suppliersService.update(id, dto, adminId);
    void this.activityLogService.log(adminId, 'Supplier Updated', 'supplier', id);
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Delete a supplier (admin)',
    description:
      'Deletes a supplier. If the supplier has active contracts, deletion is scheduled for when the last contract expires. ' +
      'During the pending deletion period, no new offers can be created or sent for this supplier.',
  })
  @ApiOkResponse({
    description: 'Supplier deleted or deletion scheduled',
    content: {
      'application/json': {
        examples: {
          immediate: {
            summary: 'Supplier deleted immediately (no active contracts)',
            value: { success: true, data: { message: 'Supplier deleted successfully' } },
          },
          scheduled: {
            summary: 'Deletion scheduled (active contracts exist)',
            value: {
              success: true,
              data: {
                message: 'Supplier deletion scheduled for 2027-03-15',
                scheduledDeletionDate: '2027-03-15',
                cancelledCases: 2,
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Active contracts have no expiry date set',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['Cannot schedule deletion: the following active contracts have no expiry date set: CTR-001, CTR-002. Please set expiry dates on these contracts first.'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Supplier not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Supplier not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async remove(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const result = await this.suppliersService.deleteSupplier(id, adminId);
    void this.activityLogService.log(
      adminId,
      result.scheduledDeletionDate ? 'Supplier Deletion Scheduled' : 'Supplier Deleted',
      'supplier',
      id,
      { scheduledDeletionDate: result.scheduledDeletionDate || null },
    );
    return result;
  }
}
