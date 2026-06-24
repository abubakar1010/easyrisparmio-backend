import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Contract } from './entities/contract.entity';
import { CreateContractDto } from './dto/create-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';

@Injectable()
export class ContractsService {
  constructor(
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
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

    const contract = this.contractRepository.create({
      caseId: dto.caseId,
      offerId: switchCase.selectedOfferId,
      userId: switchCase.userId,
      contractNumber: dto.contractNumber,
      podPdrNumber: dto.podPdrNumber,
      status: ContractStatus.DRAFT,
    });

    const saved = await this.contractRepository.save(contract);

    // Update case status to CONTRACT_SENT
    switchCase.status = CaseStatus.CONTRACT_SENT;
    await this.caseRepository.save(switchCase);

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

    // If status is being set to SIGNED, record the signing timestamp
    if (dto.status === ContractStatus.SIGNED && !contract.signedAt) {
      contract.signedAt = new Date();
    }

    Object.assign(contract, dto);

    const saved = await this.contractRepository.save(contract);

    // Sync case status based on contract status
    if (dto.status) {
      const switchCase = await this.caseRepository.findOne({
        where: { id: contract.caseId },
      });

      if (switchCase) {
        if (dto.status === ContractStatus.SIGNED) {
          switchCase.status = CaseStatus.CONTRACT_SIGNED;
          await this.caseRepository.save(switchCase);
        } else if (dto.status === ContractStatus.ACTIVE) {
          switchCase.status = CaseStatus.ACTIVATED;
          await this.caseRepository.save(switchCase);
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
}
