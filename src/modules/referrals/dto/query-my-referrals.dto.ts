import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { ReferralStatus } from '../../../common/enums/referral.enum';

export class QueryMyReferralsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ReferralStatus, description: 'Filter by referral status' })
  @IsOptional()
  @IsEnum(ReferralStatus)
  status?: ReferralStatus;
}
