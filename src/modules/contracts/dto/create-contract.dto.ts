import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractDeliveryMethod } from '../../../common/enums/contract.enum';
import { ContractDocumentItemDto } from './add-contract-documents.dto';

export class CreateContractDto {
  @ApiProperty({ description: 'ID of the switch case' })
  @IsNotEmpty()
  @IsUUID()
  caseId: string;

  @ApiPropertyOptional({ description: 'POD/PDR number' })
  @IsOptional()
  @IsString()
  podPdrNumber?: string;

  @ApiProperty({ description: 'Unique contract number' })
  @IsNotEmpty()
  @IsString()
  contractNumber: string;

  @ApiPropertyOptional({ enum: ContractDeliveryMethod, description: 'How the contract is delivered to the user' })
  @IsOptional()
  @IsEnum(ContractDeliveryMethod)
  deliveryMethod?: ContractDeliveryMethod;

  @ApiPropertyOptional({ description: 'URL of the unsigned contract document' })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional({
    description:
      'Contract documents to attach while creating. Upload the files first via ' +
      'POST /api/v1/upload, then pass the returned metadata here. They are stored ' +
      'before the customer is notified, so the contract is never announced empty.',
    type: [ContractDocumentItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContractDocumentItemDto)
  documents?: ContractDocumentItemDto[];
}
