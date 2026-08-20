import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agreement } from './entities/agreement.entity';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { UpdateAgreementStatusDto } from './dto/update-agreement-status.dto';
import { QueryAgreementsDto } from './dto/query-agreements.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { UserTarget } from '../../common/enums/offer.enum';
import { UserRole } from '../../common/enums/role.enum';

@Injectable()
export class AgreementsService {
  constructor(
    @InjectRepository(Agreement)
    private readonly agreementRepository: Repository<Agreement>,
  ) {}

  /**
   * An agreement whose validity window is inverted would pass every filter in
   * `findAllForUser` and simply never appear, so reject it at the edge instead
   * of letting the admin save a record that silently does nothing.
   */
  private assertValidDateRange(
    validFrom?: string | Date | null,
    validUntil?: string | Date | null,
  ): void {
    if (!validFrom || !validUntil) return;

    if (new Date(validUntil) < new Date(validFrom)) {
      throw new BadRequestException(
        'validUntil must be the same as or later than validFrom',
      );
    }
  }

  async create(
    dto: CreateAgreementDto,
    adminId: string,
  ): Promise<Agreement> {
    this.assertValidDateRange(dto.validFrom, dto.validUntil);

    const agreement = this.agreementRepository.create({
      ...dto,
      createdBy: adminId,
      updatedBy: adminId,
    });
    return this.agreementRepository.save(agreement);
  }

  async findAllForUser(
    userRole: UserRole,
  ): Promise<Agreement[]> {
    const targetAudience =
      userRole === UserRole.BUSINESS
        ? UserTarget.BUSINESS
        : UserTarget.PERSONAL;

    const qb = this.agreementRepository
      .createQueryBuilder('agreement')
      .where('agreement.isActive = :isActive', { isActive: true })
      .andWhere(
        '(agreement.targetAudience = :target OR agreement.targetAudience = :both)',
        { target: targetAudience, both: UserTarget.BOTH },
      )
      .andWhere('agreement.validFrom <= CURRENT_DATE')
      .andWhere(
        '(agreement.validUntil IS NULL OR agreement.validUntil >= CURRENT_DATE)',
      )
      .orderBy('agreement.sortOrder', 'ASC')
      .addOrderBy('agreement.createdAt', 'DESC');

    return qb.getMany();
  }

  async findByIdForUser(
    id: string,
    userRole: UserRole,
  ): Promise<Agreement> {
    const targetAudience =
      userRole === UserRole.BUSINESS
        ? UserTarget.BUSINESS
        : UserTarget.PERSONAL;

    const agreement = await this.agreementRepository
      .createQueryBuilder('agreement')
      .where('agreement.id = :id', { id })
      .andWhere('agreement.isActive = :isActive', { isActive: true })
      .andWhere(
        '(agreement.targetAudience = :target OR agreement.targetAudience = :both)',
        { target: targetAudience, both: UserTarget.BOTH },
      )
      .andWhere('agreement.validFrom <= CURRENT_DATE')
      .andWhere(
        '(agreement.validUntil IS NULL OR agreement.validUntil >= CURRENT_DATE)',
      )
      .getOne();

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return agreement;
  }

  async findAllAdmin(
    query: QueryAgreementsDto,
  ): Promise<PaginatedResponseDto<Agreement>> {
    const qb = this.agreementRepository.createQueryBuilder('agreement');

    if (query.isActive !== undefined) {
      qb.andWhere('agreement.isActive = :isActive', {
        isActive: query.isActive,
      });
    }

    if (query.targetAudience) {
      qb.andWhere('agreement.targetAudience = :targetAudience', {
        targetAudience: query.targetAudience,
      });
    }

    if (query.search) {
      qb.andWhere(
        '(agreement.title ILIKE :search OR agreement.partnerName ILIKE :search OR agreement.description ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('agreement.sortOrder', 'ASC')
      .addOrderBy('agreement.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async findById(id: string): Promise<Agreement> {
    const agreement = await this.agreementRepository.findOne({
      where: { id },
    });

    if (!agreement) {
      throw new NotFoundException('Agreement not found');
    }

    return agreement;
  }

  async update(
    id: string,
    dto: UpdateAgreementDto,
    adminId: string,
  ): Promise<Agreement> {
    const agreement = await this.findById(id);

    // A PATCH may move either end of the window, so validate the merged result
    // rather than whatever the payload happens to carry.
    this.assertValidDateRange(
      dto.validFrom ?? agreement.validFrom,
      dto.validUntil !== undefined ? dto.validUntil : agreement.validUntil,
    );

    Object.assign(agreement, dto);
    agreement.updatedBy = adminId;
    return this.agreementRepository.save(agreement);
  }

  async softDelete(id: string): Promise<void> {
    const agreement = await this.findById(id);
    await this.agreementRepository.softRemove(agreement);
  }

  async toggleStatus(
    id: string,
    dto: UpdateAgreementStatusDto,
    adminId: string,
  ): Promise<Agreement> {
    const agreement = await this.findById(id);
    agreement.isActive = dto.isActive;
    agreement.updatedBy = adminId;
    return this.agreementRepository.save(agreement);
  }
}
