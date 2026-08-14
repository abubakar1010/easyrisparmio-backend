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
import { BillNote } from './entities/bill-note.entity';
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
import {
  getAvailableTransitions,
  getTransitionDirection,
  BILL_STATUS_LABELS,
  type TransitionDirection,
} from '../../common/utils/bill-status-transitions';
import { BILL_STATUS_NOTIFICATIONS } from '../notifications/notification-messages';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { CaseEventType } from '../../common/enums/case-event.enum';
import { CaseStatus } from '../../common/enums/case.enum';
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
    @InjectRepository(BillNote)
    private readonly billNoteRepository: Repository<BillNote>,
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
  private async processOcrInBackground(
    bill: EnergyBill,
    options?: { fileIds?: string[]; clearFirst?: boolean },
  ): Promise<void> {
    try {
      bill.status = BillStatus.ANALYZING;
      await this.billRepository.save(bill);

      // When re-uploading, clear all previously extracted data first
      if (options?.clearFirst) {
        this.clearExtractedData(bill);
        await this.billRepository.save(bill);
      }

      // Collect images from bill files — filter to specific files if provided
      const fileWhere: any = { billId: bill.id };
      if (options?.fileIds?.length) {
        fileWhere.id = In(options.fileIds);
      }
      const billFiles = await this.billFileRepository.find({
        where: fileWhere,
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

      // Populate bill fields from extraction
      if (options?.clearFirst) {
        // Re-upload: new document is the sole source of truth — assign unconditionally
        bill.podNumber = result.podNumber ?? null;
        bill.pdrNumber = result.pdrNumber ?? null;
        bill.totalAmount = result.totalAmount ?? null;
        bill.consumptionKwh = result.consumptionKwh ?? null;
        bill.consumptionSmc = result.consumptionSmc ?? null;
        bill.costPerUnit = result.costPerUnit ?? null;
        bill.fixedCharges = result.fixedCharges ?? null;
        bill.taxes = result.taxes ?? null;
        bill.billingPeriodStart = result.billingPeriodStart
          ? new Date(result.billingPeriodStart) : null;
        bill.billingPeriodEnd = result.billingPeriodEnd
          ? new Date(result.billingPeriodEnd) : null;
        bill.supplyAddress = result.supplyAddress ?? null;
        bill.codiceFiscale = result.codiceFiscale ?? null;
        bill.partitaIva = result.partitaIva ?? null;
        bill.contractNumber = result.contractNumber ?? null;
        bill.meterNumber = result.meterNumber ?? null;
        bill.customerName = result.customerName ?? null;
        bill.supplierName = result.supplierName ?? null;
      } else {
        // First upload: preserve existing data, only overwrite non-null results
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
      }

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

  /**
   * Resets all OCR-extractable fields to null so a re-upload starts fresh.
   */
  private clearExtractedData(bill: EnergyBill): void {
    bill.podNumber = null;
    bill.pdrNumber = null;
    bill.totalAmount = null;
    bill.consumptionKwh = null;
    bill.consumptionSmc = null;
    bill.costPerUnit = null;
    bill.fixedCharges = null;
    bill.taxes = null;
    bill.billingPeriodStart = null;
    bill.billingPeriodEnd = null;
    bill.supplyAddress = null;
    bill.codiceFiscale = null;
    bill.partitaIva = null;
    bill.contractNumber = null;
    bill.meterNumber = null;
    bill.customerName = null;
    bill.supplierName = null;
    bill.rawAnalysisData = null;
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
      relations: ['supplier', 'user', 'switchCases', 'files', 'verifications', 'verifications.files'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  // ─── Admin Update Bill ────────────────────────────────────

  private static readonly FIELD_LABELS_IT: Record<string, string> = {
    billType: 'Tipo bolletta',
    podNumber: 'Numero POD',
    pdrNumber: 'Numero PDR',
    totalAmount: 'Importo totale',
    consumptionKwh: 'Consumo (kWh)',
    consumptionSmc: 'Consumo (Smc)',
    costPerUnit: 'Costo unitario',
    fixedCharges: 'Costi fissi',
    taxes: 'Imposte',
    billingPeriodStart: 'Inizio periodo',
    billingPeriodEnd: 'Fine periodo',
    supplyAddress: 'Indirizzo fornitura',
    codiceFiscale: 'Codice Fiscale',
    partitaIva: 'Partita IVA',
    contractNumber: 'Numero contratto',
    meterNumber: 'Numero contatore',
    customerName: 'Nome cliente',
    supplierName: 'Fornitore',
    supplierId: 'Fornitore',
  };

  async adminUpdateBill(
    billId: string,
    dto: Record<string, any>,
    adminId: string,
  ): Promise<{ bill: EnergyBill; changes: Record<string, { old: any; new: any }> }> {
    const bill = await this.getBillByIdAdmin(billId);

    const dateFields = ['billingPeriodStart', 'billingPeriodEnd'];
    const decimalFields = [
      'totalAmount', 'consumptionKwh', 'consumptionSmc',
      'costPerUnit', 'fixedCharges', 'taxes',
    ];

    const changes: Record<string, { old: any; new: any }> = {};

    for (const key of Object.keys(dto)) {
      if (dto[key] === undefined) continue;

      const oldVal = (bill as any)[key];
      let newVal = dto[key];

      if (dateFields.includes(key)) {
        const oldNorm = oldVal ? new Date(oldVal).toISOString().split('T')[0] : null;
        const newNorm = newVal ? new Date(newVal).toISOString().split('T')[0] : null;
        if (oldNorm === newNorm) continue;
        changes[key] = { old: oldNorm, new: newNorm };
        (bill as any)[key] = newVal ? new Date(newVal) : null;
      } else if (decimalFields.includes(key)) {
        const oldNum = oldVal != null ? Number(oldVal) : null;
        const newNum = newVal != null ? Number(newVal) : null;
        if (oldNum === newNum) continue;
        changes[key] = { old: oldNum, new: newNum };
        (bill as any)[key] = newVal;
      } else {
        const oldStr = oldVal ?? null;
        const newStr = newVal ?? null;
        if (oldStr === newStr) continue;
        changes[key] = { old: oldStr, new: newStr };
        (bill as any)[key] = newVal;
      }
    }

    if (Object.keys(changes).length === 0) {
      return { bill, changes };
    }

    // Validate supplier if changed
    if (changes.supplierId && dto.supplierId) {
      const supplier = await this.supplierRepository.findOne({ where: { id: dto.supplierId } });
      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }
    }

    await this.billRepository.save(bill);

    // Send push notification to bill owner
    try {
      await this.notificationsService.sendNotification({
        userId: bill.userId,
        messageKey: 'bill_updated',
        bodyParams: [Object.keys(changes)],
        type: NotificationType.BILL_UPDATED,
        data: {
          billId: bill.id,
          changedFields: Object.keys(changes),
        },
      });
    } catch (error) {
      this.logger.warn(`Failed to send bill update notification: ${error?.message || error}`);
    }

    const updated = await this.getBillByIdAdmin(billId);
    return { bill: updated, changes };
  }

  async getBillById(billId: string, userId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'switchCases', 'files', 'verifications', 'verifications.files'],
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
        messageKey: 'offers_recommended',
        bodyParams: [offerSnapshots.length, bestSavings.toFixed(2)],
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
    meta?: { originalName?: string; mimeType?: string; fileSize?: number; verificationId?: string },
  ): Promise<BillFile> {
    const billFile = this.billFileRepository.create({
      billId,
      fileUrl,
      originalName: meta?.originalName || fileUrl.split('/').pop() || null,
      mimeType: meta?.mimeType || null,
      fileSize: meta?.fileSize || null,
      verificationId: meta?.verificationId || null,
    });
    return this.billFileRepository.save(billFile);
  }

  async addFileToBill(
    billId: string,
    fileUrl: string,
    userId: string,
    meta?: { originalName?: string; mimeType?: string; fileSize?: number; verificationId?: string },
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
    meta?: { originalName?: string; mimeType?: string; fileSize?: number; verificationId?: string },
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
      status: VerificationStatus.PENDING,
    });

    const saved = await this.verificationRepository.save(verification);

    await this.billRepository.update(billId, {
      status: BillStatus.VERIFICATION_REQUIRED,
    });

    try {
      await this.notificationsService.sendNotification({
        userId: bill.userId,
        messageKey: 'bill_verification_required',
        body: dto.message,
        type: NotificationType.BILL_VERIFICATION,
        data: {
          billId: bill.id,
          verificationId: saved.id,
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
      relations: ['files'],
      order: { createdAt: 'DESC' },
    });
  }

  async getVerificationHistory(billId: string): Promise<BillVerification[]> {
    return this.verificationRepository.find({
      where: { billId },
      relations: ['files'],
      order: { createdAt: 'ASC' },
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

    verification.status = VerificationStatus.SUBMITTED;
    verification.userMessage = dto.message || null;
    await this.verificationRepository.save(verification);

    // Link uploaded files to this verification record
    if (dto.fileIds?.length) {
      await this.billFileRepository.update(
        { id: In(dto.fileIds), billId },
        { verificationId: verification.id },
      );
    }

    // The uploaded documents are never re-analysed and never overwrite the bill
    // data. The admin reviews the files and updates the bill fields manually.
    bill.status = BillStatus.VERIFICATION_REVIEW;
    await this.billRepository.save(bill);

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

  /**
   * Sets a bill/case to any status the admin picks from the status dropdown.
   *
   * The admin is deliberately NOT restricted to the pipeline order — a case can
   * be moved forward, backward or sideways. Whatever the direction, this always:
   *   1. updates the bill status (drives the progress bar and the app),
   *   2. keeps the linked case + contract in sync,
   *   3. writes a case timeline entry,
   *   4. sends a push notification to the customer.
   */
  async transitionBillStatus(
    billId: string,
    dto: TransitionBillStatusDto,
    adminId: string,
  ): Promise<EnergyBill> {
    const bill = await this.getBillByIdAdmin(billId);
    const oldStatus = bill.status;
    const targetStatus = dto.targetStatus;

    if (oldStatus === targetStatus) {
      throw new BadRequestException(
        `Bill is already in status "${BILL_STATUS_LABELS[targetStatus] || targetStatus}"`,
      );
    }

    // These two statuses carry an admin-written message to the customer,
    // so they cannot be set without one.
    const isVerificationRequest =
      targetStatus === BillStatus.VERIFICATION_REQUIRED ||
      targetStatus === BillStatus.CONTRACT_VERIFICATION_REQUIRED;

    if (isVerificationRequest && !dto.message) {
      throw new BadRequestException(
        `Message is required when moving the case to "${BILL_STATUS_LABELS[targetStatus]}"`,
      );
    }

    const direction = getTransitionDirection(oldStatus, targetStatus);

    // The verification branches send their own push (it carries the admin's
    // message as the body), so they opt out of the shared notification below.
    let notificationHandled = false;

    if (targetStatus === BillStatus.VERIFICATION_REQUIRED) {
      await this.requestVerification(billId, { message: dto.message! });
      notificationHandled = true;
    } else if (targetStatus === BillStatus.CONTRACT_VERIFICATION_REQUIRED) {
      // Mark any previous pending verifications as resolved
      await this.verificationRepository.update(
        { billId, status: VerificationStatus.PENDING },
        { status: VerificationStatus.RESOLVED, resolvedAt: new Date() },
      );

      // Create a contract verification record
      const verification = this.verificationRepository.create({
        billId,
        adminMessage: dto.message!,
        status: VerificationStatus.PENDING,
      });
      await this.verificationRepository.save(verification);

      await this.billRepository.update(billId, { status: targetStatus });

      try {
        await this.notificationsService.sendNotification({
          userId: bill.userId,
          messageKey: 'contract_verification_required',
          body: dto.message,
          type: NotificationType.CONTRACT_VERIFICATION,
          data: { billId: bill.id, oldStatus, newStatus: targetStatus },
        });
      } catch (error) {
        this.logger.warn(`Failed to send contract verification notification: ${error?.message || error}`);
      }
      notificationHandled = true;
    } else {
      // Moving anywhere other than a "waiting on the customer" status means we
      // are no longer waiting — close out any request still open.
      await this.verificationRepository.update(
        { billId, status: VerificationStatus.PENDING },
        { status: VerificationStatus.RESOLVED, resolvedAt: new Date() },
      );

      bill.status = targetStatus;
      await this.billRepository.save(bill);
    }

    const activeCase = bill.switchCases?.length
      ? bill.switchCases.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        )[0]
      : null;

    if (activeCase) {
      await this.syncContractWithBillStatus(activeCase.id, targetStatus);
      await this.logStatusChangeOnCase(activeCase, oldStatus, targetStatus, direction, adminId, dto.message);
    }

    // The customer is always notified of a status change — including when the
    // case is moved back to a previous status.
    if (!notificationHandled) {
      const notification = BILL_STATUS_NOTIFICATIONS[targetStatus];
      if (notification) {
        try {
          await this.notificationsService.sendNotification({
            userId: bill.userId,
            messageKey: notification.messageKey,
            type: notification.type,
            data: {
              billId: bill.id,
              caseId: activeCase?.id,
              oldStatus,
              newStatus: targetStatus,
            },
          });
        } catch (error) {
          this.logger.warn(`Failed to send transition notification: ${error?.message || error}`);
        }
      }
    }

    return this.getBillByIdAdmin(billId);
  }

  /**
   * Keeps the utility contract aligned with the pipeline status in both
   * directions, so the customer's "My Utilities" list never shows a utility as
   * active after the case has been moved back before activation.
   */
  private async syncContractWithBillStatus(
    caseId: string,
    status: BillStatus,
  ): Promise<void> {
    const contract = await this.contractRepository.findOne({ where: { caseId } });
    if (!contract) return;

    const shouldBeActive =
      status === BillStatus.AWAITING_ACTIVATION || status === BillStatus.ACTIVATED;

    if (shouldBeActive && contract.status !== ContractStatus.ACTIVE) {
      contract.status = ContractStatus.ACTIVE;
      if (!contract.activationDate) {
        contract.activationDate = new Date();
      }
      await this.contractRepository.save(contract);
    } else if (!shouldBeActive && contract.status === ContractStatus.ACTIVE) {
      contract.status = ContractStatus.SIGNED;
      await this.contractRepository.save(contract);
    }
  }

  /**
   * Mirrors the pipeline status onto the linked case and appends the change to
   * the case timeline.
   */
  private async logStatusChangeOnCase(
    activeCase: SwitchCase,
    oldStatus: BillStatus,
    newStatus: BillStatus,
    direction: TransitionDirection,
    adminId: string,
    message?: string,
  ): Promise<void> {
    const oldCaseStatus = activeCase.status;
    const newCaseStatus = BillsService.CASE_STATUS_BY_BILL_STATUS[newStatus];

    if (newCaseStatus && newCaseStatus !== oldCaseStatus) {
      await this.caseRepository.update(activeCase.id, { status: newCaseStatus });
    }

    const verb =
      direction === 'backward'
        ? 'Status moved back'
        : direction === 'forward'
          ? 'Status advanced'
          : 'Status changed';

    const oldLabel = BILL_STATUS_LABELS[oldStatus] || oldStatus;
    const newLabel = BILL_STATUS_LABELS[newStatus] || newStatus;

    await this.eventRepository.save(
      this.eventRepository.create({
        caseId: activeCase.id,
        eventType: CaseEventType.STATUS_CHANGE,
        title: `${verb}: ${oldLabel} → ${newLabel}`,
        description: message || `Case status set to ${newLabel} by an administrator.`,
        actorId: adminId,
        actorLabel: 'Admin',
        oldStatus: oldCaseStatus ?? null,
        newStatus: newCaseStatus ?? oldCaseStatus ?? null,
        metadata: {
          billOldStatus: oldStatus,
          billNewStatus: newStatus,
          direction,
        },
      }),
    );
  }

  /** Maps a pipeline (bill) status onto the coarser case status. */
  private static readonly CASE_STATUS_BY_BILL_STATUS: Partial<
    Record<BillStatus, CaseStatus>
  > = {
    [BillStatus.PENDING_EMAIL]: CaseStatus.NEW,
    [BillStatus.UPLOADED]: CaseStatus.NEW,
    [BillStatus.ANALYZING]: CaseStatus.NEW,
    [BillStatus.ANALYZED]: CaseStatus.NEW,
    [BillStatus.VERIFICATION_REVIEW]: CaseStatus.IN_PROGRESS,
    [BillStatus.VERIFICATION_REQUIRED]: CaseStatus.DOCUMENTS_PENDING,
    [BillStatus.VERIFIED]: CaseStatus.IN_PROGRESS,
    [BillStatus.OFFER_SENT]: CaseStatus.IN_PROGRESS,
    [BillStatus.OFFER_ACCEPTED]: CaseStatus.IN_PROGRESS,
    [BillStatus.CONTRACT_SENT]: CaseStatus.CONTRACT_SENT,
    [BillStatus.CONTRACT_SIGNED]: CaseStatus.CONTRACT_SIGNED,
    [BillStatus.CONTRACT_REVIEW]: CaseStatus.CONTRACT_SIGNED,
    [BillStatus.CONTRACT_VERIFICATION_REQUIRED]: CaseStatus.CONTRACT_SENT,
    [BillStatus.CONTRACT_VERIFIED]: CaseStatus.CONTRACT_SIGNED,
    [BillStatus.AWAITING_ACTIVATION]: CaseStatus.CONTRACT_SIGNED,
    [BillStatus.ACTIVATED]: CaseStatus.ACTIVATED,
    [BillStatus.CANCELLED]: CaseStatus.CANCELLED,
  };

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

      // Link uploaded files to this verification record
      if (dto.fileIds?.length) {
        await this.billFileRepository.update(
          { id: In(dto.fileIds), billId },
          { verificationId: verification.id },
        );
      }
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

  async getBillNotes(billId: string): Promise<BillNote[]> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return this.billNoteRepository.find({
      where: { billId },
      relations: ['createdBy'],
      order: { createdAt: 'DESC' },
    });
  }

  async addBillNote(
    billId: string,
    content: string,
    createdById: string,
  ): Promise<BillNote> {
    const bill = await this.billRepository.findOne({ where: { id: billId } });
    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    const note = this.billNoteRepository.create({
      billId,
      content,
      createdById,
    });

    const saved = await this.billNoteRepository.save(note);

    return this.billNoteRepository.findOneOrFail({
      where: { id: saved.id },
      relations: ['createdBy'],
    });
  }

  async updateBillNote(
    billId: string,
    noteId: string,
    content: string,
  ): Promise<BillNote> {
    const note = await this.billNoteRepository.findOne({
      where: { id: noteId, billId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    note.content = content;
    await this.billNoteRepository.save(note);

    return this.billNoteRepository.findOneOrFail({
      where: { id: noteId },
      relations: ['createdBy'],
    });
  }

  async deleteBillNote(
    billId: string,
    noteId: string,
  ): Promise<void> {
    const note = await this.billNoteRepository.findOne({
      where: { id: noteId, billId },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.billNoteRepository.remove(note);
  }
}
