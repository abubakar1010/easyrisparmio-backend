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
  ApiForbiddenResponse,
  ApiBody,
  ApiQuery,
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
      'Returns the authenticated user\'s unique 8-character referral code, a shareable registration link, ' +
      'and aggregate referral stats (total invites, registered, qualified, rewarded, total earnings in EUR). ' +
      'If the user does not yet have a code, one is auto-generated on the first call.',
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-09T12:00:00.000Z',
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
      'Each referral includes the referred user\'s details (if they registered). ' +
      'Optionally filter by status.',
  })
  @ApiOkResponse({
    description: 'Paginated list of user referrals',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
                referrerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                referralCode: 'AB3KX7WN',
                referredEmail: 'friend@email.com',
                referredPhone: null,
                referredUserId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                status: 'registered',
                rewardAmount: null,
                rewardCreditedAt: null,
                expiresAt: '2026-09-07T12:00:00.000Z',
                createdAt: '2026-06-09T12:00:00.000Z',
                updatedAt: '2026-06-10T08:00:00.000Z',
                referredUser: {
                  id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                  email: 'friend@email.com',
                  firstName: 'Giulia',
                  lastName: 'Bianchi',
                },
              },
            ],
            meta: {
              total: 1,
              page: 1,
              limit: 20,
              totalPages: 1,
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
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
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
      'email or phone number for a targeted invite. If no email/phone is provided, a generic invite ' +
      'is created that can be fulfilled by anyone using the referral code. Invites expire after 90 days.',
  })
  @ApiBody({ type: CreateReferralDto })
  @ApiCreatedResponse({
    description: 'Referral invite created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
            referrerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
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
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['referredEmail must be an email'],
          timestamp: '2026-06-09T12:00:00.000Z',
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
          timestamp: '2026-06-09T12:00:00.000Z',
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
    description:
      'Returns aggregate statistics for the entire referral program: total referrals, counts by status, ' +
      'and total rewards paid in EUR.',
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-09T12:00:00.000Z',
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
          timestamp: '2026-06-09T12:00:00.000Z',
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
      'Returns a paginated list of all referrals with referrer and referred user details. ' +
      'Supports filtering by status, referrer ID, date range, and text search ' +
      '(matches referrer name, email, or referral code).',
  })
  @ApiOkResponse({
    description: 'Paginated list of all referrals',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
                referrerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                referralCode: 'AB3KX7WN',
                referredEmail: 'friend@email.com',
                referredPhone: null,
                referredUserId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                status: 'registered',
                rewardAmount: null,
                rewardCreditedAt: null,
                expiresAt: '2026-09-07T12:00:00.000Z',
                createdAt: '2026-06-09T12:00:00.000Z',
                updatedAt: '2026-06-10T08:00:00.000Z',
                referrer: {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  email: 'mario.rossi@email.com',
                  firstName: 'Mario',
                  lastName: 'Rossi',
                },
                referredUser: {
                  id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                  email: 'friend@email.com',
                  firstName: 'Giulia',
                  lastName: 'Bianchi',
                },
              },
            ],
            meta: {
              total: 1,
              page: 1,
              limit: 20,
              totalPages: 1,
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
          timestamp: '2026-06-09T12:00:00.000Z',
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
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  findAll(@Query() query: QueryReferralsDto) {
    return this.referralsService.findAll(query);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get referral detail (admin)',
    description: 'Returns a single referral with full referrer and referred user details.',
  })
  @ApiOkResponse({
    description: 'Referral details',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
            referrerId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            referralCode: 'AB3KX7WN',
            referredEmail: 'friend@email.com',
            referredPhone: null,
            referredUserId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            status: 'qualified',
            rewardAmount: null,
            rewardCreditedAt: null,
            expiresAt: '2026-09-07T12:00:00.000Z',
            createdAt: '2026-06-09T12:00:00.000Z',
            updatedAt: '2026-06-15T10:00:00.000Z',
            referrer: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              email: 'mario.rossi@email.com',
              firstName: 'Mario',
              lastName: 'Rossi',
            },
            referredUser: {
              id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
              email: 'friend@email.com',
              firstName: 'Giulia',
              lastName: 'Bianchi',
            },
          },
        },
      },
    },
  })
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
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
      'Updates a referral\'s status. Valid transitions:\n' +
      '- PENDING → REGISTERED or EXPIRED\n' +
      '- REGISTERED → QUALIFIED or EXPIRED\n' +
      '- QUALIFIED → REWARDED or EXPIRED\n' +
      '- REWARDED and EXPIRED are terminal states\n\n' +
      'When setting status to `rewarded`, the `rewardAmount` field (EUR) is required.',
  })
  @ApiBody({ type: UpdateReferralStatusDto })
  @ApiOkResponse({
    description: 'Referral status updated successfully',
    content: {
      'application/json': {
        examples: {
          qualified: {
            summary: 'Marked as qualified',
            value: {
              success: true,
              data: {
                id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
                referralCode: 'AB3KX7WN',
                status: 'qualified',
                rewardAmount: null,
                rewardCreditedAt: null,
                createdAt: '2026-06-09T12:00:00.000Z',
                updatedAt: '2026-06-15T10:00:00.000Z',
              },
            },
          },
          rewarded: {
            summary: 'Marked as rewarded with amount',
            value: {
              success: true,
              data: {
                id: 'r1a2b3c4-d5e6-7890-abcd-ef1234567890',
                referralCode: 'AB3KX7WN',
                status: 'rewarded',
                rewardAmount: '10.00',
                rewardCreditedAt: '2026-06-15T14:00:00.000Z',
                createdAt: '2026-06-09T12:00:00.000Z',
                updatedAt: '2026-06-15T14:00:00.000Z',
              },
            },
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
            summary: 'Missing rewardAmount for REWARDED status',
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
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-09T12:00:00.000Z',
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
