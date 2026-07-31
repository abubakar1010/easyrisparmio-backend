import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { BillFile } from './entities/bill-file.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { User } from '../users/entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { VisionOcrService } from './ocr/vision-ocr.service';
import { UploadBillDto } from './dto/upload-bill.dto';
import { CreateEmailBillDto } from './dto/create-email-bill.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { BillStatus, BillType, BillSource } from '../../common/enums/bill.enum';
import { EnergyType, MarketType } from '../../common/enums/offer.enum';
import { OfferStatus } from '../../common/enums/offer-status.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { readFileSync } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(BillAnalysis)
    private readonly analysisRepository: Repository<BillAnalysis>,
    @InjectRepository(BillFile)
    private readonly billFileRepository: Repository<BillFile>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
    private readonly visionOcrService: VisionOcrService,
  ) {}

  // ─── Upload ───────────────────────────────────────────────

  async uploadBill(
    userId: string,
    fileUrl: string,
    dto: UploadBillDto,
    fileMeta?: { originalName?: string; mimeType?: string; fileSize?: number },
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
      supplierName: dto.supplierName || null,
      billingPeriodStart: dto.billingPeriodStart ? new Date(dto.billingPeriodStart) : undefined,
      billingPeriodEnd: dto.billingPeriodEnd ? new Date(dto.billingPeriodEnd) : undefined,
      supplyAddress: dto.supplyAddress,
      codiceFiscale: dto.codiceFiscale,
      partitaIva: dto.partitaIva,
      contractNumber: dto.contractNumber,
      meterNumber: dto.meterNumber,
      customerName: dto.customerName,
      source: BillSource.UPLOAD,
      status: BillStatus.ANALYZING,
      rawAnalysisData: dto.supplierName ? {
        ocrSupplierName: dto.supplierName,
        ocrConfidence: (dto as any).confidence ?? null,
        ocrOverallConfidence: (dto as any).overallConfidence ?? null,
        ocrTimestamp: new Date().toISOString(),
        source: 'openai-vision',
        model: 'gpt-4o',
      } : {
        source: 'manual-entry',
      },
    });

    const savedBill = await this.billRepository.save(bill);

    // Create BillFile record for the uploaded file
    if (fileUrl) {
      await this.createBillFileRecord(savedBill.id, fileUrl, fileMeta);
    }

    // If no OCR data was provided (mobile upload without extraction),
    // trigger background OCR extraction + analysis
    if (!dto.totalAmount && !dto.podNumber && !dto.pdrNumber && !dto.supplierName) {
      this.processOcrInBackground(savedBill).catch((err) =>
        this.logger.error(
          `Background OCR failed for bill ${savedBill.id}: ${err.message}`,
        ),
      );
    }

    return this.getBillByIdAdmin(savedBill.id);
  }

  /**
   * Runs OCR extraction and analysis in the background (fire-and-forget).
   * Collects images from ALL bill files and extracts data across them.
   * Saves whatever data was found — never sets ERROR for partial extraction.
   */
  private async processOcrInBackground(bill: EnergyBill): Promise<void> {
    try {
      bill.status = BillStatus.ANALYZING;
      await this.billRepository.save(bill);

      // Collect images from ALL bill files (not just the primary fileUrl)
      const billFiles = await this.billFileRepository.find({
        where: { billId: bill.id },
        order: { createdAt: 'ASC' },
      });

      // Fall back to primary fileUrl if no BillFile records exist yet
      const fileUrls = billFiles.length > 0
        ? billFiles.map((f) => f.fileUrl)
        : bill.fileUrl ? [bill.fileUrl] : [];

      if (fileUrls.length === 0) {
        this.logger.warn(`No files for bill ${bill.id}, skipping background OCR`);
        return;
      }

      const allImageBuffers: Buffer[] = [];
      for (const fileUrl of fileUrls) {
        try {
          const fullPath = join(process.cwd(), fileUrl);
          const ext = extname(fileUrl).toLowerCase();
          if (ext === '.pdf') {
            const pdfImages = await this.visionOcrService.convertPdfToImages(fullPath);
            allImageBuffers.push(...pdfImages);
          } else {
            allImageBuffers.push(readFileSync(fullPath));
          }
        } catch (fileErr) {
          this.logger.warn(
            `Failed to read file ${fileUrl} for bill ${bill.id}: ${fileErr.message}`,
          );
        }
      }

      if (allImageBuffers.length === 0) {
        this.logger.warn(`No readable images for bill ${bill.id}`);
        bill.rawAnalysisData = {
          ...bill.rawAnalysisData,
          ocrWarning: 'No readable images found in uploaded files',
          ocrTimestamp: new Date().toISOString(),
        };
        await this.billRepository.save(bill);
        await this.runAnalysis(bill);
        return;
      }

      this.logger.log(
        `Processing ${allImageBuffers.length} images from ${fileUrls.length} files for bill ${bill.id}`,
      );

      const result = await this.visionOcrService.extractFromImages(
        allImageBuffers,
        bill.billType,
      );

      // Populate bill fields from extraction — save whatever was found
      if (result.podNumber) bill.podNumber = result.podNumber;
      if (result.pdrNumber) bill.pdrNumber = result.pdrNumber;
      if (result.totalAmount != null) bill.totalAmount = result.totalAmount;
      if (result.consumptionKwh != null) bill.consumptionKwh = result.consumptionKwh;
      if (result.consumptionSmc != null) bill.consumptionSmc = result.consumptionSmc;
      if (result.costPerUnit != null) bill.costPerUnit = result.costPerUnit;
      if (result.fixedCharges != null) bill.fixedCharges = result.fixedCharges;
      if (result.taxes != null) bill.taxes = result.taxes;
      if (result.billingPeriodStart) {
        bill.billingPeriodStart = new Date(result.billingPeriodStart);
      }
      if (result.billingPeriodEnd) {
        bill.billingPeriodEnd = new Date(result.billingPeriodEnd);
      }
      if (result.supplyAddress) bill.supplyAddress = result.supplyAddress;
      if (result.codiceFiscale) bill.codiceFiscale = result.codiceFiscale;
      if (result.partitaIva) bill.partitaIva = result.partitaIva;
      if (result.contractNumber) bill.contractNumber = result.contractNumber;
      if (result.meterNumber) bill.meterNumber = result.meterNumber;
      if (result.customerName) bill.customerName = result.customerName;
      if (result.supplierName) bill.supplierName = result.supplierName;

      // Store OCR metadata
      bill.rawAnalysisData = {
        ...bill.rawAnalysisData,
        ocrSupplierName: result.supplierName,
        ocrConfidence: result.confidence,
        ocrOverallConfidence: result.overallConfidence,
        ocrTimestamp: new Date().toISOString(),
        source: 'openai-vision',
        model: 'gpt-4o',
        backgroundProcessed: true,
        filesProcessed: fileUrls.length,
        imagesProcessed: allImageBuffers.length,
      };

      await this.billRepository.save(bill);

      // Run analysis — works with whatever data was collected
      await this.runAnalysis(bill);

      this.logger.log(`Background OCR + analysis completed for bill ${bill.id}`);
    } catch (error) {
      this.logger.error(
        `Background OCR processing failed for bill ${bill.id}: ${error.message}`,
      );
      // Save whatever was collected so far, don't lose data
      bill.rawAnalysisData = {
        ...bill.rawAnalysisData,
        ocrWarning: error.message,
        ocrFailedAt: new Date().toISOString(),
      };
      await this.billRepository.save(bill);
      // Still try to run analysis with whatever data exists
      try {
        await this.runAnalysis(bill);
      } catch (analysisErr) {
        this.logger.error(`Analysis also failed for bill ${bill.id}: ${analysisErr.message}`);
        bill.status = BillStatus.ANALYZED;
        await this.billRepository.save(bill);
      }
    }
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
      .leftJoinAndSelect('bill.switchCases', 'switchCase')
      .leftJoinAndSelect('bill.files', 'billFile')
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
      .leftJoinAndSelect('bill.switchCases', 'switchCase')
      .leftJoinAndSelect('bill.files', 'billFile');

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

    if (query.caseStatus) {
      qb.andWhere('switchCase.status = :caseStatus', { caseStatus: query.caseStatus });
    }

    if (query.source) {
      qb.andWhere('bill.source = :source', { source: query.source });
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
      relations: ['supplier', 'analysis', 'user', 'switchCases', 'files'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async getBillById(billId: string, userId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'analysis', 'switchCases', 'files'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bill');
    }

    return bill;
  }

  // ─── Email Bill ───────────────────────────────────────────

  async createEmailBillPlaceholder(
    userId: string,
    dto: CreateEmailBillDto,
  ): Promise<EnergyBill> {
    // Prevent duplicate pending email requests for the same bill type
    const existing = await this.billRepository.findOne({
      where: {
        userId,
        billType: dto.billType,
        status: BillStatus.PENDING_EMAIL,
        source: BillSource.EMAIL,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `You already have a pending email request for ${dto.billType}. Please wait for it to be processed.`,
      );
    }

    const bill = this.billRepository.create({
      userId,
      fileUrl: null,
      billType: dto.billType,
      source: BillSource.EMAIL,
      status: BillStatus.PENDING_EMAIL,
      rawAnalysisData: {
        source: 'email',
        createdAt: new Date().toISOString(),
      },
    });

    return this.billRepository.save(bill);
  }

  async adminUploadEmailBill(
    fileUrl: string,
    billType: BillType,
    userId: string,
    extractedData?: Record<string, any>,
  ): Promise<EnergyBill> {
    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check if user has a pending email bill of the same type
    const pendingBill = await this.billRepository.findOne({
      where: {
        userId,
        billType,
        status: BillStatus.PENDING_EMAIL,
        source: BillSource.EMAIL,
      },
      order: { createdAt: 'DESC' },
    });

    let savedBill: EnergyBill;

    if (pendingBill) {
      // Update existing pending bill with file and transition to ANALYZING
      pendingBill.fileUrl = fileUrl;
      pendingBill.status = BillStatus.ANALYZING;
      pendingBill.rawAnalysisData = {
        ...pendingBill.rawAnalysisData,
        adminUploadedAt: new Date().toISOString(),
        source: 'email',
      };
      savedBill = await this.billRepository.save(pendingBill);
    } else {
      // No pending bill found - create a new email-sourced bill
      const bill = this.billRepository.create({
        userId,
        fileUrl,
        billType,
        source: BillSource.EMAIL,
        status: BillStatus.ANALYZING,
        rawAnalysisData: {
          source: 'email',
          adminUploadedAt: new Date().toISOString(),
        },
      });
      savedBill = await this.billRepository.save(bill);
    }

    // Create BillFile record
    await this.createBillFileRecord(savedBill.id, fileUrl);

    // Populate bill with OCR-extracted data if provided
    if (extractedData) {
      savedBill.podNumber = extractedData.podNumber || savedBill.podNumber;
      savedBill.pdrNumber = extractedData.pdrNumber || savedBill.pdrNumber;
      savedBill.totalAmount = extractedData.totalAmount ?? savedBill.totalAmount;
      savedBill.consumptionKwh = extractedData.consumptionKwh ?? savedBill.consumptionKwh;
      savedBill.consumptionSmc = extractedData.consumptionSmc ?? savedBill.consumptionSmc;
      savedBill.costPerUnit = extractedData.costPerUnit ?? savedBill.costPerUnit;
      savedBill.fixedCharges = extractedData.fixedCharges ?? savedBill.fixedCharges;
      savedBill.taxes = extractedData.taxes ?? savedBill.taxes;
      savedBill.billingPeriodStart = extractedData.billingPeriodStart
        ? new Date(extractedData.billingPeriodStart) : savedBill.billingPeriodStart;
      savedBill.billingPeriodEnd = extractedData.billingPeriodEnd
        ? new Date(extractedData.billingPeriodEnd) : savedBill.billingPeriodEnd;
      savedBill.supplyAddress = extractedData.supplyAddress || savedBill.supplyAddress;
      savedBill.codiceFiscale = extractedData.codiceFiscale || savedBill.codiceFiscale;
      savedBill.partitaIva = extractedData.partitaIva || savedBill.partitaIva;
      savedBill.contractNumber = extractedData.contractNumber || savedBill.contractNumber;
      savedBill.meterNumber = extractedData.meterNumber || savedBill.meterNumber;
      savedBill.customerName = extractedData.customerName || savedBill.customerName;
      savedBill.supplierName = extractedData.supplierName || savedBill.supplierName;

      // Store OCR metadata
      savedBill.rawAnalysisData = {
        ...savedBill.rawAnalysisData,
        ocrSupplierName: extractedData.supplierName,
        ocrConfidence: extractedData.confidence,
        ocrOverallConfidence: extractedData.overallConfidence,
        ocrTimestamp: new Date().toISOString(),
        source: 'openai-vision',
        model: 'gpt-4o',
      };

      await this.billRepository.save(savedBill);

      // Run analysis to generate savings data and recommended offers
      try {
        await this.runAnalysis(savedBill);
      } catch (error) {
        this.logger.error(
          `Analysis failed for bill ${savedBill.id}: ${error.message}`,
        );
      }
    }

    return this.getBillByIdAdmin(savedBill.id);
  }

  async adminAssociateBillWithUser(
    billId: string,
    userId: string,
    pendingBillId?: string,
  ): Promise<EnergyBill> {
    const bill = await this.getBillByIdAdmin(billId);

    // Verify user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (pendingBillId) {
      // Merge into existing pending bill
      const pendingBill = await this.billRepository.findOne({
        where: { id: pendingBillId, status: BillStatus.PENDING_EMAIL },
      });

      if (!pendingBill) {
        throw new NotFoundException('Pending email bill not found');
      }

      if (pendingBill.userId !== userId) {
        throw new BadRequestException('Pending bill does not belong to the specified user');
      }

      // Transfer file and data from uploaded bill to pending bill
      pendingBill.fileUrl = bill.fileUrl;
      pendingBill.status = bill.fileUrl ? BillStatus.ANALYZING : BillStatus.PENDING_EMAIL;
      pendingBill.podNumber = bill.podNumber || pendingBill.podNumber;
      pendingBill.pdrNumber = bill.pdrNumber || pendingBill.pdrNumber;
      pendingBill.totalAmount = bill.totalAmount ?? pendingBill.totalAmount;
      pendingBill.consumptionKwh = bill.consumptionKwh ?? pendingBill.consumptionKwh;
      pendingBill.consumptionSmc = bill.consumptionSmc ?? pendingBill.consumptionSmc;
      pendingBill.costPerUnit = bill.costPerUnit ?? pendingBill.costPerUnit;
      pendingBill.fixedCharges = bill.fixedCharges ?? pendingBill.fixedCharges;
      pendingBill.taxes = bill.taxes ?? pendingBill.taxes;
      pendingBill.supplierId = bill.supplierId || pendingBill.supplierId;
      pendingBill.billingPeriodStart = bill.billingPeriodStart || pendingBill.billingPeriodStart;
      pendingBill.billingPeriodEnd = bill.billingPeriodEnd || pendingBill.billingPeriodEnd;
      pendingBill.supplyAddress = bill.supplyAddress || pendingBill.supplyAddress;
      pendingBill.codiceFiscale = bill.codiceFiscale || pendingBill.codiceFiscale;
      pendingBill.partitaIva = bill.partitaIva || pendingBill.partitaIva;
      pendingBill.contractNumber = bill.contractNumber || pendingBill.contractNumber;
      pendingBill.meterNumber = bill.meterNumber || pendingBill.meterNumber;
      pendingBill.customerName = bill.customerName || pendingBill.customerName;
      pendingBill.rawAnalysisData = {
        ...pendingBill.rawAnalysisData,
        ...bill.rawAnalysisData,
        mergedAt: new Date().toISOString(),
      };

      const savedPendingBill = await this.billRepository.save(pendingBill);

      // Soft-delete the admin-uploaded bill since data was merged
      await this.billRepository.softRemove(bill);

      return savedPendingBill;
    }

    // Simple association - just set the userId
    bill.userId = userId;
    return this.billRepository.save(bill);
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

    if (bill.status === BillStatus.PENDING_EMAIL) {
      throw new BadRequestException(
        'Cannot retrieve offers for a pending email bill. Upload the document first.',
      );
    }

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

    // Query sent offers for this bill to mark which are already sent
    const sentOffers = await this.sentOfferRepository.find({
      where: { billId: bill.id },
      select: ['offerId', 'createdAt'],
    });
    const sentOfferMap = new Map(
      sentOffers.map((so) => [so.offerId, so.createdAt]),
    );

    return offers.map((offer) => ({
      ...offer,
      estimatedSavings: this.estimateOfferSavings(bill, offer),
      isSent: sentOfferMap.has(offer.id),
      sentAt: sentOfferMap.get(offer.id)?.toISOString() ?? null,
    }));
  }

  async sendOffersToUser(
    billId: string,
    selectedOffers: Array<{ offerId: string; estimatedSavings?: number }>,
  ): Promise<void> {
    const bill = await this.getBillByIdAdmin(billId);

    if (bill.status === BillStatus.PENDING_EMAIL) {
      throw new BadRequestException(
        'Cannot send offers for a pending email bill. Upload the document first.',
      );
    }

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
      contractDurationDays: offer.contractDurationDays,
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
        contractDurationDays: offer.contractDurationDays,
        isGreenEnergy: offer.isGreenEnergy,
        estimatedSavings: this.estimateOfferSavings(bill, offer),
      }));

      const analysisSummary = allOffers.length > 0
        ? `Abbiamo trovato ${allOffers.length} offerte per la tua bolletta ${bill.billType}. La migliore offerta è "${allOffers[0].name}" di ${allOffers[0].supplier?.name || 'fornitore'}, con un risparmio stimato di EUR ${potentialSavings} all'anno.`
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
      const periodsPerYear = this.getBillingPeriodsPerYear(bill);
      const savings = Math.max(0, +((currentCost - bestOfferCost) * periodsPerYear).toFixed(2));

      return {
        potentialSavings: savings,
        currentMonthlyAvg: +currentCost.toFixed(2),
        confidenceScore: 0.9,
      };
    }

    // Fallback: estimate from totalAmount (annualized)
    if (totalAmount > 0 && offers.length > 0) {
      const periodsPerYear = this.getBillingPeriodsPerYear(bill);
      return {
        potentialSavings: +(totalAmount * 0.10 * periodsPerYear).toFixed(2),
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

  private getBillingPeriodsPerYear(bill: EnergyBill): number {
    const start = bill.billingPeriodStart ? new Date(bill.billingPeriodStart) : null;
    const end = bill.billingPeriodEnd ? new Date(bill.billingPeriodEnd) : null;

    if (start && end && end.getTime() > start.getTime()) {
      const periodDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (periodDays > 0) {
        return 365 / periodDays;
      }
    }

    // Default: assume bimonthly billing (common in Italy)
    return 6;
  }

  // ─── Bill Files ──────────────────────────────────────────

  private async createBillFileRecord(
    billId: string,
    fileUrl: string,
    meta?: { originalName?: string; mimeType?: string; fileSize?: number },
  ): Promise<BillFile> {
    const billFile = this.billFileRepository.create({
      billId,
      fileUrl,
      originalName: meta?.originalName || fileUrl.split('/').pop() || null,
      mimeType: meta?.mimeType || null,
      fileSize: meta?.fileSize || null,
    });
    return this.billFileRepository.save(billFile);
  }

  async addFileToBill(
    billId: string,
    fileUrl: string,
    userId: string,
    meta?: { originalName?: string; mimeType?: string; fileSize?: number },
  ): Promise<BillFile> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }
    if (bill.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bill');
    }
    return this.createBillFileRecord(billId, fileUrl, meta);
  }

  async adminAddFileToBill(
    billId: string,
    fileUrl: string,
    meta?: { originalName?: string; mimeType?: string; fileSize?: number },
  ): Promise<BillFile> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }
    return this.createBillFileRecord(billId, fileUrl, meta);
  }

  async getBillFiles(billId: string): Promise<BillFile[]> {
    return this.billFileRepository.find({
      where: { billId },
      order: { createdAt: 'ASC' },
    });
  }

  async getBillFileById(billId: string, fileId: string): Promise<BillFile> {
    const file = await this.billFileRepository.findOne({
      where: { id: fileId, billId },
    });
    if (!file) {
      throw new NotFoundException('File not found');
    }
    return file;
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
      const periodsPerYear = this.getBillingPeriodsPerYear(bill);
      return Math.max(0, +((currentCost - offerCost) * periodsPerYear).toFixed(2));
    }

    return 0;
  }

}
