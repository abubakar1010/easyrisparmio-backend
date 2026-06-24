import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { PaginationDto, PaginatedResponseDto } from '../../common/dto/pagination.dto';

@Injectable()
export class ActivityLogService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepository: Repository<ActivityLog>,
  ) {}

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId?: string,
    metadata?: Record<string, any>,
    ipAddress?: string,
  ): Promise<ActivityLog> {
    const entry = this.activityLogRepository.create({
      userId,
      action,
      entityType,
      entityId: entityId || null,
      metadata: metadata || null,
      ipAddress: ipAddress || null,
    });

    return this.activityLogRepository.save(entry);
  }

  async getActivityLogs(
    query: PaginationDto,
    userId?: string,
    entityType?: string,
  ): Promise<PaginatedResponseDto<ActivityLog>> {
    const qb = this.activityLogRepository
      .createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    if (entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType });
    }

    if (query.search) {
      qb.andWhere('log.action ILIKE :search', {
        search: `%${query.search}%`,
      });
    }

    qb.orderBy('log.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page ?? 1, query.limit ?? 20);
  }
}
