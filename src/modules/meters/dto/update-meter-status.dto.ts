import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MeterStatus } from '../../../common/enums/utility.enum';

export class UpdateMeterStatusDto {
  @ApiProperty({
    enum: MeterStatus,
    description: 'New meter status. Valid transitions: PENDING→ACTIVE/TERMINATED, ACTIVE→INACTIVE/TERMINATED, INACTIVE→ACTIVE/TERMINATED. TERMINATED is terminal.',
    example: MeterStatus.ACTIVE,
  })
  @IsEnum(MeterStatus)
  status: MeterStatus;
}
