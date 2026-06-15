import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { UploadBillDto } from './dto/upload-bill.dto';
import { QueryBillsDto } from './dto/query-bills.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { BillStatus } from '../../common/enums/bill.enum';
import { MarketType } from '../../common/enums/offer.enum';

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(EnergyBill)
    private readonly billRepository: Repository<EnergyBill>,
    @InjectRepository(BillAnalysis)
    private readonly analysisRepository: Repository<BillAnalysis>,
  ) {}

  async uploadBill(
    userId: string,
    fileUrl: string,
    dto: UploadBillDto,
  ): Promise<EnergyBill> {
    const bill = this.billRepository.create({
      userId,
      fileUrl,
      billType: dto.billType,
      podNumber: dto.podNumber,
      pdrNumber: dto.pdrNumber,
      status: BillStatus.UPLOADED,
    });

    return this.billRepository.save(bill);
  }

  async getUserBills(
    userId: string,
    query: QueryBillsDto,
  ): Promise<PaginatedResponseDto<EnergyBill>> {
    const qb = this.billRepository
      .createQueryBuilder('bill')
      .leftJoinAndSelect('bill.supplier', 'supplier')
      .where('bill.user_id = :userId', { userId });

    if (query.billType) {
      qb.andWhere('bill.bill_type = :billType', { billType: query.billType });
    }

    if (query.status) {
      qb.andWhere('bill.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('bill.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('bill.created_at <= :dateTo', { dateTo: query.dateTo });
    }

    qb.orderBy('bill.created_at', 'DESC')
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
      .leftJoinAndSelect('bill.user', 'user');

    if (query.billType) {
      qb.andWhere('bill.bill_type = :billType', { billType: query.billType });
    }

    if (query.status) {
      qb.andWhere('bill.status = :status', { status: query.status });
    }

    if (query.dateFrom) {
      qb.andWhere('bill.created_at >= :dateFrom', { dateFrom: query.dateFrom });
    }

    if (query.dateTo) {
      qb.andWhere('bill.created_at <= :dateTo', { dateTo: query.dateTo });
    }

    if (query.search) {
      qb.andWhere(
        '(user.email ILIKE :search OR user.first_name ILIKE :search OR user.last_name ILIKE :search OR bill.pod_number ILIKE :search OR bill.pdr_number ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    qb.orderBy('bill.created_at', 'DESC')
      .skip(query.skip)
      .take(query.limit);

    const [bills, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(bills, total, query.page, query.limit);
  }

  async getBillByIdAdmin(billId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'analysis', 'user'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    return bill;
  }

  async getBillById(billId: string, userId: string): Promise<EnergyBill> {
    const bill = await this.billRepository.findOne({
      where: { id: billId },
      relations: ['supplier', 'analysis'],
    });

    if (!bill) {
      throw new NotFoundException('Bill not found');
    }

    if (bill.userId !== userId) {
      throw new ForbiddenException('You do not have access to this bill');
    }

    return bill;
  }

  async analyzeBill(billId: string, userId: string): Promise<BillAnalysis> {
    const bill = await this.getBillById(billId, userId);

    // Update bill status to ANALYZING
    bill.status = BillStatus.ANALYZING;
    await this.billRepository.save(bill);

    try {
      // Stub analysis: generate mock analysis data
      const totalAmount = Number(bill.totalAmount) || 120;
      const potentialSavings = +(totalAmount * 0.15).toFixed(2);
      const currentMonthlyAvg = +(totalAmount * 0.95).toFixed(2);

      // Check if analysis already exists
      let analysis = await this.analysisRepository.findOne({
        where: { billId },
      });

      if (analysis) {
        analysis.potentialSavings = potentialSavings;
        analysis.currentMonthlyAvg = currentMonthlyAvg;
        analysis.recommendedMarketType = MarketType.FIXED;
        analysis.analysisSummary = `Based on your ${bill.billType} bill analysis, you could save approximately EUR ${potentialSavings} per billing period by switching to a fixed-rate plan.`;
        analysis.analysisDetails = {
          currentCostPerUnit: bill.costPerUnit,
          averageMarketRate: 0.08,
          consumptionPattern: 'standard',
          recommendedActions: [
            'Consider switching to a fixed-rate contract',
            'Review your consumption during peak hours',
            'Compare offers from alternative suppliers',
          ],
        };
      } else {
        analysis = this.analysisRepository.create({
          billId,
          potentialSavings,
          currentMonthlyAvg,
          recommendedMarketType: MarketType.FIXED,
          analysisSummary: `Based on your ${bill.billType} bill analysis, you could save approximately EUR ${potentialSavings} per billing period by switching to a fixed-rate plan.`,
          analysisDetails: {
            currentCostPerUnit: bill.costPerUnit,
            averageMarketRate: 0.08,
            consumptionPattern: 'standard',
            recommendedActions: [
              'Consider switching to a fixed-rate contract',
              'Review your consumption during peak hours',
              'Compare offers from alternative suppliers',
            ],
          },
        });
      }

      await this.analysisRepository.save(analysis);

      // Update bill status to ANALYZED
      bill.status = BillStatus.ANALYZED;
      await this.billRepository.save(bill);

      return analysis;
    } catch (error) {
      bill.status = BillStatus.ERROR;
      await this.billRepository.save(bill);
      throw error;
    }
  }

  async getBillAnalysis(
    billId: string,
    userId: string,
  ): Promise<BillAnalysis> {
    // Verify ownership
    await this.getBillById(billId, userId);

    const analysis = await this.analysisRepository.findOne({
      where: { billId },
      relations: ['bill'],
    });

    if (!analysis) {
      throw new NotFoundException(
        'Analysis not found. Please trigger analysis first.',
      );
    }

    return analysis;
  }
}
