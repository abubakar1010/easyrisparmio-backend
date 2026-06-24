import {
  Controller,
  Get,
  Patch,
  Delete,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiConflictResponse,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { QueryUsersDto } from './dto/query-users.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums/role.enum';
import { User } from './entities/user.entity';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ─── User Endpoints (named routes first) ──────────────────

  @Get('profile')
  @ApiOperation({
    summary: 'Get own user profile',
    description:
      'Returns the authenticated user\'s full profile including role, status, verification flags, and referral code. ' +
      'Available to all authenticated roles (personal, business, admin). The password hash is never included in the response.',
  })
  @ApiOkResponse({
    description: 'User profile retrieved successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            phone: '+393331234567',
            firstName: 'Mario',
            lastName: 'Rossi',
            codiceFiscale: 'RSSMRA85M01H501Z',
            avatar: null,
            authProvider: 'local',
            firebaseUid: null,
            referralCode: 'MARIO2025',
            role: 'personal',
            status: 'active',
            emailVerified: true,
            phoneVerified: false,
            lastLoginAt: '2026-06-20T08:30:00.000Z',
            deletedAt: null,
            createdAt: '2026-01-15T10:00:00.000Z',
            updatedAt: '2026-06-20T08:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 401,
          message: ['Unauthorized'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  async getProfile(@CurrentUser() user: User) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser) return null;
    const { passwordHash: _, ...result } = fullUser;
    return result;
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update own user profile',
    description:
      'Updates the authenticated user\'s profile fields. All fields are optional. ' +
      'Users cannot change their own role or status. The password field is not accepted (use auth endpoints for password changes).',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({
    description: 'Profile updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            phone: '+393339876543',
            firstName: 'Mario',
            lastName: 'Rossi',
            codiceFiscale: 'RSSMRA85M01H501Z',
            avatar: null,
            authProvider: 'local',
            firebaseUid: null,
            referralCode: 'MARIO2025',
            role: 'personal',
            status: 'active',
            emailVerified: true,
            phoneVerified: false,
            lastLoginAt: '2026-06-20T08:30:00.000Z',
            deletedAt: null,
            createdAt: '2026-01-15T10:00:00.000Z',
            updatedAt: '2026-06-24T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['email must be an email', 'Invalid Codice Fiscale format'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async updateProfile(
    @CurrentUser() user: User,
    @Body() dto: UpdateUserDto,
  ) {
    const updated = await this.usersService.updateProfile(user.id, dto);
    const { passwordHash: _, ...result } = updated;
    return result;
  }

  // ─── Admin Endpoints ──────────────────────────────────────

  @Get()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'List all users (admin only, paginated)',
    description:
      'Returns a paginated list of all users. Supports filtering by role, status, and text search (name, email). ' +
      'Results include user details without password hashes. Soft-deleted users are excluded.',
  })
  @ApiOkResponse({
    description: 'Paginated list of users',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [
              {
                id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
                email: 'mario.rossi@email.com',
                phone: '+393331234567',
                firstName: 'Mario',
                lastName: 'Rossi',
                codiceFiscale: 'RSSMRA85M01H501Z',
                role: 'personal',
                status: 'active',
                emailVerified: true,
                phoneVerified: false,
                lastLoginAt: '2026-06-20T08:30:00.000Z',
                createdAt: '2026-01-15T10:00:00.000Z',
              },
              {
                id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
                email: 'giulia.bianchi@azienda.it',
                phone: '+393487654321',
                firstName: 'Giulia',
                lastName: 'Bianchi',
                codiceFiscale: null,
                role: 'business',
                status: 'active',
                emailVerified: true,
                phoneVerified: true,
                lastLoginAt: '2026-06-22T14:15:00.000Z',
                createdAt: '2026-03-10T09:00:00.000Z',
              },
            ],
            meta: { total: 2, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async findAll(@Query() query: QueryUsersDto) {
    return this.usersService.findAll(query);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Create a new user (admin only)',
    description:
      'Creates a new user account with the specified role (personal or business). ' +
      'The email must be unique. For business users, business profile fields (companyName, partitaIva, etc.) can be provided. ' +
      'The admin can optionally set the initial status; defaults to pending_verification.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiCreatedResponse({
    description: 'User created successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
            email: 'luigi.verdi@email.com',
            phone: '+393201234567',
            firstName: 'Luigi',
            lastName: 'Verdi',
            codiceFiscale: 'VRDLGU90A01F205X',
            avatar: null,
            authProvider: 'local',
            firebaseUid: null,
            referralCode: null,
            role: 'personal',
            status: 'pending_verification',
            emailVerified: false,
            phoneVerified: false,
            lastLoginAt: null,
            deletedAt: null,
            createdAt: '2026-06-24T12:00:00.000Z',
            updatedAt: '2026-06-24T12:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['email must be an email', 'password must be longer than or equal to 8 characters', 'role must be a valid enum value'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiConflictResponse({
    description: 'Email already in use',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 409,
          message: ['A user with this email already exists'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.adminCreateUser(dto);
    const { passwordHash: _, ...result } = user;
    return result;
  }

  @Get(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Get user by ID (admin only)',
    description:
      'Returns a single user\'s full profile by UUID. Includes all fields except the password hash. ' +
      'Returns 404 if the user does not exist or has been soft-deleted.',
  })
  @ApiOkResponse({
    description: 'User details',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            phone: '+393331234567',
            firstName: 'Mario',
            lastName: 'Rossi',
            codiceFiscale: 'RSSMRA85M01H501Z',
            avatar: null,
            authProvider: 'local',
            firebaseUid: null,
            referralCode: 'MARIO2025',
            role: 'personal',
            status: 'active',
            emailVerified: true,
            phoneVerified: false,
            lastLoginAt: '2026-06-20T08:30:00.000Z',
            deletedAt: null,
            createdAt: '2026-01-15T10:00:00.000Z',
            updatedAt: '2026-06-20T08:30:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['User not found'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.findById(id);
    if (!user) {
      return null;
    }
    const { passwordHash: _, ...result } = user;
    return result;
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Update user by ID (admin only)',
    description:
      'Updates a user\'s profile fields by UUID. All fields are optional. ' +
      'Admins can update role, status, and all profile fields. The password field is excluded from updates.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({
    description: 'User updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            phone: '+393331234567',
            firstName: 'Mario',
            lastName: 'Rossi',
            codiceFiscale: 'RSSMRA85M01H501Z',
            avatar: null,
            authProvider: 'local',
            firebaseUid: null,
            referralCode: 'MARIO2025',
            role: 'personal',
            status: 'active',
            emailVerified: true,
            phoneVerified: false,
            lastLoginAt: '2026-06-20T08:30:00.000Z',
            deletedAt: null,
            createdAt: '2026-01-15T10:00:00.000Z',
            updatedAt: '2026-06-24T14:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ['email must be an email', 'Invalid Codice Fiscale format'],
          timestamp: '2026-06-24T12:00:00.000Z',
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['User not found'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiConflictResponse({
    description: 'Email already in use by another user',
    content: { 'application/json': { example: { success: false, statusCode: 409, message: ['A user with this email already exists'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.adminUpdateUser(id, dto);
    const { passwordHash: _, ...result } = user;
    return result;
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Soft-delete user by ID (admin only)',
    description:
      'Soft-deletes a user by setting the `deleted_at` timestamp. The user is excluded from all queries but preserved in the database. ' +
      'This action can be reversed by an admin by clearing the deleted_at field.',
  })
  @ApiOkResponse({
    description: 'User soft-deleted successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            email: 'mario.rossi@email.com',
            firstName: 'Mario',
            lastName: 'Rossi',
            role: 'personal',
            status: 'active',
            deletedAt: '2026-06-24T15:00:00.000Z',
            createdAt: '2026-01-15T10:00:00.000Z',
            updatedAt: '2026-06-24T15:00:00.000Z',
          },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'User not found',
    content: { 'application/json': { example: { success: false, statusCode: 404, message: ['User not found'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: { success: false, statusCode: 401, message: ['Unauthorized'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: { success: false, statusCode: 403, message: ['Forbidden resource'], timestamp: '2026-06-24T12:00:00.000Z' } } },
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.usersService.softDelete(id);
    const { passwordHash: _, ...result } = user;
    return result;
  }
}
