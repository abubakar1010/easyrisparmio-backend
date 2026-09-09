import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
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
import { NotificationTemplatesService } from './notification-templates.service';
import { CreateNotificationTemplateDto } from './dto/create-notification-template.dto';
import { UpdateNotificationTemplateDto } from './dto/update-notification-template.dto';
import { QueryNotificationTemplatesDto } from './dto/query-notification-templates.dto';
import { PreviewNotificationDto } from './dto/preview-notification.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

const TEMPLATE_EXAMPLE = {
  id: 'nt1a2b3c-d4e5-6789-abcd-ef0123456789',
  name: 'Promo switch luce',
  description: 'Invito a passare a una nuova offerta luce.',
  category: 'promotional',
  title: 'Nuova offerta per te, {{firstName}}',
  body: 'Ciao {{name}}, la tua pratica {{utility_type}} con {{provider}} sta procedendo.',
  type: 'general',
  isActive: true,
  variables: ['firstName', 'name', 'utility_type', 'provider'],
  createdBy: 'ad1a2b3c-d4e5-6789-abcd-ef0123456789',
  updatedBy: 'ad1a2b3c-d4e5-6789-abcd-ef0123456789',
  createdAt: '2026-08-27T10:00:00.000Z',
  updatedAt: '2026-08-27T10:00:00.000Z',
};

const ERROR_401 = {
  success: false,
  statusCode: 401,
  message: ['Unauthorized'],
  timestamp: '2026-08-27T12:00:00.000Z',
};

const ERROR_403 = {
  success: false,
  statusCode: 403,
  message: ['Forbidden resource'],
  timestamp: '2026-08-27T12:00:00.000Z',
};

const ERROR_404 = {
  success: false,
  statusCode: 404,
  message: ['Notification template not found'],
  timestamp: '2026-08-27T12:00:00.000Z',
};

/**
 * Reusable messages an admin composes once and sends from a customer's profile.
 *
 * A controller of its own rather than more routes on NotificationsController:
 * that file is already long, and the two literal routes here (`variables`,
 * `preview`) would have to be threaded past its existing `:id` parameters.
 */
@ApiTags('Notification Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('notification-templates')
export class NotificationTemplatesController {
  constructor(private readonly templatesService: NotificationTemplatesService) {}

  /** Italian unless the caller asks otherwise — the dashboard's default. */
  private localeOf(req: any): 'it' | 'en' {
    const header = String(req?.headers?.['accept-language'] || '').toLowerCase();
    return header.startsWith('en') ? 'en' : 'it';
  }

  // Literal segments first. Declared below `:id` they would never be reached —
  // Nest matches in declaration order, and ParseUUIDPipe would reject the word
  // "variables" with a 400.

  @Get('variables')
  @ApiOperation({
    summary: 'List the variables templates may use (admin)',
    description:
      'The single source of truth for `{{...}}` substitution. The composer builds ' +
      'its chip palette from this rather than hardcoding a second copy that can ' +
      'drift from what the server actually resolves. `scope: "case"` variables ' +
      'need the customer to have a case; without one a send is refused.',
  })
  @ApiOkResponse({
    description: 'The variables this server resolves',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            {
              key: 'name',
              scope: 'user',
              label: 'Nome completo',
              description: 'Nome e cognome del cliente.',
              example: 'Mario Rossi',
            },
            {
              key: 'provider',
              scope: 'case',
              label: 'Nuovo fornitore',
              description:
                'Il fornitore dell’offerta scelta nella pratica più recente.',
              example: 'Illumia',
            },
          ],
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  getVariables(@Req() req: any) {
    return this.templatesService.getVariables(this.localeOf(req));
  }

  @Post('preview')
  @ApiOperation({
    summary: 'Render a message for one customer without sending it (admin)',
    description:
      'Pass `templateId` to preview a saved template, or `title`/`body` to preview ' +
      'text being edited. `unresolved` lists variables that could not be filled — ' +
      'a send with any of those is rejected, so the composer disables Send instead ' +
      'of letting the admin discover it on submit.',
  })
  @ApiBody({ type: PreviewNotificationDto })
  @ApiOkResponse({
    description: 'The message as the customer would receive it',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            title: 'Nuova offerta per te, Mario',
            body: 'Ciao Mario Rossi, la tua pratica Luce con Illumia sta procedendo.',
            unresolved: [],
            context: {
              caseId: 'c1a2b3c4-d5e6-7890-abcd-ef0123456789',
              caseNumber: 'SW-20260731-00001',
              provider: 'Illumia',
              offerName: 'Casa Luce Fissa 12',
              utilityType: 'electricity',
            },
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Template or customer not found',
    content: { 'application/json': { example: ERROR_404 } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  preview(@Body() dto: PreviewNotificationDto) {
    return this.templatesService.preview(dto);
  }

  @Get()
  @ApiOperation({
    summary: 'List notification templates with pagination (admin)',
    description:
      'Search matches the template name and its title. Filter by category, type ' +
      'and active status. Newest edits first.',
  })
  @ApiOkResponse({
    description: 'Paginated list of notification templates',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [TEMPLATE_EXAMPLE],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  findAll(@Query() query: QueryNotificationTemplatesDto) {
    return this.templatesService.findAll(query);
  }

  @Post()
  @ApiOperation({
    summary: 'Create a notification template (admin)',
    description:
      'Names must be unique. Every `{{...}}` in the title and body must be a known ' +
      'variable, so a typo is caught here rather than in a customer’s notification tray.',
  })
  @ApiBody({ type: CreateNotificationTemplateDto })
  @ApiCreatedResponse({
    description: 'Notification template created successfully',
    content: {
      'application/json': { example: { success: true, data: TEMPLATE_EXAMPLE } },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed, duplicate name, or unknown variable',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: [
            'Unknown variable(s): {{provder}}. See GET /notification-templates/variables.',
          ],
          timestamp: '2026-08-27T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  create(
    @Body() dto: CreateNotificationTemplateDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.templatesService.create(dto, adminId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one notification template (admin)' })
  @ApiParam({ name: 'id', description: 'Notification template UUID' })
  @ApiOkResponse({
    description: 'The notification template',
    content: {
      'application/json': { example: { success: true, data: TEMPLATE_EXAMPLE } },
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification template not found',
    content: { 'application/json': { example: ERROR_404 } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.templatesService.findById(id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a notification template (admin)',
    description:
      'Editing a template never rewrites history: messages already sent keep the ' +
      'text they were rendered with.',
  })
  @ApiParam({ name: 'id', description: 'Notification template UUID' })
  @ApiBody({ type: UpdateNotificationTemplateDto })
  @ApiOkResponse({
    description: 'Notification template updated successfully',
    content: {
      'application/json': { example: { success: true, data: TEMPLATE_EXAMPLE } },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed, duplicate name, or unknown variable',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ["A notification template named 'Promo switch luce' already exists"],
          timestamp: '2026-08-27T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification template not found',
    content: { 'application/json': { example: ERROR_404 } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateNotificationTemplateDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.templatesService.update(id, dto, adminId);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a notification template (admin)',
    description:
      'Soft delete. Messages already sent from it keep naming it in the customer’s ' +
      'notification history.',
  })
  @ApiParam({ name: 'id', description: 'Notification template UUID' })
  @ApiOkResponse({
    description: 'Notification template deleted successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: { message: 'Notification template deleted successfully' },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Notification template not found',
    content: { 'application/json': { example: ERROR_404 } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.templatesService.remove(id);
    return { message: 'Notification template deleted successfully' };
  }
}
