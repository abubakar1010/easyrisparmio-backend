import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiInternalServerErrorResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, RegisterBusinessDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import {
  RegisterResponseDto,
  LoginResponseDto,
  TokenResponseDto,
  MessageResponseDto,
  ProfileResponseDto,
  ErrorResponseDto,
} from './dto/auth-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ─── Registration ─────────────────────────────────────────

  @Post('register')
  @ApiOperation({
    summary: 'Register a new personal user',
    description:
      'Creates a personal user account. After registration the user receives a 6-digit OTP ' +
      'for email verification. The account status is `pending_verification` until the OTP is verified. ' +
      'Admin role cannot be used for registration.',
  })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({
    description: 'User registered successfully. OTP sent for email verification.',
    type: RegisterResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'Registration successful. Please verify your email.',
            user: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              email: 'mario.rossi@email.com',
              firstName: 'Mario',
              lastName: 'Rossi',
              phone: '+393331234567',
              role: 'personal',
              status: 'pending_verification',
              authProvider: 'local',
              firebaseUid: null,
              emailVerified: false,
              phoneVerified: false,
              createdAt: '2026-06-09T10:00:00.000Z',
              updatedAt: '2026-06-09T10:00:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or admin role attempted',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        examples: {
          validation_error: {
            summary: 'Validation error',
            value: {
              success: false,
              statusCode: 400,
              message: [
                'email must be an email',
                'password must be longer than or equal to 8 characters',
              ],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          admin_role: {
            summary: 'Admin registration blocked',
            value: {
              success: false,
              statusCode: 400,
              message: ['Cannot register as admin'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Email already registered',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['Email already registered'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('register/business')
  @ApiOperation({
    summary: 'Register a new business user',
    description:
      'Creates a business user account with company profile (Partita IVA, PEC, etc.). ' +
      'After registration the user receives a 6-digit OTP for email verification.',
  })
  @ApiBody({ type: RegisterBusinessDto })
  @ApiCreatedResponse({
    description: 'Business user registered successfully. OTP sent for email verification.',
    type: RegisterResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'Registration successful. Please verify your email.',
            user: {
              id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
              email: 'info@rossi-srl.it',
              firstName: 'Mario',
              lastName: 'Rossi',
              phone: '+393331234567',
              role: 'business',
              status: 'pending_verification',
              authProvider: 'local',
              firebaseUid: null,
              emailVerified: false,
              phoneVerified: false,
              createdAt: '2026-06-09T10:00:00.000Z',
              updatedAt: '2026-06-09T10:00:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: [
            'Partita IVA must be exactly 11 digits',
            'companyName should not be empty',
          ],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Email already registered',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['Email already registered'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  async registerBusiness(@Body() dto: RegisterBusinessDto) {
    return this.authService.register(dto);
  }

  // ─── Login ────────────────────────────────────────────────

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('local'))
  @ApiOperation({
    summary: 'Login with email and password',
    description:
      'Authenticates with email and password. Returns JWT access token (15 min) ' +
      'and a UUID refresh token (7 days). Login is blocked for unverified and suspended accounts.',
  })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({
    description: 'Login successful. Returns user profile and token pair.',
    type: LoginResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            user: {
              id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
              email: 'mario.rossi@email.com',
              firstName: 'Mario',
              lastName: 'Rossi',
              phone: '+393331234567',
              role: 'personal',
              status: 'active',
              authProvider: 'local',
              firebaseUid: null,
              emailVerified: true,
              phoneVerified: false,
              lastLoginAt: '2026-06-09T12:00:00.000Z',
              createdAt: '2026-06-01T10:00:00.000Z',
              updatedAt: '2026-06-09T12:00:00.000Z',
            },
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: '550e8400-e29b-41d4-a716-446655440000',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Invalid credentials, unverified email, or suspended account',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        examples: {
          invalid_credentials: {
            summary: 'Invalid email or password',
            value: {
              success: false,
              statusCode: 401,
              message: ['Unauthorized'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          pending_verification: {
            summary: 'Email not verified',
            value: {
              success: false,
              statusCode: 401,
              message: ['Please verify your email before logging in'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          suspended: {
            summary: 'Account suspended',
            value: {
              success: false,
              statusCode: 401,
              message: ['Your account has been suspended'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  async login(@Body() _dto: LoginDto, @CurrentUser() user: User) {
    return this.authService.login(user);
  }

  // ─── Social Login ─────────────────────────────────────────

  @Post('social-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Login or register via social provider (Google, Facebook, Apple)',
    description:
      'Authenticates using a Firebase ID token obtained from the mobile app after ' +
      'social sign-in (Google, Facebook, or Apple). If the user does not exist, a new account ' +
      'is created with `role: personal` and `status: active`. If an account with the same email ' +
      'already exists, the Firebase UID is linked to the existing account.',
  })
  @ApiBody({ type: SocialLoginDto })
  @ApiOkResponse({
    description: 'Social login successful. Returns user profile and token pair.',
    type: LoginResponseDto,
    content: {
      'application/json': {
        examples: {
          new_user: {
            summary: 'New user created via Google',
            value: {
              success: true,
              data: {
                user: {
                  id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
                  email: 'mario.rossi@gmail.com',
                  firstName: 'Mario',
                  lastName: 'Rossi',
                  phone: null,
                  role: 'personal',
                  status: 'active',
                  authProvider: 'google',
                  firebaseUid: 'firebase-uid-abc123',
                  emailVerified: true,
                  phoneVerified: false,
                  avatar: 'https://lh3.googleusercontent.com/a/photo',
                  lastLoginAt: '2026-06-09T12:00:00.000Z',
                  createdAt: '2026-06-09T12:00:00.000Z',
                  updatedAt: '2026-06-09T12:00:00.000Z',
                },
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: '660f9500-f3ab-52e5-b827-557766551111',
              },
            },
          },
          existing_user_linked: {
            summary: 'Existing local user linked via Facebook',
            value: {
              success: true,
              data: {
                user: {
                  id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                  email: 'mario.rossi@email.com',
                  firstName: 'Mario',
                  lastName: 'Rossi',
                  phone: '+393331234567',
                  role: 'personal',
                  status: 'active',
                  authProvider: 'local',
                  firebaseUid: 'firebase-uid-xyz789',
                  emailVerified: true,
                  phoneVerified: false,
                  avatar: null,
                  lastLoginAt: '2026-06-09T12:00:00.000Z',
                  createdAt: '2026-06-01T10:00:00.000Z',
                  updatedAt: '2026-06-09T12:00:00.000Z',
                },
                accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
                refreshToken: '770a0601-a4bc-63f6-c938-668877662222',
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid Firebase token or missing email',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        examples: {
          no_email: {
            summary: 'Social account has no email',
            value: {
              success: false,
              statusCode: 400,
              message: ['Email is required. Please ensure your social account has a verified email.'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          invalid_token: {
            summary: 'Invalid or expired Firebase ID token',
            value: {
              success: false,
              statusCode: 400,
              message: ['Firebase ID token has expired. Get a fresh token and try again.'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Account is suspended',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Your account has been suspended'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Firebase is not configured on the server',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 500,
          message: ['Firebase is not configured'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  async socialLogin(@Body() dto: SocialLoginDto) {
    return this.authService.socialLogin(dto.idToken);
  }

  // ─── OTP Verification ─────────────────────────────────────

  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify OTP code (email verification, phone verification, password reset)',
    description:
      'Verifies a 6-digit OTP code. For `email_verification`, activates the user account ' +
      '(sets `emailVerified: true` and `status: active`). For `phone_verification`, ' +
      'sets `phoneVerified: true`. OTP codes expire after 10 minutes and are single-use.',
  })
  @ApiBody({ type: VerifyOtpDto })
  @ApiOkResponse({
    description: 'OTP verified successfully',
    type: MessageResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'OTP verified successfully',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired OTP, or user not found',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        examples: {
          invalid_otp: {
            summary: 'Invalid or expired OTP code',
            value: {
              success: false,
              statusCode: 400,
              message: ['Invalid or expired OTP code'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          user_not_found: {
            summary: 'User not found',
            value: {
              success: false,
              statusCode: 400,
              message: ['User not found'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  async verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto);
  }

  // ─── Password Reset ───────────────────────────────────────

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request password reset OTP',
    description:
      'Sends a 6-digit OTP to the user\'s email for password reset. ' +
      'Always returns the same response regardless of whether the email exists (prevents user enumeration).',
  })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({
    description: 'Password reset OTP sent (or not, response is always the same)',
    type: MessageResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'If the email is registered, a password reset code has been sent',
          },
        },
      },
    },
  })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using OTP code',
    description:
      'Resets the user\'s password using a valid OTP code from `forgot-password`. ' +
      'After a successful reset, all existing refresh tokens for the user are revoked for security.',
  })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({
    description: 'Password reset successfully. All refresh tokens revoked.',
    type: MessageResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            message: 'Password reset successfully',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Invalid OTP or user not found',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        examples: {
          invalid_otp: {
            summary: 'Invalid or expired OTP code',
            value: {
              success: false,
              statusCode: 400,
              message: ['Invalid or expired OTP code'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
          invalid_request: {
            summary: 'User not found',
            value: {
              success: false,
              statusCode: 400,
              message: ['Invalid request'],
              timestamp: '2026-06-09T12:00:00.000Z',
            },
          },
        },
      },
    },
  })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // ─── Token Management ─────────────────────────────────────

  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token using refresh token',
    description:
      'Exchanges a valid refresh token for a new access token and refresh token pair. ' +
      'The old refresh token is revoked (token rotation). ' +
      'Refresh tokens expire after 7 days and can only be used once.',
  })
  @ApiBody({ type: RefreshTokenDto })
  @ApiOkResponse({
    description: 'New token pair issued. Old refresh token revoked.',
    type: TokenResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            refreshToken: '770a0601-a4bc-63f6-c938-668877662222',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Refresh token is invalid, expired, or already revoked',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Invalid or expired refresh token'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  async refreshToken(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshToken(dto.refreshToken);
  }

  // ─── Profile ──────────────────────────────────────────────

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current authenticated user profile',
    description:
      'Returns the profile of the authenticated user. Requires a valid JWT access token ' +
      'in the Authorization header. The `passwordHash` field is never included.',
  })
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    type: ProfileResponseDto,
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            firstName: 'Mario',
            lastName: 'Rossi',
            phone: '+393331234567',
            codiceFiscale: null,
            avatar: null,
            role: 'personal',
            status: 'active',
            authProvider: 'local',
            firebaseUid: null,
            emailVerified: true,
            phoneVerified: false,
            lastLoginAt: '2026-06-09T12:00:00.000Z',
            createdAt: '2026-06-01T10:00:00.000Z',
            updatedAt: '2026-06-09T12:00:00.000Z',
            businessProfile: null,
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    type: ErrorResponseDto,
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-09T12:00:00.000Z',
        },
      },
    },
  })
  async getMe(@CurrentUser() user: User) {
    return this.authService.getProfile(user.id);
  }
}
