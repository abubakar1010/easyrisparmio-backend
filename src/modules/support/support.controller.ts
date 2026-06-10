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
  ApiQuery,
} from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';

const TICKET_EXAMPLE = {
  id: 'tk1a2b3c-d5e6-7890-abcd-ef1234567890',
  userId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  assignedAgentId: null,
  subject: 'Unable to upload my electricity bill',
  category: 'billing_payments',
  priority: 'medium',
  status: 'open',
  resolvedAt: null,
  closedAt: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  user: { id: 'a1b2c3d4...', email: 'mario.rossi@email.com', firstName: 'Mario', lastName: 'Rossi' },
  assignedAgent: null,
};

const MESSAGE_EXAMPLE = {
  id: 'msg1a2b3-d5e6-7890-abcd-ef1234567890',
  ticketId: 'tk1a2b3c-d5e6-7890-abcd-ef1234567890',
  senderId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  message: 'I keep getting an error when trying to upload my Enel electricity bill as PDF.',
  attachments: null,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
  sender: { id: 'a1b2c3d4...', firstName: 'Mario', lastName: 'Rossi' },
};

const FAQ_EXAMPLE = {
  id: 'fq1a2b3c-d5e6-7890-abcd-ef1234567890',
  category: 'billing',
  question: 'How does the switching process work?',
  answer: 'The switching process takes 2-4 weeks. We handle all paperwork with your new supplier and ensure no service interruption.',
  sortOrder: 1,
  isActive: true,
  locale: 'it',
  targetAudience: 'both',
  createdAt: '2026-06-01T10:00:00.000Z',
  updatedAt: '2026-06-01T10:00:00.000Z',
};

