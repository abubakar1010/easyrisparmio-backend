import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReferralStatus } from '../../../common/enums/referral.enum';

export class QueryReferralsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReferralStatus, description: 'Filter by referral status' })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;

  @ApiPropertyOptional({ description: 'Filter by referrer user ID' })
  @IsOptional()
  @IsUUID()
  referrerId?: string;

  @ApiPropertyOptional({ description: 'Filter by start date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Filter by end date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
