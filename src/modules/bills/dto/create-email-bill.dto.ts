import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { BillType } from '../../../common/enums/bill.enum';

export class CreateEmailBillDto {
  @ApiProperty({
    enum: BillType,
    description: 'Type of energy bill being sent via email',
    example: BillType.ELECTRICITY,
  })
  @IsEnum(BillType)
  billType: BillType;
}
