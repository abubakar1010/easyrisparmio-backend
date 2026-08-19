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
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { LIVE_UTILITY_CASE_STATUSES } from '../../common/enums/case.enum';
import { BillType } from '../../common/enums/bill.enum';

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
      .addSelect([
        'supplier.id',
        'supplier.name',
        'supplier.logoUrl',
        'supplier.contactEmail',
        'supplier.website',
      ])
      .leftJoin('sc.bill', 'bill')
      .addSelect([
        'bill.id',
        'bill.podNumber',
        'bill.pdrNumber',
        'bill.billType',
        'bill.supplyAddress',
        'bill.meterNumber',
        'bill.consumptionKwh',
        'bill.consumptionSmc',
        'bill.billingPeriodStart',
        'bill.billingPeriodEnd',
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
      // The supplier's own logo, so the utilities list shows who supplies the
      // contract rather than a placeholder. Stored as the relative upload path
      // the admin uploaded it to (or an absolute URL for a hosted logo), which
      // clients resolve against the API origin. Null when the supplier has no
      // logo on file — the client falls back to a generic mark.
      supplierLogo: switchCase.selectedOffer?.supplier?.logoUrl || null,
      // How the customer reaches the supplier directly, alongside the in-app
      // ticket: the address the supplier takes customer mail at, and their own
      // site. Either is null when the supplier has none on file, and the client
      // leaves that contact option out rather than showing a dead row.
      supplierEmail: switchCase.selectedOffer?.supplier?.contactEmail || null,
      supplierWebsite: switchCase.selectedOffer?.supplier?.website || null,
      // The customer's reference for this supply. There is no contract number
      // to quote any more — nobody enters one, because the contract is signed
      // outside the application — so the case number is what identifies it.
      contractNumber: switchCase.caseNumber,
      podPdrNumber:
        switchCase.bill?.podNumber || switchCase.bill?.pdrNumber || null,
      // The physical meter serving this supply, as read off the bill. Null on
      // a bill the OCR could not find one on, so the client leaves the row out
      // rather than print a placeholder.
      meterNumber: switchCase.bill?.meterNumber || null,
      annualConsumption: this.annualConsumption(switchCase.bill),
      consumptionUnit: this.consumptionUnit(switchCase.bill),
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
   * What this supply uses in a year, in kWh for electricity and Smc for gas.
   *
   * A bill covers one billing period, so the figure printed on it is scaled up
   * by how many of those periods fit in a year — the same annualisation the
   * savings calculation uses. Where the period dates are missing the Italian
   * default of bimonthly billing (six periods) stands in, which is what makes
   * this answerable for a bill the OCR read the consumption off but not the
   * dates. Null when there is no consumption figure at all; the client leaves
   * the block out rather than show a zero the customer would read as a fact.
   */
  private annualConsumption(bill: EnergyBill | null | undefined): number | null {
    if (!bill) return null;

    const raw =
      bill.billType === BillType.GAS ? bill.consumptionSmc : bill.consumptionKwh;
    const consumption = raw == null ? null : Number(raw);
    if (consumption == null || !Number.isFinite(consumption) || consumption <= 0) {
      return null;
    }

    return Math.round(consumption * this.billingPeriodsPerYear(bill));
  }

  /** The unit [annualConsumption] is quoted in, so the client need not map the
   * supply type to a unit itself. Null whenever the figure itself is null. */
  private consumptionUnit(bill: EnergyBill | null | undefined): string | null {
    if (this.annualConsumption(bill) === null) return null;
    return bill!.billType === BillType.GAS ? 'Smc' : 'kWh';
  }

  /**
   * How many billing periods this bill's own period fits into a year. Falls
   * back to six — bimonthly, the common Italian cycle — when the bill carries
   * no usable period.
   */
  private billingPeriodsPerYear(bill: EnergyBill): number {
    const start = bill.billingPeriodStart
      ? new Date(bill.billingPeriodStart).getTime()
      : NaN;
    const end = bill.billingPeriodEnd
      ? new Date(bill.billingPeriodEnd).getTime()
      : NaN;

    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const periodDays = (end - start) / MS_PER_DAY;
      if (periodDays > 0) return 365 / periodDays;
    }

    return 6;
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
