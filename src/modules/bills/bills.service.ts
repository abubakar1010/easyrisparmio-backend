import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { VisionOcrService } from './ocr/vision-ocr.service';
import { UploadBillDto } from './dto/upload-bill.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { BillStatus, BillType } from '../../common/enums/bill.enum';
import { EnergyType, MarketType } from '../../common/enums/offer.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';
import { NotificationType } from '../../common/enums/notification.enum';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(BillAnalysis)
    private readonly analysisRepository: Repository<BillAnalysis>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    private readonly notificationsService: NotificationsService,
    private readonly visionOcrService: VisionOcrService,
  ) {}

  // ─── Upload ───────────────────────────────────────────────

  async uploadBill(
    userId: string,
    fileUrl: string,
    dto: UploadBillDto,
  ): Promise<EnergyBill> {
    // Match supplier name from Vision API extraction against existing suppliers
    let resolvedSupplierId = dto.supplierId;
    if (!resolvedSupplierId && dto.supplierName) {
      const matched = await this.supplierRepository
        .createQueryBuilder('supplier')
        .where('supplier.name ILIKE :name', {
          name: `%${dto.supplierName}%`,
        })
        .getOne();

      if (matched) {
        resolvedSupplierId = matched.id;
        this.logger.log(
          `Matched supplier "${dto.supplierName}" → ${matched.name} (${matched.id})`,
        );
      } else {
        this.logger.warn(`No supplier match found for "${dto.supplierName}"`);
      }
    }

    const bill = this.billRepository.create({
      userId,
      fileUrl,
      billType: dto.billType,
      podNumber: dto.podNumber,
      pdrNumber: dto.pdrNumber,
      totalAmount: dto.totalAmount,
      consumptionKwh: dto.consumptionKwh,
      consumptionSmc: dto.consumptionSmc,
      costPerUnit: dto.costPerUnit,
      fixedCharges: dto.fixedCharges,
      taxes: dto.taxes,
      supplierId: resolvedSupplierId,
      billingPeriodStart: dto.billingPeriodStart ? new Date(dto.billingPeriodStart) : undefined,
      billingPeriodEnd: dto.billingPeriodEnd ? new Date(dto.billingPeriodEnd) : undefined,
      supplyAddress: dto.supplyAddress,
      codiceFiscale: dto.codiceFiscale,
      partitaIva: dto.partitaIva,
      contractNumber: dto.contractNumber,
      meterNumber: dto.meterNumber,
      customerName: dto.customerName,
      status: BillStatus.ANALYZING,
      rawAnalysisData: dto.supplierName ? {
        ocrSupplierName: dto.supplierName,
        ocrTimestamp: new Date().toISOString(),
        source: 'openai-vision',
        model: 'gpt-4o',
      } : {
        source: 'manual-entry',
      },
    });

    const savedBill = await this.billRepository.save(bill);

    return savedBill;
  }

  // ─── User Queries ─────────────────────────────────────────

  async getUserBills(
    userId: string,
    query: QueryBillsDto,
  ): Promise<PaginatedResponseDto<EnergyBill>> {
    const qb = this.billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.supplier', 'supplier')
      .leftJoinAndSelect('bill.analysis', 'analysis')
      .where('bill.userId = :userId', { userId });

    if (query.billType) {
      qb.andWhere('bill.billType = :billType', { billType: query.billType });
    }

    if (query.status) {
      qb.andWhere('bill.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('bill.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('bill.createdAt <= :dateTo', { dateTo: query.dateTo });
    }

    qb.orderBy('bill.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [bills, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(bills, total, query.page, query.limit);
  }

  async getAllBills(
    query: QueryBillsDto,
  ): Promise<PaginatedResponseDto<EnergyBill>> {
    const qb = this.billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.supplier', 'supplier')
      .leftJoinAndSelect('bill.user', 'user')
      .leftJoinAndSelect('bill.switchCases', 'switchCase');

    if (query.billType) {
      qb.andWhere('bill.billType = :billType', { billType: query.billType });
    }

    if (query.status) {
      qb.andWhere('bill.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('bill.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('bill.createdAt <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.firstName ILIKE :search OR user.lastName ILIKE :search OR bill.podNumber ILIKE :search OR bill.pdrNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('bill.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [bills, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(bills, total, query.page, query.limit);
  }

  async getBillByIdAdmin(billId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'analysis', 'user', 'switchCases'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async getBillById(billId: string, userId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'analysis'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bill');
    }

    return bill;
  }

  // ─── Analysis ─────────────────────────────────────────────

  async reanalyzeBill(billId: string): Promise<BillAnalysis> {
    const bill = await this.getBillByIdAdmin(billId);
    return this.runAnalysis(bill);
  }

  // ─── Admin: Recommended Offers ────────────────────────────

  async getRecommendedOffersAdmin(billId: string) {
    const analysis = await this.analysisRepository.findOne({
      where: { billId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found for this bill');
    }

    return {
      billId,
      recommendedOffers: analysis.recommendedOffers || [],
      potentialSavings: analysis.potentialSavings,
      offersSentToUser: analysis.offersSentToUser,
    };
  }

  async getAllOffersForBill(billId: string) {
    const bill = await this.getBillByIdAdmin(billId);

    const energyType = bill.billType === BillType.ELECTRICITY
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

    if (bill.billType === BillType.ELECTRICITY) {
      qb.orderBy('offer.pricePerKwh', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('offer.pricePerSmc', 'ASC', 'NULLS LAST');
    }

    const offers = await qb.getMany();

    return offers.map((offer) => ({
      ...offer,
      estimatedSavings: this.estimateOfferSavings(bill, offer),
    }));
  }

  async sendOffersToUser(
    billId: string,
    selectedOffers: Array<{ offerId: string; estimatedSavings?: number }>,
  ): Promise<void> {
    const bill = await this.getBillByIdAdmin(billId);

    if (!selectedOffers?.length) {
      throw new NotFoundException('No offers selected to send');
    }

    const offerIds = selectedOffers.map((o) => o.offerId);
    const offers = await this.offerRepository.find({
      where: { id: In(offerIds) },
      relations: ['supplier'],
    });

    if (offers.length === 0) {
      throw new NotFoundException('No valid offers found for the given IDs');
    }

    // Build a lookup for admin-provided savings overrides
    const savingsMap = new Map(
      selectedOffers
        .filter((o) => o.estimatedSavings != null)
        .map((o) => [o.offerId, o.estimatedSavings!]),
    );

    // Build offer snapshots
    const offerSnapshots = offers.map((offer) => ({
      id: offer.id,
      name: offer.name,
      supplierName: offer.supplier?.name || null,
      supplierId: offer.supplierId,
      pricePerKwh: offer.pricePerKwh,
      pricePerSmc: offer.pricePerSmc,
      fixedMonthlyFee: offer.fixedMonthlyFee,
      energyType: offer.energyType,
      marketType: offer.marketType,
      contractDurationMonths: offer.contractDurationMonths,
      isGreenEnergy: offer.isGreenEnergy,
      estimatedSavings: savingsMap.has(offer.id)
        ? savingsMap.get(offer.id)!
        : this.estimateOfferSavings(bill, offer),
    }));

    // Check for existing sent offers to avoid duplicates
    const existing = await this.sentOfferRepository.find({
      where: { billId: bill.id },
      select: ['offerId'],
    });
    const existingIds = new Set(existing.map((s) => s.offerId));

    const newRecords = offerSnapshots
      .filter((snap) => !existingIds.has(snap.id))
      .map((snap) =>
        this.sentOfferRepository.create({
          userId: bill.userId,
          billId: bill.id,
          offerId: snap.id,
          estimatedSavings: snap.estimatedSavings ?? null,
          sentBy: 'admin',
          offerSnapshot: snap,
        }),
      );

    if (newRecords.length > 0) {
      await this.sentOfferRepository.save(newRecords);
    }

    // Calculate best savings for notification message
    const bestSavings = Math.max(...offerSnapshots.map((s) => s.estimatedSavings || 0));

    await this.notificationsService.sendNotification({
      userId: bill.userId,
      title: 'Nuove offerte consigliate per te',
      body: `Abbiamo trovato ${offerSnapshots.length} offerte migliori per la tua bolletta. Risparmio stimato: EUR ${bestSavings.toFixed(2)}`,
      type: NotificationType.OFFER_AVAILABLE,
      data: {
        billId: bill.id,
        offers: offerSnapshots,
      },
    });

    bill.status = BillStatus.OFFER_SENT;
    await this.billRepository.save(bill);
  }

  // ─── Private: Core Analysis Logic ─────────────────────────

  private async runAnalysis(bill: EnergyBill): Promise<BillAnalysis> {
    bill.status = BillStatus.ANALYZING;
    await this.billRepository.save(bill);

    try {
      const energyType = bill.billType === BillType.ELECTRICITY
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

      if (bill.billType === BillType.ELECTRICITY) {
        qb.orderBy('offer.pricePerKwh', 'ASC', 'NULLS LAST');
      } else {
        qb.orderBy('offer.pricePerSmc', 'ASC', 'NULLS LAST');
      }

      const allOffers = await qb.getMany();

      const { potentialSavings, currentMonthlyAvg, confidenceScore } =
        this.calculateSavings(bill, allOffers);

      const recommendedMarketType = allOffers.length > 0
        ? allOffers[0].marketType
        : MarketType.FIXED;

      const offerSnapshots = allOffers.map((offer) => ({
        id: offer.id,
        name: offer.name,
        supplierName: offer.supplier?.name || null,
        supplierId: offer.supplierId,
        pricePerKwh: offer.pricePerKwh,
        pricePerSmc: offer.pricePerSmc,
        fixedMonthlyFee: offer.fixedMonthlyFee,
        energyType: offer.energyType,
        marketType: offer.marketType,
        contractDurationMonths: offer.contractDurationMonths,
        isGreenEnergy: offer.isGreenEnergy,
        estimatedSavings: this.estimateOfferSavings(bill, offer),
      }));

      const analysisSummary = allOffers.length > 0
        ? `Abbiamo trovato ${allOffers.length} offerte per la tua bolletta ${bill.billType}. La migliore offerta è "${allOffers[0].name}" di ${allOffers[0].supplier?.name || 'fornitore'}, con un risparmio stimato di EUR ${potentialSavings} per periodo di fatturazione.`
        : `Non abbiamo trovato offerte per la tua bolletta ${bill.billType} al momento. Ti aggiorneremo quando saranno disponibili nuove offerte.`;

      let analysis = await this.analysisRepository.findOne({
        where: { billId: bill.id },
      });

      const analysisData = {
        potentialSavings,
        currentMonthlyAvg,
        recommendedMarketType,
        analysisSummary,
        analysisDetails: {
          currentCostPerUnit: bill.costPerUnit,
          currentFixedCharges: bill.fixedCharges,
          consumption: bill.billType === BillType.ELECTRICITY
            ? bill.consumptionKwh
            : bill.consumptionSmc,
          offersCompared: allOffers.length,
        },
        confidenceScore,
        recommendedOffers: offerSnapshots,
        offersSentToUser: false,
      };

      if (analysis) {
        Object.assign(analysis, analysisData);
      } else {
        analysis = this.analysisRepository.create({
          billId: bill.id,
          ...analysisData,
        });
      }

      await this.analysisRepository.save(analysis);

      bill.status = BillStatus.ANALYZED;
      await this.billRepository.save(bill);

      return analysis;
    } catch (error) {
      bill.status = BillStatus.ERROR;
      await this.billRepository.save(bill);
      throw error;
    }
  }

  private calculateSavings(
    bill: EnergyBill,
    offers: Offer[],
  ): { potentialSavings: number; currentMonthlyAvg: number; confidenceScore: number } {
    const totalAmount = Number(bill.totalAmount) || 0;
    const costPerUnit = Number(bill.costPerUnit) || 0;
    const fixedCharges = Number(bill.fixedCharges) || 0;
    const consumption = bill.billType === BillType.ELECTRICITY
      ? Number(bill.consumptionKwh) || 0
      : Number(bill.consumptionSmc) || 0;

    // If we have full cost data + offers, calculate real savings
    if (costPerUnit > 0 && consumption > 0 && offers.length > 0) {
      const bestOffer = offers[0];
      const bestOfferPrice = bill.billType === BillType.ELECTRICITY
        ? Number(bestOffer.pricePerKwh) || 0
        : Number(bestOffer.pricePerSmc) || 0;
      const bestOfferFee = Number(bestOffer.fixedMonthlyFee) || 0;

      const currentCost = (consumption * costPerUnit) + fixedCharges;
      const bestOfferCost = (consumption * bestOfferPrice) + bestOfferFee;
      const savings = Math.max(0, +(currentCost - bestOfferCost).toFixed(2));

      return {
        potentialSavings: savings,
        currentMonthlyAvg: +currentCost.toFixed(2),
        confidenceScore: 0.9,
      };
    }

    // Fallback: estimate from totalAmount
    if (totalAmount > 0 && offers.length > 0) {
      return {
        potentialSavings: +(totalAmount * 0.10).toFixed(2),
        currentMonthlyAvg: +totalAmount.toFixed(2),
        confidenceScore: 0.4,
      };
    }

    // No data available
    return {
      potentialSavings: 0,
      currentMonthlyAvg: totalAmount,
      confidenceScore: 0,
    };
  }

  private estimateOfferSavings(bill: EnergyBill, offer: Offer): number {
    const costPerUnit = Number(bill.costPerUnit) || 0;
    const fixedCharges = Number(bill.fixedCharges) || 0;
    const consumption = bill.billType === BillType.ELECTRICITY
      ? Number(bill.consumptionKwh) || 0
      : Number(bill.consumptionSmc) || 0;

    if (costPerUnit > 0 && consumption > 0) {
      const offerPrice = bill.billType === BillType.ELECTRICITY
        ? Number(offer.pricePerKwh) || 0
        : Number(offer.pricePerSmc) || 0;
      const offerFee = Number(offer.fixedMonthlyFee) || 0;

      const currentCost = (consumption * costPerUnit) + fixedCharges;
      const offerCost = (consumption * offerPrice) + offerFee;
      return Math.max(0, +(currentCost - offerCost).toFixed(2));
    }

    return 0;
  }

}
