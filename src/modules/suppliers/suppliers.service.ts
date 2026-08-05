import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Supplier } from './entities/supplier.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';
import { SupplierStatus } from '../../common/enums/supplier.enum';
import { ContractStatus } from '../../common/enums/contract.enum';
import { CaseStatus } from '../../common/enums/case.enum';

@Injectable()
export class SuppliersService {
  private readonly logger = new Logger(SuppliersService.name);

  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
    @InjectRepository(Offer)
    private readonly offerRepository: Repository<Offer>,
    @InjectRepository(Contract)
    private readonly contractRepository: Repository<Contract>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
  ) {}

  async create(dto: CreateSupplierDto, adminId: string): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      ...dto,
      country: 'Italy',
      createdBy: adminId,
      updatedBy: adminId,
    });
    try {
      return await this.supplierRepository.save(supplier);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A supplier with this supplier code already exists',
        );
      }
      throw error;
    }
  }

  async findAllPublic(
    query: PaginationDto,
  ): Promise<PaginatedResponseDto<Supplier>> {
    const qb = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.isActive = :isActive', { isActive: true });

    if (query.search) {
      qb.andWhere(
        '(supplier.name ILIKE :search OR supplier.supplierCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('supplier.name', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findAllAdmin(
    query: QuerySuppliersDto,
  ): Promise<PaginatedResponseDto<Supplier>> {
    const qb = this.supplierRepository
      .createQueryBuilder('supplier')
      .leftJoinAndSelect('supplier.offers', 'offers');

    if (query.isActive !== undefined) {
      qb.andWhere('supplier.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.status) {
      qb.andWhere('supplier.status = :status', { status: query.status });
    }

    if (query.commodity) {
      qb.andWhere('supplier.commodity = :commodity', {
        commodity: query.commodity,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(supplier.name ILIKE :search OR supplier.legalName ILIKE :search OR supplier.contactEmail ILIKE :search OR supplier.supplierCode ILIKE :search OR supplier.taxId ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('supplier.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.supplierRepository.findOne({
      where: { id },
      relations: ['offers'],
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found');
    }

    return supplier;
  }

  async update(
    id: string,
    dto: UpdateSupplierDto,
    adminId: string,
  ): Promise<Supplier> {
    const supplier = await this.findById(id);

    if (supplier.status === SupplierStatus.PENDING_DELETION) {
      throw new BadRequestException(
        'Cannot modify a supplier pending deletion. Cancel the deletion first.',
      );
    }

    Object.assign(supplier, dto);
    supplier.updatedBy = adminId;
    try {
      return await this.supplierRepository.save(supplier);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          'A supplier with this supplier code already exists',
        );
      }
      throw error;
    }
  }

  async toggleStatus(
    id: string,
    dto: UpdateSupplierStatusDto,
    adminId: string,
  ): Promise<Supplier> {
    const supplier = await this.findById(id);

    if (supplier.status === SupplierStatus.PENDING_DELETION) {
      throw new BadRequestException(
        'Cannot modify a supplier pending deletion. Cancel the deletion first.',
      );
    }

    supplier.isActive = dto.isActive;
    supplier.updatedBy = adminId;
    return this.supplierRepository.save(supplier);
  }

  // ─── Deletion Logic ───────────────────────────────────────

  async deleteSupplier(
    id: string,
    adminId: string,
  ): Promise<{
    message: string;
    scheduledDeletionDate?: string;
    cancelledCases?: number;
  }> {
    const supplier = await this.findById(id);

    // Idempotent: already pending deletion
    if (supplier.status === SupplierStatus.PENDING_DELETION) {
      return {
        message: 'Supplier deletion is already scheduled',
        scheduledDeletionDate: supplier.scheduledDeletionDate
          ? supplier.scheduledDeletionDate.toString()
          : undefined,
      };
    }

    // Check for active contracts linked to this supplier's offers
    const activeContracts = await this.getActiveContractsForSupplier(id);

    if (activeContracts.length === 0) {
      // No active contracts — delete immediately
      await this.executeSupplierDeletion(supplier);
      return { message: 'Supplier deleted successfully' };
    }

    // Check for contracts with no expiry date
    const noExpiryContracts = activeContracts.filter((c) => !c.expiryDate);
    if (noExpiryContracts.length > 0) {
      const contractNumbers = noExpiryContracts
        .map((c) => c.contractNumber)
        .join(', ');
      throw new BadRequestException(
        `Cannot schedule deletion: the following active contracts have no expiry date set: ${contractNumbers}. Please set expiry dates on these contracts first.`,
      );
    }

    // Schedule deletion for when the last contract expires
    const latestExpiry = activeContracts.reduce((latest, c) => {
      const expiry = new Date(c.expiryDate);
      return expiry > latest ? expiry : latest;
    }, new Date(0));

    supplier.status = SupplierStatus.PENDING_DELETION;
    supplier.isActive = false;
    supplier.scheduledDeletionDate = latestExpiry;
    supplier.updatedBy = adminId;
    await this.supplierRepository.save(supplier);

    // Cancel early-stage cases for this supplier
    const cancelledCases = await this.cancelEarlyStageCases(id);

    const scheduledDateStr = latestExpiry.toISOString().split('T')[0];
    this.logger.log(
      `Supplier "${supplier.name}" (${id}) deletion scheduled for ${scheduledDateStr}`,
    );

    return {
      message: `Supplier deletion scheduled for ${scheduledDateStr}`,
      scheduledDeletionDate: scheduledDateStr,
      cancelledCases,
    };
  }

  async getDeletionStatus(id: string): Promise<{
    status: SupplierStatus;
    scheduledDeletionDate: string | null;
    activeContractsCount: number;
  }> {
    const supplier = await this.findById(id);
    const activeContracts = await this.getActiveContractsForSupplier(id);

    return {
      status: supplier.status,
      scheduledDeletionDate: supplier.scheduledDeletionDate
        ? supplier.scheduledDeletionDate.toString()
        : null,
      activeContractsCount: activeContracts.length,
    };
  }

  async cancelScheduledDeletion(
    id: string,
    adminId: string,
  ): Promise<{ message: string }> {
    const supplier = await this.findById(id);

    if (supplier.status !== SupplierStatus.PENDING_DELETION) {
      throw new BadRequestException(
        'Supplier is not pending deletion',
      );
    }

    supplier.status = SupplierStatus.INACTIVE;
    supplier.scheduledDeletionDate = null;
    supplier.updatedBy = adminId;
    await this.supplierRepository.save(supplier);

    this.logger.log(
      `Scheduled deletion cancelled for supplier "${supplier.name}" (${id})`,
    );

    return { message: 'Supplier deletion cancelled. Status set to inactive.' };
  }

  // ─── Cron: Execute Scheduled Deletions ────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async executeScheduledDeletions(): Promise<void> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const pendingSuppliers = await this.supplierRepository.find({
        where: {
          status: SupplierStatus.PENDING_DELETION,
          scheduledDeletionDate: LessThanOrEqual(today),
        },
      });

      for (const supplier of pendingSuppliers) {
        // Safety net: re-check no active contracts remain
        const activeContracts =
          await this.getActiveContractsForSupplier(supplier.id);

        if (activeContracts.length > 0) {
          // Recalculate scheduled date
          const contractsWithExpiry = activeContracts.filter(
            (c) => c.expiryDate,
          );
          if (contractsWithExpiry.length > 0) {
            const newLatest = contractsWithExpiry.reduce((latest, c) => {
              const expiry = new Date(c.expiryDate);
              return expiry > latest ? expiry : latest;
            }, new Date(0));
            supplier.scheduledDeletionDate = newLatest;
            await this.supplierRepository.save(supplier);
            this.logger.warn(
              `Supplier "${supplier.name}" (${supplier.id}) still has active contracts. Rescheduled to ${newLatest.toISOString().split('T')[0]}`,
            );
          }
          continue;
        }

        await this.executeSupplierDeletion(supplier);
        this.logger.log(
          `Scheduled deletion executed for supplier: "${supplier.name}" (${supplier.id})`,
        );
      }
    } catch (error: any) {
      this.logger.error(
        `Failed to execute scheduled deletions: ${error?.message}`,
        error?.stack,
      );
    }
  }

  // ─── Private Helpers ──────────────────────────────────────

  private async getActiveContractsForSupplier(
    supplierId: string,
  ): Promise<Contract[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.contractRepository
      .createQueryBuilder('contract')
      .innerJoin('contract.offer', 'offer')
      .where('offer.supplierId = :supplierId', { supplierId })
      .andWhere('contract.status = :status', {
        status: ContractStatus.ACTIVE,
      })
      .andWhere('contract.deletedAt IS NULL')
      .andWhere(
        '(contract.expiryDate IS NULL OR contract.expiryDate > :today)',
        { today },
      )
      .getMany();
  }

  private async cancelEarlyStageCases(supplierId: string): Promise<number> {
    const earlyStatuses = [
      CaseStatus.NEW,
      CaseStatus.IN_PROGRESS,
      CaseStatus.DOCUMENTS_PENDING,
    ];

    const result = await this.caseRepository
      .createQueryBuilder()
      .update(SwitchCase)
      .set({ status: CaseStatus.CANCELLED })
      .where('to_supplier_id = :supplierId', { supplierId })
      .andWhere('status IN (:...statuses)', { statuses: earlyStatuses })
      .andWhere('deleted_at IS NULL')
      .execute();

    return result.affected || 0;
  }

  private async executeSupplierDeletion(supplier: Supplier): Promise<void> {
    // Soft-delete all offers for this supplier
    const offers = await this.offerRepository.find({
      where: { supplierId: supplier.id },
    });
    if (offers.length > 0) {
      await this.offerRepository.softRemove(offers);
    }

    // Soft-delete the supplier
    await this.supplierRepository.softRemove(supplier);
  }
}
