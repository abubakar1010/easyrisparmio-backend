import { IsUUID, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
