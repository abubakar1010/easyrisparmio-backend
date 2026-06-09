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
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ReferralsService } from './referrals.service';
import { CreateReferralDto } from './dto/create-referral.dto';
import { QueryReferralsDto } from './dto/query-referrals.dto';
import { QueryMyReferralsDto } from './dto/query-my-referrals.dto';
import { UpdateReferralStatusDto } from './dto/update-referral-status.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

@ApiTags('Referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private readonly referralsService: ReferralsService) {}

  // ─── User Endpoints (named routes first) ──────────────────

  @Get('my-code')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Get or generate referral code with stats',
    description:
      'Returns the authenticated user\'s unique referral code, a shareable link, and referral stats. ' +
      'If the user does not yet have a code, one is generated automatically.',
  })
  @ApiOkResponse({
    description: 'Referral code and stats returned',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            referralCode: 'AB3KX7WN',
            shareLink: 'http://localhost:3001/register?ref=AB3KX7WN',
            stats: {
              totalInvites: 5,
              registered: 3,
              qualified: 1,
              rewarded: 1,
              totalEarnings: 10,
            },
          },
        },
      },
    },
  })
  getMyCode(@CurrentUser('id') userId: string) {
    return this.referralsService.getOrGenerateMyCode(userId);
  }

  @Get('my-referrals')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'List my referrals (paginated)',
    description:
      'Returns a paginated list of referrals created by the authenticated user. ' +
      'Optionally filter by status.',
  })
  @ApiOkResponse({ description: 'Paginated list of user referrals' })
  getMyReferrals(
    @CurrentUser('id') userId: string,
    @Query() query: QueryMyReferralsDto,
  ) {
    return this.referralsService.getMyReferrals(userId, query);
  }

  @Post('invite')
  @Roles(UserRole.PERSONAL, UserRole.BUSINESS)
  @ApiOperation({
    summary: 'Send a referral invite',
    description:
      'Creates a new referral invite with PENDING status. Optionally include the referred person\'s ' +
      'email or phone. The invite expires after 90 days.',
  })
  @ApiCreatedResponse({
    description: 'Referral invite created',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            referrerId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            referralCode: 'AB3KX7WN',
            referredEmail: 'friend@email.com',
            referredPhone: null,
            referredUserId: null,
            status: 'pending',
            rewardAmount: null,
            rewardCreditedAt: null,
            expiresAt: '2026-09-07T12:00:00.000Z',
            createdAt: '2026-06-09T12:00:00.000Z',
            updatedAt: '2026-06-09T12:00:00.000Z',
          },
        },
      },
    },
  })
  createInvite(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateReferralDto,
  ) {
    return this.referralsService.createInvite(userId, dto);
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Get('stats')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get referral program KPIs (admin)',
    description: 'Returns aggregate statistics for the referral program.',
  })
  @ApiOkResponse({
    description: 'Referral program statistics',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            totalReferrals: 150,
            pending: 45,
            registered: 60,
            qualified: 25,
            rewarded: 15,
            expired: 5,
            totalRewardsPaid: 150,
          },
        },
      },
    },
  })
  getStats() {
    return this.referralsService.getStats();
  }

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all referrals (admin, paginated)',
    description:
      'Returns a paginated list of all referrals. Supports filtering by status, referrer ID, ' +
      'date range, and search (referrer name/email or referral code).',
  })
  @ApiOkResponse({ description: 'Paginated list of all referrals' })
  findAll(@Query() query: QueryReferralsDto) {
    return this.referralsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get referral detail (admin)',
    description: 'Returns a single referral with referrer and referred user details.',
  })
  @ApiOkResponse({ description: 'Referral details' })
  @ApiNotFoundResponse({
    description: 'Referral not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Referral not found'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.referralsService.findById(id);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update referral status (admin)',
    description:
      'Updates a referral\'s status. Valid transitions: PENDING→REGISTERED, REGISTERED→QUALIFIED, ' +
      'QUALIFIED→REWARDED, any→EXPIRED. When setting to REWARDED, rewardAmount is required.',
  })
  @ApiOkResponse({
    description: 'Referral status updated',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            status: 'rewarded',
            rewardAmount: '10.00',
            rewardCreditedAt: '2026-06-09T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid status transition or missing rewardAmount',
    content: {
      'application/json': {
        examples: {
          invalid_transition: {
            summary: 'Invalid status transition',
            value: {
              success: false,
              statusCode: 400,
              message: ['Cannot transition from pending to rewarded'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          missing_reward: {
            summary: 'Missing rewardAmount',
            value: {
              success: false,
              statusCode: 400,
              message: ['rewardAmount is required when setting status to REWARDED'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferralStatusDto,
  ) {
    return this.referralsService.updateStatus(id, dto);
  }
}
