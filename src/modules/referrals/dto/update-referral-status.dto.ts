import { IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReferralStatus } from '../../../common/enums/referral.enum';

export class UpdateReferralStatusDto {
  @ApiProperty({
    enum: ReferralStatus,
    description: 'New status for the referral',
    example: ReferralStatus.QUALIFIED,
  })
  @IsEnum(ReferralStatus)
  status: ReferralStatus;

  @ApiPropertyOptional({
    description: 'Reward amount in EUR (required when setting status to REWARDED)',
    example: 10.0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  rewardAmount?: number;
}
