import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../../common/enums/role.enum';
import { UserStatus, AuthProvider } from '../../../common/enums/user.enum';

// ── User object (passwordHash excluded) ──

export class UserProfileDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id: string;

  @ApiProperty({ example: 'mario.rossi@email.com' })
  email: string;

  @ApiProperty({ example: 'Mario' })
  firstName: string;

  @ApiProperty({ example: 'Rossi' })
  lastName: string;

  @ApiPropertyOptional({ example: '+393331234567' })
  phone: string;

  @ApiPropertyOptional({ example: null })
  codiceFiscale: string;

  @ApiPropertyOptional({ example: null })
  avatar: string;

  @ApiProperty({ enum: AuthProvider, example: AuthProvider.LOCAL })
  authProvider: AuthProvider;

  @ApiPropertyOptional({ example: null })
  firebaseUid: string | null;

  @ApiProperty({ enum: UserRole, example: UserRole.PERSONAL })
  role: UserRole;

  @ApiProperty({ enum: UserStatus, example: UserStatus.ACTIVE })
  status: UserStatus;

  @ApiProperty({ example: true })
  emailVerified: boolean;

  @ApiProperty({ example: false })
  phoneVerified: boolean;

  @ApiPropertyOptional({ example: '2026-06-09T12:00:00.000Z' })
  lastLoginAt: Date | null;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-06-09T10:00:00.000Z' })
  updatedAt: Date;
}

// ── Register response ──

export class RegisterDataDto {
  @ApiProperty({ example: 'Registration successful. Please verify your email.' })
  message: string;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}

export class RegisterResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: RegisterDataDto })
  data: RegisterDataDto;
}

// ── Login / Social Login response ──

export class LoginDataDto {
  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJlbWFpbCI6Im1hcmlvLnJvc3NpQGVtYWlsLmNvbSIsInJvbGUiOiJwZXJzb25hbCJ9.signature' })
  accessToken: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  refreshToken: string;
}

export class LoginResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: LoginDataDto })
  data: LoginDataDto;
}

// ── Token refresh response ──

export class TokenDataDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhMWIyYzNkNCIsImVtYWlsIjoibWFyaW8ucm9zc2lAZW1haWwuY29tIiwicm9sZSI6InBlcnNvbmFsIn0.new_signature' })
  accessToken: string;

  @ApiProperty({ example: '660f9500-f3ab-52e5-b827-557766551111' })
  refreshToken: string;
}

export class TokenResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: TokenDataDto })
  data: TokenDataDto;
}

// ── Message-only responses ──

export class MessageDataDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: MessageDataDto })
  data: MessageDataDto;
}

// ── Profile response ──

export class ProfileResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ type: UserProfileDto })
  data: UserProfileDto;
}

// ── Error responses ──

export class ErrorResponseDto {
  @ApiProperty({ example: false })
  success: boolean;

  @ApiProperty({ example: 400 })
  statusCode: number;

  @ApiProperty({ example: ['Error message'], type: [String] })
  message: string[];

  @ApiProperty({ example: '2026-06-09T12:00:00.000Z' })
  timestamp: string;
}
