import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupportTicket } from './entities/support-ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { Faq } from './entities/faq.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import { CreateMessageDto } from './dto/create-message.dto';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { TicketStatus, TicketPriority } from '../../common/enums/support.enum';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepository: Repository<SupportTicket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepository: Repository<TicketMessage>,
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
  ) {}

  async createTicket(
    userId: string,
    dto: CreateTicketDto,
  ): Promise<SupportTicket> {
    const ticket = this.ticketRepository.create({
      userId,
      subject: dto.subject,
      category: dto.category,
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
      .leftJoinAndSelect('ticket.assignedAgent', 'agent');

    if (userRole !== UserRole.ADMIN) {
      qb.andWhere('ticket.user_id = :userId', { userId });
    }

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }

    if (query.category) {
      qb.andWhere('ticket.category = :category', { category: query.category });
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
      relations: ['user', 'assignedAgent', 'messages', 'messages.sender'],
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

    if (dto.assignedAgentId) {
      ticket.assignedAgentId = dto.assignedAgentId;
      if (ticket.status === TicketStatus.OPEN) {
        ticket.status = TicketStatus.IN_PROGRESS;
      }
    }

    if (dto.status) {
      this.validateStatusTransition(ticket.status, dto.status);
      ticket.status = dto.status;

      if (dto.status === TicketStatus.RESOLVED) {
        ticket.resolvedAt = new Date();
      }
      if (dto.status === TicketStatus.CLOSED) {
        ticket.closedAt = new Date();
      }
    }

    return this.ticketRepository.save(ticket);
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

    return this.messageRepository.save(message);
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

  async getFaqs(category?: string): Promise<Faq[]> {
    const where: any = { isActive: true };
    if (category) {
      where.category = category;
    }

    return this.faqRepository.find({
      where,
      order: { category: 'ASC', sortOrder: 'ASC' },
    });
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

  private validateStatusTransition(
    current: TicketStatus,
    next: TicketStatus,
  ): void {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CLOSED],
      [TicketStatus.IN_PROGRESS]: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
      [TicketStatus.RESOLVED]: [TicketStatus.CLOSED],
      [TicketStatus.CLOSED]: [],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }
}
