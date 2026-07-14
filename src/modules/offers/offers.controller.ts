import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
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
  ApiQuery,
} from '@nestjs/swagger';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

// Shared example fragments
const OFFER_EXAMPLE = {
  id: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890',
  name: 'Casa Luce Fix 12',
  description: 'Fixed-price electricity plan for residential customers with 12-month lock-in',
  energyType: 'electricity',
  marketType: 'fixed',
  pricePerKwh: '0.085000',
  pricePerSmc: null,
  fixedMonthlyFee: '9.90',
  activationCost: '0.00',
  contractDurationMonths: 12,
  isGreenEnergy: true,
  isActive: true,
  validFrom: '2026-01-01',
  validUntil: '2026-12-31',
  termsUrl: 'https://www.enelenergia.it/terms/casa-luce-fix',
  target: 'personal',
  highlights: ['Fixed price for 12 months', 'No activation fee', '100% green energy'],
  offerCode: 'CLF-12-2026',
  offerStatus: 'active',
  version: 1,
  parentOfferId: null,
  supplierId: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
  createdBy: 'admin-uuid',
  updatedBy: 'admin-uuid',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const OFFER_WITH_SUPPLIER = {
  ...OFFER_EXAMPLE,
  supplier: {
    id: 's1a2b3c4-d5e6-7890-abcd-ef1234567890',
    name: 'Enel Energia',
    logoUrl: 'https://cdn.easyresparmio.it/logos/enel-energia.png',
  },
};

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

@ApiTags('Offers')
@Controller('offers')
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  // ─── Public Endpoints ─────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'List active offers (public)',
    description:
      'Returns a paginated list of published, active offers with supplier details. ' +
      'No authentication required. Supports text search by offer name, description, and offer code.',
  })
  @ApiOkResponse({
    description: 'Paginated list of active offers',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [OFFER_WITH_SUPPLIER],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  async findAllPublic(@Query() query: PaginationDto, @Req() req: any) {
    const result = await this.offersService.findAllPublic(query);
    result.data = this.offersService.resolveOffersLocale(result.data, (req as any).locale);
    return result;
  }

  @Get('compare')
  @ApiOperation({
    summary: 'Compare multiple offers side by side',
    description:
      'Returns full details of multiple offers for comparison. ' +
      'Pass a comma-separated list of offer UUIDs. Maximum practical limit: 5 offers.',
  })
  @ApiQuery({
    name: 'ids',
    type: String,
    description: 'Comma-separated offer UUIDs',
    example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890,o2b3c4d5-e6f7-8901-bcde-f23456789012',
  })
  @ApiOkResponse({
    description: 'Array of offers for comparison',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            OFFER_WITH_SUPPLIER,
            {
              ...OFFER_WITH_SUPPLIER,
              id: 'o2b3c4d5-e6f7-8901-bcde-f23456789012',
              name: 'Gas Sicuro 24',
              energyType: 'gas',
              pricePerKwh: null,
              pricePerSmc: '0.450000',
              offerCode: 'GS-24-2026',
              contractDurationMonths: 24,
              isGreenEnergy: false,
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'No offers found for the provided IDs',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['No offers found for the provided IDs'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async compareOffers(@Query('ids') ids: string, @Req() req: any) {
    const idArray = ids.split(',').map((id) => id.trim());
    const offers = await this.offersService.compareOffers(idArray);
    return this.offersService.resolveOffersLocale(offers, (req as any).locale);
  }

  @Get('recommended/:billId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get recommended offers based on a bill',
    description:
      'Returns up to 10 recommended offers based on the user\'s energy bill. ' +
      'Matches by energy type (electricity/gas) and excludes the current supplier. ' +
      'Results are sorted by price ascending (cheapest first).',
  })
  @ApiOkResponse({
    description: 'List of recommended offers (max 10)',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            OFFER_WITH_SUPPLIER,
            {
              ...OFFER_WITH_SUPPLIER,
              id: 'o2b3c4d5-e6f7-8901-bcde-f23456789012',
              name: 'Energia Verde Fix',
              pricePerKwh: '0.078000',
              offerCode: 'EVF-2026',
              supplier: { id: 's2b3c4d5...', name: 'Edison Energia', logoUrl: null },
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Bill not found or does not belong to the user',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Bill not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  async getRecommendedOffers(
    @CurrentUser('id') userId: string,
    @Param('billId', ParseUUIDPipe) billId: string,
    @Req() req: any,
  ) {
    const offers = await this.offersService.getRecommendedOffers(billId, userId);
    return this.offersService.resolveOffersLocale(offers, (req as any).locale);
  }

  @Get('my-offers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get my sent offers',
    description:
      'Returns all offers that have been sent to the authenticated user ' +
      '(either auto-sent after bill analysis or manually sent by an admin). ' +
      'Each record includes the full offer details (live data if available, ' +
      'frozen snapshot as fallback) and the bill it was recommended for.',
  })
  @ApiOkResponse({
    description: 'List of sent offers for the user',
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  async getMyOffers(@CurrentUser('id') userId: string, @Req() req: any) {
    const sentOffers = await this.offersService.getUserSentOffers(userId);
    for (const so of sentOffers) {
      if (so.offer) {
        this.offersService.resolveOfferLocale(so.offer, (req as any).locale);
      }
    }
    return sentOffers;
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all offers (admin, paginated)',
    description:
      'Returns a paginated list of all offers including drafts, inactive, and archived. ' +
      'Supports filtering by energy type, market type, target audience, active status, ' +
      'offer status, supplier, and text search (name, description, offer code).',
  })
  @ApiOkResponse({
    description: 'Paginated list of all offers',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              OFFER_WITH_SUPPLIER,
              {
                ...OFFER_WITH_SUPPLIER,
                id: 'o2b3c4d5-e6f7-8901-bcde-f23456789012',
                name: 'Gas Business Pro',
                energyType: 'gas',
                marketType: 'variable',
                target: 'business',
                offerStatus: 'draft',
                isActive: true,
                pricePerKwh: null,
                pricePerSmc: '0.380000',
                offerCode: 'GBP-2026',
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
  findAllAdmin(@Query() query: QueryOffersDto) {
    return this.offersService.findAllAdmin(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get offer by ID (public)',
    description: 'Returns a single offer with full supplier details. No authentication required.',
  })
  @ApiOkResponse({
    description: 'Offer details',
    content: {
      'application/json': {
        example: { success: true, data: OFFER_WITH_SUPPLIER },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Offer not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Offer not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  async findById(@Param('id', ParseUUIDPipe) id: string, @Req() req: any) {
    const offer = await this.offersService.findById(id);
    return this.offersService.resolveOfferLocale(offer, (req as any).locale);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new offer (admin)',
    description:
      'Creates a new energy offer linked to a supplier. The `offerCode` must be unique if provided. ' +
      'Offers default to `draft` status and `isActive = true`. ' +
      'The `createdBy` and `updatedBy` fields are automatically set from the admin JWT.',
  })
  @ApiBody({ type: CreateOfferDto })
  @ApiCreatedResponse({
    description: 'Offer created successfully',
    content: {
      'application/json': {
        example: { success: true, data: OFFER_EXAMPLE },
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
            'name should not be empty',
            'energyType must be a valid enum value',
            'supplierId must be a UUID',
          ],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Duplicate offer code',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['An offer with this offer code already exists'],
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
    @Body() dto: CreateOfferDto,
  ) {
    return this.offersService.create(dto, adminId);
  }

  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Change offer status (admin moderation)',
    description:
      'Updates an offer\'s lifecycle status. Controls visibility and availability.\n\n' +
      'Valid transitions:\n' +
      '- DRAFT → ACTIVE or ARCHIVED\n' +
      '- ACTIVE → EXPIRING or ARCHIVED\n' +
      '- EXPIRING → EXPIRED or ARCHIVED\n' +
      '- EXPIRED → ARCHIVED\n' +
      '- ARCHIVED is a terminal state (no further transitions)',
  })
  @ApiBody({ type: UpdateOfferStatusDto })
  @ApiOkResponse({
    description: 'Offer status updated',
    content: {
      'application/json': {
        examples: {
          published: {
            summary: 'Offer published (draft → active)',
            value: {
              success: true,
              data: {
                ...OFFER_EXAMPLE,
                offerStatus: 'active',
                updatedAt: '2026-06-10T14:00:00.000Z',
              },
            },
          },
          archived: {
            summary: 'Offer archived',
            value: {
              success: true,
              data: {
                ...OFFER_EXAMPLE,
                offerStatus: 'archived',
                updatedAt: '2026-06-10T14:00:00.000Z',
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
          message: ['Cannot transition from archived to active'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Offer not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Offer not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOfferStatusDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.offersService.updateStatus(id, dto, adminId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update offer fields (admin)',
    description:
      'Updates offer fields. All fields are optional. Use `PATCH :id/status` for status moderation.',
  })
  @ApiBody({ type: UpdateOfferDto })
  @ApiOkResponse({
    description: 'Offer updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...OFFER_EXAMPLE,
            pricePerKwh: '0.079000',
            description: 'Updated price after market review',
            updatedAt: '2026-06-10T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Offer not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Offer not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiConflictResponse({
    description: 'Duplicate offer code after update',
    content: { 'application/json': { example: { success: false, statusCode: 409, message: ['An offer with this offer code already exists'], timestamp: '2026-06-10T12:00:00.000Z' } } },
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
    @Body() dto: UpdateOfferDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.offersService.update(id, dto, adminId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft-delete an offer (admin)',
    description:
      'Marks the offer as deleted (sets `deleted_at`). The offer is hidden from all queries but preserved in the database.',
  })
  @ApiOkResponse({
    description: 'Offer deleted successfully',
    content: { 'application/json': { example: { success: true, data: { message: 'Offer deleted successfully' } } } },
  })
  @ApiNotFoundResponse({
    description: 'Offer not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Offer not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
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
    await this.offersService.softDelete(id);
    return { message: 'Offer deleted successfully' };
  }
}
