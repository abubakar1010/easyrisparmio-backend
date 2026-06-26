import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiBody,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';
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
    description: 'Admin dashboard KPIs, charts, tasks, alerts, and activity',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            kpiStats: {
              totalSwitches: { value: 342, delta: 12.5 },
              activeCustomers: { value: 1247, delta: 8.2 },
              conversionRate: { value: 32.4, delta: 3.1 },
              avgProcessingTime: { value: 18, delta: 2 },
            },
            financialKpis: {
              acquisitionCommission: { total: 12340, count: 124 },
              recurringCommission: { total: 8920, count: 892 },
              pendingRevenue: { total: 34560, count: 67 },
              churnRate: 2.8,
            },
            priorityTasks: {
              missingDocuments: 23,
              expiringContracts: 12,
              pendingValidation: 12,
              followUpRequired: 12,
            },
            conversionFunnel: {
              requestReceived: 342,
              documentation: 298,
              validation: 267,
              activation: 234,
              rejected: 44,
              conversionRate: 68.4,
            },
            revenueTrend: [
              { month: '2025-07', potential: 11500, validated: 8200, collected: 6100 },
              { month: '2025-08', potential: 12300, validated: 9100, collected: 7200 },
            ],
            activeAlerts: [
              {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                alertType: 'duplicate_pod',
                severity: 'critical',
                title: 'Duplicate POD/PDR Detected',
                description: 'Customer ID 4521 has matching meter number with existing contract',
                entityType: 'contract',
                entityId: 'f1a2b3c4-d5e6-7890-abcd-ef1234567890',
                relatedData: null,
                createdAt: '2026-06-24T10:00:00.000Z',
              },
            ],
            recentActivity: [
              {
                id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                action: 'Contract Activated',
                entityType: 'contract',
                entityId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                metadata: { contractNumber: 'CTR-2026-001234' },
                createdAt: '2026-06-24T12:00:00.000Z',
                user: { id: 'd4e5f6a7-b8c9-0123-defa-234567890123', firstName: 'Mario', lastName: 'Rossi' },
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

  // ─── Admin Settings ──────────────────────────────────────

  @Get('admin/settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin settings',
    description: 'Returns admin-wide settings including auto-send offers toggle.',
  })
  @ApiOkResponse({ description: 'Admin settings returned' })
  getAdminSettings() {
    return this.dashboardService.getAdminSettings();
  }

  @Patch('admin/settings')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update admin settings',
    description: 'Updates admin-wide settings such as the auto-send offers toggle.',
  })
  @ApiBody({ type: UpdateAdminSettingsDto })
  @ApiOkResponse({ description: 'Admin settings updated' })
  updateAdminSettings(
    @CurrentUser('id') adminId: string,
    @Body() dto: UpdateAdminSettingsDto,
  ) {
    return this.dashboardService.updateAdminSettings(dto, adminId);
  }
}
