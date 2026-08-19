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
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { LIVE_UTILITY_CASE_STATUSES } from '../../common/enums/case.enum';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MetersService {
  constructor(
    @InjectRepository(Meter)
    private readonly meterRepository: Repository<Meter>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
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

  /**
   * The customer's utilities: everything from "In Attivazione" onward.
   *
   * The case status is what decides. Reading it keeps this list, the utilities
   * count and the savings total on the same set of utilities, and lets each row
   * carry the badge that matches its real stage — "In Attivazione" while the
   * switch is running, "Attivo" once the supplier has confirmed it.
   */
  async findUserActivatedServices(userId: string) {
    const cases = await this.caseRepository
      .createQueryBuilder('sc')
      .leftJoinAndSelect('sc.selectedOffer', 'offer')
      .leftJoin('offer.supplier', 'supplier')
      .addSelect(['supplier.id', 'supplier.name', 'supplier.logoUrl'])
      .leftJoin('sc.bill', 'bill')
      .addSelect([
        'bill.id',
        'bill.podNumber',
        'bill.pdrNumber',
        'bill.billType',
        'bill.supplyAddress',
      ])
      .where('sc.userId = :userId', { userId })
      .andWhere('sc.status IN (:...statuses)', {
        statuses: [...LIVE_UTILITY_CASE_STATUSES],
      })
      .andWhere('sc.deletedAt IS NULL')
      .orderBy('sc.createdAt', 'DESC')
      .getMany();

    return cases.map((switchCase) => ({
      id: switchCase.id,
      caseId: switchCase.id,
      offerId: switchCase.selectedOfferId,
      // The supply the customer asked us to switch — never the offer's own
      // energyType, which is "dual" on an offer that covers both and would
      // name a supply the customer never asked for.
      energyType: switchCase.bill?.billType || null,
      supplyAddress: this.supplyAddressLine(switchCase),
      offerName: switchCase.selectedOffer?.name || null,
      supplierName: switchCase.selectedOffer?.supplier?.name || null,
      // The customer's reference for this supply. There is no contract number
      // to quote any more — nobody enters one, because the contract is signed
      // outside the application — so the case number is what identifies it.
      contractNumber: switchCase.caseNumber,
      podPdrNumber:
        switchCase.bill?.podNumber || switchCase.bill?.pdrNumber || null,
      // Both entered by the admin when the case moves to "In Attivazione".
      activationDate: switchCase.activationDate || null,
      expiryDate: switchCase.expiryDate || null,
      monthlyEstimate: null,
      pricePerKwh: switchCase.selectedOffer?.pricePerKwh || null,
      pricePerSmc: switchCase.selectedOffer?.pricePerSmc || null,
      fixedMonthlyFee: switchCase.selectedOffer?.fixedMonthlyFee || null,
      contractDurationDays: this.contractDurationDays(
        switchCase.activationDate,
        switchCase.expiryDate,
      ),
      isGreenEnergy: switchCase.selectedOffer?.isGreenEnergy || false,
      status: switchCase.status,
    }));
  }

  /**
   * Where this utility is delivered, as one line — "Via Roma 25, Cagliari".
   *
   * The five structured fields on the case are the answer: they are what the
   * admin edits in the CRM, so the app picks an edit up on its next read. The
   * OCR'd line on the bill is the fallback for cases opened before those
   * fields existed, which carry the address nowhere else.
   */
  private supplyAddressLine(switchCase: SwitchCase): string | null {
    const street = [switchCase.supplyStreet, switchCase.supplyStreetNumber]
      .filter(Boolean)
      .join(' ')
      .trim();

    const line = [street, switchCase.supplyCity?.trim()]
      .filter(Boolean)
      .join(', ');

    return line || switchCase.bill?.supplyAddress || null;
  }

  /**
   * How long *this customer's* contract runs, from the two dates the admin
   * entered by hand when the case went into activation.
   *
   * The offer cannot answer this. Its own `contractDurationDays` describes the
   * offer, and two customers who sign the same offer months apart hold
   * contracts that start and end on different days — so the only honest source
   * is the pair of dates the contract itself was described by. Both are
   * mandatory before a case may enter "In Attivazione" and the expiry is
   * validated to fall after the activation, so in practice this is always
   * answerable for the cases this list returns; the null is for the rows that
   * predate that rule.
   */
  private contractDurationDays(
    activationDate: Date | string | null,
    expiryDate: Date | string | null,
  ): number | null {
    if (!activationDate || !expiryDate) return null;

    const from = new Date(activationDate).getTime();
    const to = new Date(expiryDate).getTime();
    if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null;

    return Math.round((to - from) / MS_PER_DAY);
  }
}
