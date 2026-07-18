import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { SentOffer } from './entities/sent-offer.entity';
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
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
  ) {}

  resolveOfferLocale(offer: Offer, locale?: string): Offer {
    if (!locale || locale === 'it') return offer;
    if (offer.nameI18n && offer.nameI18n[locale]) {
      offer.name = offer.nameI18n[locale];
    }
    if (offer.descriptionI18n && offer.descriptionI18n[locale]) {
      offer.description = offer.descriptionI18n[locale];
    }
    if (offer.highlightsI18n && offer.highlightsI18n[locale]) {
      offer.highlights = offer.highlightsI18n[locale];
    }
    return offer;
  }

  resolveOffersLocale(offers: Offer[], locale?: string): Offer[] {
    return offers.map((offer) => this.resolveOfferLocale(offer, locale));
  }

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
      .where('offer.isActive = :isActive', { isActive: true })
      .andWhere('offer.offerStatus = :status', { status: OfferStatus.ACTIVE });

    if (query.search) {
      qb.andWhere(
        '(offer.name ILIKE :search OR offer.description ILIKE :search OR offer.offerCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('offer.createdAt', 'DESC')
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
      qb.andWhere('offer.energyType = :energyType', {
        energyType: query.energyType,
      });
    }

    if (query.marketType) {
      qb.andWhere('offer.marketType = :marketType', {
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
      qb.andWhere('offer.isActive = :isActive', { isActive: query.isActive });
    }

    if (query.supplierId) {
      qb.andWhere('offer.supplierId = :supplierId', {
        supplierId: query.supplierId,
      });
    }

    if (query.offerStatus) {
      qb.andWhere('offer.offerStatus = :offerStatus', {
        offerStatus: query.offerStatus,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(offer.name ILIKE :search OR offer.description ILIKE :search OR offer.offerCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('offer.createdAt', 'DESC')
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
      .where('offer.isActive = :isActive', { isActive: true })
      .andWhere('offer.offerStatus = :offerStatus', { offerStatus: OfferStatus.ACTIVE })
      .andWhere(
        '(offer.energyType = :energyType OR offer.energyType = :dual)',
        { energyType, dual: EnergyType.DUAL },
      );

    if (bill.supplierId) {
      qb.andWhere('offer.supplierId != :currentSupplier', {
        currentSupplier: bill.supplierId,
      });
    }

    if (bill.billType === BillType.ELECTRICITY) {
      qb.orderBy('offer.pricePerKwh', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('offer.pricePerSmc', 'ASC', 'NULLS LAST');
    }

    qb.take(10);

    return qb.getMany();
  }

  async getUserSentOffers(userId: string): Promise<SentOffer[]> {
    return this.sentOfferRepository
      .createQueryBuilder('so')
      .leftJoinAndSelect('so.offer', 'offer')
      .leftJoinAndSelect('offer.supplier', 'supplier')
      .where('so.userId = :userId', { userId })
      .andWhere(
        `so.billId NOT IN (
          SELECT sc.bill_id FROM switch_cases sc
          WHERE sc.user_id = :userId
          AND sc.status NOT IN ('cancelled', 'rejected')
          AND sc.deleted_at IS NULL
        )`,
      )
      .orderBy('so.createdAt', 'DESC')
      .getMany();
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
