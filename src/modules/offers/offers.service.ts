import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { BillType } from '../../common/enums/bill.enum';
import { EnergyType, UserTarget } from '../../common/enums/offer.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
  ) {}

  async create(dto: CreateOfferDto, adminId: string): Promise<Offer> {
    const offer = this.offerRepository.create({
      ...dto,
      createdBy: adminId,
      updatedBy: adminId,
    });
    try {
      return await this.offerRepository.save(offer);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'An offer with this offer code already exists',
        );
      }
      throw error;
    }
  }

  async findAllPublic(
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Offer>> {
    const qb = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.supplier', 'supplier')
      .where('offer.is_active = :isActive', { isActive: true })
      .andWhere('offer.offer_status = :status', { status: OfferStatus.ACTIVE });

    if (query.search) {
      qb.andWhere(
        '(offer.name ILIKE :search OR offer.description ILIKE :search OR offer.offer_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('offer.created_at', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findAllAdmin(
    query: QueryOffersDto,
  ): Promise<PaginatedResponseDto<Offer>> {
    const qb = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.supplier', 'supplier');

    if (query.energyType) {
      qb.andWhere('offer.energy_type = :energyType', {
        energyType: query.energyType,
      });
    }

    if (query.marketType) {
      qb.andWhere('offer.market_type = :marketType', {
        marketType: query.marketType,
      });
    }

    if (query.target) {
      qb.andWhere('(offer.target = :target OR offer.target = :both)', {
        target: query.target,
        both: UserTarget.BOTH,
      });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('offer.is_active = :isActive', { isActive: query.isActive });
    }

    if (query.supplierId) {
      qb.andWhere('offer.supplier_id = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.offerStatus) {
      qb.andWhere('offer.offer_status = :offerStatus', {
        offerStatus: query.offerStatus,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(offer.name ILIKE :search OR offer.description ILIKE :search OR offer.offer_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('offer.created_at', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Offer> {
    const offer = await this.offerRepository.findOne({
      where: { id },
      relations: ['supplier'],
    });

    if (!offer) {
      throw new NotFoundException('Offer not found');
    }

    return offer;
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    adminId: string,
  ): Promise<Offer> {
    const offer = await this.findById(id);
    Object.assign(offer, dto);
    offer.updatedBy = adminId;
    try {
      return await this.offerRepository.save(offer);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'An offer with this offer code already exists',
        );
      }
      throw error;
    }
  }

  async softDelete(id: string): Promise<void> {
    const offer = await this.findById(id);
    await this.offerRepository.softRemove(offer);
  }

  async updateStatus(
    id: string,
    dto: UpdateOfferStatusDto,
    adminId: string,
  ): Promise<Offer> {
    const offer = await this.findById(id);
    this.validateStatusTransition(offer.offerStatus, dto.offerStatus);
    offer.offerStatus = dto.offerStatus;
    offer.updatedBy = adminId;
    return this.offerRepository.save(offer);
  }

  async compareOffers(ids: string[]): Promise<Offer[]> {
    const offers = await this.offerRepository.find({
      where: { id: In(ids) },
      relations: ['supplier'],
    });

    if (offers.length === 0) {
      throw new NotFoundException('No offers found for the provided IDs');
    }

    return offers;
  }

  async getRecommendedOffers(
    billId: string,
    userId: string,
  ): Promise<Offer[]> {
    const bill = await this.billRepository.findOne({
      where: { id: billId, userId },
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const energyType =
      bill.billType === BillType.ELECTRICITY
        ? EnergyType.ELECTRICITY
        : EnergyType.GAS;

    const qb = this.offerRepository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.supplier', 'supplier')
      .where('offer.is_active = :isActive', { isActive: true })
      .andWhere(
        '(offer.energy_type = :energyType OR offer.energy_type = :dual)',
        { energyType, dual: EnergyType.DUAL },
      );

    if (bill.supplierId) {
      qb.andWhere('offer.supplier_id != :currentSupplier', {
        currentSupplier: bill.supplierId,
      });
    }

    if (bill.billType === BillType.ELECTRICITY) {
      qb.orderBy('offer.price_per_kwh', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('offer.price_per_smc', 'ASC', 'NULLS LAST');
    }

    qb.take(10);

    return qb.getMany();
  }

  private validateStatusTransition(
    current: OfferStatus,
    next: OfferStatus,
  ): void {
    const validTransitions: Record<OfferStatus, OfferStatus[]> = {
      [OfferStatus.DRAFT]: [OfferStatus.ACTIVE, OfferStatus.ARCHIVED],
      [OfferStatus.ACTIVE]: [OfferStatus.EXPIRING, OfferStatus.ARCHIVED],
      [OfferStatus.EXPIRING]: [OfferStatus.EXPIRED, OfferStatus.ARCHIVED],
      [OfferStatus.EXPIRED]: [OfferStatus.ARCHIVED],
      [OfferStatus.ARCHIVED]: [],
    };

    if (!validTransitions[current]?.includes(next)) {
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }
}
