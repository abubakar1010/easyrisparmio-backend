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
} from '@nestjs/swagger';
import { CommissionsService } from './commissions.service';
import { CreateCommissionRuleDto } from './dto/create-commission-rule.dto';
import { QueryCommissionsDto } from './dto/query-commissions.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Commissions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('commissions')
export class CommissionsController {
  constructor(private readonly commissionsService: CommissionsService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all commissions (admin: all; agent: own)',
    description:
      'Returns a paginated list of commissions. Admins see all commissions across agents. ' +
      'Supports filtering by agent, supplier, status, and date range.',
  })
  @ApiOkResponse({
    description: 'Paginated list of commissions',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'e1f2a3b4-c5d6-7890-abcd-ef1234567890',
                contractId: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
                agentId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
                amount: '45.00',
                status: 'pending',
                type: 'activation',
                energyType: 'electricity',
                approvedAt: null,
                paidAt: null,
                createdAt: '2026-06-20T10:00:00.000Z',
                updatedAt: '2026-06-20T10:00:00.000Z',
              },
            ],
            meta: {
              total: 128,
              page: 1,
              limit: 10,
              totalPages: 13,
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
  findAll(
    @Query() query: QueryCommissionsDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.commissionsService.getCommissions(query, user);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get commission summary statistics',
    description:
      'Returns aggregate commission statistics including total amounts by status ' +
      '(pending, approved, paid) and counts. Useful for the admin dashboard.',
  })
  @ApiOkResponse({
    description: 'Commission statistics',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            totalPending: '2340.00',
            totalApproved: '8750.50',
            totalPaid: '45230.00',
            countPending: 52,
            countApproved: 31,
            countPaid: 215,
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
  getStats(@CurrentUser() user: { id: string; role: UserRole }) {
    return this.commissionsService.getCommissionStats(user);
  }

  @Post('rules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new commission rule',
    description:
      'Creates a commission rule that defines how much commission is earned per contract activation ' +
      'for a given supplier and energy type. Can be a fixed EUR amount or a percentage.',
  })
  @ApiBody({ type: CreateCommissionRuleDto })
  @ApiCreatedResponse({
    description: 'Commission rule created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
            energyType: 'electricity',
            commissionAmount: 45.0,
            commissionPercentage: null,
            isActive: true,
            validFrom: '2026-01-01',
            validUntil: null,
            createdAt: '2026-06-24T10:00:00.000Z',
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
          message: [
            'supplierId must be a UUID',
            'commissionAmount must be a number',
            'energyType must be one of the following values: electricity, gas, dual',
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
  createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionsService.createRule(dto);
  }

  @Get('rules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get all commission rules',
    description:
      'Returns all commission rules, both active and inactive. ' +
      'Rules define the commission amount or percentage per supplier and energy type.',
  })
  @ApiOkResponse({
    description: 'List of all commission rules',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
              energyType: 'electricity',
              commissionAmount: 45.0,
              commissionPercentage: null,
              isActive: true,
              validFrom: '2026-01-01',
              validUntil: null,
              createdAt: '2026-01-01T10:00:00.000Z',
              updatedAt: '2026-01-01T10:00:00.000Z',
            },
            {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
              energyType: 'gas',
              commissionAmount: 35.0,
              commissionPercentage: null,
              isActive: true,
              validFrom: '2026-01-01',
              validUntil: '2026-12-31',
              createdAt: '2026-01-01T10:00:00.000Z',
              updatedAt: '2026-01-01T10:00:00.000Z',
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
  getRules() {
    return this.commissionsService.getRules();
  }

  @Patch('rules/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update a commission rule',
    description:
      'Updates an existing commission rule. Can modify the amount, percentage, active status, ' +
      'energy type, or validity period. Admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Commission rule UUID', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiBody({ type: CreateCommissionRuleDto })
  @ApiOkResponse({
    description: 'Commission rule updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
            energyType: 'electricity',
            commissionAmount: 50.0,
            commissionPercentage: null,
            isActive: true,
            validFrom: '2026-01-01',
            validUntil: '2027-06-30',
            createdAt: '2026-01-01T10:00:00.000Z',
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
          message: ['commissionAmount must be a number'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Commission rule not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Commission rule not found'],
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
  updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCommissionRuleDto>,
  ) {
    return this.commissionsService.updateRule(id, dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Approve a pending commission',
    description:
      'Transitions a commission from `pending` to `approved` status. ' +
      'Only pending commissions can be approved. Admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Commission UUID', example: 'e1f2a3b4-c5d6-7890-abcd-ef1234567890' })
  @ApiOkResponse({
    description: 'Commission approved successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'e1f2a3b4-c5d6-7890-abcd-ef1234567890',
            contractId: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            agentId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
            amount: '45.00',
            status: 'approved',
            type: 'activation',
            energyType: 'electricity',
            approvedAt: '2026-06-24T10:00:00.000Z',
            paidAt: null,
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-24T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Commission is not in pending status',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['Commission is not in pending status'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Commission not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Commission not found'],
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
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.approveCommission(id);
  }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Mark an approved commission as paid',
    description:
      'Transitions a commission from `approved` to `paid` status. ' +
      'Only approved commissions can be marked as paid. Records the payment timestamp. Admin only.',
  })
  @ApiParam({ name: 'id', type: String, description: 'Commission UUID', example: 'e1f2a3b4-c5d6-7890-abcd-ef1234567890' })
  @ApiOkResponse({
    description: 'Commission marked as paid',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'e1f2a3b4-c5d6-7890-abcd-ef1234567890',
            contractId: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
            agentId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            supplierId: 'd4e5f6a7-b8c9-0123-defg-234567890123',
            amount: '45.00',
            status: 'paid',
            type: 'activation',
            energyType: 'electricity',
            approvedAt: '2026-06-22T10:00:00.000Z',
            paidAt: '2026-06-24T14:30:00.000Z',
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-24T14:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Commission is not in approved status',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['Commission is not in approved status'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Commission not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Commission not found'],
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
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.markAsPaid(id);
  }
}
