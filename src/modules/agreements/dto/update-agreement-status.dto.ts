import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAgreementStatusDto {
  @ApiProperty({
    description: 'Set agreement active (visible to users) or inactive (hidden)',
    example: true,
  })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;
}
