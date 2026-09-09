import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { QueryPriorityTasksDto } from './dto/query-priority-tasks.dto';
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
      'active cases, contracts by status, and recent activity. Admin only.',
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

  @Get('admin/tasks')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List the customers and cases behind the priority-task buckets',
    description:
      'The rows behind the counts on the Priority Tasks card. Pass `category` to ' +
      'open one bucket, or omit it to get every open task ordered by urgency — ' +
      'which is what "View all tasks" asks for. Both come out of the same ' +
      'definition as the counts, so a number on the card always opens exactly ' +
      'that many rows. Admin only.',
  })
  @ApiOkResponse({
    description: 'Paginated list of open tasks',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                category: 'pending_validation',
                billId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                caseId: null,
                caseNumber: null,
                status: 'verification_review',
                billType: 'electricity',
                podPdr: 'IT001E98765432',
                supplierName: 'Enel Energia',
                amount: 128.4,
                waitingSince: '2026-06-18T09:12:00.000Z',
                daysWaiting: 6,
                dueDate: null,
                daysUntilDue: null,
                customer: {
                  id: 'd4e5f6a7-b8c9-0123-defa-234567890123',
                  firstName: 'Mario',
                  lastName: 'Rossi',
                  email: 'mario.rossi@example.it',
                  phone: '+39 333 1234567',
                  role: 'personal',
                },
              },
            ],
            meta: { total: 23, page: 1, limit: 20, totalPages: 2 },
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
  getPriorityTasks(@Query() query: QueryPriorityTasksDto) {
    return this.dashboardService.getPriorityTaskList(query);
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

}
