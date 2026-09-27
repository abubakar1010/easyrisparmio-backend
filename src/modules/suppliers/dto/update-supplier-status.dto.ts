import { IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  ADMIN_SETTABLE_SUPPLIER_STATUSES,
  SupplierStatus,
} from '../../../common/enums/supplier.enum';

export class UpdateSupplierStatusDto {
  @ApiProperty({
    description:
      'Activate or deactivate the supplier. pending_deletion is only reachable through DELETE.',
    enum: ADMIN_SETTABLE_SUPPLIER_STATUSES,
    example: SupplierStatus.ACTIVE,
  })
  @IsIn(ADMIN_SETTABLE_SUPPLIER_STATUSES, {
    message: 'Status must be one of: active, inactive',
  })
  status: SupplierStatus.ACTIVE | SupplierStatus.INACTIVE;
}
