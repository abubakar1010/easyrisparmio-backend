import {
  IsOptional,
  IsEnum,
  IsString,
  IsDateString,
  IsNumber,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ContractStatus } from '../../../common/enums/contract.enum';

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
}
