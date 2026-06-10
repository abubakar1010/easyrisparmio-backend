import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { UpdateSupplierStatusDto } from './dto/update-supplier-status.dto';
import { QuerySuppliersDto } from './dto/query-suppliers.dto';
import {
  PaginationDto,
  PaginatedResponseDto,
} from '../../common/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto, adminId: string): Promise<Supplier> {
    const supplier = this.supplierRepository.create({
      ...dto,
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
      .where('supplier.is_active = :isActive', { isActive: true });

    if (query.search) {
      qb.andWhere(
        '(supplier.name ILIKE :search OR supplier.supplier_code ILIKE :search)',
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
    const qb = this.supplierRepository.createQueryBuilder('supplier');

    if (query.isActive !== undefined) {
      qb.andWhere('supplier.is_active = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(supplier.name ILIKE :search OR supplier.contact_email ILIKE :search OR supplier.supplier_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('supplier.created_at', 'DESC')
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

  async softDelete(id: string): Promise<void> {
    const supplier = await this.findById(id);
    await this.supplierRepository.softRemove(supplier);
  }

  async toggleStatus(
    id: string,
    dto: UpdateSupplierStatusDto,
    adminId: string,
  ): Promise<Supplier> {
    const supplier = await this.findById(id);
    supplier.isActive = dto.isActive;
    supplier.updatedBy = adminId;
    return this.supplierRepository.save(supplier);
  }
}
