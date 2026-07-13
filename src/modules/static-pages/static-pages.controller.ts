import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
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
  ApiBody,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { StaticPagesService } from './static-pages.service';
import { CreateStaticPageDto } from './dto/create-static-page.dto';
import { UpdateStaticPageDto } from './dto/update-static-page.dto';
import { QueryStaticPagesDto } from './dto/query-static-pages.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/role.enum';

const PAGE_EXAMPLE = {
  id: 'sp1a2b3c-d4e5-6789-abcd-ef0123456789',
  slug: 'privacy-policy',
  title: 'Informativa sulla Privacy',
  content: '<h2>Privacy Policy</h2><p>Your privacy is important to us...</p>',
  locale: 'it',
  isActive: true,
  createdAt: '2026-06-10T10:00:00.000Z',
  updatedAt: '2026-06-10T10:00:00.000Z',
};

const ERROR_401 = {
  success: false,
  statusCode: 401,
  message: ['Unauthorized'],
  timestamp: '2026-06-10T12:00:00.000Z',
};

const ERROR_403 = {
  success: false,
  statusCode: 403,
  message: ['Forbidden resource'],
  timestamp: '2026-06-10T12:00:00.000Z',
};

@ApiTags('Static Pages')
@Controller('static-pages')
export class StaticPagesController {
  constructor(private readonly staticPagesService: StaticPagesService) {}

  // ─── Admin Endpoints ────────────────────────────────────────

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get all static pages with pagination (admin)',
    description:
      'Returns all static pages (active and inactive) with pagination, search, and filtering.',
  })
  @ApiOkResponse({
    description: 'Paginated list of all static pages',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            data: [PAGE_EXAMPLE],
            meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
          },
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  getAdminPages(@Query() query: QueryStaticPagesDto) {
    return this.staticPagesService.getAdminPages(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Create a new static page (admin)',
    description:
      'Creates a new static page. Each slug + locale combination must be unique.',
  })
  @ApiBody({ type: CreateStaticPageDto })
  @ApiCreatedResponse({
    description: 'Static page created successfully',
    content: { 'application/json': { example: { success: true, data: PAGE_EXAMPLE } } },
  })
  @ApiBadRequestResponse({
    description: 'Validation failed or duplicate slug+locale',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 400,
          message: ["A page with slug 'privacy-policy' already exists for locale 'it'"],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  createPage(@Body() dto: CreateStaticPageDto) {
    return this.staticPagesService.createPage(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update a static page (admin)',
    description: 'Updates static page fields. All fields are optional.',
  })
  @ApiBody({ type: UpdateStaticPageDto })
  @ApiOkResponse({
    description: 'Static page updated successfully',
    content: {
      'application/json': {
        example: {
          success: true,
          data: { ...PAGE_EXAMPLE, updatedAt: '2026-06-10T14:00:00.000Z' },
        },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Static page not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Static page not found'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaticPageDto,
  ) {
    return this.staticPagesService.updatePage(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Delete a static page (admin)',
    description: 'Permanently deletes a static page from the database.',
  })
  @ApiOkResponse({
    description: 'Static page deleted successfully',
    content: {
      'application/json': {
        example: { success: true, data: { message: 'Static page deleted successfully' } },
      },
    },
  })
  @ApiNotFoundResponse({
    description: 'Static page not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ['Static page not found'],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT access token',
    content: { 'application/json': { example: ERROR_401 } },
  })
  @ApiForbiddenResponse({
    description: 'User does not have admin role',
    content: { 'application/json': { example: ERROR_403 } },
  })
  async deletePage(@Param('id', ParseUUIDPipe) id: string) {
    await this.staticPagesService.deletePage(id);
    return { message: 'Static page deleted successfully' };
  }

  // ─── Public Endpoint ────────────────────────────────────────

  @Get(':slug')
  @ApiOperation({
    summary: 'Get a static page by slug (public)',
    description:
      'Returns an active static page by its slug. No authentication required. ' +
      'Falls back to Italian locale if the requested locale is not found.',
  })
  @ApiParam({ name: 'slug', description: 'Page slug', example: 'privacy-policy' })
  @ApiQuery({ name: 'locale', required: false, description: 'Language locale (defaults to it)', example: 'it' })
  @ApiOkResponse({
    description: 'Static page content',
    content: { 'application/json': { example: { success: true, data: PAGE_EXAMPLE } } },
  })
  @ApiNotFoundResponse({
    description: 'Page not found',
    content: {
      'application/json': {
        example: {
          success: false,
          statusCode: 404,
          message: ["Page 'unknown-slug' not found"],
          timestamp: '2026-06-10T12:00:00.000Z',
        },
      },
    },
  })
  getPageBySlug(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ) {
    return this.staticPagesService.getPageBySlug(slug, locale);
  }
}