const ERROR_401 = { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-10T12:00:00.000Z' };
const ERROR_403 = { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-10T12:00:00.000Z' };

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  // ─── Ticket Endpoints ─────────────────────────────────────

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new support ticket',
    description:
      'Creates a support ticket with an initial message. The ticket is assigned to the authenticated user ' +
      'and starts in `open` status. Available to all authenticated users (personal, business, admin).',
  })
  @ApiBody({ type: CreateTicketDto })
  @ApiCreatedResponse({
    description: 'Ticket created with initial message',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...TICKET_EXAMPLE,
            messages: [MESSAGE_EXAMPLE],
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
          message: ['subject should not be empty', 'category must be a valid enum value'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List support tickets',
    description:
      'Returns a paginated list of support tickets. Regular users see only their own tickets; ' +
      'admins see all tickets. Supports filtering by status, priority, category, and text search on subject.',
  })
  @ApiOkResponse({
    description: 'Paginated list of tickets',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [TICKET_EXAMPLE],
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
  getTickets(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Query() query: QueryTicketsDto,
  ) {
    return this.supportService.getTickets(query, userId, userRole);
  }

  @Get('tickets/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get support ticket by ID',
    description:
      'Returns a single ticket with full conversation thread (messages with sender details). ' +
      'Users can only access their own tickets; admins can access any ticket.',
  })
  @ApiOkResponse({
    description: 'Ticket detail with messages',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...TICKET_EXAMPLE,
            messages: [
              MESSAGE_EXAMPLE,
              {
                ...MESSAGE_EXAMPLE,
                id: 'msg2b3c4d-e6f7-8901-bcde-f23456789012',
                senderId: 'admin-uuid',
                message: 'Thank you for reporting this. Could you share which browser you are using?',
                createdAt: '2026-06-10T11:00:00.000Z',
                sender: { id: 'admin-uuid', firstName: 'Admin', lastName: 'Support' },
              },
            ],
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Ticket not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not own this ticket',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Access denied'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  getTicketById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.supportService.getTicketById(id, userId, userRole);
  }

  @Patch('tickets/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update ticket status or assign agent (admin)',
    description:
      'Updates a ticket\'s status and/or assigns an admin agent. When an agent is assigned to an `open` ticket, ' +
      'status auto-transitions to `in_progress`.\n\n' +
      'Valid status transitions:\n' +
      '- OPEN → IN_PROGRESS or CLOSED\n' +
      '- IN_PROGRESS → RESOLVED or CLOSED\n' +
      '- RESOLVED → CLOSED\n' +
      '- CLOSED is a terminal state\n\n' +
      'When resolved: `resolvedAt` timestamp is set. When closed: `closedAt` timestamp is set.',
  })
  @ApiBody({ type: UpdateTicketDto })
  @ApiOkResponse({
    description: 'Ticket updated',
    content: {
      'application/json': {
        examples: {
          assigned: {
            summary: 'Agent assigned (auto in_progress)',
            value: {
              success: true,
              data: {
                ...TICKET_EXAMPLE,
                assignedAgentId: 'admin-uuid',
                status: 'in_progress',
                assignedAgent: { id: 'admin-uuid', firstName: 'Admin', lastName: 'Support' },
              },
            },
          },
          resolved: {
            summary: 'Ticket resolved',
            value: {
              success: true,
              data: {
                ...TICKET_EXAMPLE,
                status: 'resolved',
                resolvedAt: '2026-06-10T16:00:00.000Z',
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid status transition',
    content: { 'application/json': { example: { success: false, statusCode: 400, message: ['Cannot transition from closed to open'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Ticket not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.supportService.updateTicket(id, dto);
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Add a message to a ticket',
    description:
      'Adds a message to an existing ticket conversation. Users can only message their own tickets; ' +
      'admins can message any ticket. Supports optional file attachments.',
  })
  @ApiBody({ type: CreateMessageDto })
  @ApiCreatedResponse({
    description: 'Message added to ticket',
    content: {
      'application/json': {
        example: { success: true, data: MESSAGE_EXAMPLE },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Ticket not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not own this ticket',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Access denied'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  addMessage(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @Body() dto: CreateMessageDto,
  ) {
    return this.supportService.addMessage(ticketId, userId, dto, userRole);
  }

  @Get('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get messages for a ticket',
    description:
      'Returns all messages in a ticket conversation, ordered by creation date ascending. ' +
      'Users can only view messages from their own tickets; admins can view any ticket.',
  })
  @ApiOkResponse({
    description: 'Message thread',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            MESSAGE_EXAMPLE,
            {
              ...MESSAGE_EXAMPLE,
              id: 'msg2b3c4d-e6f7-8901-bcde-f23456789012',
              senderId: 'admin-uuid',
              message: 'Thank you for reporting this. Could you share which browser you are using?',
              createdAt: '2026-06-10T11:00:00.000Z',
              sender: { id: 'admin-uuid', firstName: 'Admin', lastName: 'Support' },
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Ticket not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['Ticket not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not own this ticket',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Access denied'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  getMessages(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.supportService.getMessages(ticketId, userId, userRole);
  }

  // ─── FAQ Endpoints ────────────────────────────────────────

  @Get('faqs')
  @ApiOperation({
    summary: 'Get FAQs (public)',
    description:
      'Returns active FAQs sorted by category and display order. No authentication required. ' +
      'Optionally filter by category.',
  })
  @ApiQuery({ name: 'category', required: false, description: 'Filter by FAQ category', example: 'billing' })
  @ApiOkResponse({
    description: 'List of active FAQs',
    content: {
      'application/json': {
        example: {
          success: true,
          data: [
            FAQ_EXAMPLE,
            {
              ...FAQ_EXAMPLE,
              id: 'fq2b3c4d-e6f7-8901-bcde-f23456789012',
              question: 'Will my service be interrupted?',
              answer: 'No. Your service continues uninterrupted during the switch. The new supplier takes over seamlessly.',
              sortOrder: 2,
            },
          ],
        },
      },
    },
  })
  getFaqs(@Query('category') category?: string) {
    return this.supportService.getFaqs(category);
  }

  @Post('faqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new FAQ (admin)',
    description:
      'Creates a new FAQ entry. Use `targetAudience` to target personal, business, or all users. ' +
      'Use `locale` for multi-language support (defaults to `it` for Italian).',
  })
  @ApiBody({ type: CreateFaqDto })
  @ApiCreatedResponse({
    description: 'FAQ created successfully',
    content: { 'application/json': { example: { success: true, data: FAQ_EXAMPLE } } },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['category should not be empty', 'question should not be empty', 'answer should not be empty'],
          timestamp: '2026-06-10T12:00:00.000Z',
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
  createFaq(@Body() dto: CreateFaqDto) {
    return this.supportService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a FAQ (admin)',
    description: 'Updates FAQ fields. All fields are optional.',
  })
  @ApiBody({ type: UpdateFaqDto })
  @ApiOkResponse({
    description: 'FAQ updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            ...FAQ_EXAMPLE,
            answer: 'Updated answer with more details about the switching timeline.',
            updatedAt: '2026-06-10T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'FAQ not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['FAQ not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFaqDto,
  ) {
    return this.supportService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a FAQ (admin)',
    description: 'Permanently deletes a FAQ entry from the database.',
  })
  @ApiOkResponse({
    description: 'FAQ deleted successfully',
    content: { 'application/json': { example: { success: true, data: { message: 'FAQ deleted successfully' } } } },
  })
  @ApiNotFoundResponse({
    description: 'FAQ not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['FAQ not found'], timestamp: '2026-06-10T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  async deleteFaq(@Param('id', ParseUUIDPipe) id: string) {
    await this.supportService.deleteFaq(id);
    return { message: 'FAQ deleted successfully' };
  }
}
