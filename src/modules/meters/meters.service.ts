import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Meter } from './entities/meter.entity';
import { CreateMeterDto } from './dto/create-meter.dto';
import { UpdateMeterDto } from './dto/update-meter.dto';
import { UpdateMeterStatusDto } from './dto/update-meter-status.dto';
import { QueryMetersDto } from './dto/query-meters.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { MeterStatus } from '../../common/enums/utility.enum';

@Injectable()
export class MetersService {
  constructor(
    @InjectRepository(Meter)
    private readonly meterRepository: Repository<Meter>,
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
          'A meter with this code and utility type already exists',
        );
      }
      throw error;
    }
  }

  async findAll(
    query: QueryMetersDto,
  ): Promise<PaginatedResponseDto<Meter>> {
    const qb = this.meterRepository
      .createQueryBuilder('meter')
      .leftJoinAndSelect('meter.user', 'user')
      .leftJoinAndSelect('meter.supplier', 'supplier')
      .leftJoinAndSelect('meter.address', 'address');

    if (query.utilityType) {
      qb.andWhere('meter.utilityType = :utilityType', {
        utilityType: query.utilityType,
      });
    }

    if (query.status) {
      qb.andWhere('meter.status = :status', { status: query.status });
    }

    if (query.userId) {
      qb.andWhere('meter.userId = :userId', { userId: query.userId });
    }

    if (query.supplierId) {
      qb.andWhere('meter.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(meter.meterCode ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR user.email ILIKE :search)',
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
      relations: ['user', 'supplier', 'address'],
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
          'A meter with this code and utility type already exists',
        );
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    const meter = await this.findById(id);
    await this.meterRepository.softRemove(meter);
  }

  async updateStatus(
    id: string,
    dto: UpdateMeterStatusDto,
    adminId: string,
  ): Promise<Meter> {
    const meter = await this.findById(id);

    this.validateStatusTransition(meter.status, dto.status);

    meter.status = dto.status;
    meter.updatedBy = adminId;

    return this.meterRepository.save(meter);
  }

  // ─── User Methods ─────────────────────────────────────────

  async findUserActiveMeters(userId: string): Promise<Meter[]> {
    return this.meterRepository
      .createQueryBuilder('meter')
      .leftJoinAndSelect('meter.supplier', 'supplier')
      .leftJoinAndSelect('meter.address', 'address')
      .where('meter.userId = :userId', { userId })
      .andWhere('meter.status = :status', { status: MeterStatus.ACTIVE })
      .orderBy('meter.createdAt', 'DESC')
      .getMany();
  }

  // ─── Helpers ──────────────────────────────────────────────

  private validateStatusTransition(
    currentStatus: MeterStatus,
    newStatus: MeterStatus,
  ): void {
    const validTransitions: Record<MeterStatus, MeterStatus[]> = {
      [MeterStatus.PENDING]: [MeterStatus.ACTIVE, MeterStatus.TERMINATED],
      [MeterStatus.ACTIVE]: [MeterStatus.INACTIVE, MeterStatus.TERMINATED],
      [MeterStatus.INACTIVE]: [MeterStatus.ACTIVE, MeterStatus.TERMINATED],
      [MeterStatus.TERMINATED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
