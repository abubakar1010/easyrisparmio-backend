import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierFaqDto {
  @ApiProperty({ description: 'FAQ question', example: 'How do I read my Enel bill?', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @ApiProperty({ description: 'FAQ answer', example: 'Your consumption is on page 2, under "Dettaglio consumi".' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiPropertyOptional({ description: 'Display order (lower = shown first)', example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether the FAQ is shown to customers', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
