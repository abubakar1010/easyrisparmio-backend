import { IsUUID, IsArray, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReorderOffersDto {
  @ApiProperty({
    type: [String],
    description:
      'The offers already sent for this bill, in the order the customer will see them. ' +
      'The first ID is the offer shown first in the app.',
    example: [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'b2c3d4e5-f6a7-8901-bcde-f23456789012',
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('all', { each: true })
  offerIds: string[];
}
