import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(CaseEvent)
    private readonly eventRepository: Repository<CaseEvent>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createContract(dto: CreateContractDto): Promise<Contract> {
    const switchCase = await this.caseRepository.findOne({
      where: { id: dto.caseId },
    });

    if (!switchCase) {
      throw new NotFoundException('Case not found');
    }

    // Check if contract already exists for this case
    const existing = await this.contractRepository.findOne({
      where: { caseId: dto.caseId },
    });

    if (existing) {
      throw new ConflictException('A contract already exists for this case');
    }

    // If deliveryMethod is provided, set status to SENT directly
    const initialStatus = dto.deliveryMethod
      ? ContractStatus.SENT
      : ContractStatus.DRAFT;

    const contract = this.contractRepository.create({
      caseId: dto.caseId,
      offerId: switchCase.selectedOfferId,
      userId: switchCase.userId,
      contractNumber: dto.contractNumber,
      podPdrNumber: dto.podPdrNumber,
      status: initialStatus,
      deliveryMethod: dto.deliveryMethod || null,
      documentUrl: dto.documentUrl || null,
    });

    const saved = await this.contractRepository.save(contract);

    // Update case status to CONTRACT_SENT
    switchCase.status = CaseStatus.CONTRACT_SENT;
    await this.caseRepository.save(switchCase);

    // Log case event
    await this.eventRepository.save(
      this.eventRepository.create({
        caseId: switchCase.id,
        eventType: CaseEventType.CONTRACT_GENERATED,
        title: 'Contratto creato',
        description: dto.deliveryMethod
          ? `Contratto ${dto.contractNumber} creato e inviato via ${dto.deliveryMethod}`
          : `Contratto ${dto.contractNumber} creato in bozza`,
        oldStatus: null,
        newStatus: CaseStatus.CONTRACT_SENT,
      }),
    );

    // Send notification to user if contract is being sent
    if (dto.deliveryMethod) {
      const bodyText =
        dto.deliveryMethod === 'app'
          ? 'Il tuo contratto è stato caricato. Puoi scaricarlo dalla app.'
          : `Il tuo contratto ti è stato inviato via ${dto.deliveryMethod}.`;

      await this.notificationsService.sendNotification({
        userId: switchCase.userId,
        title: 'Contratto Inviato',
        body: bodyText,
        type: NotificationType.CONTRACT_STATUS,
        data: {
          caseId: switchCase.id,
          contractId: saved.id,
          deliveryMethod: dto.deliveryMethod,
        },
      });
    }

    return saved;
  }

  async getContracts(
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Contract>> {
    const qb = this.contractRepository.createQueryBuilder('c')
      .leftJoinAndSelect('c.user', 'user')
      .leftJoinAndSelect('c.offer', 'offer')
      .leftJoinAndSelect('c.switchCase', 'switchCase');

    if (query.search) {
      qb.andWhere(
        '(c.contractNumber ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('c.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getContractById(id: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['user', 'offer', 'switchCase'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async updateContract(
    id: string,
    dto: UpdateContractDto,
  ): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const oldStatus = contract.status;

    // If status is being set to SIGNED, record the signing timestamp
    if (dto.status === ContractStatus.SIGNED && !contract.signedAt) {
      contract.signedAt = new Date();
    }

    Object.assign(contract, dto);

    const saved = await this.contractRepository.save(contract);

    // Sync case status based on contract status and send notifications
    if (dto.status && dto.status !== oldStatus) {
      const switchCase = await this.caseRepository.findOne({
        where: { id: contract.caseId },
      });

      if (switchCase) {
        let newCaseStatus: CaseStatus | null = null;
        let notificationTitle = '';
        let notificationBody = '';
        let eventType: CaseEventType = CaseEventType.STATUS_CHANGE;

        if (dto.status === ContractStatus.SENT) {
          newCaseStatus = CaseStatus.CONTRACT_SENT;
          notificationTitle = 'Contratto Inviato';
          notificationBody = contract.deliveryMethod === 'app'
            ? 'Il tuo contratto è stato caricato. Puoi scaricarlo dalla app.'
            : `Il tuo contratto ti è stato inviato via ${contract.deliveryMethod || 'email'}.`;
        } else if (dto.status === ContractStatus.SIGNED) {
          newCaseStatus = CaseStatus.CONTRACT_SIGNED;
          notificationTitle = 'Contratto Firmato';
          notificationBody = 'Il tuo contratto è stato firmato. È in fase di attivazione.';
          eventType = CaseEventType.CONTRACT_SIGNED;
        } else if (dto.status === ContractStatus.ACTIVE) {
          newCaseStatus = CaseStatus.ACTIVATED;
          notificationTitle = 'Utenza Attivata';
          notificationBody = 'La tua utenza è stata attivata! Puoi vederla nella sezione Le Mie Utenze.';
        }

        if (newCaseStatus) {
          const oldCaseStatus = switchCase.status;
          switchCase.status = newCaseStatus;
          await this.caseRepository.save(switchCase);

          // Log case event
          await this.eventRepository.save(
            this.eventRepository.create({
              caseId: switchCase.id,
              eventType,
              title: notificationTitle,
              description: notificationBody,
              oldStatus: oldCaseStatus,
              newStatus: newCaseStatus,
            }),
          );

          // Send notification to user
          await this.notificationsService.sendNotification({
            userId: switchCase.userId,
            title: notificationTitle,
            body: notificationBody,
            type: NotificationType.CONTRACT_STATUS,
            data: {
              caseId: switchCase.id,
              contractId: saved.id,
              newStatus: dto.status,
            },
          });
        }
      }
    }

    return saved;
  }

  async getContractByCase(caseId: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { caseId },
      relations: ['user', 'offer', 'switchCase'],
    });

    if (!contract) {
      throw new NotFoundException('No contract found for this case');
    }

    return contract;
  }

  // ─── User-facing methods ─────────────────────────────────

  async getUserContracts(userId: string): Promise<Contract[]> {
    return this.contractRepository.find({
      where: { userId },
      relations: ['offer', 'offer.supplier'],
      order: { createdAt: 'DESC' },
    });
  }

  async getUserContractById(id: string, userId: string): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
      relations: ['offer', 'offer.supplier'],
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    return contract;
  }

  async uploadSignedContract(
    id: string,
    userId: string,
    signedDocumentUrl: string,
  ): Promise<Contract> {
    const contract = await this.contractRepository.findOne({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.userId !== userId) {
      throw new ForbiddenException('Access denied');
    }

    if (contract.status !== ContractStatus.SENT) {
      throw new BadRequestException(
        'Contract must be in SENT status to upload signed document',
      );
    }

    contract.signedDocumentUrl = signedDocumentUrl;
    contract.status = ContractStatus.SIGNED;
    contract.signedAt = new Date();

    const saved = await this.contractRepository.save(contract);

    // Sync case status
    const switchCase = await this.caseRepository.findOne({
      where: { id: contract.caseId },
    });

    if (switchCase) {
      const oldCaseStatus = switchCase.status;
      switchCase.status = CaseStatus.CONTRACT_SIGNED;
      await this.caseRepository.save(switchCase);

      // Log case event
      await this.eventRepository.save(
        this.eventRepository.create({
          caseId: switchCase.id,
          eventType: CaseEventType.CONTRACT_SIGNED,
          title: 'Contratto firmato dal cliente',
          description: 'Il cliente ha caricato il contratto firmato.',
          oldStatus: oldCaseStatus,
          newStatus: CaseStatus.CONTRACT_SIGNED,
          actorId: userId,
        }),
      );
    }

    return saved;
  }
}
