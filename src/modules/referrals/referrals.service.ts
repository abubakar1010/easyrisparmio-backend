import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Referral } from './entities/referral.entity';
import { CreateReferralDto } from './dto/create-referral.dto';
import { QueryReferralsDto } from './dto/query-referrals.dto';
import { QueryMyReferralsDto } from './dto/query-my-referrals.dto';
import { UpdateReferralStatusDto } from './dto/update-referral-status.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { ReferralStatus } from '../../common/enums/referral.enum';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../../common/enums/notification.enum';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  // ─── User Methods ─────────────────────────────────────────

  async getOrGenerateMyCode(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let referralCode = user.referralCode;

    if (!referralCode) {
      referralCode = await this.generateUniqueCode();
      await this.usersService.update(userId, { referralCode });
    }

    const backendDomain = this.configService.get<string>('app.backendDomain') || 'http://localhost:3000';
    const shareLink = `${backendDomain}/r/${referralCode}`;

    const stats = await this.referralRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(r.rewardAmount), 0)', 'totalRewards')
      .where('r.referrerId = :userId', { userId })
      .groupBy('r.status')
      .getRawMany();

    const statMap: Record<string, { count: number; totalRewards: number }> = {};
    for (const row of stats) {
      statMap[row.status] = {
        count: parseInt(row.count, 10),
        totalRewards: parseFloat(row.totalRewards),
      };
    }

    return {
      referralCode,
      shareLink,
      stats: {
        totalInvites: Object.values(statMap).reduce((sum, s) => sum + s.count, 0),
        registered: statMap[ReferralStatus.REGISTERED]?.count || 0,
        qualified: statMap[ReferralStatus.QUALIFIED]?.count || 0,
        rewarded: statMap[ReferralStatus.REWARDED]?.count || 0,
        totalEarnings: statMap[ReferralStatus.REWARDED]?.totalRewards || 0,
      },
    };
  }

  async getMyReferrals(
    userId: string,
    query: QueryMyReferralsDto,
  ): Promise<PaginatedResponseDto<Referral>> {
    const qb = this.referralRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.referredUser', 'referredUser')
      .where('r.referrerId = :userId', { userId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async createInvite(
    userId: string,
    dto: CreateReferralDto,
  ): Promise<Referral> {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Ensure the user has a referral code
    let referralCode = user.referralCode;
    if (!referralCode) {
      referralCode = await this.generateUniqueCode();
      await this.usersService.update(userId, { referralCode });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90);

    const referral = this.referralRepository.create({
      referrerId: userId,
      referralCode,
      referredEmail: dto.referredEmail || null,
      referredPhone: dto.referredPhone || null,
      status: ReferralStatus.PENDING,
      expiresAt,
    });

    return this.referralRepository.save(referral);
  }

  // ─── Admin Methods ────────────────────────────────────────

  async findAll(
    query: QueryReferralsDto,
  ): Promise<PaginatedResponseDto<Referral>> {
    const qb = this.referralRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.referrer', 'referrer')
      .leftJoinAndSelect('r.referredUser', 'referredUser');

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    if (query.referrerId) {
      qb.andWhere('r.referrerId = :referrerId', {
        referrerId: query.referrerId,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('r.createdAt >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('r.createdAt <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.search) {
      qb.andWhere(
        '(referrer.firstName ILIKE :search OR referrer.lastName ILIKE :search OR referrer.email ILIKE :search OR r.referralCode ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('r.createdAt', 'DESC');
    qb.skip(query.skip);
    qb.take(query.limit);

    const [data, total] = await qb.getManyAndCount();

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getStats() {
    const result = await this.referralRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(r.rewardAmount), 0)', 'totalRewards')
      .groupBy('r.status')
      .getRawMany();

    const statMap: Record<string, { count: number; totalRewards: number }> = {};
    for (const row of result) {
      statMap[row.status] = {
        count: parseInt(row.count, 10),
        totalRewards: parseFloat(row.totalRewards),
      };
    }

    const totalReferrals = Object.values(statMap).reduce(
      (sum, s) => sum + s.count,
      0,
    );

    return {
      totalReferrals,
      pending: statMap[ReferralStatus.PENDING]?.count || 0,
      registered: statMap[ReferralStatus.REGISTERED]?.count || 0,
      qualified: statMap[ReferralStatus.QUALIFIED]?.count || 0,
      rewarded: statMap[ReferralStatus.REWARDED]?.count || 0,
      expired: statMap[ReferralStatus.EXPIRED]?.count || 0,
      totalRewardsPaid: statMap[ReferralStatus.REWARDED]?.totalRewards || 0,
    };
  }

  async findById(id: string): Promise<Referral> {
    const referral = await this.referralRepository.findOne({
      where: { id },
      relations: ['referrer', 'referredUser'],
    });

    if (!referral) {
      throw new NotFoundException('Referral not found');
    }

    return referral;
  }

  async updateStatus(
    id: string,
    dto: UpdateReferralStatusDto,
  ): Promise<Referral> {
    const referral = await this.findById(id);

    this.validateStatusTransition(referral.status, dto.status);

    if (dto.status === ReferralStatus.REWARDED) {
      if (dto.rewardAmount == null) {
        throw new BadRequestException(
          'rewardAmount is required when setting status to REWARDED',
        );
      }
      referral.rewardAmount = dto.rewardAmount;
      referral.rewardCreditedAt = new Date();
    }

    referral.status = dto.status;

    const saved = await this.referralRepository.save(referral);

    // Notify the referrer about the status change
    try {
      const statusMessages: Partial<Record<ReferralStatus, string>> = {
        [ReferralStatus.REGISTERED]: 'Your referral has registered!',
        [ReferralStatus.QUALIFIED]: 'Your referral has been qualified!',
        [ReferralStatus.REWARDED]: `Your referral reward of €${dto.rewardAmount} has been credited!`,
        [ReferralStatus.EXPIRED]: 'A referral has expired.',
      };
      const body = statusMessages[dto.status];
      if (body) {
        await this.notificationsService.sendNotification({
          userId: referral.referrerId,
          title: 'Referral Update',
          body,
          type: NotificationType.REFERRAL_STATUS,
          data: { referralId: referral.id, status: dto.status },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Failed to send referral notification: ${error?.message || error}`,
      );
    }

    return saved;
  }

  // ─── Registration Hook ────────────────────────────────────

  async processReferralCode(
    referralCode: string,
    referredUserId: string,
    referredEmail: string,
  ): Promise<void> {
    const now = new Date();

    // First, try to find a targeted pending invite matching code + email
    let referral = await this.referralRepository
      .createQueryBuilder('r')
      .where('r.referralCode = :code', { code: referralCode })
      .andWhere('r.referredEmail = :email', { email: referredEmail })
      .andWhere('r.status = :status', { status: ReferralStatus.PENDING })
      .andWhere('(r.expiresAt IS NULL OR r.expiresAt > :now)', { now })
      .getOne();

    // If no targeted invite, find any generic pending invite with this code
    if (!referral) {
      referral = await this.referralRepository
        .createQueryBuilder('r')
        .where('r.referralCode = :code', { code: referralCode })
        .andWhere('r.referredEmail IS NULL')
        .andWhere('r.status = :status', { status: ReferralStatus.PENDING })
        .andWhere('(r.expiresAt IS NULL OR r.expiresAt > :now)', { now })
        .getOne();
    }

    if (referral) {
      // Update existing referral
      referral.referredUserId = referredUserId;
      referral.referredEmail = referredEmail;
      referral.status = ReferralStatus.REGISTERED;
      await this.referralRepository.save(referral);
      return;
    }

    // No existing referral found — check if the code belongs to a user
    const referrer = await this.usersService.findByReferralCode(referralCode);
    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    // Create a new referral record
    const newReferral = this.referralRepository.create({
      referrerId: referrer.id,
      referralCode,
      referredEmail,
      referredUserId,
      status: ReferralStatus.REGISTERED,
    });
    await this.referralRepository.save(newReferral);
  }

  // ─── Scheduled Tasks ───────────────────────────────────────

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireStaleReferrals(): Promise<void> {
    const result = await this.referralRepository
      .createQueryBuilder()
      .update(Referral)
      .set({ status: ReferralStatus.EXPIRED })
      .where('status = :status', { status: ReferralStatus.PENDING })
      .andWhere('expiresAt IS NOT NULL')
      .andWhere('expiresAt <= :now', { now: new Date() })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Expired ${result.affected} stale referral(s)`);
    }
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async generateUniqueCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      const existing = await this.referralRepository.findOne({
        where: { referralCode: code },
      });
      if (!existing) {
        return code;
      }
    }

    throw new BadRequestException(
      'Failed to generate unique referral code. Please try again.',
    );
  }

  private validateStatusTransition(
    currentStatus: ReferralStatus,
    newStatus: ReferralStatus,
  ): void {
    const validTransitions: Record<ReferralStatus, ReferralStatus[]> = {
      [ReferralStatus.PENDING]: [
        ReferralStatus.REGISTERED,
        ReferralStatus.EXPIRED,
      ],
      [ReferralStatus.REGISTERED]: [
        ReferralStatus.QUALIFIED,
        ReferralStatus.EXPIRED,
      ],
      [ReferralStatus.QUALIFIED]: [
        ReferralStatus.REWARDED,
        ReferralStatus.EXPIRED,
      ],
      [ReferralStatus.REWARDED]: [],
      [ReferralStatus.EXPIRED]: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${currentStatus} to ${newStatus}`,
      );
    }
  }
}
