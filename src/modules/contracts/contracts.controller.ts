import {
  Controller,
  Get,
  Post,
  Patch,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Contracts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  // ─── User Endpoints (named routes first) ──────────────────

  @Get('my-contracts')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my contracts',
    description: 'Returns all contracts for the authenticated user with offer and supplier details.',
  })
  @ApiOkResponse({ description: 'List of user contracts' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getMyContracts(@CurrentUser('id') userId: string) {
    return this.contractsService.getUserContracts(userId);
  }

  @Get('my-contracts/:id')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Get my contract by ID',
    description: 'Returns a single contract for the authenticated user. Access denied if user does not own the contract.',
  })
  @ApiOkResponse({ description: 'Contract found' })
  @ApiNotFoundResponse({ description: 'Contract not found' })
  @ApiForbiddenResponse({ description: 'User does not own this contract' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  getMyContractById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.contractsService.getUserContractById(id, userId);
  }

  @Patch('my-contracts/:id/upload-signed')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Upload signed contract document',
    description:
      'Allows the user to upload the signed contract. Sets contract status to SIGNED, ' +
      'records the signing timestamp, and syncs the case status to CONTRACT_SIGNED.',
  })
  @ApiOkResponse({ description: 'Signed contract uploaded' })
  @ApiNotFoundResponse({ description: 'Contract not found' })
  @ApiForbiddenResponse({ description: 'User does not own this contract' })
  @ApiBadRequestResponse({ description: 'Contract must be in SENT status' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
  uploadSignedContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { signedDocumentUrl: string },
  ) {
    return this.contractsService.uploadSignedContract(id, userId, body.signedDocumentUrl);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a contract for a case',
    description:
      'Creates a new energy supply contract linked to an existing switch case. ' +
      'The contract is initialized with status `draft`. Only admins can create contracts.',
  })
  @ApiBody({ type: CreateContractDto })
  @ApiCreatedResponse({
    description: 'Contract created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            caseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            offerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            contractNumber: 'CTR-2026-001234',
            status: 'draft',
            podPdrNumber: 'IT001E98765432',
            activationDate: null,
            expiryDate: null,
            signedAt: null,
            signedDocumentUrl: null,
            monthlyEstimate: null,
            renewalDate: null,
            cancellationReason: null,
            createdAt: '2026-06-24T10:00:00.000Z',
            updatedAt: '2026-06-24T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or contract already exists for this case',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: [
            'caseId must be a UUID',
            'contractNumber should not be empty',
          ],
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
  create(@Body() dto: CreateContractDto) {
    return this.contractsService.createContract(dto);
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all contracts (paginated)',
    description:
      'Returns a paginated list of all energy supply contracts. ' +
      'Supports search by contract number or POD/PDR. Admin only.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'CTR-2026' })
  @ApiOkResponse({
    description: 'Paginated list of contracts',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
                caseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                offerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                contractNumber: 'CTR-2026-001234',
                status: 'active',
                podPdrNumber: 'IT001E98765432',
                activationDate: '2026-01-15',
                expiryDate: '2027-01-15',
                signedAt: '2026-01-10T14:30:00.000Z',
                signedDocumentUrl: '/uploads/contracts/signed-001234.pdf',
                monthlyEstimate: '85.50',
                renewalDate: null,
                cancellationReason: null,
                createdAt: '2026-01-05T10:00:00.000Z',
                updatedAt: '2026-01-15T10:00:00.000Z',
              },
            ],
            meta: {
              total: 47,
              page: 1,
              limit: 10,
              totalPages: 5,
            },
          },
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
  findAll(@Query() query: PaginationDto) {
    return this.contractsService.getContracts(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a contract by ID',
    description:
      'Returns a single contract with its full details including related case, offer, and user information. Admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Contract UUID', example: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @ApiOkResponse({
    description: 'Contract found',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            caseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            offerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            contractNumber: 'CTR-2026-001234',
            status: 'active',
            podPdrNumber: 'IT001E98765432',
            activationDate: '2026-01-15',
            expiryDate: '2027-01-15',
            signedAt: '2026-01-10T14:30:00.000Z',
            signedDocumentUrl: '/uploads/contracts/signed-001234.pdf',
            monthlyEstimate: '85.50',
            renewalDate: null,
            cancellationReason: null,
            createdAt: '2026-01-05T10:00:00.000Z',
            updatedAt: '2026-01-15T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Contract not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Contract not found'],
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
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.getContractById(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update contract status, dates, or details',
    description:
      'Updates an existing contract. Can change status (draft, sent, signed, active, expired, cancelled), ' +
      'set activation/expiry dates, attach signed document URL, or set monthly cost estimate. Admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Contract UUID', example: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @ApiBody({ type: UpdateContractDto })
  @ApiOkResponse({
    description: 'Contract updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            caseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            offerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            contractNumber: 'CTR-2026-001234',
            status: 'signed',
            podPdrNumber: 'IT001E98765432',
            activationDate: '2026-02-01',
            expiryDate: '2027-02-01',
            signedAt: '2026-01-20T09:15:00.000Z',
            signedDocumentUrl: '/uploads/contracts/signed-001234.pdf',
            monthlyEstimate: '92.30',
            renewalDate: null,
            cancellationReason: null,
            createdAt: '2026-01-05T10:00:00.000Z',
            updatedAt: '2026-06-24T10:00:00.000Z',
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
          message: ['status must be one of the following values: draft, sent, signed, active, expired, cancelled'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Contract not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Contract not found'],
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.contractsService.updateContract(id, dto);
  }

  @Get('case/:caseId')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get contract by case ID',
    description:
      'Returns the contract associated with a specific switch case. ' +
      'Each case has at most one contract. Admin only.',
  })
  @ApiParam({ name: 'caseId', type: String, description: 'Switch case UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiOkResponse({
    description: 'Contract found for the given case',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            caseId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            offerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            userId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            contractNumber: 'CTR-2026-001234',
            status: 'active',
            podPdrNumber: 'IT001E98765432',
            activationDate: '2026-01-15',
            expiryDate: '2027-01-15',
            signedAt: '2026-01-10T14:30:00.000Z',
            signedDocumentUrl: '/uploads/contracts/signed-001234.pdf',
            monthlyEstimate: '85.50',
            renewalDate: null,
            cancellationReason: null,
            createdAt: '2026-01-05T10:00:00.000Z',
            updatedAt: '2026-01-15T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'No contract found for this case',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Contract not found for this case'],
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
  findByCase(@Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.contractsService.getContractByCase(caseId);
  }
}
