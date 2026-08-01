import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminResetPasswordDto {
  @ApiProperty({
    description: 'New password for the user (minimum 8 characters)',
    example: 'NewSecure123!',
    minLength: 8,
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
