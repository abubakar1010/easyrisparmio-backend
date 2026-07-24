import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus, ContractDeliveryMethod } from '../../../common/enums/contract.enum';

export class UpdateContractDto {
  @ApiPropertyOptional({ enum: ContractStatus, description: 'Contract status' })
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;

  @ApiPropertyOptional({ description: 'Activation date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  activationDate?: string;

  @ApiPropertyOptional({ description: 'Expiry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({ description: 'URL of the signed document' })
  @IsOptional()
  @IsString()
  signedDocumentUrl?: string;

  @ApiPropertyOptional({ description: 'Estimated monthly cost' })
  @IsOptional()
  @IsNumber()
  monthlyEstimate?: number;

  @ApiPropertyOptional({ enum: ContractDeliveryMethod, description: 'How the contract is delivered to the user' })
  @IsOptional()
  @IsEnum(ContractDeliveryMethod)
  deliveryMethod?: ContractDeliveryMethod;

  @ApiPropertyOptional({ description: 'URL of the unsigned contract document' })
  @IsOptional()
  @IsString()
  documentUrl?: string;

  @ApiPropertyOptional({ description: 'Estimated savings for this contract (EUR)' })
  @IsOptional()
  @IsNumber()
  estimatedSavings?: number;
}
