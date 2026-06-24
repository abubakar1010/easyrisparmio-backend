import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('admin')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin dashboard KPIs and charts data',
    description:
      'Returns key performance indicators for the admin panel including total users, ' +
      'active cases, contracts by status, commission totals, and recent activity. Admin only.',
  })
  @ApiOkResponse({
    description: 'Admin dashboard KPIs',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            totalUsers: 1245,
            totalPersonalUsers: 980,
            totalBusinessUsers: 265,
            totalCases: 387,
            activeCases: 52,
            totalContracts: 312,
            contractsByStatus: {
              draft: 15,
              sent: 23,
              signed: 8,
              active: 248,
              expired: 12,
              cancelled: 6,
            },
            commissions: {
              totalPending: '2340.00',
              totalApproved: '8750.50',
              totalPaid: '45230.00',
            },
            recentSignups: 34,
            monthlyRevenue: '12500.00',
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
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('user')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Get user personal dashboard summary',
    description:
      'Returns a summary for the authenticated user including their active contracts, ' +
      'pending cases, latest bills, and estimated savings. Available to personal and business users.',
  })
  @ApiOkResponse({
    description: 'User dashboard summary',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            activeCases: 2,
            activeContracts: 3,
            totalBills: 12,
            pendingBills: 1,
            estimatedMonthlySaving: '32.50',
            recentCases: [
              {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                status: 'in_progress',
                energyType: 'electricity',
                createdAt: '2026-06-15T10:00:00.000Z',
              },
            ],
            recentContracts: [
              {
                id: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
                contractNumber: 'CTR-2026-001234',
                status: 'active',
                podPdrNumber: 'IT001E98765432',
                monthlyEstimate: '85.50',
              },
            ],
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
    description: 'User does not have personal or business role',
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
  getUserDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getUserDashboard(userId);
  }
}
