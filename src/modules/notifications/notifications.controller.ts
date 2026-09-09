import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
  ApiParam,
} from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { QueryAdminNotificationsDto } from './dto/query-admin-notifications.dto';
import { QueryCustomerNotificationsDto } from './dto/query-customer-notifications.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get user notifications (paginated)',
    description:
      'Returns the authenticated user\'s notifications with pagination support. ' +
      'Can be filtered by notification type and read/unread status. Results are ordered by newest first.',
  })
  @ApiOkResponse({
    description: 'Paginated list of user notifications',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'n1a2b3c4-d5e6-7890-abcd-ef1234567890',
                userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                title: 'Bill Analyzed',
                body: 'Your electricity bill has been analyzed. You could save up to 15% by switching.',
                type: 'bill_analyzed',
                data: { billId: 'b1c2d3e4-f5a6-7890-bcde-f12345678901' },
                isRead: false,
                readAt: null,
                createdAt: '2026-06-20T14:30:00.000Z',
                updatedAt: '2026-06-20T14:30:00.000Z',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  getUserNotifications(
    @CurrentUser('id') userId: string,
    @Query() query: QueryNotificationsDto,
  ) {
    return this.notificationsService.getUserNotifications(userId, query);
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count',
    description:
      'Returns the total number of unread notifications for the authenticated user. ' +
      'Useful for displaying badge counts in the mobile app.',
  })
  @ApiOkResponse({
    description: 'Unread notification count',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            count: 5,
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  async getUnreadCount(@CurrentUser('id') userId: string) {
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  @Patch(':id/read')
  @ApiOperation({
    summary: 'Mark a notification as read',
    description:
      'Marks a single notification as read and sets the `readAt` timestamp. ' +
      'The notification must belong to the authenticated user.',
  })
  @ApiOkResponse({
    description: 'Notification marked as read',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'n1a2b3c4-d5e6-7890-abcd-ef1234567890',
            userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            title: 'Bill Analyzed',
            body: 'Your electricity bill has been analyzed.',
            type: 'bill_analyzed',
            data: { billId: 'b1c2d3e4-f5a6-7890-bcde-f12345678901' },
            isRead: true,
            readAt: '2026-06-20T15:00:00.000Z',
            createdAt: '2026-06-20T14:30:00.000Z',
            updatedAt: '2026-06-20T15:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification not found or does not belong to the user',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Notification not found'],
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid UUID format',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['Validation failed (uuid is expected)'],
          timestamp: '2026-06-20T12:00:00.000Z',
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  markAsRead(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.notificationsService.markAsRead(id, userId);
  }

  @Patch('read-all')
  @ApiOperation({
    summary: 'Mark all notifications as read',
    description:
      'Marks all unread notifications as read for the authenticated user. ' +
      'Sets `isRead` to true and `readAt` to the current timestamp for all unread notifications.',
  })
  @ApiOkResponse({
    description: 'All notifications marked as read',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'All notifications marked as read',
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  async markAllAsRead(@CurrentUser('id') userId: string) {
    await this.notificationsService.markAllAsRead(userId);
    return { message: 'All notifications marked as read' };
  }

  @Post('push-token')
  @ApiOperation({
    summary: 'Register a push notification token',
    description:
      'Registers a device push notification token (FCM) for the authenticated user. ' +
      'If the token already exists, it is updated with the current user and platform. ' +
      'Each device should register its token on app startup.',
  })
  @ApiBody({ type: RegisterPushTokenDto })
  @ApiCreatedResponse({
    description: 'Push token registered successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'pt1a2b3c-d5e6-7890-abcd-ef1234567890',
            userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            token: 'fMI-EXAMPLE-TOKEN_abc123xyz...',
            platform: 'ios',
            isActive: true,
            createdAt: '2026-06-20T10:00:00.000Z',
            updatedAt: '2026-06-20T10:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed - missing token or invalid platform',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['token should not be empty', 'platform must be a valid enum value (ios, android)'],
          timestamp: '2026-06-20T12:00:00.000Z',
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  registerPushToken(
    @CurrentUser('id') userId: string,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerPushToken(
      userId,
      dto.token,
      dto.platform,
    );
  }

  @Delete('push-token/:token')
  @ApiOperation({
    summary: 'Remove a push notification token',
    description:
      'Removes a device push notification token. Should be called when the user logs out ' +
      'or disables push notifications on a device.',
  })
  @ApiOkResponse({
    description: 'Push token removed successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'Push token removed',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Push token not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Push token not found'],
          timestamp: '2026-06-20T12:00:00.000Z',
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
          timestamp: '2026-06-20T12:00:00.000Z',
        },
      },
    },
  })
  async removePushToken(@Param('token') token: string) {
    await this.notificationsService.removePushToken(token);
    return { message: 'Push token removed' };
  }

  @Get('admin')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get admin notifications (sent & received)',
    description:
      'Returns notifications for the admin panel with direction filtering. ' +
      'Use `direction=sent` for notifications sent by admin, `direction=received` for system notifications, ' +
      'or `direction=all` (default) for both.',
  })
  getAdminNotifications(
    @CurrentUser('id') adminId: string,
    @Query() query: QueryAdminNotificationsDto,
  ) {
    return this.notificationsService.getAdminNotifications(adminId, query);
  }

  @Get('admin/user/:userId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get a customer notification history (admin)',
    description:
      'Every notification this customer received, newest first, with the operator ' +
      'who sent it. Distinct from `GET /notifications/admin`, which is the logged-in ' +
      'admin’s own inbox and outbox. Notifications the platform raised automatically ' +
      'have a null `sender` and should be shown as sent by the system; pass ' +
      '`onlyManual=true` to exclude them.',
  })
  @ApiParam({ name: 'userId', description: 'Customer UUID' })
  @ApiOkResponse({
    description: 'Paginated notification history for the customer',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'n1a2b3c4-d5e6-7890-abcd-ef0123456789',
                title: 'Nuova offerta per te, Mario',
                body: 'Ciao Mario Rossi, la tua pratica Luce con Illumia sta procedendo.',
                type: 'general',
                isRead: false,
                readAt: null,
                sentBy: 'ad1a2b3c-d4e5-6789-abcd-ef0123456789',
                sender: {
                  id: 'ad1a2b3c-d4e5-6789-abcd-ef0123456789',
                  firstName: 'Giulia',
                  lastName: 'Bianchi',
                  email: 'giulia@easyrisparmio.it',
                },
                templateId: 'nt1a2b3c-d4e5-6789-abcd-ef0123456789',
                templateName: 'Promo switch luce',
                createdAt: '2026-08-27T10:00:00.000Z',
              },
            ],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
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
          timestamp: '2026-08-27T12:00:00.000Z',
        },
      },
    },
  })
  getCustomerNotificationHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: QueryCustomerNotificationsDto,
  ) {
    return this.notificationsService.getCustomerNotificationHistory(
      userId,
      query,
    );
  }

  @Get('admin/:id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get notification details (admin)',
    description:
      'Returns full notification details. If the notification is a received notification ' +
      'for the admin and is unread, it is automatically marked as read.',
  })
  getNotificationById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') adminId: string,
  ) {
    return this.notificationsService.getNotificationById(id, adminId);
  }

  @Post('send')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Send notification to a user (admin)',
    description:
      'Sends a notification to a single user identified by `userId`. Also triggers a push ' +
      'notification to the registered devices of that user. Sending one message to a group ' +
      'of customers is not supported. Requires admin role.',
  })
  @ApiBody({ type: SendNotificationDto })
  sendNotification(
    @Body() dto: SendNotificationDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.notificationsService.sendNotification(dto, adminId);
  }
}
