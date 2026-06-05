import { IsString, IsNotEmpty, IsOptional, IsInt, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFaqDto {
  @ApiProperty({ description: 'FAQ category' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @ApiProperty({ description: 'FAQ question' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  question: string;

  @ApiProperty({ description: 'FAQ answer' })
  @IsString()
  @IsNotEmpty()
  answer: string;

  @ApiPropertyOptional({ description: 'Sort order', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
