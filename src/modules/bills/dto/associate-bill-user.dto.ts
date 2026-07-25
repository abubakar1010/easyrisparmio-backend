import { IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AssociateBillUserDto {
  @ApiProperty({
    description: 'ID of the user to associate the bill with',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({
    description: 'ID of the user\'s existing pending email bill to merge into',
    example: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  pendingBillId?: string;
}
