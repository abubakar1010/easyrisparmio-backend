import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Offer } from './entities/offer.entity';
import { SentOffer } from './entities/sent-offer.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { CreateOfferDto } from './dto/create-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-offer-status.dto';
import { QueryOffersDto } from './dto/query-offers.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { BillType } from '../../common/enums/bill.enum';
import {
  EnergyType,
  MarketType,
  OfferPaymentMethod,
  UserTarget,
} from '../../common/enums/offer.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';
import { SupplierStatus } from '../../common/enums/supplier.enum';
import { CaseStatus, CLOSED_CASE_STATUSES } from '../../common/enums/case.enum';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class OffersService {
  constructor(
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    @InjectRepository(SwitchCase)
    private readonly switchCaseRepository: Repository<SwitchCase>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
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
    // Validate supplier exists and is eligible
    const supplier = await this.supplierRepository.findOne({
      where: { id: dto.supplierId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    this.assertSupplierCanCarryOffers(supplier);

    // Validate commodity compatibility
    if (supplier.commodity) {
      const energyType = dto.energyType as string;
      const supplierCommodity = supplier.commodity as string;

      if (supplierCommodity !== 'dual' && energyType !== supplierCommodity) {
        throw new BadRequestException(
          `Commodity mismatch: supplier "${supplier.name}" supports "${supplierCommodity}" but the offer energy type is "${energyType}"`,
        );
      }
      if (energyType === 'dual' && supplierCommodity !== 'dual') {
        throw new BadRequestException(
          `Commodity mismatch: a dual offer requires a dual supplier, but "${supplier.name}" supports only "${supplierCommodity}"`,
        );
      }
    }

    this.assertPricingComplete(dto.marketType, dto.energyType, dto);

    const offer = this.offerRepository.create({
      ...dto,
      createdBy: adminId,
      updatedBy: adminId,
    });
    try {
      const saved = await this.offerRepository.save(offer);

      // Catalogue edits notify nobody. An admin adding an offer is not an
      // event another admin has to act on, and it is visible in the offers
      // list the moment it is saved.

      return saved;
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'An offer with this offer code already exists',
        );
      }
      if (error.code === '23503') {
        throw new BadRequestException(
          'Referenced supplier does not exist',
        );
      }
      if (error.message?.includes('numeric field overflow')) {
        throw new BadRequestException(
          'A numeric value exceeds the allowed range. Prices allow up to 4 integer digits, fees/costs up to 8 integer digits.',
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
      .andWhere('offer.offerStatus = :status', { status: OfferStatus.ACTIVE })
      .andWhere('supplier.status != :pendingDeletion', {
        pendingDeletion: SupplierStatus.PENDING_DELETION,
      });

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

    // An offer accepting both methods matches either single-method filter; a
    // "both" filter degenerates to an exact match, which is what admins expect.
    if (query.paymentMethod) {
      qb.andWhere(
        '(offer.paymentMethod = :paymentMethod OR offer.paymentMethod = :bothPayment)',
        {
          paymentMethod: query.paymentMethod,
          bothPayment: OfferPaymentMethod.BOTH,
        },
      );
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

    // Which offers a live switch still depends on. This is the flag the
    // dashboard greys the Edit button on, so it has to draw the line in the
    // same place `checkOfferHasAcceptedCases` does — a cancelled or rejected
    // case would otherwise show an offer as frozen that the API will happily
    // let the admin edit.
    if (data.length > 0) {
      const offerIds = data.map((o) => o.id);
      const acceptedRows = await this.switchCaseRepository
        .createQueryBuilder('sc')
        .select('DISTINCT sc.selected_offer_id', 'offerId')
        .where('sc.selected_offer_id IN (:...ids)', { ids: offerIds })
        .andWhere('sc.status NOT IN (:...closedCaseStatuses)', {
          closedCaseStatuses: [...CLOSED_CASE_STATUSES],
        })
        .andWhere('sc.deletedAt IS NULL')
        .getRawMany();
      const acceptedSet = new Set(acceptedRows.map((r) => r.offerId));
      data.forEach((offer) => {
        (offer as any).hasAcceptedCases = acceptedSet.has(offer.id);
      });
    }

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

  /**
   * Refuses an offer that carries no price for the way it says it is priced.
   *
   * A fixed offer's price is its per-unit rate, one per commodity it covers;
   * a variable or indexed offer's is the spread over the market index. Either
   * way exactly one of those has to be on the row, and until now neither was
   * enforced anywhere: the DTO marks all three optional, so an offer could be
   * saved priced at nothing at all. That offer reaches the customer's utility
   * details with an empty price and no way to tell a missing figure from a
   * free supply, which is what this exists to stop at the source.
   *
   * Zero is a price. `== null` rather than a falsy test, so a genuinely free
   * component — a zero spread on a pure pass-through index offer — passes
   * instead of being rejected as unpriced.
   */
  private assertPricingComplete(
    marketType: MarketType,
    energyType: EnergyType,
    prices: {
      pricePerKwh?: number | null;
      pricePerSmc?: number | null;
      spread?: number | null;
    },
  ): void {
    if (
      marketType === MarketType.VARIABLE ||
      marketType === MarketType.INDEXED
    ) {
      if (prices.spread == null) {
        throw new BadRequestException(
          `A ${marketType} offer is priced as a spread over the market index, so a spread is required.`,
        );
      }
      return;
    }

    // Fixed. A dual offer covers both commodities and needs a rate for each,
    // or one half of it reaches the customer unpriced.
    const missing: string[] = [];
    if (
      (energyType === EnergyType.ELECTRICITY ||
        energyType === EnergyType.DUAL) &&
      prices.pricePerKwh == null
    ) {
      missing.push('pricePerKwh');
    }
    if (
      (energyType === EnergyType.GAS || energyType === EnergyType.DUAL) &&
      prices.pricePerSmc == null
    ) {
      missing.push('pricePerSmc');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `A fixed ${energyType} offer requires a per-unit price: ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} missing.`,
      );
    }
  }

  async update(
    id: string,
    dto: UpdateOfferDto,
    adminId: string,
  ): Promise<Offer> {
    const offer = await this.findById(id);

    // Strip offerStatus from update DTO — status changes must go through PATCH /offers/:id/status
    const { offerStatus, ...updateData } = dto as any;

    // If offer is not in DRAFT and has accepted cases, block all field updates
    if (offer.offerStatus !== OfferStatus.DRAFT) {
      const hasAccepted = await this.checkOfferHasAcceptedCases(id);
      if (hasAccepted) {
        throw new BadRequestException(
          'This offer has been accepted by users and cannot be modified. Only status changes are allowed via the status endpoint.',
        );
      }
    }

    Object.assign(offer, updateData);
    this.assertPricingComplete(offer.marketType, offer.energyType, offer);
    offer.updatedBy = adminId;
    try {
      return await this.offerRepository.save(offer);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'An offer with this offer code already exists',
        );
      }
      if (error.code === '23503') {
        throw new BadRequestException(
          'Referenced supplier does not exist',
        );
      }
      if (error.message?.includes('numeric field overflow')) {
        throw new BadRequestException(
          'A numeric value exceeds the allowed range. Prices allow up to 4 integer digits, fees/costs up to 8 integer digits.',
        );
      }
      throw error;
    }
  }

  async deleteOffer(id: string): Promise<{ message: string; cancelledCases?: number }> {
    const offer = await this.findById(id);

    // A supply that is still running is the strongest reason not to delete an
    // offer: the customer is being billed against its terms right now. An
    // activated case counts until the day its supply expires.
    const liveUtilities = await this.switchCaseRepository
      .createQueryBuilder('sc')
      .where('sc.selectedOfferId = :offerId', { offerId: id })
      .andWhere('sc.status = :activated', { activated: CaseStatus.ACTIVATED })
      .andWhere('sc.deletedAt IS NULL')
      .andWhere('(sc.expiryDate IS NULL OR sc.expiryDate > :today)', {
        today: new Date(),
      })
      .getMany();

    if (liveUtilities.length > 0) {
      const caseNumbers = liveUtilities.map((c) => c.caseNumber).join(', ');
      throw new BadRequestException(
        `Cannot delete this offer: it has ${liveUtilities.length} live utility/utilities (${caseNumbers}). Wait for them to expire or cancel them first.`,
      );
    }

    // Check for in-progress cases (not yet activated but not terminal)
    const activeCaseStatuses = [
      CaseStatus.NEW,
      CaseStatus.IN_PROGRESS,
      CaseStatus.DOCUMENTS_PENDING,
      CaseStatus.CONTRACT_SENT,
      CaseStatus.AWAITING_ACTIVATION,
    ];

    const activeCases = await this.switchCaseRepository.count({
      where: {
        selectedOfferId: id,
        status: In(activeCaseStatuses),
      },
    });

    if (activeCases > 0) {
      throw new BadRequestException(
        `Cannot delete this offer: it has ${activeCases} active case(s) in progress. Cancel or complete them first.`,
      );
    }

    // Safe to delete — only terminal cases (expired, CANCELLED, REJECTED) remain
    await this.offerRepository.softRemove(offer);

    return { message: 'Offer deleted successfully' };
  }

  async updateStatus(
    id: string,
    dto: UpdateOfferStatusDto,
    adminId: string,
  ): Promise<Offer> {
    const offer = await this.findById(id);
    const hasAccepted = await this.checkOfferHasAcceptedCases(id);
    this.validateStatusTransition(offer.offerStatus, dto.offerStatus, hasAccepted);

    // Now that ARCHIVED is reversible, an offer can re-enter the catalogue
    // long after its supplier left it. `create` refuses to build an offer on a
    // dead supplier; putting one back on sale has to refuse for the same
    // reason, or the send-offers screen starts listing suppliers we cannot
    // switch anyone to.
    if (dto.offerStatus === OfferStatus.ACTIVE) {
      this.assertSupplierCanCarryOffers(offer.supplier);
    }

    offer.offerStatus = dto.offerStatus;
    offer.updatedBy = adminId;
    const saved = await this.offerRepository.save(offer);

    // As with creation: an admin changing an offer's status is not news to
    // the other admins.

    return saved;
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
      relations: ['user'],
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
      .andWhere('supplier.status != :pendingDeletion', {
        pendingDeletion: SupplierStatus.PENDING_DELETION,
      })
      .andWhere(
        '(offer.energyType = :energyType OR offer.energyType = :dual)',
        { energyType, dual: EnergyType.DUAL },
      );

    // Same audience rule the admin's send-offers list obeys: a business tariff
    // is not a recommendation for a private customer.
    const target =
      bill.user?.role === UserRole.BUSINESS
        ? UserTarget.BUSINESS
        : bill.user?.role === UserRole.PERSONAL
          ? UserTarget.PERSONAL
          : null;
    if (target) {
      qb.andWhere('(offer.target = :target OR offer.target = :bothTargets)', {
        target,
        bothTargets: UserTarget.BOTH,
      });
    }

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

    return qb.getMany();
  }

  /**
   * The offers the customer still has to choose from, in the order the admin
   * put them in.
   *
   * Accepting one offer settles the whole bill, so every offer sent for that
   * bill leaves the list — the accepted one included. Only a cancelled or
   * rejected case frees the bill again and brings its offers back.
   *
   * Within a bill the admin's arrangement decides everything: the app renders
   * this list as it arrives, so `displayOrder` is the only sort applied and
   * price or savings never override it. Across bills the newest batch still
   * comes first, which is what the list did before and what a customer expects
   * when a fresh set of offers lands on a second supply point.
   *
   * The ordering is done here rather than in SQL because it needs each bill's
   * most recent send, and the list is one customer's offers — small enough that
   * a correlated subquery would buy nothing.
   */
  async getUserSentOffers(userId: string): Promise<SentOffer[]> {
    const sentOffers = await this.sentOfferRepository
      .createQueryBuilder('so')
      .leftJoinAndSelect('so.offer', 'offer')
      .leftJoinAndSelect('offer.supplier', 'supplier')
      .where('so.userId = :userId', { userId })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM switch_cases sc
          WHERE sc.bill_id = "so"."bill_id"
          AND sc.status NOT IN (:...closedCaseStatuses)
          AND sc.deleted_at IS NULL
        )`,
        { closedCaseStatuses: [...CLOSED_CASE_STATUSES] },
      )
      .orderBy('so.createdAt', 'DESC')
      .getMany();

    const latestSendPerBill = new Map<string, number>();
    for (const so of sentOffers) {
      const sentAt = so.createdAt.getTime();
      const latest = latestSendPerBill.get(so.billId);
      if (latest === undefined || sentAt > latest) {
        latestSendPerBill.set(so.billId, sentAt);
      }
    }

    // The bill id breaks a tie between two bills sent in the same millisecond.
    // Without it their offers would interleave by position, and one bill's
    // arrangement would be read as though it belonged to the other.
    return sentOffers.sort(
      (a, b) =>
        (latestSendPerBill.get(b.billId) ?? 0) -
          (latestSendPerBill.get(a.billId) ?? 0) ||
        a.billId.localeCompare(b.billId) ||
        a.displayOrder - b.displayOrder ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }

  /**
   * A supplier we can still switch customers to. Enforced when an offer is
   * created and again whenever one is put on sale.
   */
  private assertSupplierCanCarryOffers(supplier?: Supplier | null): void {
    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }
    if (!supplier.isActive) {
      throw new BadRequestException(
        'Cannot publish offers for an inactive supplier',
      );
    }
    if (supplier.status === SupplierStatus.PENDING_DELETION) {
      throw new BadRequestException(
        'Cannot publish offers for a supplier that is pending deletion',
      );
    }
  }

  /**
   * Is this offer still spoken for by a live switch?
   *
   * Only a case that is still going somewhere counts. A cancelled or rejected
   * case released its bill back to the customer — the offer it named was never
   * taken up, so it must not freeze the catalogue entry for good. Soft-deleted
   * cases are excluded by TypeORM's default scope for the same reason.
   */
  private async checkOfferHasAcceptedCases(offerId: string): Promise<boolean> {
    const count = await this.switchCaseRepository.count({
      where: {
        selectedOfferId: offerId,
        status: Not(In([...CLOSED_CASE_STATUSES])),
      },
    });
    return count > 0;
  }

  private validateStatusTransition(
    current: OfferStatus,
    next: OfferStatus,
    hasAcceptedCases: boolean = false,
  ): void {
    // DRAFT is the only editable state, so every route back into it is closed
    // while a live case names the offer. Everything else is reversible:
    // archiving retires an offer from the catalogue, it does not destroy it.
    const backToDraft = hasAcceptedCases ? [] : [OfferStatus.DRAFT];

    const validTransitions: Record<OfferStatus, OfferStatus[]> = {
      [OfferStatus.DRAFT]: [OfferStatus.ACTIVE, OfferStatus.ARCHIVED],
      [OfferStatus.ACTIVE]: [
        OfferStatus.EXPIRING,
        OfferStatus.ARCHIVED,
        ...backToDraft,
      ],
      [OfferStatus.EXPIRING]: [OfferStatus.EXPIRED, OfferStatus.ARCHIVED],
      [OfferStatus.EXPIRED]: [OfferStatus.ARCHIVED],
      // Un-archiving restores the offer to the catalogue. It goes back to
      // ACTIVE for immediate reuse, or to DRAFT when the terms need reworking
      // first — the latter only while no live case depends on them.
      [OfferStatus.ARCHIVED]: [OfferStatus.ACTIVE, ...backToDraft],
    };

    if (!validTransitions[current]?.includes(next)) {
      if (next === OfferStatus.DRAFT && hasAcceptedCases) {
        throw new BadRequestException(
          'Cannot revert to draft: this offer is used by an active case',
        );
      }
      throw new BadRequestException(
        `Cannot transition from ${current} to ${next}`,
      );
    }
  }
}
