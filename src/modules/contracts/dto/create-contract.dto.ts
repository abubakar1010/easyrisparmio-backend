import { IsUUID, IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ContractDeliveryMethod } from '../../../common/enums/contract.enum';

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
}
