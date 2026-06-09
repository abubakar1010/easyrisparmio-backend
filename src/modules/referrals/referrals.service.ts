import {
  Injectable,
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

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(Referral)
    private readonly referralRepository: Repository<Referral>,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
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

    const frontendUrl = this.configService.get<string>('app.frontendUrl') || 'http://localhost:3001';
    const shareLink = `${frontendUrl}/register?ref=${referralCode}`;

    const stats = await this.referralRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(r.reward_amount), 0)', 'totalRewards')
      .where('r.referrer_id = :userId', { userId })
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
      .where('r.referrer_id = :userId', { userId });

    if (query.status) {
      qb.andWhere('r.status = :status', { status: query.status });
    }

    qb.orderBy('r.created_at', 'DESC');
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
      qb.andWhere('r.referrer_id = :referrerId', {
        referrerId: query.referrerId,
      });
    }

    if (query.dateFrom) {
      qb.andWhere('r.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('r.created_at <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.search) {
      qb.andWhere(
        '(referrer.first_name ILIKE :search OR referrer.last_name ILIKE :search OR referrer.email ILIKE :search OR r.referral_code ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('r.created_at', 'DESC');
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
      .addSelect('COALESCE(SUM(r.reward_amount), 0)', 'totalRewards')
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

    return this.referralRepository.save(referral);
  }

  // ─── Registration Hook ────────────────────────────────────

  async processReferralCode(
    referralCode: string,
    referredUserId: string,
    referredEmail: string,
  ): Promise<void> {
    // First, try to find a targeted pending invite matching code + email
    let referral = await this.referralRepository.findOne({
      where: {
        referralCode,
        referredEmail,
        status: ReferralStatus.PENDING,
      },
    });

    // If no targeted invite, find any generic pending invite with this code
    if (!referral) {
      referral = await this.referralRepository.findOne({
        where: {
          referralCode,
          status: ReferralStatus.PENDING,
          referredEmail: undefined, // generic invite (no specific email)
        },
      });
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
