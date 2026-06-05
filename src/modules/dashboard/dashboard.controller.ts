import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Get admin dashboard KPIs and charts data' })
  getAdminDashboard() {
    return this.dashboardService.getAdminDashboard();
  }

  @Get('agent')
  @Roles(UserRole.AGENT)
  @ApiOperation({ summary: 'Get agent personal stats dashboard' })
  getAgentDashboard(@CurrentUser('id') agentId: string) {
    return this.dashboardService.getAgentDashboard(agentId);
  }

  @Get('user')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({ summary: 'Get user personal dashboard summary' })
  getUserDashboard(@CurrentUser('id') userId: string) {
    return this.dashboardService.getUserDashboard(userId);
  }
}
