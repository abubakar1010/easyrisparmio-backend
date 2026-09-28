import { PartialType } from '@nestjs/swagger';
import { CreateSupplierFaqDto } from './create-supplier-faq.dto';

export class UpdateSupplierFaqDto extends PartialType(CreateSupplierFaqDto) {}
