import { IsString, IsNotEmpty, IsOptional, IsInt, IsBoolean, IsEnum, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserTarget } from '../../../common/enums/offer.enum';

export class CreateFaqDto {
  @ApiProperty({ description: 'FAQ category', example: 'billing', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @ApiProperty({ description: 'FAQ question', example: 'How does the switching process work?', maxLength: 500 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @ApiProperty({ description: 'FAQ answer', example: 'The switching process takes 2-4 weeks. We handle all paperwork with your new supplier and ensure no service interruption.' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiPropertyOptional({ description: 'Display order (lower = shown first)', example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Locale code', example: 'it', default: 'it', maxLength: 5 })
  @IsOptional()
  @IsString()
  @MaxLength(5)
  locale?: string;

  @ApiPropertyOptional({ enum: UserTarget, description: 'Target audience', example: UserTarget.BOTH, default: UserTarget.BOTH })
  @IsOptional()
  @IsEnum(UserTarget)
  targetAudience?: UserTarget;

  @ApiPropertyOptional({ description: 'Whether the FAQ is active', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
