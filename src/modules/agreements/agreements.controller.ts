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
  ApiBody,
} from '@nestjs/swagger';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from './dto/update-agreement-status.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

const AGREEMENT_EXAMPLE = {
  id: 'ag1a2b3c-d5e6-7890-abcd-ef1234567890',
  title: '20% Off on Enel Smart Home Kit',
  description: 'Exclusive discount on smart home energy monitoring devices for EasyRisparmio users',
  partnerName: 'Enel X',
  partnerLogoUrl: 'https://cdn.easyresparmio.it/partners/enel-x.png',
  discountDescription: '20% off on all smart home kits. Use code EASY20 at checkout.',
  termsUrl: 'https://www.enelx.com/terms/easy-risparmio',
  isActive: true,
  targetAudience: 'both',
  validFrom: '2026-01-01',
  validUntil: '2026-12-31',
  sortOrder: 1,
  createdBy: 'admin-uuid',
  updatedBy: 'admin-uuid',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const AGREEMENT_EXAMPLE_2 = {
  id: 'ag2b3c4d-e6f7-8901-bcde-f23456789012',
  title: 'Free Energy Audit from Edison',
  description: 'Get a free home energy efficiency audit from Edison certified technicians',
  partnerName: 'Edison',
  partnerLogoUrl: 'https://cdn.easyresparmio.it/partners/edison.png',
  discountDescription: 'Free in-home energy audit (valued at €150). Book via the partner website.',
  termsUrl: 'https://www.edison.it/terms/easy-audit',
  isActive: true,
  targetAudience: 'personal',
  validFrom: '2026-03-01',
  validUntil: null,
  sortOrder: 2,
  createdBy: 'admin-uuid',
  updatedBy: 'admin-uuid',
  createdAt: '2026-05-15T08:00:00.000Z',
  updatedAt: '2026-05-15T08:00:00.000Z',
};

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

@ApiTags('Agreements')
@Controller('agreements')
export class AgreementsController {
  constructor(private readonly agreementsService: AgreementsService) {}

  // ─── User Endpoints ───────────────────────────────────────

  @Get('my-agreements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my available agreements (user)',
    description:
      'Returns active partner agreements available to the authenticated user. ' +
      'Agreements are filtered by the user\'s role (personal/business) and current validity dates. ' +
      'Sorted by display order, then by creation date. No pagination — typically 5-15 agreements.',
  })
  @ApiOkResponse({
    description: 'List of available agreements',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [AGREEMENT_EXAMPLE, AGREEMENT_EXAMPLE_2],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  getMyAgreements(@CurrentUser('role') userRole: UserRole) {
    return this.agreementsService.findAllForUser(userRole);
  }

  @Get('my-agreements/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Get agreement details (user)',
    description:
      'Returns full details of a specific partner agreement. ' +
      'Only returns the agreement if it is active, matches the user\'s role, and is within its validity period.',
  })
  @ApiOkResponse({
    description: 'Agreement details',
    content: {
      'application/json': {
        example: { success: true, data: AGREEMENT_EXAMPLE },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Agreement not found or not available for this user',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Agreement not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  getMyAgreementById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.agreementsService.findByIdForUser(id, userRole);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all agreements (admin, paginated)',
    description:
      'Returns a paginated list of all agreements including inactive ones. ' +
      'Supports filtering by active status, target audience, and text search (title, partner name, description).',
  })
  @ApiOkResponse({
    description: 'Paginated list of all agreements',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              AGREEMENT_EXAMPLE,
              {
                ...AGREEMENT_EXAMPLE_2,
                isActive: false,
                targetAudience: 'business',
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
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  findAllAdmin(@Query() query: QueryAgreementsDto) {
    return this.agreementsService.findAllAdmin(query);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get agreement detail (admin)',
    description: 'Returns a single agreement with full details. Admin can view any agreement regardless of status or validity.',
  })
  @ApiOkResponse({
    description: 'Agreement details',
    content: {
      'application/json': {
        example: { success: true, data: AGREEMENT_EXAMPLE },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Agreement not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Agreement not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.agreementsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new agreement (admin)',
    description:
      'Creates a new partner agreement/discount. Set `isActive` to control visibility to users. ' +
      'Use `targetAudience` to target personal users, business users, or both. ' +
      'The `createdBy` and `updatedBy` fields are automatically set from the admin JWT.',
  })
  @ApiBody({ type: CreateAgreementDto })
  @ApiCreatedResponse({
    description: 'Agreement created successfully',
    content: {
      'application/json': {
        example: { success: true, data: AGREEMENT_EXAMPLE },
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
          message: [
            'title should not be empty',
            'partnerName should not be empty',
            'validFrom must be a valid ISO 8601 date string',
          ],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  create(
    @CurrentUser('id') adminId: string,
    @Body() dto: CreateAgreementDto,
  ) {
    return this.agreementsService.create(dto, adminId);
  }

  @Patch(':id/toggle-status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Toggle agreement visibility (admin)',
    description:
      'Activates or deactivates an agreement. Active agreements are shown to users in the mobile app; ' +
      'inactive agreements are hidden but preserved for admin reference.',
  })
  @ApiBody({ type: UpdateAgreementStatusDto })
  @ApiOkResponse({
    description: 'Agreement status updated',
    content: {
      'application/json': {
        examples: {
          activated: {
            summary: 'Agreement activated (visible to users)',
            value: {
              success: true,
              data: { ...AGREEMENT_EXAMPLE, isActive: true, updatedAt: '2026-06-10T14:00:00.000Z' },
            },
          },
          deactivated: {
            summary: 'Agreement deactivated (hidden from users)',
            value: {
              success: true,
              data: { ...AGREEMENT_EXAMPLE, isActive: false, updatedAt: '2026-06-10T14:00:00.000Z' },
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Agreement not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Agreement not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  toggleStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgreementStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.agreementsService.toggleStatus(id, dto, adminId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update agreement fields (admin)',
    description:
      'Updates agreement fields. All fields are optional. Use `PATCH :id/toggle-status` for active/inactive toggling.',
  })
  @ApiBody({ type: UpdateAgreementDto })
  @ApiOkResponse({
    description: 'Agreement updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...AGREEMENT_EXAMPLE,
            discountDescription: '25% off on all smart home kits — increased discount!',
            sortOrder: 0,
            updatedAt: '2026-06-10T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Agreement not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Agreement not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgreementDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.agreementsService.update(id, dto, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft-delete an agreement (admin)',
    description:
      'Marks the agreement as deleted (sets `deleted_at`). The agreement is hidden from all queries but preserved in the database.',
  })
  @ApiOkResponse({
    description: 'Agreement deleted successfully',
    content: { 'application/json': { example: { success: true, data: { message: 'Agreement deleted successfully' } } } },
  })
  @ApiNotFoundResponse({
    description: 'Agreement not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Agreement not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.agreementsService.softDelete(id);
    return { message: 'Agreement deleted successfully' };
  }
}
