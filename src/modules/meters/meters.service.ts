import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meter } from './entities/meter.entity';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { QueryMetersDto } from './dto/query-meters.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Contract } from '../contracts/entities/contract.entity';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';

@Injectable()
export class MetersService {
  constructor(
    @InjectRepository(Meter)
    private readonly meterRepository: Repository<Meter>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
  ) {}

  // ─── Admin Methods ────────────────────────────────────────

  async create(dto: CreateMeterDto, adminId: string): Promise<Meter> {
    const meter = this.meterRepository.create({
      ...dto,
      createdBy: adminId,
      updatedBy: adminId,
    });

    try {
      return await this.meterRepository.save(meter);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A service type with this utility type already exists',
        );
      }
      throw error;
    }
  }

  async findAll(
    query: QueryMetersDto,
  ): Promise<PaginatedResponseDto<Meter>> {
    const qb = this.meterRepository.createQueryBuilder('meter');

    if (query.utilityType) {
      qb.andWhere('meter.utilityType = :utilityType', {
        utilityType: query.utilityType,
      });
    }

    if (query.isActive !== undefined) {
      const isActive = query.isActive === 'true';
      qb.andWhere('meter.isActive = :isActive', { isActive });
    }

    if (query.search) {
      qb.andWhere(
        '(meter.name ILIKE :search OR CAST(meter.utilityType AS TEXT) ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('meter.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Meter> {
    const meter = await this.meterRepository.findOne({
      where: { id },
    });

    if (!meter) {
      throw new NotFoundException('Meter not found');
    }

    return meter;
  }

  async update(
    id: string,
    dto: UpdateMeterDto,
    adminId: string,
  ): Promise<Meter> {
    const meter = await this.findById(id);

    Object.assign(meter, dto);
    meter.updatedBy = adminId;

    try {
      return await this.meterRepository.save(meter);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A service type with this utility type already exists',
        );
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    const meter = await this.findById(id);
    await this.meterRepository.softRemove(meter);
  }

  // ─── User Methods ─────────────────────────────────────────

  async findUserActivatedServices(userId: string) {
    const contracts = await this.contractRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.switchCase', 'sc')
      .leftJoinAndSelect('c.offer', 'offer')
      .leftJoin('offer.supplier', 'supplier')
      .addSelect(['supplier.id', 'supplier.name', 'supplier.logoUrl'])
      .where('c.userId = :userId', { userId })
      .andWhere('c.status = :contractStatus', { contractStatus: ContractStatus.ACTIVE })
      .andWhere('sc.status = :caseStatus', { caseStatus: CaseStatus.ACTIVATED })
      .orderBy('c.createdAt', 'DESC')
      .getMany();

    return contracts.map((contract) => ({
      id: contract.id,
      caseId: contract.caseId,
      offerId: contract.offerId,
      energyType: contract.offer?.energyType || null,
      offerName: contract.offer?.name || null,
      supplierName: contract.offer?.supplier?.name || null,
      contractNumber: contract.contractNumber,
      podPdrNumber: contract.podPdrNumber || null,
      activationDate: contract.activationDate || null,
      expiryDate: contract.expiryDate || null,
      monthlyEstimate: contract.monthlyEstimate || null,
      pricePerKwh: contract.offer?.pricePerKwh || null,
      pricePerSmc: contract.offer?.pricePerSmc || null,
      fixedMonthlyFee: contract.offer?.fixedMonthlyFee || null,
      contractDurationMonths: contract.offer?.contractDurationMonths || null,
      isGreenEnergy: contract.offer?.isGreenEnergy || false,
    }));
  }
}
