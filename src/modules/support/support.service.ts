import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { SupportTicket } from './entities/support-ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { Faq } from './entities/faq.entity';
import { SupportTopic } from './entities/support-topic.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { CreateTopicDto } from './dto/create-topic.dto';
import { UpdateTopicDto } from './dto/update-topic.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { QueryFaqsDto } from './dto/query-faqs.dto';
import { QueryTopicsDto } from './dto/query-topics.dto';
import { TicketStatus, TicketPriority } from '../../common/enums/support.enum';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';
import { UserTarget } from '../../common/enums/offer.enum';

@Injectable()
export class SupportService {
  private readonly logger = new Logger(SupportService.name);

  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepository: Repository<TicketMessage>,
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
    @InjectRepository(SupportTopic)
    private readonly topicRepository: Repository<SupportTopic>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Topic Methods ──────────────────────────────────────────

  async createTopic(dto: CreateTopicDto): Promise<SupportTopic> {
    const topic = this.topicRepository.create(dto);
    return this.topicRepository.save(topic);
  }

  async getAdminTopics(
    query: QueryTopicsDto,
  ): Promise<PaginatedResponseDto<SupportTopic & { ticketCount: number }>> {
    const qb = this.topicRepository
      .createQueryBuilder('topic')
      .loadRelationCountAndMap('topic.ticketCount', 'topic.tickets');

    if (query.isActive !== undefined) {
      qb.andWhere('topic.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.search) {
      qb.andWhere('topic.name ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('topic.sortOrder', 'ASC').addOrderBy('topic.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(
      data as (SupportTopic & { ticketCount: number })[],
      total,
      query.page,
      query.limit,
    );
  }

  async getActiveTopics(): Promise<SupportTopic[]> {
    return this.topicRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC' },
    });
  }

  async updateTopic(
    topicId: string,
    dto: UpdateTopicDto,
  ): Promise<SupportTopic> {
    const topic = await this.topicRepository.findOne({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    Object.assign(topic, dto);
    return this.topicRepository.save(topic);
  }

  async deleteTopic(topicId: string): Promise<void> {
    const topic = await this.topicRepository.findOne({
      where: { id: topicId },
    });

    if (!topic) {
      throw new NotFoundException('Topic not found');
    }

    const ticketCount = await this.ticketRepository.count({
      where: { topicId },
    });

    if (ticketCount > 0) {
      throw new BadRequestException(
        'Cannot delete topic with existing support requests. Deactivate it instead.',
      );
    }

    await this.topicRepository.remove(topic);
  }

  // ─── Ticket Methods ─────────────────────────────────────────

  async createTicket(
    userId: string,
    dto: CreateTicketDto,
  ): Promise<SupportTicket> {
    const topic = await this.topicRepository.findOne({
      where: { id: dto.topicId, isActive: true },
    });

    if (!topic) {
      throw new BadRequestException('Topic not found or inactive');
    }

    const ticket = this.ticketRepository.create({
      userId,
      topicId: dto.topicId,
      subject: dto.subject,
      priority: dto.priority || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
    });

    const savedTicket = await this.ticketRepository.save(ticket);

    const message = this.messageRepository.create({
      ticketId: savedTicket.id,
      senderId: userId,
      message: dto.message,
    });
    await this.messageRepository.save(message);

    return this.getTicketById(savedTicket.id, userId, UserRole.ADMIN);
  }

  async getTickets(
    query: QueryTicketsDto,
    userId: string,
    userRole: UserRole,
  ): Promise<PaginatedResponseDto<SupportTicket>> {
    const qb = this.ticketRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.user', 'user')
      .leftJoinAndSelect('ticket.assignedAgent', 'agent')
      .leftJoinAndSelect('ticket.topic', 'topic');

    if (userRole !== UserRole.ADMIN) {
      qb.andWhere('ticket.userId = :userId', { userId });
    }

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }

    if (query.topicId) {
      qb.andWhere('ticket.topicId = :topicId', { topicId: query.topicId });
    }

    if (query.search) {
      qb.andWhere('ticket.subject ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('ticket.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getTicketById(
    ticketId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
      relations: ['user', 'assignedAgent', 'messages', 'messages.sender', 'topic'],
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (userRole !== UserRole.ADMIN && ticket.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return ticket;
  }

  async updateTicket(
    ticketId: string,
    dto: UpdateTicketDto,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (dto.priority) {
      ticket.priority = dto.priority;
    }

    if (dto.assignedAgentId) {
      ticket.assignedAgentId = dto.assignedAgentId;
      if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
    }

    if (dto.status) {
      ticket.status = dto.status;

      if (dto.status === TicketStatus.RESOLVED) {
        ticket.resolvedAt = new Date();
      }
      if (dto.status === TicketStatus.CLOSED) {
        ticket.closedAt = new Date();
      }
    }

    const saved = await this.ticketRepository.save(ticket);

    // Notify ticket owner on status changes
    if (dto.status === TicketStatus.RESOLVED || dto.status === TicketStatus.CLOSED) {
      const msgKey = dto.status === TicketStatus.RESOLVED ? 'ticket_resolved' : 'ticket_closed';
      try {
        await this.notificationsService.sendNotification({
          userId: ticket.userId,
          messageKey: msgKey,
          type: NotificationType.SUPPORT_REPLY,
          data: { ticketId: ticket.id, status: dto.status },
        });
      } catch (error) {
        this.logger.warn(`Failed to send ticket status notification: ${error?.message || error}`);
      }
    }

    return saved;
  }

  async addMessage(
    ticketId: string,
    senderId: string,
    dto: CreateMessageDto,
    userRole: UserRole,
  ): Promise<TicketMessage> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (userRole !== UserRole.ADMIN && ticket.userId !== senderId) {
      throw new ForbiddenException('Access denied');
    }

    const message = this.messageRepository.create({
      ticketId,
      senderId,
      message: dto.message,
      attachments: dto.attachments || null,
    });

    const saved = await this.messageRepository.save(message);

    // Notify ticket owner when admin replies
    if (userRole === UserRole.ADMIN && ticket.userId !== senderId) {
      try {
        const bodyPreview = dto.message.length > 100
          ? dto.message.substring(0, 100) + '...'
          : dto.message;
        await this.notificationsService.sendNotification({
          userId: ticket.userId,
          messageKey: 'support_reply',
          body: bodyPreview,
          type: NotificationType.SUPPORT_REPLY,
          data: { ticketId, messageId: saved.id },
        });
      } catch (error) {
        this.logger.warn(`Failed to send support reply notification: ${error?.message || error}`);
      }
    }

    return saved;
  }

  async getMessages(
    ticketId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<TicketMessage[]> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (userRole !== UserRole.ADMIN && ticket.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return this.messageRepository.find({
      where: { ticketId },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  // ─── FAQ Methods ─────────────────────────────────────────────

  async getAdminFaqs(query: QueryFaqsDto): Promise<PaginatedResponseDto<Faq>> {
    const qb = this.faqRepository.createQueryBuilder('faq');

    if (query.category) {
      qb.andWhere('faq.category = :category', { category: query.category });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('faq.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.targetAudience) {
      qb.andWhere('faq.targetAudience = :targetAudience', {
        targetAudience: query.targetAudience,
      });
    }

    if (query.locale) {
      qb.andWhere('faq.locale = :locale', { locale: query.locale });
    }

    if (query.search) {
      qb.andWhere('faq.question ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('faq.category', 'ASC').addOrderBy('faq.sortOrder', 'ASC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getFaqs(
    category?: string,
    locale?: string,
    targetAudience?: UserTarget,
  ): Promise<Faq[]> {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }

    // A `personal` / `business` caller also gets the FAQs targeted at `both`.
    // No value (or an explicit `both`) means "no audience filter" — show everything.
    if (targetAudience && targetAudience !== UserTarget.BOTH) {
      where.targetAudience = In([targetAudience, UserTarget.BOTH]);
    }

    where.locale = locale || 'it';

    const results = await this.faqRepository.find({
      where,
      order: { category: 'ASC', sortOrder: 'ASC' },
    });

    // Fall back to Italian if no FAQs found for the requested locale
    if (results.length === 0 && where.locale !== 'it') {
      where.locale = 'it';
      return this.faqRepository.find({
        where,
        order: { category: 'ASC', sortOrder: 'ASC' },
      });
    }

    return results;
  }

  async createFaq(dto: CreateFaqDto): Promise<Faq> {
    const faq = this.faqRepository.create(dto);
    return this.faqRepository.save(faq);
  }

  async updateFaq(faqId: string, dto: UpdateFaqDto): Promise<Faq> {
    const faq = await this.faqRepository.findOne({ where: { id: faqId } });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    Object.assign(faq, dto);
    return this.faqRepository.save(faq);
  }

  async deleteFaq(faqId: string): Promise<void> {
    const faq = await this.faqRepository.findOne({ where: { id: faqId } });

    if (!faq) {
      throw new NotFoundException('FAQ not found');
    }

    await this.faqRepository.remove(faq);
  }

}
