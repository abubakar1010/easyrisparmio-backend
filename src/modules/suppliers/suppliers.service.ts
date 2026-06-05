import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './entities/supplier.entity';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(Supplier)
    private readonly supplierRepository: Repository<Supplier>,
  ) {}

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const supplier = this.supplierRepository.create(dto);
    return this.supplierRepository.save(supplier);
  }

  async findAll(query: PaginationDto): Promise<PaginatedResponseDto<Supplier>> {
    const qb = this.supplierRepository
      .createQueryBuilder('supplier')
      .where('supplier.is_active = :isActive', { isActive: true });

    if (query.search) {
      qb.andWhere('LOWER(supplier.name) LIKE LOWER(:search)', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('supplier.name', 'ASC')
      .skip(query.skip)
      .take(query.limit);

    const [suppliers, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(suppliers, total, query.page, query.limit);
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

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const supplier = await this.findById(id);
    Object.assign(supplier, dto);
    return this.supplierRepository.save(supplier);
  }

  async softDelete(id: string): Promise<Supplier> {
    const supplier = await this.findById(id);
    supplier.isActive = false;
    return this.supplierRepository.save(supplier);
  }
}
