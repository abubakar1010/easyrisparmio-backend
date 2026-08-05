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
import { BillFile } from './entities/bill-file.entity';
import { BillVerification, VerificationStatus } from './entities/bill-verification.entity';
import { RequestVerificationDto, SubmitVerificationDto } from './dto/request-verification.dto';
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
import { SupplierStatus } from '../../common/enums/supplier.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { TransitionBillStatusDto, SubmitContractVerificationDto } from './dto/transition-bill-status.dto';
import { isValidTransition, getAvailableTransitions } from '../../common/utils/bill-status-transitions';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { ContractStatus } from '../../common/enums/contract.enum';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { readFileSync } from 'fs';
import { join, extname } from 'path';

@Injectable()
export class BillsService {
  private readonly logger = new Logger(BillsService.name);

  constructor(
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(BillFile)
    private readonly billFileRepository: Repository<BillFile>,
    @InjectRepository(BillVerification)
    private readonly verificationRepository: Repository<BillVerification>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(SentOffer)
    private readonly sentOfferRepository: Repository<SentOffer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(CaseEvent)
    private readonly eventRepository: Repository<CaseEvent>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
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
      status: BillStatus.VERIFICATION_REVIEW,
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
        bill.status = BillStatus.VERIFICATION_REVIEW;
        await this.billRepository.save(bill);
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

      bill.status = BillStatus.VERIFICATION_REVIEW;
      await this.billRepository.save(bill);

      this.logger.log(`Background OCR completed for bill ${bill.id}`);
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
      bill.status = BillStatus.VERIFICATION_REVIEW;
      await this.billRepository.save(bill);
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

    if (query.source) {
      qb.andWhere('bill.source = :source', { source: query.source });
    }

    if (query.userId) {
      qb.andWhere('bill.userId = :userId', { userId: query.userId });
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
      relations: ['supplier', 'user', 'switchCases', 'files', 'verifications'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async getBillById(billId: string, userId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'switchCases', 'files', 'verifications'],
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

      savedBill.status = BillStatus.VERIFICATION_REVIEW;
      await this.billRepository.save(savedBill);

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

  // ─── Admin: Offers for Bill ────────────────────────────────

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
      qb.orderBy('COALESCE(offer.spread, offer.price_per_kwh)', 'ASC', 'NULLS LAST');
    } else {
      qb.orderBy('COALESCE(offer.spread, offer.price_per_smc)', 'ASC', 'NULLS LAST');
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

    if (bill.status !== BillStatus.VERIFIED && bill.status !== BillStatus.OFFER_SENT) {
      throw new BadRequestException(
        'Bill must be verified before sending offers.',
      );
    }

    if (!selectedOffers?.length) {
      throw new NotFoundException('No offers selected to send');
    }

    const offerIds = selectedOffers.map((o) => o.offerId);
    const allOffers = await this.offerRepository.find({
      where: { id: In(offerIds) },
      relations: ['supplier'],
    });

    if (allOffers.length === 0) {
      throw new NotFoundException('No valid offers found for the given IDs');
    }

    // Filter out offers from suppliers pending deletion
    const offers = allOffers.filter(
      (o) => o.supplier?.status !== SupplierStatus.PENDING_DELETION,
    );

    if (offers.length === 0) {
      throw new BadRequestException(
        'All selected offers belong to suppliers that are pending deletion',
      );
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
      spread: offer.spread,
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

    try {
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
    } catch (error) {
      this.logger.warn(
        `Failed to send offer notification: ${error?.message || error}`,
      );
    }

    bill.status = BillStatus.OFFER_SENT;
    await this.billRepository.save(bill);
  }

  // ─── Private: Savings Helpers ──────────────────────────────

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

  // ─── Verification ─────────────────────────────────────────

  async requestVerification(
    billId: string,
    dto: RequestVerificationDto,
  ): Promise<BillVerification> {
    const bill = await this.getBillByIdAdmin(billId);

    // Mark any previous pending verifications as resolved
    await this.verificationRepository.update(
      { billId, status: VerificationStatus.PENDING },
      { status: VerificationStatus.RESOLVED, resolvedAt: new Date() },
    );

    const verification = this.verificationRepository.create({
      billId,
      adminMessage: dto.message,
      missingFields: dto.missingFields,
      requireReupload: dto.requireReupload ?? false,
      status: VerificationStatus.PENDING,
    });

    const saved = await this.verificationRepository.save(verification);

    bill.status = BillStatus.VERIFICATION_REQUIRED;
    await this.billRepository.save(bill);

    try {
      await this.notificationsService.sendNotification({
        userId: bill.userId,
        title: 'Verifica richiesta per la tua bolletta',
        body: dto.message,
        type: NotificationType.BILL_VERIFICATION,
        data: {
          billId: bill.id,
          verificationId: saved.id,
          missingFields: dto.missingFields,
          requireReupload: dto.requireReupload ?? false,
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send verification notification: ${error?.message || error}`,
      );
    }

    return saved;
  }

  async getActiveVerification(billId: string): Promise<BillVerification | null> {
    return this.verificationRepository.findOne({
      where: { billId, status: VerificationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });
  }

  async getVerificationHistory(billId: string): Promise<BillVerification[]> {
    return this.verificationRepository.find({
      where: { billId },
      order: { createdAt: 'DESC' },
    });
  }

  async submitVerification(
    billId: string,
    userId: string,
    dto: SubmitVerificationDto,
  ): Promise<EnergyBill> {
    const bill = await this.getBillById(billId, userId);

    const verification = await this.verificationRepository.findOne({
      where: { billId, status: VerificationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    if (!verification) {
      throw new NotFoundException('No pending verification request found');
    }

    // Apply user-submitted field values to the bill
    if (dto.fieldValues) {
      const fieldMap: Record<string, string> = {
        podNumber: 'podNumber',
        pdrNumber: 'pdrNumber',
        totalAmount: 'totalAmount',
        consumptionKwh: 'consumptionKwh',
        consumptionSmc: 'consumptionSmc',
        costPerUnit: 'costPerUnit',
        fixedCharges: 'fixedCharges',
        taxes: 'taxes',
        billingPeriodStart: 'billingPeriodStart',
        billingPeriodEnd: 'billingPeriodEnd',
        supplyAddress: 'supplyAddress',
        codiceFiscale: 'codiceFiscale',
        partitaIva: 'partitaIva',
        contractNumber: 'contractNumber',
        meterNumber: 'meterNumber',
        customerName: 'customerName',
        supplierName: 'supplierName',
      };

      for (const [key, value] of Object.entries(dto.fieldValues)) {
        if (fieldMap[key] && value != null && value !== '') {
          const entityField = fieldMap[key];
          if (['billingPeriodStart', 'billingPeriodEnd'].includes(entityField)) {
            (bill as any)[entityField] = new Date(value);
          } else {
            (bill as any)[entityField] = value;
          }
        }
      }
    }

    verification.status = VerificationStatus.SUBMITTED;
    verification.userMessage = dto.message || null;
    verification.userData = dto.fieldValues || null;
    await this.verificationRepository.save(verification);

    // Re-run OCR if re-upload was required, otherwise just update status
    if (verification.requireReupload) {
      bill.status = BillStatus.ANALYZING;
      await this.billRepository.save(bill);
      this.processOcrInBackground(bill).catch((err) =>
        this.logger.error(`Re-OCR failed for bill ${bill.id}: ${err.message}`),
      );
    } else {
      bill.status = BillStatus.VERIFICATION_REVIEW;
      await this.billRepository.save(bill);
    }

    return this.getBillById(bill.id, userId);
  }

  private estimateOfferSavings(bill: EnergyBill, offer: Offer): number {
    const costPerUnit = Number(bill.costPerUnit) || 0;
    const fixedCharges = Number(bill.fixedCharges) || 0;
    const consumption = bill.billType === BillType.ELECTRICITY
      ? Number(bill.consumptionKwh) || 0
      : Number(bill.consumptionSmc) || 0;

    if (costPerUnit > 0 && consumption > 0) {
      let offerPrice: number;
      if (offer.marketType === MarketType.VARIABLE || offer.marketType === MarketType.INDEXED) {
        offerPrice = Number(offer.spread) || 0;
      } else {
        offerPrice = bill.billType === BillType.ELECTRICITY
          ? Number(offer.pricePerKwh) || 0
          : Number(offer.pricePerSmc) || 0;
      }
      const offerFee = Number(offer.fixedMonthlyFee) || 0;

      const currentCost = (consumption * costPerUnit) + fixedCharges;
      const offerCost = (consumption * offerPrice) + offerFee;
      const periodsPerYear = this.getBillingPeriodsPerYear(bill);
      return Math.max(0, +((currentCost - offerCost) * periodsPerYear).toFixed(2));
    }

    return 0;
  }

  // ─── Status Transitions ───────────────────────────────────

  getAvailableTransitionsForBill(status: BillStatus): BillStatus[] {
    return getAvailableTransitions(status);
  }

  async transitionBillStatus(
    billId: string,
    dto: TransitionBillStatusDto,
    adminId: string,
  ): Promise<EnergyBill> {
    const bill = await this.getBillByIdAdmin(billId);

    if (!isValidTransition(bill.status, dto.targetStatus)) {
      throw new BadRequestException(
        `Cannot transition from "${bill.status}" to "${dto.targetStatus}"`,
      );
    }

    const oldStatus = bill.status;

    // Handle verification_required — create verification record
    if (dto.targetStatus === BillStatus.VERIFICATION_REQUIRED) {
      if (!dto.message) {
        throw new BadRequestException('Message is required when requesting verification');
      }
      await this.requestVerification(billId, {
        message: dto.message,
        missingFields: dto.missingFields || [],
        requireReupload: dto.requireReupload,
      });
      return this.getBillByIdAdmin(billId);
    }

    // Handle contract_verification_required — create verification record for contract
    if (dto.targetStatus === BillStatus.CONTRACT_VERIFICATION_REQUIRED) {
      if (!dto.message) {
        throw new BadRequestException('Message is required when requesting contract verification');
      }

      // Mark any previous pending verifications as resolved
      await this.verificationRepository.update(
        { billId, status: VerificationStatus.PENDING },
        { status: VerificationStatus.RESOLVED, resolvedAt: new Date() },
      );

      // Create a contract verification record
      const verification = this.verificationRepository.create({
        billId,
        adminMessage: dto.message,
        missingFields: dto.missingFields || [],
        requireReupload: dto.requireReupload ?? false,
        status: VerificationStatus.PENDING,
      });
      await this.verificationRepository.save(verification);

      bill.status = BillStatus.CONTRACT_VERIFICATION_REQUIRED;
      await this.billRepository.save(bill);

      // Send notification
      try {
        await this.notificationsService.sendNotification({
          userId: bill.userId,
          title: 'Verifica contratto richiesta',
          body: dto.message,
          type: NotificationType.BILL_VERIFICATION,
          data: { billId: bill.id },
        });
      } catch (error) {
        this.logger.warn(`Failed to send contract verification notification: ${error?.message || error}`);
      }

      return this.getBillByIdAdmin(billId);
    }

    // Handle verified — resolve pending verifications
    if (dto.targetStatus === BillStatus.VERIFIED) {
      await this.verificationRepository.update(
        { billId, status: VerificationStatus.PENDING },
        { status: VerificationStatus.RESOLVED, resolvedAt: new Date() },
      );
    }

    // Update bill status
    bill.status = dto.targetStatus;
    await this.billRepository.save(bill);

    // When bill reaches awaiting_activation or activated, sync the contract
    // to ACTIVE so the utility appears in the user's my-services list
    if (
      dto.targetStatus === BillStatus.AWAITING_ACTIVATION ||
      dto.targetStatus === BillStatus.ACTIVATED
    ) {
      const activeCase = bill.switchCases?.length
        ? bill.switchCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null;

      if (activeCase) {
        const contract = await this.contractRepository.findOne({
          where: { caseId: activeCase.id },
        });
        if (contract && contract.status !== ContractStatus.ACTIVE) {
          contract.status = ContractStatus.ACTIVE;
          if (!contract.activationDate) {
            contract.activationDate = new Date();
          }
          await this.contractRepository.save(contract);
        }
      }
    }

    // Log case event if a case exists
    const activeCase = bill.switchCases?.length
      ? bill.switchCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
      : null;

    if (activeCase) {
      await this.eventRepository.save(
        this.eventRepository.create({
          caseId: activeCase.id,
          eventType: CaseEventType.STATUS_CHANGE,
          title: `Status: ${oldStatus} → ${dto.targetStatus}`,
          description: dto.message || `Bill status transitioned to ${dto.targetStatus}`,
          actorId: adminId,
        }),
      );
    }

    // Send notification for key transitions
    const notificationMap: Partial<Record<BillStatus, { title: string; body: string; type: NotificationType }>> = {
      [BillStatus.VERIFIED]: {
        title: 'Bolletta verificata',
        body: 'I dati della tua bolletta sono stati verificati. A breve riceverai le offerte.',
        type: NotificationType.BILL_ANALYZED,
      },
      [BillStatus.CONTRACT_VERIFIED]: {
        title: 'Contratto approvato',
        body: 'Il tuo contratto è stato verificato e approvato.',
        type: NotificationType.CONTRACT_STATUS,
      },
      [BillStatus.AWAITING_ACTIVATION]: {
        title: 'In attesa di attivazione',
        body: 'La tua utenza è in fase di attivazione. Ti aggiorneremo appena sarà attiva.',
        type: NotificationType.CONTRACT_STATUS,
      },
      [BillStatus.ACTIVATED]: {
        title: 'Utenza Attivata',
        body: 'La tua utenza è stata attivata! Puoi vederla nella sezione Le Mie Utenze.',
        type: NotificationType.CONTRACT_STATUS,
      },
    };

    const notification = notificationMap[dto.targetStatus];
    if (notification) {
      try {
        await this.notificationsService.sendNotification({
          userId: bill.userId,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          data: { billId: bill.id },
        });
      } catch (error) {
        this.logger.warn(`Failed to send transition notification: ${error?.message || error}`);
      }
    }

    return this.getBillByIdAdmin(billId);
  }

  async submitContractVerification(
    billId: string,
    userId: string,
    dto: SubmitContractVerificationDto,
  ): Promise<EnergyBill> {
    const bill = await this.getBillById(billId, userId);

    if (bill.status !== BillStatus.CONTRACT_VERIFICATION_REQUIRED) {
      throw new BadRequestException(
        'Bill must be in contract_verification_required status',
      );
    }

    const verification = await this.verificationRepository.findOne({
      where: { billId, status: VerificationStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    if (verification) {
      verification.status = VerificationStatus.SUBMITTED;
      verification.userMessage = dto.message || null;
      await this.verificationRepository.save(verification);
    }

    // Update signed document if provided
    if (dto.signedDocumentUrl) {
      const activeCase = bill.switchCases?.length
        ? bill.switchCases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
        : null;

      if (activeCase) {
        const contract = await this.contractRepository.findOne({
          where: { caseId: activeCase.id },
        });
        if (contract) {
          contract.signedDocumentUrl = dto.signedDocumentUrl;
          await this.contractRepository.save(contract);
        }
      }
    }

    bill.status = BillStatus.CONTRACT_REVIEW;
    await this.billRepository.save(bill);

    return this.getBillById(bill.id, userId);
  }
}
