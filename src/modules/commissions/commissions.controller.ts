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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
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
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get all commissions (admin: all; agent: own)' })
  findAll(
    @Query() query: QueryCommissionsDto,
    @CurrentUser() user: { id: string; role: UserRole },
  ) {
    return this.commissionsService.getCommissions(query, user);
  }

  @Get('stats')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get commission summary statistics' })
  getStats(@CurrentUser() user: { id: string; role: UserRole }) {
    return this.commissionsService.getCommissionStats(user);
  }

  @Post('rules')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Create a new commission rule' })
  createRule(@Body() dto: CreateCommissionRuleDto) {
    return this.commissionsService.createRule(dto);
  }

  @Get('rules')
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiOperation({ summary: 'Get all commission rules' })
  getRules() {
    return this.commissionsService.getRules();
  }

  @Patch('rules/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Update a commission rule' })
  updateRule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateCommissionRuleDto>,
  ) {
    return this.commissionsService.updateRule(id, dto);
  }

  @Patch(':id/approve')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Approve a pending commission' })
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.approveCommission(id);
  }

  @Patch(':id/pay')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Mark an approved commission as paid' })
  markPaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.commissionsService.markAsPaid(id);
  }
}
