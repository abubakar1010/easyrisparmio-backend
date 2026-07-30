import { PartialType, OmitType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password'] as const),
) {
  @ApiPropertyOptional({ example: '/uploads/avatar-uuid.jpg', description: 'Avatar image URL' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatar?: string;
}
