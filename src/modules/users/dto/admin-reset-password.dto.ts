import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class AdminResetPasswordDto {
  @ApiProperty({
    description:
      'New password for the user (min 8 chars, must include uppercase, ' +
      'lowercase, number and special character — the same rule the account ' +
      'holder is held to when they change it themselves)',
    example: 'NewSecure123!',
    minLength: 8,
  })
  @IsString()
  @IsStrongPassword()
  newPassword: string;
}
