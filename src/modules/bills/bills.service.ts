import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { Offer } from '../offers/entities/offer.entity';
import { AdminSettings } from '../dashboard/entities/admin-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';
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
    @InjectRepository(AdminSettings)
    private readonly adminSettingsRepository: Repository<AdminSettings>,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── Upload ───────────────────────────────────────────────

  async uploadBill(
    userId: string,
    fileUrl: string,
    dto: UploadBillDto,
  ): Promise<EnergyBill> {
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
      supplierId: dto.supplierId,
      billingPeriodStart: dto.billingPeriodStart ? new Date(dto.billingPeriodStart) : undefined,
      billingPeriodEnd: dto.billingPeriodEnd ? new Date(dto.billingPeriodEnd) : undefined,
      status: BillStatus.UPLOADED,
    });

    const savedBill = await this.billRepository.save(bill);

    // Auto-trigger analysis in background
    setImmediate(() => {
      this.triggerAutoAnalysis(savedBill).catch((err) => {
        this.logger.error(`Auto-analysis failed for bill ${savedBill.id}`, err.stack);
      });
    });

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
      .leftJoinAndSelect('bill.user', 'user');

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
      relations: ['supplier', 'analysis', 'user'],
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

  async analyzeBill(billId: string, userId: string): Promise<BillAnalysis> {
    const bill = await this.getBillById(billId, userId);
    return this.runAnalysis(bill);
  }

  async reanalyzeBill(billId: string): Promise<BillAnalysis> {
    const bill = await this.getBillByIdAdmin(billId);
    return this.runAnalysis(bill);
  }

  async getBillAnalysis(
    billId: string,
    userId: string,
  ): Promise<BillAnalysis> {
    await this.getBillById(billId, userId);

    const analysis = await this.analysisRepository.findOne({
      where: { billId },
      relations: ['bill'],
    });

    if (!analysis) {
      throw new NotFoundException(
        'Analysis not found. Please trigger analysis first.',
      );
    }

    return analysis;
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

  async sendOffersToUser(billId: string): Promise<void> {
    const bill = await this.getBillByIdAdmin(billId);
    const analysis = await this.analysisRepository.findOne({
      where: { billId },
    });

    if (!analysis) {
      throw new NotFoundException('Analysis not found for this bill');
    }

    if (!analysis.recommendedOffers?.length) {
      throw new NotFoundException('No recommended offers to send');
    }

    await this.notificationsService.sendNotification({
      userId: bill.userId,
      title: 'Nuove offerte consigliate per te',
      body: `Abbiamo trovato ${analysis.recommendedOffers.length} offerte migliori per la tua bolletta. Risparmio stimato: EUR ${analysis.potentialSavings}`,
      type: NotificationType.OFFER_AVAILABLE,
      data: {
        billId,
        analysisId: analysis.id,
        offers: analysis.recommendedOffers,
      },
    });

    analysis.offersSentToUser = true;
    await this.analysisRepository.save(analysis);
  }

  // ─── Private: Core Analysis Logic ─────────────────────────

  private async runAnalysis(bill: EnergyBill): Promise<BillAnalysis> {
    bill.status = BillStatus.ANALYZING;
    await this.billRepository.save(bill);

    try {
      const settings = await this.getAdminSettings();
      const topOffers = await this.findTopOffers(bill, settings.maxRecommendedOffers);

      const { potentialSavings, currentMonthlyAvg, confidenceScore } =
        this.calculateSavings(bill, topOffers);

      const recommendedMarketType = topOffers.length > 0
        ? topOffers[0].marketType
        : MarketType.FIXED;

      const offerSnapshots = topOffers.map((offer) => ({
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

      const analysisSummary = topOffers.length > 0
        ? `Abbiamo trovato ${topOffers.length} offerte migliori per la tua bolletta ${bill.billType}. La migliore offerta è "${topOffers[0].name}" di ${topOffers[0].supplier?.name || 'fornitore'}, con un risparmio stimato di EUR ${potentialSavings} per periodo di fatturazione.`
        : `Non abbiamo trovato offerte migliori per la tua bolletta ${bill.billType} al momento. Ti aggiorneremo quando saranno disponibili nuove offerte.`;

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
          offersCompared: topOffers.length,
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

  private async findTopOffers(bill: EnergyBill, limit: number): Promise<Offer[]> {
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

    qb.take(limit);

    return qb.getMany();
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

  // ─── Private: Auto-Analysis Trigger ───────────────────────

  private async triggerAutoAnalysis(bill: EnergyBill): Promise<void> {
    const analysis = await this.runAnalysis(bill);

    if (!analysis.recommendedOffers?.length) return;

    const settings = await this.getAdminSettings();
    if (!settings.autoSendOffers) return;

    await this.notificationsService.sendNotification({
      userId: bill.userId,
      title: 'Nuove offerte consigliate per te',
      body: `Abbiamo trovato ${analysis.recommendedOffers.length} offerte migliori per la tua bolletta. Risparmio stimato: EUR ${analysis.potentialSavings}`,
      type: NotificationType.OFFER_AVAILABLE,
      data: {
        billId: bill.id,
        analysisId: analysis.id,
        offers: analysis.recommendedOffers,
      },
    });

    analysis.offersSentToUser = true;
    await this.analysisRepository.save(analysis);
  }

  private async getAdminSettings(): Promise<AdminSettings> {
    let settings = await this.adminSettingsRepository.findOne({ where: {} });
    if (!settings) {
      settings = this.adminSettingsRepository.create({
        autoSendOffers: false,
        maxRecommendedOffers: 3,
      });
      await this.adminSettingsRepository.save(settings);
    }
    return settings;
  }
}
