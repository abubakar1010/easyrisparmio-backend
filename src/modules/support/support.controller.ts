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
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFaqDto } from './dto/create-faq.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { TicketStatus } from '../../common/enums/support.enum';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new support ticket' })
  createTicket(
    @CurrentUser('id') userId: string,
    @Body() dto: CreateTicketDto,
  ) {
    return this.supportService.createTicket(userId, dto);
  }

  @Get('tickets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get support tickets (own for users, all for admin)' })
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
  @ApiOperation({ summary: 'Get a support ticket by ID' })
  getTicketById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.supportService.getTicketById(id, userId, userRole);
  }

  @Patch('tickets/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.AGENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update ticket status or assign agent (admin/agent)' })
  updateTicket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status?: TicketStatus,
    @Body('assignedAgentId') assignedAgentId?: string,
  ) {
    if (assignedAgentId) {
      return this.supportService.assignAgent(id, assignedAgentId);
    }
    if (status) {
      return this.supportService.updateTicketStatus(id, status);
    }
  }

  @Post('tickets/:id/messages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add a message to a ticket' })
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
  @ApiOperation({ summary: 'Get messages for a ticket' })
  getMessages(
    @Param('id', ParseUUIDPipe) ticketId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.supportService.getMessages(ticketId, userId, userRole);
  }

  @Get('faqs')
  @ApiOperation({ summary: 'Get FAQs (public)' })
  getFaqs(@Query('category') category?: string) {
    return this.supportService.getFaqs(category);
  }

  @Post('faqs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new FAQ (admin)' })
  createFaq(@Body() dto: CreateFaqDto) {
    return this.supportService.createFaq(dto);
  }

  @Patch('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a FAQ (admin)' })
  updateFaq(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: Partial<CreateFaqDto>,
  ) {
    return this.supportService.updateFaq(id, dto);
  }

  @Delete('faqs/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a FAQ (admin)' })
  deleteFaq(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.deleteFaq(id);
  }
}
