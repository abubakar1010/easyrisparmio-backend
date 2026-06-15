import { IsUUID, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCaseDto {
  @ApiProperty({ description: 'ID of the energy bill for this switch case', example: 'bl1a2b3c-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  billId: string;

  @ApiProperty({ description: 'ID of the selected offer', example: 'o1a2b3c4-d5e6-7890-abcd-ef1234567890' })
  @IsNotEmpty()
  @IsUUID()
  selectedOfferId: string;
}
